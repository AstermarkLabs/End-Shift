import { Router, type IRouter } from "express";
import { db, usersTable, rolesTable, passkeyCredentialsTable, type User, type Role } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import {
  CreateProfileBody,
  UpdateProfileBody,
  UpdateMeBody,
} from "@workspace/api-zod";
import { hashPassword, verifyPassword } from "../lib/auth";
import {
  blockIfMustChangePassword,
  requireAnyRight,
  requireAuth,
  requireRight,
} from "../middlewares/auth";

const router: IRouter = Router();

// Apply must-change-password gate after authentication for every route in this
// router.  /me GET and /me PUT are explicitly allowed by the middleware.
router.use(requireAuth, blockIfMustChangePassword);

/**
 * Returns true when `callerRole` is permitted to assign `targetRole` to
 * another account (or to itself).
 *
 * Two conditions must both hold:
 *  1. The target role's level must not exceed the caller's level.
 *  2. The target role must not carry any rights that the caller does not
 *     already possess — this prevents lateral escalation into a same-level
 *     role that happens to hold more powerful rights.
 */
function callerCanAssignRole(
  callerRole: Pick<Role, "isSystem" | "level" | "rights">,
  targetRole: Pick<Role, "level" | "rights">,
): boolean {
  if (callerRole.isSystem) return true;
  if (targetRole.level > callerRole.level) return false;
  const callerRights = new Set<string>(callerRole.rights);
  if (targetRole.rights.some((r) => !callerRights.has(r))) return false;
  return true;
}

export function profileFor(user: User, role: Role) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    roleId: user.roleId,
    role: {
      id: role.id,
      name: role.name,
      level: role.level,
      isSystem: role.isSystem,
      rights: role.rights,
    },
    mustChangePassword: user.mustChangePassword,
    isActive: user.isActive,
  };
}

async function loadProfile(id: number) {
  const rows = await db
    .select({ user: usersTable, role: rolesTable })
    .from(usersTable)
    .innerJoin(rolesTable, eq(usersTable.roleId, rolesTable.id))
    .where(eq(usersTable.id, id))
    .limit(1);
  return rows[0] ?? null;
}

router.get("/me", requireAuth, async (req, res) => {
  const u = req.user!;
  res.json(profileFor(u, u.role));
});

router.put("/me", requireAuth, async (req, res) => {
  const u = req.user!;
  const body = UpdateMeBody.parse(req.body);
  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (body.displayName) updates.displayName = body.displayName;
  if (body.newPassword) {
    if (!u.passwordHash || !body.currentPassword) {
      res.status(400).json({ error: "Current password required" });
      return;
    }
    const ok = await verifyPassword(body.currentPassword, u.passwordHash);
    if (!ok) {
      res.status(400).json({ error: "Current password incorrect" });
      return;
    }
    updates.passwordHash = await hashPassword(body.newPassword);
    updates.mustChangePassword = false;
  }
  updates.updatedAt = new Date();
  await db.update(usersTable).set(updates).where(eq(usersTable.id, u.id));
  const reloaded = await loadProfile(u.id);
  if (!reloaded) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(profileFor(reloaded.user, reloaded.role));
});

// Listing profiles is required by anyone administering users (manage_profiles)
// or assigning their roles (assign_roles) — without it, an assign-only user
// has no way to discover the target IDs they are entitled to act on.
router.get(
  "/",
  requireAnyRight("manage_profiles", "assign_roles"),
  async (_req, res) => {
    const rows = await db
      .select({ user: usersTable, role: rolesTable })
      .from(usersTable)
      .innerJoin(rolesTable, eq(usersTable.roleId, rolesTable.id));
    res.json(rows.map((r) => profileFor(r.user, r.role)));
  },
);

router.post(
  "/",
  requireAuth,
  requireRight("manage_profiles"),
  async (req, res) => {
    const u = req.user!;
    const body = CreateProfileBody.parse(req.body);
    const targetRole = await db
      .select()
      .from(rolesTable)
      .where(eq(rolesTable.id, body.roleId))
      .limit(1);
    if (targetRole.length === 0) {
      res.status(400).json({ error: "Invalid role" });
      return;
    }
    if (!callerCanAssignRole(u.role, targetRole[0])) {
      res.status(403).json({ error: "Cannot assign a role with rights or level exceeding your own" });
      return;
    }
    const passwordHash = await hashPassword(body.password);
    let created;
    try {
      [created] = await db
        .insert(usersTable)
        .values({
          username: body.username,
          displayName: body.displayName,
          passwordHash,
          roleId: body.roleId,
          mustChangePassword: body.mustChangePassword ?? true,
        })
        .returning();
    } catch (e) {
      res.status(409).json({ error: "Username already in use" });
      return;
    }
    res.status(201).json(profileFor(created, targetRole[0]));
  },
);

