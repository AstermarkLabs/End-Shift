import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  boolean,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const rolesTable = pgTable(
  "roles",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    level: integer("level").notNull(),
    isSystem: boolean("is_system").notNull().default(false),
    rights: jsonb("rights").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    nameIdx: uniqueIndex("roles_name_idx").on(table.name),
  }),
);

export const usersTable = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    username: text("username").notNull(),
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

export const usersRelations = relations(usersTable, ({ one, many }) => ({
  role: one(rolesTable, {
    fields: [usersTable.roleId],
    references: [rolesTable.id],
  }),
  passkeys: many(passkeyCredentialsTable),
}));

export const rolesRelations = relations(rolesTable, ({ many }) => ({
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

export type Role = typeof rolesTable.$inferSelect;
export type InsertRole = typeof rolesTable.$inferInsert;
export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;
export type PasskeyCredential = typeof passkeyCredentialsTable.$inferSelect;
export type InsertPasskeyCredential = typeof passkeyCredentialsTable.$inferInsert;

export const ALL_RIGHTS = [
  "manage_profiles",
  "assign_roles",
  "manage_roles",
  "create_checklists",
] as const;
export type Right = (typeof ALL_RIGHTS)[number];

export const SYSTEM_ADMIN_ROLE_NAME = "System Admin";
