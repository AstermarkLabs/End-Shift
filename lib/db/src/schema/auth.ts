import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  boolean,
  jsonb,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// ── Tenants ───────────────────────────────────────────────────────────────────
// Each self-registered business is a tenant. All users, roles, and org units
// created within that business are scoped to the tenant row.

export const tenantsTable = pgTable("tenants", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── Org Units ─────────────────────────────────────────────────────────────────
// Hierarchical units within a tenant: region → district → location.
// parentId is null for top-level units; set null on parent delete (not cascade)
// so children remain but become roots rather than vanishing.

export const ORG_UNIT_TYPES = ["region", "district", "location"] as const;
export type OrgUnitType = (typeof ORG_UNIT_TYPES)[number];

export const orgUnitsTable = pgTable("org_units", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenantsTable.id, { onDelete: "cascade" }),
  parentId: integer("parent_id").references(
    (): AnyPgColumn => orgUnitsTable.id,
    { onDelete: "set null" },
  ),
  name: text("name").notNull(),
  type: text("type").$type<OrgUnitType>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── Roles ─────────────────────────────────────────────────────────────────────
// tenantId = null  →  system-level role (isSystem=true, e.g. "System Admin")
// tenantId = <id>  →  tenant-scoped role, visible only within that tenant

export const rolesTable = pgTable("roles", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenantsTable.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull(),
  level: integer("level").notNull(),
  isSystem: boolean("is_system").notNull().default(false),
  rights: jsonb("rights").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── Users ─────────────────────────────────────────────────────────────────────
// tenantId = null    → system-level user (e.g. System Admin)
// tenantId + orgUnitId = null  → tenant-wide scope (admin, owner)
// tenantId + orgUnitId set     → scoped to that org unit and its descendants

export const usersTable = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").references(() => tenantsTable.id, {
      onDelete: "set null",
    }),
    orgUnitId: integer("org_unit_id").references(() => orgUnitsTable.id, {
      onDelete: "set null",
    }),
    username: text("username").notNull(),
    email: text("email"),
    accountType: text("account_type").notNull().default("personal"),
    displayName: text("display_name").notNull(),
    passwordHash: text("password_hash"),
    roleId: integer("role_id")
      .notNull()
      .references(() => rolesTable.id),
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    currentChallenge: text("current_challenge"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    usernameIdx: uniqueIndex("users_username_idx").on(table.username),
  }),
);

export const passkeyCredentialsTable = pgTable(
  "passkey_credentials",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    credentialId: text("credential_id").notNull(),
    publicKey: text("public_key").notNull(),
    counter: integer("counter").notNull().default(0),
    transports: jsonb("transports").$type<string[]>().notNull().default([]),
    label: text("label"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (table) => ({
    credentialIdIdx: uniqueIndex("passkey_credentials_credential_id_idx").on(
      table.credentialId,
    ),
  }),
);

export const refreshTokensTable = pgTable(
  "refresh_tokens",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    tokenId: text("token_id").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tokenIdIdx: uniqueIndex("refresh_tokens_token_id_idx").on(table.tokenId),
  }),
);

// ── Relations ─────────────────────────────────────────────────────────────────

export const tenantsRelations = relations(tenantsTable, ({ many }) => ({
  users: many(usersTable),
  roles: many(rolesTable),
  orgUnits: many(orgUnitsTable),
}));

export const orgUnitsRelations = relations(orgUnitsTable, ({ one, many }) => ({
  tenant: one(tenantsTable, {
    fields: [orgUnitsTable.tenantId],
    references: [tenantsTable.id],
  }),
  parent: one(orgUnitsTable, {
    fields: [orgUnitsTable.parentId],
    references: [orgUnitsTable.id],
    relationName: "orgUnitChildren",
  }),
  children: many(orgUnitsTable, { relationName: "orgUnitChildren" }),
  users: many(usersTable),
}));

export const refreshTokensRelations = relations(refreshTokensTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [refreshTokensTable.userId],
    references: [usersTable.id],
  }),
}));

export const usersRelations = relations(usersTable, ({ one, many }) => ({
  tenant: one(tenantsTable, {
    fields: [usersTable.tenantId],
    references: [tenantsTable.id],
  }),
  orgUnit: one(orgUnitsTable, {
    fields: [usersTable.orgUnitId],
    references: [orgUnitsTable.id],
  }),
  role: one(rolesTable, {
    fields: [usersTable.roleId],
    references: [rolesTable.id],
  }),
  passkeys: many(passkeyCredentialsTable),
  refreshTokens: many(refreshTokensTable),
}));

