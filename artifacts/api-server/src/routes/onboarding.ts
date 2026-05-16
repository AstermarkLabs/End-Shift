import { Router, type IRouter } from "express";
import { db, usersTable, rolesTable, orgUnitsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { hashPassword } from "../lib/auth";
import { requireAuth } from "../middlewares/auth";
import { orgUnitSubtreeIds } from "../lib/tenant-scope";

const router: IRouter = Router();

// ─── Role presets ─────────────────────────────────────────────────────────────
// Maps the friendly role names from the onboarding UI to level + rights.
// Created roles are scoped to the caller's tenant.

const ROLE_PRESETS: Record<string, { level: number; rights: string[] }> = {
  Admin: { level: 900, rights: ["manage_profiles", "assign_roles", "manage_roles", "manage_org_units", "create_checklists", "edit_checklists", "delete_checklists", "view_reports", "manage_checklist_settings"] },
  "Regional Manager": { level: 700, rights: ["manage_profiles", "assign_roles", "manage_org_units", "create_checklists", "edit_checklists", "delete_checklists", "view_reports", "manage_checklist_settings"] },
  "District Manager": { level: 500, rights: ["assign_roles", "manage_org_units", "create_checklists", "edit_checklists", "delete_checklists", "view_reports", "manage_checklist_settings"] },
  "Location Manager": { level: 300, rights: ["create_checklists", "edit_checklists", "view_reports", "manage_checklist_settings"] },
  Staff: { level: 100, rights: ["create_checklists", "view_reports"] },
};

const DEFAULT_PRESET = ROLE_PRESETS["Staff"];

// ─── Validation ───────────────────────────────────────────────────────────────

const OnboardingCompleteBody = z.object({
  teamMembers: z.array(
    z.object({
      email: z.string().min(1),
      role: z.string().min(1),
      orgUnitId: z.number().int().nullable().optional(),
    }),
  ),
});

// ─── POST /onboarding/complete ────────────────────────────────────────────────

router.post("/complete", requireAuth, async (req, res) => {
  const u = req.user!;
  const body = OnboardingCompleteBody.parse(req.body);

  if (body.teamMembers.length === 0) {
    res.json({ invited: 0, failed: [] });
    return;
  }

  // Tenant-scoped users must have a tenantId to assign to team members.
  if (!u.role.isSystem && !u.tenantId) {
    res.status(403).json({ error: "No tenant associated with your account" });
    return;
  }

  // Precompute caller's org subtree once if they are org-scoped.
  const callerSubtree = u.orgUnitId ? await orgUnitSubtreeIds(u.orgUnitId) : null;

  // Resolve or create each role, keyed by name, to avoid redundant DB trips.
  const roleIdCache = new Map<string, number>();

  async function getRoleId(roleName: string): Promise<number> {
    if (roleIdCache.has(roleName)) return roleIdCache.get(roleName)!;

    // Look for an existing role with this name scoped to the caller's tenant.
    const existing = u.tenantId
      ? await db
          .select({ id: rolesTable.id })
          .from(rolesTable)
          .where(and(eq(rolesTable.tenantId, u.tenantId), eq(rolesTable.name, roleName)))
          .limit(1)
      : await db
          .select({ id: rolesTable.id })
          .from(rolesTable)
          .where(eq(rolesTable.name, roleName))
          .limit(1);

    if (existing.length > 0) {
      roleIdCache.set(roleName, existing[0].id);
      return existing[0].id;
    }

    const preset = ROLE_PRESETS[roleName] ?? DEFAULT_PRESET;
    const [created] = await db
      .insert(rolesTable)
      .values({
        tenantId: u.role.isSystem ? null : u.tenantId,
        name: roleName,
        level: preset.level,
        isSystem: false,
        rights: preset.rights,
      })
      .returning({ id: rolesTable.id });
    roleIdCache.set(roleName, created.id);
    return created.id;
  }

  const invited: number[] = [];
  const failed: { email: string; error: string }[] = [];

  for (const member of body.teamMembers) {
    // Validate orgUnitId if provided.
    const orgUnitId = member.orgUnitId ?? null;
    if (orgUnitId !== null && !u.role.isSystem) {
      const orgUnit = await db
        .select()
        .from(orgUnitsTable)
        .where(eq(orgUnitsTable.id, orgUnitId))
        .limit(1);
      if (orgUnit.length === 0 || orgUnit[0].tenantId !== u.tenantId) {
        failed.push({ email: member.email, error: "Invalid org unit" });
        continue;
      }
      if (callerSubtree !== null && !callerSubtree.includes(orgUnitId)) {
        failed.push({ email: member.email, error: "Org unit is outside your scope" });
        continue;
      }
    }

    try {
      const roleId = await getRoleId(member.role);
      const tempPassword = Buffer.from(crypto.getRandomValues(new Uint8Array(12))).toString("base64url");
      const passwordHash = await hashPassword(tempPassword);
      const displayName = member.email.split("@")[0] ?? member.email;

      const [created] = await db
        .insert(usersTable)
        .values({
          tenantId: u.role.isSystem ? null : u.tenantId,
          orgUnitId,
          username: member.email,
          displayName,
          passwordHash,
          roleId,
          mustChangePassword: true,
        })
        .returning({ id: usersTable.id });

      invited.push(created.id);
    } catch {
      failed.push({ email: member.email, error: "Email already in use" });
    }
  }

  res.json({ invited: invited.length, failed });
});

export default router;
