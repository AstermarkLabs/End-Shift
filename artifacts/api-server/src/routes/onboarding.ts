import { Router, type IRouter } from "express";
import { db, usersTable, rolesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { hashPassword } from "../lib/auth";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

// ─── Role presets ─────────────────────────────────────────────────────────────
// Maps the friendly role names from the onboarding UI to level + rights.
// "System Admin" is reserved and not assignable via onboarding.

const ROLE_PRESETS: Record<string, { level: number; rights: string[] }> = {
  Admin: { level: 900, rights: ["manage_profiles", "assign_roles", "manage_roles", "create_checklists"] },
  "Regional Manager": { level: 700, rights: ["manage_profiles", "assign_roles", "create_checklists"] },
  "District Manager": { level: 500, rights: ["assign_roles", "create_checklists"] },
  "Location Manager": { level: 300, rights: ["create_checklists"] },
  Staff: { level: 100, rights: ["create_checklists"] },
};

const DEFAULT_PRESET = ROLE_PRESETS["Staff"];

// ─── Validation ───────────────────────────────────────────────────────────────

const OnboardingCompleteBody = z.object({
  teamMembers: z.array(
    z.object({
      email: z.string().min(1),
      role: z.string().min(1),
      scope: z.string().optional(),
    }),
  ),
});

// ─── POST /onboarding/complete ────────────────────────────────────────────────

router.post("/complete", requireAuth, async (req, res) => {
  const body = OnboardingCompleteBody.parse(req.body);

  if (body.teamMembers.length === 0) {
    res.json({ invited: 0, failed: [] });
    return;
  }

  // Resolve or create each role up front, keyed by name, to avoid redundant DB
  // round-trips when multiple team members share the same role.
  const roleIdCache = new Map<string, number>();

  async function getRoleId(roleName: string): Promise<number> {
    if (roleIdCache.has(roleName)) return roleIdCache.get(roleName)!;

    const existing = await db
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
      .values({ name: roleName, level: preset.level, isSystem: false, rights: preset.rights })
      .returning({ id: rolesTable.id });
    roleIdCache.set(roleName, created.id);
    return created.id;
  }

  const invited: number[] = [];
  const failed: { email: string; error: string }[] = [];

  for (const member of body.teamMembers) {
    try {
      const roleId = await getRoleId(member.role);
      // Generate a random temp password; the user must change it on first login.
      const tempPassword = Buffer.from(crypto.getRandomValues(new Uint8Array(12))).toString("base64url");
      const passwordHash = await hashPassword(tempPassword);
      const displayName = member.email.split("@")[0] ?? member.email;

      const [created] = await db
        .insert(usersTable)
        .values({
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
