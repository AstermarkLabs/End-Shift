import { Router, type IRouter } from "express";
import { db, checklistsTable, checklistTasksTable, orgUnitsTable } from "@workspace/db";
import { and, eq, asc } from "drizzle-orm";
import { z } from "zod/v4";
import {
  blockIfMustChangePassword,
  requireAnyRight,
  requireAuth,
  requireRight,
} from "../middlewares/auth";

const router: IRouter = Router();

router.use(requireAuth, blockIfMustChangePassword);

// ── Helpers ───────────────────────────────────────────────────────────────────

function shapeChecklist(row: typeof checklistsTable.$inferSelect) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    locationId: row.locationId ?? null,
    name: row.name,
    createdBy: row.createdBy ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function shapeTask(row: typeof checklistTasksTable.$inferSelect) {
  return {
    id: row.id,
    checklistId: row.checklistId,
    section: row.section,
    subsection: row.subsection ?? null,
    text: row.text,
    required: row.required,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
  };
}

const CreateBody = z.object({
  name: z.string().min(1),
  locationId: z.number().int().nullable().optional(),
});

const UpdateBody = z.object({
  name: z.string().min(1).optional(),
  locationId: z.number().int().nullable().optional(),
});

const TaskCreateBody = z.object({
  section: z.string().min(1),
  subsection: z.string().nullable().optional(),
  text: z.string().min(1),
  required: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const TaskUpdateBody = z.object({
  section: z.string().min(1).optional(),
  subsection: z.string().nullable().optional(),
  text: z.string().min(1).optional(),
  required: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

// ── List checklists ───────────────────────────────────────────────────────────

router.get(
  "/checklists",
  requireAnyRight("create_checklists", "edit_checklists", "delete_checklists", "view_reports", "manage_checklist_settings"),
  async (req, res): Promise<void> => {
    const u = req.user!;
    if (u.role.isSystem) {
      const rows = await db.select().from(checklistsTable);
      res.json(rows.map(shapeChecklist));
      return;
    }
    if (!u.tenantId) { res.json([]); return; }

    const rows = await db
      .select()
      .from(checklistsTable)
      .where(eq(checklistsTable.tenantId, u.tenantId));
    res.json(rows.map(shapeChecklist));
  },
);

// ── Create checklist ──────────────────────────────────────────────────────────

router.post(
  "/checklists",
  requireRight("create_checklists"),
  async (req, res): Promise<void> => {
    const u = req.user!;
    const body = CreateBody.parse(req.body);

    if (!u.role.isSystem && !u.tenantId) {
      res.status(403).json({ error: "No tenant associated with your account" });
      return;
    }
    const tenantId = u.tenantId!;

    // Validate locationId belongs to this tenant.
    if (body.locationId != null) {
      const loc = await db
        .select()
        .from(orgUnitsTable)
        .where(eq(orgUnitsTable.id, body.locationId))
        .limit(1);
      if (loc.length === 0 || loc[0].tenantId !== tenantId) {
        res.status(400).json({ error: "Invalid location" });
        return;
      }
    }

    const [created] = await db
      .insert(checklistsTable)
      .values({
        tenantId,
        locationId: body.locationId ?? null,
        name: body.name,
        createdBy: u.id,
      })
      .returning();

    res.status(201).json(shapeChecklist(created));
  },
);

// ── Get checklist (with tasks) ────────────────────────────────────────────────

router.get(
  "/checklists/:id",
  requireAnyRight("create_checklists", "edit_checklists", "delete_checklists", "view_reports", "manage_checklist_settings"),
  async (req, res): Promise<void> => {
    const u = req.user!;
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const rows = await db
      .select()
      .from(checklistsTable)
      .where(eq(checklistsTable.id, id))
      .limit(1);

    if (rows.length === 0) { res.status(404).end(); return; }
    const cl = rows[0];
    if (!u.role.isSystem && cl.tenantId !== u.tenantId) { res.status(404).end(); return; }

    const tasks = await db
      .select()
      .from(checklistTasksTable)
      .where(eq(checklistTasksTable.checklistId, id))
      .orderBy(asc(checklistTasksTable.sortOrder), asc(checklistTasksTable.createdAt));

    res.json({ ...shapeChecklist(cl), tasks: tasks.map(shapeTask) });
  },
);

// ── Update checklist ──────────────────────────────────────────────────────────

router.put(
  "/checklists/:id",
  requireRight("edit_checklists"),
  async (req, res): Promise<void> => {
    const u = req.user!;
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    const body = UpdateBody.parse(req.body);

    const rows = await db
      .select()
      .from(checklistsTable)
      .where(eq(checklistsTable.id, id))
      .limit(1);
    if (rows.length === 0) { res.status(404).end(); return; }
    if (!u.role.isSystem && rows[0].tenantId !== u.tenantId) { res.status(404).end(); return; }

    // Validate locationId if provided.
    if (body.locationId != null) {
      const loc = await db
        .select()
        .from(orgUnitsTable)
        .where(eq(orgUnitsTable.id, body.locationId))
        .limit(1);
      if (loc.length === 0 || loc[0].tenantId !== rows[0].tenantId) {
        res.status(400).json({ error: "Invalid location" });
        return;
      }
    }

    const updates: Partial<typeof checklistsTable.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (body.name) updates.name = body.name;
    if ("locationId" in body) updates.locationId = body.locationId ?? null;

    await db.update(checklistsTable).set(updates).where(eq(checklistsTable.id, id));
    const [updated] = await db.select().from(checklistsTable).where(eq(checklistsTable.id, id));
    res.json(shapeChecklist(updated));
  },
);

// ── Delete checklist ──────────────────────────────────────────────────────────

router.delete(
  "/checklists/:id",
  requireRight("delete_checklists"),
  async (req, res): Promise<void> => {
    const u = req.user!;
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const rows = await db
      .select()
      .from(checklistsTable)
      .where(eq(checklistsTable.id, id))
      .limit(1);
    if (rows.length === 0) { res.status(404).end(); return; }
    if (!u.role.isSystem && rows[0].tenantId !== u.tenantId) { res.status(404).end(); return; }

    await db.delete(checklistsTable).where(eq(checklistsTable.id, id));
    res.status(204).end();
  },
);

// ── List tasks ────────────────────────────────────────────────────────────────

router.get(
  "/checklists/:id/tasks",
  requireAnyRight("create_checklists", "edit_checklists", "delete_checklists", "view_reports", "manage_checklist_settings"),
  async (req, res): Promise<void> => {
    const u = req.user!;
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const cl = await db.select().from(checklistsTable).where(eq(checklistsTable.id, id)).limit(1);
    if (cl.length === 0) { res.status(404).end(); return; }
    if (!u.role.isSystem && cl[0].tenantId !== u.tenantId) { res.status(404).end(); return; }

    const tasks = await db
      .select()
      .from(checklistTasksTable)
      .where(eq(checklistTasksTable.checklistId, id))
      .orderBy(asc(checklistTasksTable.sortOrder), asc(checklistTasksTable.createdAt));
    res.json(tasks.map(shapeTask));
  },
);

// ── Create task ───────────────────────────────────────────────────────────────

router.post(
  "/checklists/:id/tasks",
  requireRight("edit_checklists"),
  async (req, res): Promise<void> => {
    const u = req.user!;
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    const body = TaskCreateBody.parse(req.body);

    const cl = await db.select().from(checklistsTable).where(eq(checklistsTable.id, id)).limit(1);
    if (cl.length === 0) { res.status(404).end(); return; }
    if (!u.role.isSystem && cl[0].tenantId !== u.tenantId) { res.status(404).end(); return; }

    const [created] = await db
      .insert(checklistTasksTable)
      .values({
        checklistId: id,
        section: body.section,
        subsection: body.subsection ?? null,
        text: body.text,
        required: body.required ?? true,
        sortOrder: body.sortOrder ?? 0,
      })
      .returning();

    res.status(201).json(shapeTask(created));
  },
);

// ── Update task ───────────────────────────────────────────────────────────────

router.put(
  "/checklists/:id/tasks/:taskId",
  requireRight("edit_checklists"),
  async (req, res): Promise<void> => {
    const u = req.user!;
    const id = Number(req.params["id"]);
    const taskId = Number(req.params["taskId"]);
    if (!Number.isFinite(id) || !Number.isFinite(taskId)) {
      res.status(400).json({ error: "Invalid id" }); return;
    }
    const body = TaskUpdateBody.parse(req.body);

    const cl = await db.select().from(checklistsTable).where(eq(checklistsTable.id, id)).limit(1);
    if (cl.length === 0) { res.status(404).end(); return; }
    if (!u.role.isSystem && cl[0].tenantId !== u.tenantId) { res.status(404).end(); return; }

    const task = await db
      .select()
      .from(checklistTasksTable)
      .where(and(eq(checklistTasksTable.id, taskId), eq(checklistTasksTable.checklistId, id)))
      .limit(1);
    if (task.length === 0) { res.status(404).end(); return; }

    const updates: Partial<typeof checklistTasksTable.$inferInsert> = {};
    if (body.section !== undefined) updates.section = body.section;
    if (body.subsection !== undefined) updates.subsection = body.subsection ?? null;
    if (body.text !== undefined) updates.text = body.text;
    if (body.required !== undefined) updates.required = body.required;
    if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;

    await db.update(checklistTasksTable).set(updates).where(eq(checklistTasksTable.id, taskId));
    const [updated] = await db.select().from(checklistTasksTable).where(eq(checklistTasksTable.id, taskId));
    res.json(shapeTask(updated));
  },
);

// ── Delete task ───────────────────────────────────────────────────────────────

router.delete(
  "/checklists/:id/tasks/:taskId",
  requireRight("edit_checklists"),
  async (req, res): Promise<void> => {
    const u = req.user!;
    const id = Number(req.params["id"]);
    const taskId = Number(req.params["taskId"]);
    if (!Number.isFinite(id) || !Number.isFinite(taskId)) {
      res.status(400).json({ error: "Invalid id" }); return;
    }

    const cl = await db.select().from(checklistsTable).where(eq(checklistsTable.id, id)).limit(1);
    if (cl.length === 0) { res.status(404).end(); return; }
    if (!u.role.isSystem && cl[0].tenantId !== u.tenantId) { res.status(404).end(); return; }

    const task = await db
      .select()
      .from(checklistTasksTable)
      .where(and(eq(checklistTasksTable.id, taskId), eq(checklistTasksTable.checklistId, id)))
      .limit(1);
    if (task.length === 0) { res.status(404).end(); return; }

    await db.delete(checklistTasksTable).where(eq(checklistTasksTable.id, taskId));
    res.status(204).end();
  },
);

export default router;
