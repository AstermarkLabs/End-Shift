import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { tenantsTable, orgUnitsTable, usersTable } from "./auth";

// ── Checklists ────────────────────────────────────────────────────────────────
// A checklist template owned by a specific location (org unit of type
// "location"). All tasks that staff work through each shift belong here.

export const checklistsTable = pgTable("checklists", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenantsTable.id, { onDelete: "cascade" }),
  locationId: integer("location_id").references(() => orgUnitsTable.id, {
    onDelete: "set null",
  }),
  name: text("name").notNull(),
  createdBy: integer("created_by").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── Checklist Tasks ───────────────────────────────────────────────────────────
// The task items that make up a checklist template. Tasks are grouped into
// named sections (e.g. "1 Hour Before Closing").

export const checklistTasksTable = pgTable("checklist_tasks", {
  id: serial("id").primaryKey(),
  checklistId: integer("checklist_id")
    .notNull()
    .references(() => checklistsTable.id, { onDelete: "cascade" }),
  section: text("section").notNull(),
  subsection: text("subsection"),
  text: text("text").notNull(),
  required: boolean("required").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── Shift Logs ────────────────────────────────────────────────────────────────
// A record of one shift execution against a checklist. Created when someone
// opens a checklist to start working. Submitted once they close out the shift.

export const shiftLogsTable = pgTable("shift_logs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenantsTable.id, { onDelete: "cascade" }),
  checklistId: integer("checklist_id").references(() => checklistsTable.id, {
    onDelete: "set null",
  }),
  locationId: integer("location_id").references(() => orgUnitsTable.id, {
    onDelete: "set null",
  }),
  openedBy: integer("opened_by").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  submittedBy: integer("submitted_by").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  openedAt: timestamp("opened_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  notes: text("notes"),
});

// ── Shift Task Completions ────────────────────────────────────────────────────
// Records which user checked off which task during a shift, and when.

export const shiftTaskCompletionsTable = pgTable("shift_task_completions", {
  id: serial("id").primaryKey(),
  shiftLogId: integer("shift_log_id")
    .notNull()
    .references(() => shiftLogsTable.id, { onDelete: "cascade" }),
  taskId: integer("task_id")
    .notNull()
    .references(() => checklistTasksTable.id, { onDelete: "cascade" }),
  completedBy: integer("completed_by").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  completedAt: timestamp("completed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── Relations ─────────────────────────────────────────────────────────────────

export const checklistsRelations = relations(
  checklistsTable,
  ({ one, many }) => ({
    tenant: one(tenantsTable, {
      fields: [checklistsTable.tenantId],
      references: [tenantsTable.id],
    }),
    location: one(orgUnitsTable, {
      fields: [checklistsTable.locationId],
      references: [orgUnitsTable.id],
    }),
    createdByUser: one(usersTable, {
      fields: [checklistsTable.createdBy],
      references: [usersTable.id],
    }),
    tasks: many(checklistTasksTable),
    shiftLogs: many(shiftLogsTable),
  }),
);

export const checklistTasksRelations = relations(
  checklistTasksTable,
  ({ one, many }) => ({
    checklist: one(checklistsTable, {
      fields: [checklistTasksTable.checklistId],
      references: [checklistsTable.id],
    }),
    completions: many(shiftTaskCompletionsTable),
  }),
);

export const shiftLogsRelations = relations(
  shiftLogsTable,
  ({ one, many }) => ({
    tenant: one(tenantsTable, {
      fields: [shiftLogsTable.tenantId],
      references: [tenantsTable.id],
    }),
    checklist: one(checklistsTable, {
      fields: [shiftLogsTable.checklistId],
      references: [checklistsTable.id],
    }),
    location: one(orgUnitsTable, {
      fields: [shiftLogsTable.locationId],
      references: [orgUnitsTable.id],
    }),
    openedByUser: one(usersTable, {
      fields: [shiftLogsTable.openedBy],
      references: [usersTable.id],
      relationName: "shiftOpenedBy",
    }),
    submittedByUser: one(usersTable, {
      fields: [shiftLogsTable.submittedBy],
      references: [usersTable.id],
      relationName: "shiftSubmittedBy",
    }),
    taskCompletions: many(shiftTaskCompletionsTable),
  }),
);

export const shiftTaskCompletionsRelations = relations(
  shiftTaskCompletionsTable,
  ({ one }) => ({
    shiftLog: one(shiftLogsTable, {
      fields: [shiftTaskCompletionsTable.shiftLogId],
      references: [shiftLogsTable.id],
    }),
    task: one(checklistTasksTable, {
      fields: [shiftTaskCompletionsTable.taskId],
      references: [checklistTasksTable.id],
    }),
    completedByUser: one(usersTable, {
      fields: [shiftTaskCompletionsTable.completedBy],
      references: [usersTable.id],
    }),
  }),
);

// ── Types ─────────────────────────────────────────────────────────────────────

export type Checklist = typeof checklistsTable.$inferSelect;
export type InsertChecklist = typeof checklistsTable.$inferInsert;
export type ChecklistTask = typeof checklistTasksTable.$inferSelect;
export type InsertChecklistTask = typeof checklistTasksTable.$inferInsert;
export type ShiftLog = typeof shiftLogsTable.$inferSelect;
export type InsertShiftLog = typeof shiftLogsTable.$inferInsert;
export type ShiftTaskCompletion = typeof shiftTaskCompletionsTable.$inferSelect;
export type InsertShiftTaskCompletion =
  typeof shiftTaskCompletionsTable.$inferInsert;
