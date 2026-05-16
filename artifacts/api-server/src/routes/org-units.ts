import { Router, type IRouter } from "express";
import { db, orgUnitsTable, usersTable, ORG_UNIT_TYPES, type OrgUnitType } from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod/v4";
import {
  blockIfMustChangePassword,
  requireAnyRight,
  requireAuth,
  requireRight,
} from "../middlewares/auth";

const router: IRouter = Router();

router.use(requireAuth, blockIfMustChangePassword);

function shape(unit: typeof orgUnitsTable.$inferSelect) {
  return {
    id: unit.id,
    tenantId: unit.tenantId,
    parentId: unit.parentId ?? null,
    name: unit.name,
    type: unit.type,
    createdAt: unit.createdAt.toISOString(),
  };
}

const CreateOrgUnitBody = z.object({
  name: z.string().min(1),
  type: z.enum(ORG_UNIT_TYPES),
  parentId: z.number().int().nullable().optional(),
});

const UpdateOrgUnitBody = z.object({
  name: z.string().min(1).optional(),
  parentId: z.number().int().nullable().optional(),
});

// ── List org units ────────────────────────────────────────────────────────────
// Returns all org units for the caller's tenant. System Admins see all.

router.get(
  "/",
  requireAnyRight("manage_org_units", "manage_profiles", "assign_roles"),
  async (req, res) => {
    const u = req.user!;

    if (u.role.isSystem) {
      const rows = await db.select().from(orgUnitsTable);
      res.json(rows.map(shape));
      return;
    }

    if (!u.tenantId) {
      res.json([]);
      return;
    }

    const rows = await db
      .select()
      .from(orgUnitsTable)
      .where(eq(orgUnitsTable.tenantId, u.tenantId));
    res.json(rows.map(shape));
  },
);

// ── Create org unit ───────────────────────────────────────────────────────────

router.post(
  "/",
  requireRight("manage_org_units"),
  async (req, res) => {
    const u = req.user!;
    const body = CreateOrgUnitBody.parse(req.body);

    if (!u.role.isSystem && !u.tenantId) {
      res.status(403).json({ error: "No tenant associated with your account" });
      return;
    }

    const tenantId = u.role.isSystem
      ? (body as { tenantId?: number }).tenantId ?? null
      : u.tenantId!;

    if (!tenantId) {
      res.status(400).json({ error: "tenantId is required for System Admin" });
      return;
    }

    // Validate parent belongs to the same tenant.
    if (body.parentId !== null && body.parentId !== undefined) {
      const parent = await db
        .select()
        .from(orgUnitsTable)
        .where(eq(orgUnitsTable.id, body.parentId))
        .limit(1);
      if (parent.length === 0 || parent[0].tenantId !== tenantId) {
        res.status(400).json({ error: "Invalid parent org unit" });
        return;
      }
    }

    const [created] = await db
      .insert(orgUnitsTable)
      .values({
        tenantId,
        parentId: body.parentId ?? null,
        name: body.name,
        type: body.type,
      })
      .returning();

    res.status(201).json(shape(created));
  },
);

// ── Update org unit ───────────────────────────────────────────────────────────

router.put(
  "/:id",
  requireRight("manage_org_units"),
  async (req, res) => {
    const u = req.user!;
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const body = UpdateOrgUnitBody.parse(req.body);

    const existing = await db
      .select()
      .from(orgUnitsTable)
      .where(eq(orgUnitsTable.id, id))
      .limit(1);
    if (existing.length === 0) {
      res.status(404).end();
      return;
    }
    if (!u.role.isSystem && existing[0].tenantId !== u.tenantId) {
      res.status(404).end();
      return;
    }

    // Validate new parent if changing it.
    if ("parentId" in body && body.parentId !== null && body.parentId !== undefined) {
      if (body.parentId === id) {
        res.status(400).json({ error: "Org unit cannot be its own parent" });
        return;
      }
      const parent = await db
        .select()
        .from(orgUnitsTable)
        .where(eq(orgUnitsTable.id, body.parentId))
        .limit(1);
      if (parent.length === 0 || parent[0].tenantId !== existing[0].tenantId) {
        res.status(400).json({ error: "Invalid parent org unit" });
        return;
      }
    }

    const updates: Partial<typeof orgUnitsTable.$inferInsert> = {};
    if (body.name) updates.name = body.name;
    if ("parentId" in body) updates.parentId = body.parentId ?? null;

    await db.update(orgUnitsTable).set(updates).where(eq(orgUnitsTable.id, id));
    const [updated] = await db
      .select()
      .from(orgUnitsTable)
      .where(eq(orgUnitsTable.id, id));
    res.json(shape(updated));
  },
);

// ── Delete org unit ───────────────────────────────────────────────────────────
// Rejected if the unit has children or users assigned to it.

router.delete(
  "/:id",
  requireRight("manage_org_units"),
  async (req, res) => {
    const u = req.user!;
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const existing = await db
      .select()
      .from(orgUnitsTable)
      .where(eq(orgUnitsTable.id, id))
      .limit(1);
    if (existing.length === 0) {
      res.status(404).end();
      return;
    }
    if (!u.role.isSystem && existing[0].tenantId !== u.tenantId) {
      res.status(404).end();
      return;
    }

    const children = await db
      .select({ id: orgUnitsTable.id })
      .from(orgUnitsTable)
      .where(eq(orgUnitsTable.parentId, id))
      .limit(1);
    if (children.length > 0) {
      res.status(409).json({ error: "Cannot delete org unit with child units" });
      return;
    }

    const assignedUsers = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.orgUnitId, id))
      .limit(1);
    if (assignedUsers.length > 0) {
      res.status(409).json({ error: "Cannot delete org unit with assigned users" });
      return;
    }

    await db.delete(orgUnitsTable).where(eq(orgUnitsTable.id, id));
    res.status(204).end();
  },
);

export default router;
