import { Router, type IRouter } from "express";
import { db, usersTable, rolesTable, passkeyCredentialsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  LoginBody,
  RefreshBody,
  PasskeyRegisterVerifyBody,
  PasskeyAuthOptionsBody,
  PasskeyAuthVerifyBody,
} from "@workspace/api-zod";
import {
  hashPassword,
  signAccessToken,
  signRefreshToken,
  verifyPassword,
  verifyRefreshToken,
} from "../lib/auth";
import {
  buildAuthenticationOptions,
  buildRegistrationOptions,
  base64UrlToBytes,
  bytesToBase64Url,
  verifyAuthentication,
  verifyRegistration,
} from "../lib/webauthn";
import { requireAuth } from "../middlewares/auth";
import { profileFor } from "./profiles";
import { consumeChallenge, rememberChallenge } from "../lib/passkey-challenges";

const router: IRouter = Router();

router.post("/login", async (req, res) => {
  const body = LoginBody.parse(req.body);
  const rows = await db
    .select({ user: usersTable, role: rolesTable })
    .from(usersTable)
    .innerJoin(rolesTable, eq(usersTable.roleId, rolesTable.id))
    .where(eq(usersTable.username, body.username))
    .limit(1);
  if (rows.length === 0) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const { user, role } = rows[0];
  if (!user.isActive || !user.passwordHash) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const ok = await verifyPassword(body.password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const accessToken = signAccessToken({ sub: user.id, username: user.username });
  const refreshToken = signRefreshToken({ sub: user.id });
  res.json({
    accessToken,
    refreshToken,
    profile: profileFor(user, role),
  });
});

router.post("/logout", (_req, res) => {
  res.status(204).end();
});

router.post("/refresh", async (req, res) => {
  const body = RefreshBody.parse(req.body);
  let payload;
  try {
    payload = verifyRefreshToken(body.refreshToken);
  } catch {
    res.status(401).json({ error: "Invalid refresh token" });
    return;
  }
  const rows = await db
    .select({ user: usersTable, role: rolesTable })
    .from(usersTable)
    .innerJoin(rolesTable, eq(usersTable.roleId, rolesTable.id))
    .where(eq(usersTable.id, payload.sub))
    .limit(1);
  if (rows.length === 0 || !rows[0].user.isActive) {
    res.status(401).json({ error: "Invalid session" });
    return;
  }
  const { user, role } = rows[0];
  const accessToken = signAccessToken({ sub: user.id, username: user.username });
  const refreshToken = signRefreshToken({ sub: user.id });
  res.json({ accessToken, refreshToken, profile: profileFor(user, role) });
});

// ── Passkey registration (requires auth) ────────────────────────────────────

router.post("/passkey/register-options", requireAuth, async (req, res) => {
  const u = req.user!;
  const existing = await db
    .select()
    .from(passkeyCredentialsTable)
    .where(eq(passkeyCredentialsTable.userId, u.id));
  const opts = await buildRegistrationOptions({
    userId: u.id,
    username: u.username,
    displayName: u.displayName,
    excludeCredentials: existing.map((c) => ({
      id: c.credentialId,
      transports: c.transports,
    })),
  });
  await db
    .update(usersTable)
    .set({ currentChallenge: opts.challenge })
    .where(eq(usersTable.id, u.id));
  res.json(opts);
});

router.post("/passkey/register-verify", requireAuth, async (req, res) => {
  const u = req.user!;
  const body = PasskeyRegisterVerifyBody.parse(req.body);
  if (!u.currentChallenge) {
    res.status(400).json({ error: "No active registration challenge" });
    return;
  }
  let verification;
  try {
    verification = await verifyRegistration({
      response: body.response as never,
      expectedChallenge: u.currentChallenge,
    });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
    return;
  }
  if (!verification.verified || !verification.registrationInfo) {
    res.status(400).json({ error: "Verification failed" });
    return;
  }
  const info = verification.registrationInfo;
  const credentialId = info.credential.id;
  const publicKey = bytesToBase64Url(info.credential.publicKey);
  const counter = info.credential.counter;
  const transports =
    (body.response as { response?: { transports?: string[] } }).response
      ?.transports ?? [];
  const [created] = await db
    .insert(passkeyCredentialsTable)
    .values({
      userId: u.id,
      credentialId,
      publicKey,
      counter,
      transports,
      label: body.label ?? null,
    })
    .returning();
  await db
    .update(usersTable)
    .set({ currentChallenge: null })
    .where(eq(usersTable.id, u.id));
  res.json({
    id: created.id,
    credentialId: created.credentialId,
    label: created.label,
    createdAt: created.createdAt.toISOString(),
    lastUsedAt: created.lastUsedAt ? created.lastUsedAt.toISOString() : null,
  });
});

// ── Passkey authentication (no auth required) ──────────────────────────────

router.post("/passkey/auth-options", async (req, res) => {
  const body = PasskeyAuthOptionsBody.parse(req.body ?? {});
  let allowCredentials: Array<{ id: string; transports?: string[] }> = [];
  if (body.username) {
    const userRow = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, body.username))
      .limit(1);
    if (userRow.length > 0) {
      const creds = await db
        .select()
        .from(passkeyCredentialsTable)
        .where(eq(passkeyCredentialsTable.userId, userRow[0].id));
      allowCredentials = creds.map((c) => ({
        id: c.credentialId,
        transports: c.transports,
      }));
    }
  }
  const opts = await buildAuthenticationOptions({ allowCredentials });
  if (body.username) {
    // Bind challenge to the named user so a stolen challenge can't be reused
    // against another account.
    await db
      .update(usersTable)
      .set({ currentChallenge: opts.challenge })
      .where(eq(usersTable.username, body.username));
  } else {
    // Usernameless / discoverable-credential flow: keep a short-lived,
    // single-use record of the issued challenge so verify can validate it
    // regardless of which user the resident credential resolves to.
    rememberChallenge(opts.challenge);
  }
  res.json(opts);
});

