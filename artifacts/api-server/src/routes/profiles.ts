import { Router, type IRouter } from "express";
import {
  db,
  usersTable,
  rolesTable,
  orgUnitsTable,
  passkeyCredentialsTable,
  type User,
  type Role,
  type OrgUnit,
} from "@workspace/db";
import { and, eq, inArray, isNull } from "drizzle-orm";
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
import { visibleOrgUnitIds, orgUnitSubtreeIds } from "../lib/tenant-scope";

const router: IRouter = Router();

router.use(requireAuth, blockIfMustChangePassword);

/**
 * Returns true when `callerRole` is permitted to assign `targetRole`.
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

export function profileFor(
  user: User,
  role: Role,
  orgUnit: OrgUnit | null | undefined,
) {
  return {
    id: user.id,
    tenantId: user.tenantId ?? null,
    orgUnitId: user.orgUnitId ?? null,
    orgUnit: orgUnit
      ? {
          id: orgUnit.id,
          tenantId: orgUnit.tenantId,
          parentId: orgUnit.parentId ?? null,
          name: orgUnit.name,
          type: orgUnit.type,
          createdAt: orgUnit.createdAt.toISOString(),
        }
      : null,
    username: user.username,
    email: user.email ?? null,
    displayName: user.displayName,
    roleId: user.roleId,
    role: {
      id: role.id,
      tenantId: role.tenantId ?? null,
      name: role.name,
      level: role.level,
      isSystem: role.isSystem,
      rights: role.rights,
    },
    mustChangePassword: user.mustChangePassword,
    isActive: user.isActive,
  };
}

type ProfileRow = {
  user: User;
  role: Role;
  orgUnit: OrgUnit | null;
};

async function loadProfile(id: number): Promise<ProfileRow | null> {
  const rows = await db
    .select({ user: usersTable, role: rolesTable, orgUnit: orgUnitsTable })
    .from(usersTable)
    .innerJoin(rolesTable, eq(usersTable.roleId, rolesTable.id))
    .leftJoin(orgUnitsTable, eq(usersTable.orgUnitId, orgUnitsTable.id))
    .where(eq(usersTable.id, id))
    .limit(1);
  if (!rows[0]) return null;
  const row = rows[0];
  return {
    user: row.user,
    role: row.role,
    // Drizzle returns orgUnit columns as null when left join finds no match.
    // Detect this via the primary key.
    orgUnit: row.orgUnit?.id !== null && row.orgUnit?.id !== undefined ? (row.orgUnit as OrgUnit) : null,
  };
}

router.get("/me", requireAuth, async (req, res) => {
  const u = req.user!;
  const row = await loadProfile(u.id);
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(profileFor(row.user, row.role, row.orgUnit));
});

router.put("/me", requireAuth, async (req, res) => {
  const u = req.user!;
  const body = UpdateMeBody.parse(req.body);
  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (body.displayName) updates.displayName = body.displayName;
  if ("email" in body) {
    const newEmail = body.email ?? null;
    if (newEmail !== null) {
      const existing = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.email, newEmail))
        .limit(1);
      if (existing.length > 0 && existing[0]!.id !== u.id) {
        res.status(409).json({ error: "Email already in use" });
        return;
      }
    }
    updates.email = newEmail;
  }
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
  res.json(profileFor(reloaded.user, reloaded.role, reloaded.orgUnit));
});

// ── List profiles ─────────────────────────────────────────────────────────────
// Results are scoped to the caller's tenant and, if the caller is assigned to
// an org unit, further limited to users within that org unit's subtree.

router.get(
  "/",
  requireAnyRight("manage_profiles", "assign_roles"),
  async (req, res) => {
    const u = req.user!;

    // System Admin sees everyone globally.
    if (u.role.isSystem) {
      const rows = await db
        .select({ user: usersTable, role: rolesTable, orgUnit: orgUnitsTable })
        .from(usersTable)
        .innerJoin(rolesTable, eq(usersTable.roleId, rolesTable.id))
        .leftJoin(orgUnitsTable, eq(usersTable.orgUnitId, orgUnitsTable.id));
      res.json(
        rows.map((r) =>
          profileFor(
            r.user,
            r.role,
            r.orgUnit?.id !== null && r.orgUnit?.id !== undefined ? (r.orgUnit as OrgUnit) : null,
          ),
        ),
      );
      return;
    }

    if (!u.tenantId) {
      res.json([]);
      return;
    }

    const subtreeIds = await visibleOrgUnitIds(u);
    const conditions = [eq(usersTable.tenantId, u.tenantId)];

    if (subtreeIds !== null) {
      // Caller is org-scoped: show users in their subtree OR with no org unit
      // assignment but only within the same tenant.  Practically, org-scoped
      // users should only see users in their own subtree.
      conditions.push(inArray(usersTable.orgUnitId, subtreeIds));
    }

    const rows = await db
      .select({ user: usersTable, role: rolesTable, orgUnit: orgUnitsTable })
      .from(usersTable)
      .innerJoin(rolesTable, eq(usersTable.roleId, rolesTable.id))
      .leftJoin(orgUnitsTable, eq(usersTable.orgUnitId, orgUnitsTable.id))
      .where(and(...conditions));

    res.json(
      rows.map((r) =>
        profileFor(
          r.user,
          r.role,
          r.orgUnit?.id !== null && r.orgUnit?.id !== undefined ? (r.orgUnit as OrgUnit) : null,
        ),
      ),
    );
  },
);

// ── Create profile ────────────────────────────────────────────────────────────

router.post(
  "/",
  requireAuth,
  requireRight("manage_profiles"),
  async (req, res) => {
    const u = req.user!;
    const body = CreateProfileBody.parse(req.body);

    // System Admins are not bound to a tenant; other callers must have one.
    if (!u.role.isSystem && !u.tenantId) {
      res.status(403).json({ error: "No tenant associated with your account" });
      return;
    }

    const targetRole = await db
      .select()
      .from(rolesTable)
      .where(eq(rolesTable.id, body.roleId))
      .limit(1);
    if (targetRole.length === 0) {
      res.status(400).json({ error: "Invalid role" });
      return;
    }

    // Non-system callers can only assign roles that belong to their tenant or
    // are system roles (isSystem = true).
    if (
      !u.role.isSystem &&
      targetRole[0].tenantId !== null &&
      targetRole[0].tenantId !== u.tenantId
    ) {
      res.status(403).json({ error: "Cannot assign a role from another tenant" });
      return;
    }

    if (!callerCanAssignRole(u.role, targetRole[0])) {
      res
        .status(403)
        .json({ error: "Cannot assign a role with rights or level exceeding your own" });
      return;
    }

    // Validate the requested orgUnitId is within the caller's tenant and scope.
    const requestedOrgUnitId = body.orgUnitId ?? null;
    if (requestedOrgUnitId !== null && !u.role.isSystem) {
      const orgUnit = await db
        .select()
        .from(orgUnitsTable)
        .where(eq(orgUnitsTable.id, requestedOrgUnitId))
        .limit(1);
      if (orgUnit.length === 0 || orgUnit[0].tenantId !== u.tenantId) {
        res.status(400).json({ error: "Invalid org unit" });
        return;
      }
      // If caller is themselves org-scoped, the target org unit must be in
      // the caller's subtree.
      if (u.orgUnitId) {
        const subtree = await orgUnitSubtreeIds(u.orgUnitId);
        if (!subtree.includes(requestedOrgUnitId)) {
          res.status(403).json({ error: "Org unit is outside your scope" });
          return;
        }
      }
    }

    const passwordHash = await hashPassword(body.password);
    let created: User;
    try {
      [created] = await db
        .insert(usersTable)
        .values({
          tenantId: u.role.isSystem ? null : u.tenantId,
          orgUnitId: requestedOrgUnitId,
          username: body.username,
          displayName: body.displayName,
          passwordHash,
          roleId: body.roleId,
          mustChangePassword: body.mustChangePassword ?? true,
        })
        .returning();
    } catch {
      res.status(409).json({ error: "Username already in use" });
      return;
    }

    let orgUnit: OrgUnit | null = null;
    if (created.orgUnitId) {
      const rows = await db
        .select()
        .from(orgUnitsTable)
        .where(eq(orgUnitsTable.id, created.orgUnitId))
        .limit(1);
      orgUnit = rows[0] ?? null;
    }

    res.status(201).json(profileFor(created, targetRole[0], orgUnit));
  },
);

// ── Update profile ────────────────────────────────────────────────────────────

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

  // Non-system users may only act on users within their own tenant.
  if (!u.role.isSystem && target.user.tenantId !== u.tenantId) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const isSelf = id === u.id;
  const wantsRoleChange =
    body.roleId !== undefined && body.roleId !== target.user.roleId;
  const wantsOrgUnitChange =
    "orgUnitId" in body && body.orgUnitId !== target.user.orgUnitId;
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
  if (!isSelf && !wantsProfileFieldChange && !wantsRoleChange && !wantsOrgUnitChange) {
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
    if (
      !u.role.isSystem &&
      newRole[0].tenantId !== null &&
      newRole[0].tenantId !== u.tenantId
    ) {
      res.status(403).json({ error: "Cannot assign a role from another tenant" });
      return;
    }
    if (!callerCanAssignRole(u.role, newRole[0])) {
      res
        .status(403)
        .json({ error: "Cannot assign a role with rights or level exceeding your own" });
      return;
    }
  }

  if (wantsOrgUnitChange && !u.role.isSystem) {
    if (!hasManageProfiles && !hasAssignRoles) {
      res.status(403).json({ error: "Missing right: manage_profiles or assign_roles" });
      return;
    }
    if (body.orgUnitId !== null && body.orgUnitId !== undefined) {
      const orgUnit = await db
        .select()
        .from(orgUnitsTable)
        .where(eq(orgUnitsTable.id, body.orgUnitId))
        .limit(1);
      if (orgUnit.length === 0 || orgUnit[0].tenantId !== u.tenantId) {
        res.status(400).json({ error: "Invalid org unit" });
        return;
      }
      if (u.orgUnitId) {
        const subtree = await orgUnitSubtreeIds(u.orgUnitId);
        if (!subtree.includes(body.orgUnitId)) {
          res.status(403).json({ error: "Org unit is outside your scope" });
          return;
        }
      }
    }
  }

  if (isSelf && body.password) {
    res.status(400).json({ error: "Use PUT /api/profiles/me to change your own password" });
    return;
  }

  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (body.username) updates.username = body.username;
  if (body.displayName) updates.displayName = body.displayName;
  if (body.roleId !== undefined) updates.roleId = body.roleId;
  if (wantsOrgUnitChange) updates.orgUnitId = body.orgUnitId ?? null;
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
  res.json(profileFor(reloaded.user, reloaded.role, reloaded.orgUnit));
});

// ── Delete profile ────────────────────────────────────────────────────────────

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
    // Non-system users can only delete users in their own tenant.
    if (!u.role.isSystem && target.user.tenantId !== u.tenantId) {
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

// ── Passkeys ──────────────────────────────────────────────────────────────────

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
  // Non-system users may only inspect passkeys of users in their own tenant.
  if (id !== u.id && !u.role.isSystem) {
    const target = await loadProfile(id);
    if (!target || target.user.tenantId !== u.tenantId) {
      res.status(404).end();
      return;
    }
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
  const credentialId = Array.isArray(credentialIdRaw)
    ? credentialIdRaw[0]
    : credentialIdRaw;
  if (!Number.isFinite(id) || !credentialId) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }
  if (id !== u.id && !u.role.isSystem && !u.role.rights.includes("manage_profiles")) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (id !== u.id && !u.role.isSystem) {
    const target = await loadProfile(id);
    if (!target || target.user.tenantId !== u.tenantId) {
      res.status(404).end();
      return;
    }
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
