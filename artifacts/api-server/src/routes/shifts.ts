import { Router, type IRouter } from "express";
import {
  db,
  checklistsTable,
  shiftLogsTable,
  shiftTaskCompletionsTable,
  checklistTasksTable,
} from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import { z } from "zod/v4";
import {
  blockIfMustChangePassword,
  requireAnyRight,
  requireAuth,
} from "../middlewares/auth";

const router: IRouter = Router();

router.use(requireAuth, blockIfMustChangePassword);

// ── Helpers ───────────────────────────────────────────────────────────────────

function shapeShift(row: typeof shiftLogsTable.$inferSelect) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    checklistId: row.checklistId ?? null,
    locationId: row.locationId ?? null,
    openedBy: row.openedBy ?? null,
    submittedBy: row.submittedBy ?? null,
    openedAt: row.openedAt.toISOString(),
    submittedAt: row.submittedAt?.toISOString() ?? null,
    notes: row.notes ?? null,
  };
}

function shapeCompletion(row: typeof shiftTaskCompletionsTable.$inferSelect) {
  return {
    id: row.id,
    shiftLogId: row.shiftLogId,
    taskId: row.taskId,
    completedBy: row.completedBy ?? null,
    completedAt: row.completedAt.toISOString(),
  };
}

async function shapeShiftWithCompletions(shift: typeof shiftLogsTable.$inferSelect) {
  const completions = await db
    .select()
    .from(shiftTaskCompletionsTable)
    .where(eq(shiftTaskCompletionsTable.shiftLogId, shift.id));
  return { ...shapeShift(shift), completions: completions.map(shapeCompletion) };
}

// ── List shifts for a checklist ───────────────────────────────────────────────

router.get(
  "/checklists/:id/shifts",
  requireAnyRight("create_checklists", "view_reports"),
  async (req, res): Promise<void> => {
    const u = req.user!;
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const cl = await db.select().from(checklistsTable).where(eq(checklistsTable.id, id)).limit(1);
    if (cl.length === 0) { res.status(404).end(); return; }
    if (!u.role.isSystem && cl[0].tenantId !== u.tenantId) { res.status(404).end(); return; }

    const rows = await db
      .select()
      .from(shiftLogsTable)
      .where(eq(shiftLogsTable.checklistId, id))
      .orderBy(desc(shiftLogsTable.openedAt))
      .limit(50);

    res.json(rows.map(shapeShift));
  },
);

// ── Open a shift ──────────────────────────────────────────────────────────────

router.post(
  "/checklists/:id/shifts",
  requireAnyRight("create_checklists"),
  async (req, res): Promise<void> => {
    const u = req.user!;
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    if (!u.tenantId) {
      res.status(403).json({ error: "No tenant associated with your account" });
      return;
    }

    const cl = await db.select().from(checklistsTable).where(eq(checklistsTable.id, id)).limit(1);
    if (cl.length === 0) { res.status(404).end(); return; }
    if (!u.role.isSystem && cl[0].tenantId !== u.tenantId) { res.status(404).end(); return; }

    const [shift] = await db
      .insert(shiftLogsTable)
      .values({
        tenantId: u.tenantId,
        checklistId: id,
        locationId: cl[0].locationId ?? null,
        openedBy: u.id,
      })
      .returning();

    res.status(201).json(await shapeShiftWithCompletions(shift));
  },
);

// ── Get a shift ───────────────────────────────────────────────────────────────

router.get(
  "/shifts/:id",
  requireAnyRight("create_checklists", "view_reports"),
  async (req, res): Promise<void> => {
    const u = req.user!;
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const rows = await db.select().from(shiftLogsTable).where(eq(shiftLogsTable.id, id)).limit(1);
    if (rows.length === 0) { res.status(404).end(); return; }
    if (!u.role.isSystem && rows[0].tenantId !== u.tenantId) { res.status(404).end(); return; }

    res.json(await shapeShiftWithCompletions(rows[0]));
  },
);

// ── Submit a shift ────────────────────────────────────────────────────────────

const SubmitBody = z.object({ notes: z.string().optional() });