router.put("/:id", requireAuth, async (req, res) => {
  const u = req.user!;
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const body = UpdateProfileBody.parse(req.body);
  const target = await loadProfile(id);
  if (!target) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  // Permissions:
  //   - self may edit displayName/password
  //   - non-self profile field edits (username/displayName/password/isActive/
  //     mustChangePassword) require `manage_profiles`
  //   - non-self role changes require `assign_roles` (independent of
  //     `manage_profiles`)
  const isSelf = id === u.id;
  const wantsRoleChange =
    body.roleId !== undefined && body.roleId !== target.user.roleId;
  const wantsProfileFieldChange =
    body.username !== undefined ||
    body.displayName !== undefined ||
    body.password !== undefined ||
    body.isActive !== undefined ||
    body.mustChangePassword !== undefined;
  const hasManageProfiles = u.role.isSystem || u.role.rights.includes("manage_profiles");
  const hasAssignRoles = u.role.isSystem || u.role.rights.includes("assign_roles");
  if (!isSelf && wantsProfileFieldChange && !hasManageProfiles) {
    res.status(403).json({ error: "Missing right: manage_profiles" });
    return;
  }
  if (!isSelf && !wantsProfileFieldChange && !wantsRoleChange) {
    // Nothing to change and no rights asserted — keep behaviour predictable.
    if (!hasManageProfiles && !hasAssignRoles) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
  }
  // Hierarchy: cannot edit users at or above your own level (unless self).
  if (!isSelf && !u.role.isSystem && target.role.level >= u.role.level) {
    res.status(403).json({ error: "Cannot edit user at or above your level" });
    return;
  }
  if (wantsRoleChange) {
    if (!u.role.isSystem && !u.role.rights.includes("assign_roles")) {
      res.status(403).json({ error: "Missing right: assign_roles" });
      return;
    }
    const newRole = await db
      .select()
      .from(rolesTable)
      .where(eq(rolesTable.id, body.roleId!))
      .limit(1);
    if (newRole.length === 0) {
      res.status(400).json({ error: "Invalid role" });
      return;
    }
    if (!callerCanAssignRole(u.role, newRole[0])) {
      res.status(403).json({ error: "Cannot assign a role with rights or level exceeding your own" });
      return;
    }
  }
  // Self-service password changes must go through PUT /me, which requires
  // the current password for re-authentication.  Allowing password writes
  // here would let anyone with a live session token permanently take over
  // the account without ever knowing the original password.
  if (isSelf && body.password) {
    res.status(400).json({ error: "Use PUT /api/profiles/me to change your own password" });
    return;
  }
  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (body.username) updates.username = body.username;
  if (body.displayName) updates.displayName = body.displayName;
  if (body.roleId !== undefined) updates.roleId = body.roleId;
  if (body.isActive !== undefined) updates.isActive = body.isActive;
  if (body.mustChangePassword !== undefined)
    updates.mustChangePassword = body.mustChangePassword;
  if (body.password) updates.passwordHash = await hashPassword(body.password);
  updates.updatedAt = new Date();
  await db.update(usersTable).set(updates).where(eq(usersTable.id, id));
  const reloaded = await loadProfile(id);
  if (!reloaded) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(profileFor(reloaded.user, reloaded.role));
});

router.delete(
  "/:id",
  requireAuth,
  requireRight("manage_profiles"),
  async (req, res) => {
    const u = req.user!;
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    if (id === u.id) {
      res.status(400).json({ error: "Cannot delete yourself" });
      return;
    }
    const target = await loadProfile(id);
    if (!target) {
      res.status(404).end();
      return;
    }
    if (!u.role.isSystem && target.role.level >= u.role.level) {
      res.status(403).json({ error: "Cannot delete user at or above your level" });
      return;
    }
    await db.delete(usersTable).where(eq(usersTable.id, id));
    res.status(204).end();
  },
);

router.get("/:id/passkeys", requireAuth, async (req, res) => {
  const u = req.user!;
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  if (id !== u.id && !u.role.isSystem && !u.role.rights.includes("manage_profiles")) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const rows = await db
    .select()
    .from(passkeyCredentialsTable)
    .where(eq(passkeyCredentialsTable.userId, id));
  res.json(
    rows.map((c) => ({
      id: c.id,
      credentialId: c.credentialId,
      label: c.label,
      createdAt: c.createdAt.toISOString(),
      lastUsedAt: c.lastUsedAt ? c.lastUsedAt.toISOString() : null,
    })),
  );
});

router.delete("/:id/passkeys/:credentialId", requireAuth, async (req, res) => {
  const u = req.user!;
  const id = Number(req.params["id"]);
  const credentialIdRaw = req.params["credentialId"];
  const credentialId = Array.isArray(credentialIdRaw) ? credentialIdRaw[0] : credentialIdRaw;
  if (!Number.isFinite(id) || !credentialId) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }
  if (id !== u.id && !u.role.isSystem && !u.role.rights.includes("manage_profiles")) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  await db
    .delete(passkeyCredentialsTable)
    .where(
      and(
        eq(passkeyCredentialsTable.userId, id),
        eq(passkeyCredentialsTable.credentialId, credentialId),
      ),
    );
  res.status(204).end();
});

export default router;
