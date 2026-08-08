import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from "crypto";

// ─── Field-level encryption at rest ────────────────────────────────────────────
// Encrypts personal-information fields (email, displayName) before they hit
// the DB, so a raw DB/backup/disk read never sees plaintext. The app server
// itself still holds the key and decrypts on every legitimate read (admin
// panels, own-profile reads, WebAuthn ceremonies) — this is NOT end-to-end
// encryption (see HANDOFF-e2ee.md for why that model was rejected: it would
// break admin user management, which nothing in this request asked to
// remove). Threat model: protects against DB/backup exfiltration, not a
// compromised API server.
//
// Blob format: "v<N>:" + base64(iv[12] || authTag[16] || ciphertext), where
// N is the AES key version that encrypted it. Every row carries its own
// version tag, so a partially-rotated table (some rows still v1, some
// already v2) decrypts correctly regardless of mix — decryptField picks the
// key by the blob's own tag, not by whatever's currently "active".
//
// Key rotation: bump FIELD_ENCRYPTION_ACTIVE_KEY_VERSION and add the
// corresponding FIELD_ENCRYPTION_KEY_V{N} env var; new writes use the new
// version immediately, old rows keep decrypting under their original
// version's key until rotated forward by scripts/rotateFieldEncryptionKey.ts.
// Never remove an old FIELD_ENCRYPTION_KEY_V{N} until every row has been
// rotated off it (the rotate script's summary reports remaining counts).
//
// The email blind index (hashForLookup) intentionally does NOT rotate with
// the AES key — it uses its own separate, stable secret
// (FIELD_INDEX_KEY). Rotating the AES encryption key must never change
// emailHash values (that would require a coordinated rewrite of every row's
// index alongside every other row's, which defeats incremental rotation).
// If FIELD_INDEX_KEY itself is ever compromised and needs to change, that's
// a distinct, harder operation (requires recomputing every emailHash in one
// pass) — not supported by this module; would need new tooling if needed.

const BLOB_PREFIX_RE = /^v(\d+):(.*)$/s;
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

// Same fail-closed convention as JWT_ACCESS_SECRET/JWT_REFRESH_SECRET in
// lib/auth.ts: production must have an explicit, sufficiently-long secret —
// a deterministic fallback in prod would let anyone who knows the
// derivation decrypt every row / forge lookups. `fallbackEnvVar` lets
// FIELD_ENCRYPTION_KEY_V1 alias the pre-rotation FIELD_ENCRYPTION_KEY name
// (both are still length-checked, not accepted blindly).
function getRequiredSecret(envVar: string, fallbackEnvVar?: string): string {
  const v = process.env[envVar];
  if (v && v.length >= 16) return v;
  if (fallbackEnvVar) {
    const fallback = process.env[fallbackEnvVar];
    if (fallback && fallback.length >= 16) return fallback;
  }
  if (process.env["NODE_ENV"] === "production") {
    const names = fallbackEnvVar ? `${envVar} (or ${fallbackEnvVar})` : envVar;
    throw new Error(
      `Refusing to start: ${names} is required in production and must be at least 16 characters.`,
    );
  }
  // Dev-only deterministic fallback so local development works without
  // setup. Keyed by fallbackEnvVar when given, NOT envVar — for the v1/
  // FIELD_ENCRYPTION_KEY alias this must stay "FIELD_ENCRYPTION_KEY" (the
  // pre-rotation name) so already-encrypted local rows keep decrypting
  // under the same derived dev key after this rotation support was added.
  return `dev-${fallbackEnvVar ?? envVar}-${process.env["DATABASE_URL"] ?? "local"}`;
}

/** Which AES key version new encryptions use. Explicit, not "highest env var
 * present" — an auto-detected version is a footgun: a stale
 * FIELD_ENCRYPTION_KEY_V2 left in one environment would silently change
 * which key writes data there. Defaults to 1 (no rotation performed yet). */
