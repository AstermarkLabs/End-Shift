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

export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

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

export type RefreshToken = typeof refreshTokensTable.$inferSelect;
export type InsertRefreshToken = typeof refreshTokensTable.$inferInsert;

export const refreshTokensRelations = relations(refreshTokensTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [refreshTokensTable.userId],
    references: [usersTable.id],
  }),
}));

export const usersRelations = relations(usersTable, ({ one, many }) => ({
  role: one(rolesTable, {
    fields: [usersTable.roleId],
    references: [rolesTable.id],
  }),
  passkeys: many(passkeyCredentialsTable),
  refreshTokens: many(refreshTokensTable),
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
