import { Router, type IRouter } from "express";
import { db, rolesTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateRoleBody, UpdateRoleBody } from "@workspace/api-zod";
import {
  blockIfMustChangePassword,
  requireAnyRight,
  requireAuth,
  requireRight,
} from "../middlewares/auth";

const router: IRouter = Router();

router.use(requireAuth, blockIfMustChangePassword);

function shape(role: typeof rolesTable.$inferSelect) {
  return {
    id: role.id,
    name: role.name,
    level: role.level,
    isSystem: role.isSystem,
    rights: role.rights,
  };
}

// Listing roles is needed by anyone with administrative rights over users or
// roles (manage_roles to edit them, manage_profiles or assign_roles to assign
// them when creating/updating profiles).
router.get(
  "/",
  requireAnyRight("manage_roles", "manage_profiles", "assign_roles"),
  async (_req, res) => {
    const rows = await db.select().from(rolesTable);
    res.json(rows.map(shape));
  },
);

router.post("/", requireAuth, requireRight("manage_roles"), async (req, res) => {
  const u = req.user!;
  const body = CreateRoleBody.parse(req.body);
  if (!u.role.isSystem && body.level >= u.role.level) {
    res.status(403).json({ error: "Cannot create role at or above your level" });
    return;
  }
  try {
    const [created] = await db
      .insert(rolesTable)
      .values({
        name: body.name,
        level: body.level,
        rights: body.rights,
      })
      .returning();
    res.status(201).json(shape(created));
  } catch {
    res.status(409).json({ error: "Role name in use" });
  }
});

router.put("/:id", requireAuth, requireRight("manage_roles"), async (req, res) => {
  const u = req.user!;
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const body = UpdateRoleBody.parse(req.body);
  const existing = await db
    .select()
    .from(rolesTable)
    .where(eq(rolesTable.id, id))
    .limit(1);
  if (existing.length === 0) {
    res.status(404).end();
    return;
  }
  if (existing[0].isSystem) {
    res.status(403).json({ error: "Cannot modify system role" });
    return;
  }
  if (!u.role.isSystem && existing[0].level >= u.role.level) {
    res.status(403).json({ error: "Cannot edit role at or above your level" });
    return;
  }
  const updates: Partial<typeof rolesTable.$inferInsert> = {};
  if (body.name) updates.name = body.name;
  if (body.level !== undefined) updates.level = body.level;
  if (body.rights) updates.rights = body.rights;
  await db.update(rolesTable).set(updates).where(eq(rolesTable.id, id));
  const [updated] = await db
    .select()
    .from(rolesTable)
    .where(eq(rolesTable.id, id));
  res.json(shape(updated));
});

router.delete("/:id", requireAuth, requireRight("manage_roles"), async (req, res) => {
  const u = req.user!;
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const existing = await db.select().from(rolesTable).where(eq(rolesTable.id, id)).limit(1);
  if (existing.length === 0) {
    res.status(404).end();
    return;
  }
  if (existing[0].isSystem) {
    res.status(403).json({ error: "Cannot delete system role" });
    return;
  }
  if (!u.role.isSystem && existing[0].level >= u.role.level) {
    res.status(403).json({ error: "Cannot delete role at or above your level" });
    return;
  }
  const usersWithRole = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.roleId, id))
    .limit(1);
  if (usersWithRole.length > 0) {
    res.status(409).json({ error: "Role is in use" });
    return;
  }
  await db.delete(rolesTable).where(eq(rolesTable.id, id));
  res.status(204).end();
});

export default router;