router.post(
  "/shifts/:id/submit",
  requireAnyRight("create_checklists"),
  async (req, res): Promise<void> => {
    const u = req.user!;
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    const body = SubmitBody.parse(req.body ?? {});

    const rows = await db.select().from(shiftLogsTable).where(eq(shiftLogsTable.id, id)).limit(1);
    if (rows.length === 0) { res.status(404).end(); return; }
    if (!u.role.isSystem && rows[0].tenantId !== u.tenantId) { res.status(404).end(); return; }
    if (rows[0].submittedAt) {
      res.status(409).json({ error: "Shift already submitted" });
      return;
    }

    await db
      .update(shiftLogsTable)
      .set({ submittedBy: u.id, submittedAt: new Date(), notes: body.notes ?? null })
      .where(eq(shiftLogsTable.id, id));

    const [updated] = await db.select().from(shiftLogsTable).where(eq(shiftLogsTable.id, id));
    res.json(await shapeShiftWithCompletions(updated));
  },
);

// ── Complete a task in a shift ────────────────────────────────────────────────

router.post(
  "/shifts/:id/tasks/:taskId/complete",
  requireAnyRight("create_checklists"),
  async (req, res): Promise<void> => {
    const u = req.user!;
    const id = Number(req.params["id"]);
    const taskId = Number(req.params["taskId"]);
    if (!Number.isFinite(id) || !Number.isFinite(taskId)) {
      res.status(400).json({ error: "Invalid id" }); return;
    }

    const shift = await db.select().from(shiftLogsTable).where(eq(shiftLogsTable.id, id)).limit(1);
    if (shift.length === 0) { res.status(404).end(); return; }
    if (!u.role.isSystem && shift[0].tenantId !== u.tenantId) { res.status(404).end(); return; }
    if (shift[0].submittedAt) {
      res.status(409).json({ error: "Shift already submitted" });
      return;
    }

    // Verify task belongs to this shift's checklist.
    const task = await db
      .select()
      .from(checklistTasksTable)
      .where(and(
        eq(checklistTasksTable.id, taskId),
        eq(checklistTasksTable.checklistId, shift[0].checklistId!),
      ))
      .limit(1);
    if (task.length === 0) { res.status(404).end(); return; }

    // Idempotent — if already complete, return 409.
    const existing = await db
      .select()
      .from(shiftTaskCompletionsTable)
      .where(and(
        eq(shiftTaskCompletionsTable.shiftLogId, id),
        eq(shiftTaskCompletionsTable.taskId, taskId),
      ))
      .limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "Task already complete" });
      return;
    }

    const [completion] = await db
      .insert(shiftTaskCompletionsTable)
      .values({ shiftLogId: id, taskId, completedBy: u.id })
      .returning();

    res.status(201).json(shapeCompletion(completion));
  },
);

// ── Uncomplete a task in a shift ──────────────────────────────────────────────

router.delete(
  "/shifts/:id/tasks/:taskId/complete",
  requireAnyRight("create_checklists"),
  async (req, res): Promise<void> => {
    const u = req.user!;
    const id = Number(req.params["id"]);
    const taskId = Number(req.params["taskId"]);
    if (!Number.isFinite(id) || !Number.isFinite(taskId)) {
      res.status(400).json({ error: "Invalid id" }); return;
    }

    const shift = await db.select().from(shiftLogsTable).where(eq(shiftLogsTable.id, id)).limit(1);
    if (shift.length === 0) { res.status(404).end(); return; }
    if (!u.role.isSystem && shift[0].tenantId !== u.tenantId) { res.status(404).end(); return; }
    if (shift[0].submittedAt) {
      res.status(409).json({ error: "Shift already submitted" });
      return;
    }

    const completion = await db
      .select()
      .from(shiftTaskCompletionsTable)
      .where(and(
        eq(shiftTaskCompletionsTable.shiftLogId, id),
        eq(shiftTaskCompletionsTable.taskId, taskId),
      ))
      .limit(1);
    if (completion.length === 0) { res.status(404).end(); return; }

    await db
      .delete(shiftTaskCompletionsTable)
      .where(eq(shiftTaskCompletionsTable.id, completion[0].id));

    res.status(204).end();
  },
);

export default router;