export function getActiveKeyVersion(): number {
  const raw = process.env["FIELD_ENCRYPTION_ACTIVE_KEY_VERSION"];
  if (!raw) return 1;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(
      `Invalid FIELD_ENCRYPTION_ACTIVE_KEY_VERSION: ${raw} (must be a positive integer)`,
    );
  }
  return n;
}

// v1 predates key-version env vars — FIELD_ENCRYPTION_KEY_V1 falls back to
// the original FIELD_ENCRYPTION_KEY name so already-deployed rows/config
// keep working untouched after this rotation support was added.
function getAesSecretForVersion(version: number): string {
  if (version === 1) {
    return getRequiredSecret("FIELD_ENCRYPTION_KEY_V1", "FIELD_ENCRYPTION_KEY");
  }
  return getRequiredSecret(`FIELD_ENCRYPTION_KEY_V${version}`);
}

function deriveAesKey(secret: string): Buffer {
  return createHash("sha256").update(`fieldcrypto:aes:${secret}`).digest();
}

function deriveIndexKey(): Buffer {
  const secret = getRequiredSecret("FIELD_INDEX_KEY");
  return createHash("sha256").update(`fieldcrypto:index:${secret}`).digest();
}

/** Encrypt a plaintext string for storage, using the active AES key version.
 * Non-deterministic (random IV) — two calls with the same input produce
 * different blobs. Never use this output for equality lookups; use
 * hashForLookup for that. */
export function encryptField(plaintext: string): string {
  const version = getActiveKeyVersion();
  const key = deriveAesKey(getAesSecretForVersion(version));
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  const packed = Buffer.concat([iv, authTag, ciphertext]);
  return `v${version}:${packed.toString("base64")}`;
}

/** Decrypt a blob produced by encryptField, using whichever AES key version
 * is embedded in the blob itself (not the currently-active version — a
 * row's own tag always wins, so mixed-version tables decrypt correctly
 * mid-rotation). Throws if the blob is malformed, the corresponding key is
 * unavailable, or the ciphertext was tampered with (GCM auth tag check
 * fails). */
export function decryptField(blob: string): string {
  const match = BLOB_PREFIX_RE.exec(blob);
  if (!match) {
    throw new Error("decryptField: unrecognized blob format (missing version prefix)");
  }
  const version = Number(match[1]);
  const packed = Buffer.from(match[2]!, "base64");
  if (packed.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("decryptField: blob too short to contain iv + authTag");
  }
  const iv = packed.subarray(0, IV_LENGTH);
  const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = packed.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const key = deriveAesKey(getAesSecretForVersion(version));
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

/** Which AES key version encrypted this blob, or null if the value isn't a
 * recognized encryptField blob at all. Used by the rotate script to find
 * rows still on an old version. */
export function blobKeyVersion(value: string): number | null {
  const match = BLOB_PREFIX_RE.exec(value);
  if (!match) return null;
  try {
    const packed = Buffer.from(match[2]!, "base64");
    if (packed.length < IV_LENGTH + AUTH_TAG_LENGTH) return null;
    return Number(match[1]);
  } catch {
    return null;
  }
}

/** True if the given stored value is already an encryptField blob (used by
 * the backfill script to skip already-migrated rows, and safe to call on
 * legacy plaintext values — plaintext will simply never match the "v<N>:"
 * + valid-base64 shape in practice, but the caller should treat this as a
 * heuristic, not a security boundary). */
export function isEncryptedFieldBlob(value: string): boolean {
  return blobKeyVersion(value) !== null;
}

/** Deterministic blind-index hash for equality lookups (e.g. duplicate-email
 * detection) on a field that's otherwise stored as non-deterministic
 * ciphertext. Uses FIELD_INDEX_KEY — a separate, stable secret from the AES
 * encryption key(s) — so rotating the AES key never changes existing
 * emailHash values. Callers MUST normalize the input the same way every
 * time (this module does not normalize) so the same logical value always
 * hashes identically — e.g. trim + lowercase for email. */
export function hashForLookup(normalizedValue: string): string {
  const key = deriveIndexKey();
  return createHmac("sha256", key).update(normalizedValue, "utf8").digest("base64");
}