function decodeChallengeFromAssertion(
  response: unknown,
): string | null {
  const r = response as { response?: { clientDataJSON?: string } };
  const cdj = r?.response?.clientDataJSON;
  if (typeof cdj !== "string") return null;
  try {
    const json = JSON.parse(Buffer.from(cdj, "base64url").toString("utf-8"));
    return typeof json?.challenge === "string" ? json.challenge : null;
  } catch {
    return null;
  }
}

router.post("/passkey/auth-verify", async (req, res) => {
  const body = PasskeyAuthVerifyBody.parse(req.body);
  const credentialId = (body.response as { id?: string }).id;
  if (!credentialId) {
    res.status(400).json({ error: "Missing credential id" });
    return;
  }
  const credRows = await db
    .select()
    .from(passkeyCredentialsTable)
    .where(eq(passkeyCredentialsTable.credentialId, credentialId))
    .limit(1);
  if (credRows.length === 0) {
    res.status(401).json({ error: "Unknown credential" });
    return;
  }
  const cred = credRows[0];
  const userRows = await db
    .select({ user: usersTable, role: rolesTable })
    .from(usersTable)
    .innerJoin(rolesTable, eq(usersTable.roleId, rolesTable.id))
    .where(eq(usersTable.id, cred.userId))
    .limit(1);
  if (userRows.length === 0 || !userRows[0].user.isActive) {
    res.status(401).json({ error: "Invalid session" });
    return;
  }
  const { user, role } = userRows[0];

  // The challenge in the assertion's clientDataJSON is the source of truth for
  // what the client signed.  Accept it if it matches either:
  //   (a) the challenge we stored on the user (named flow), or
  //   (b) a challenge we recently issued for the usernameless flow.
  const assertedChallenge = decodeChallengeFromAssertion(body.response);
  if (!assertedChallenge) {
    res.status(400).json({ error: "Malformed assertion" });
    return;
  }
  let expectedChallenge: string | null = null;
  if (user.currentChallenge && user.currentChallenge === assertedChallenge) {
    expectedChallenge = user.currentChallenge;
  } else if (consumeChallenge(assertedChallenge)) {
    expectedChallenge = assertedChallenge;
  }
  if (!expectedChallenge) {
    res.status(400).json({ error: "No active authentication challenge" });
    return;
  }
  let verification;
  try {
    verification = await verifyAuthentication({
      response: body.response as never,
      expectedChallenge,
      credentialPublicKey: base64UrlToBytes(cred.publicKey),
      credentialID: cred.credentialId,
      counter: cred.counter,
    });
  } catch (e) {
    res.status(401).json({ error: (e as Error).message });
    return;
  }
  if (!verification.verified) {
    res.status(401).json({ error: "Verification failed" });
    return;
  }
  await db
    .update(passkeyCredentialsTable)
    .set({
      counter: verification.authenticationInfo.newCounter,
      lastUsedAt: new Date(),
    })
    .where(eq(passkeyCredentialsTable.id, cred.id));
  await db
    .update(usersTable)
    .set({ currentChallenge: null })
    .where(eq(usersTable.id, user.id));
  const accessToken = signAccessToken({ sub: user.id, username: user.username });
  const refreshToken = signRefreshToken({ sub: user.id });
  res.json({ accessToken, refreshToken, profile: profileFor(user, role) });
});

export default router;