export const rolesRelations = relations(rolesTable, ({ one, many }) => ({
  tenant: one(tenantsTable, {
    fields: [rolesTable.tenantId],
    references: [tenantsTable.id],
  }),
  users: many(usersTable),
}));

export const passkeyCredentialsRelations = relations(
  passkeyCredentialsTable,
  ({ one }) => ({
    user: one(usersTable, {
      fields: [passkeyCredentialsTable.userId],
      references: [usersTable.id],
    }),
  }),
);

// ── Types ─────────────────────────────────────────────────────────────────────

export type Tenant = typeof tenantsTable.$inferSelect;
export type InsertTenant = typeof tenantsTable.$inferInsert;
export type OrgUnit = typeof orgUnitsTable.$inferSelect;
export type InsertOrgUnit = typeof orgUnitsTable.$inferInsert;
export type Role = typeof rolesTable.$inferSelect;
export type InsertRole = typeof rolesTable.$inferInsert;
export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;
export type PasskeyCredential = typeof passkeyCredentialsTable.$inferSelect;
export type InsertPasskeyCredential = typeof passkeyCredentialsTable.$inferInsert;
export type RefreshToken = typeof refreshTokensTable.$inferSelect;
export type InsertRefreshToken = typeof refreshTokensTable.$inferInsert;

// ── Rights ────────────────────────────────────────────────────────────────────

export const ALL_RIGHTS = [
  "manage_profiles",
  "assign_roles",
  "manage_roles",
  "manage_org_units",
  "create_checklists",
  "edit_checklists",
  "delete_checklists",
  "view_reports",
  "manage_checklist_settings",
] as const;
export type Right = (typeof ALL_RIGHTS)[number];

export const SYSTEM_ADMIN_ROLE_NAME = "System Admin";

// ── Standard tenant roles ─────────────────────────────────────────────────────
// Seeded automatically when a new tenant is created at registration.
// All rights are tenant-scoped so there is no cross-business leakage.
//
// Visibility scope per role (enforced server-side via orgUnitId):
//   Owner           — tenant-wide (orgUnitId = null)
//   Regional Mgr    — their region + all districts/locations beneath it
//   District Mgr    — their district + all locations beneath it
//   Location Mgr    — their single location only
//   Staff           — no user-listing access at all

export interface StandardRole {
  name: string;
  level: number;
  rights: Right[];
}

export const STANDARD_TENANT_ROLES: StandardRole[] = [
  {
    name: "Owner",
    level: 950,
    rights: [
      "manage_profiles",
      "assign_roles",
      "manage_roles",
      "manage_org_units",
      "create_checklists",
      "edit_checklists",
      "delete_checklists",
      "view_reports",
      "manage_checklist_settings",
    ],
  },
  {
    // Can see and manage all users within their region; can create org units;
    // cannot create or delete custom roles (that requires manage_roles).
    name: "Regional Manager",
    level: 700,
    rights: [
      "manage_profiles",
      "assign_roles",
      "manage_org_units",
      "create_checklists",
      "edit_checklists",
      "delete_checklists",
      "view_reports",
      "manage_checklist_settings",
    ],
  },
  {
    // Can assign roles to users in their district and manage its org units;
    // cannot create new users directly (no manage_profiles).
    name: "District Manager",
    level: 500,
    rights: [
      "assign_roles",
      "manage_org_units",
      "create_checklists",
      "edit_checklists",
      "delete_checklists",
      "view_reports",
      "manage_checklist_settings",
    ],
  },
  {
    // Can see staff at their location (assign_roles grants profile listing);
    // cannot modify user accounts or org structure.
    name: "Location Manager",
    level: 300,
    rights: [
      "assign_roles",
      "create_checklists",
      "edit_checklists",
      "view_reports",
      "manage_checklist_settings",
    ],
  },
  {
    // No management rights; cannot list other users.
    name: "Staff",
    level: 100,
    rights: ["create_checklists", "view_reports"],
  },
];

// Convenience reference to the owner role definition.
export const TENANT_OWNER_ROLE_NAME = "Owner";
