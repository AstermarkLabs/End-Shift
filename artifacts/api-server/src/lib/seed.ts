import {
  db,
  rolesTable,
  usersTable,
  tenantsTable,
  ALL_RIGHTS,
  SYSTEM_ADMIN_ROLE_NAME,
  STANDARD_TENANT_ROLES,
} from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import { randomBytes } from "crypto";
import { hashPassword } from "./auth";
import { logger } from "./logger";

const KNOWN_WEAK_USERNAMES = ["admin"];
const KNOWN_WEAK_PASSWORDS = ["changeme123", "password", "admin", "admin123"];

function resolveBootstrapCredentials(): { username: string; password: string; generated: boolean } {
  const username = process.env["DEFAULT_ADMIN_USERNAME"] ?? "admin";
  const password = process.env["DEFAULT_ADMIN_PASSWORD"];

  if (process.env["NODE_ENV"] === "production") {
    const usernameIsDefault = KNOWN_WEAK_USERNAMES.includes(username.toLowerCase());
    const passwordMissing = !password;
    const passwordIsWeak = password && KNOWN_WEAK_PASSWORDS.includes(password);

    if (usernameIsDefault || passwordMissing || passwordIsWeak) {
      // Generate a cryptographically random one-time password and log it once.
      // The operator must retrieve it from server logs before they can sign in.
      const generatedPassword = randomBytes(18).toString("base64url");
      const effectiveUsername = usernameIsDefault ? "sysadmin" : username;
      logger.warn(
        { username: effectiveUsername },
        "Production bootstrap: DEFAULT_ADMIN_USERNAME and/or DEFAULT_ADMIN_PASSWORD env vars are missing or insecure. " +
        "A one-time random password has been generated — retrieve it from logs before logging in.",
      );
      logger.warn(
        { bootstrapUsername: effectiveUsername, bootstrapPassword: generatedPassword },
        "BOOTSTRAP CREDENTIALS (change immediately after first login)",
      );
      return { username: effectiveUsername, password: generatedPassword, generated: true };
    }
  }

  return { username, password: password ?? "changeme123", generated: false };
}

export async function resetAdminIfRequested(): Promise<void> {
  const resetValue = process.env["RESET_ADMIN_PASSWORD"];
  if (!resetValue) return;

  const adminRole = await db
    .select()
    .from(rolesTable)
    .where(eq(rolesTable.name, SYSTEM_ADMIN_ROLE_NAME))
    .limit(1);

  if (adminRole.length === 0) {
    logger.warn("RESET_ADMIN_PASSWORD set but no system admin role found — skipping reset");
    return;
  }

  const adminUser = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.roleId, adminRole[0].id))
    .limit(1);

  if (adminUser.length === 0) {
    logger.warn("RESET_ADMIN_PASSWORD set but no admin user found — skipping reset");
    return;
  }

  // Use the env var value as the password if it looks like a real password,
  // otherwise generate a secure random one.
  const newPassword = resetValue === "true" || resetValue === "1"
    ? randomBytes(18).toString("base64url")
    : resetValue;

  const passwordHash = await hashPassword(newPassword);
  await db
    .update(usersTable)
    .set({ passwordHash, mustChangePassword: true })
    .where(eq(usersTable.id, adminUser[0].id));

  logger.warn(
    {
      resetUsername: adminUser[0].username,
      resetPassword: newPassword,
    },
    "RESET_ADMIN_PASSWORD: admin password has been reset — retrieve credentials from logs and change immediately after login. Remove the RESET_ADMIN_PASSWORD env var after use.",
  );
}

/**
 * Idempotent: for every existing tenant, insert any standard roles that are
 * missing by name. Safe to run on every startup — it is a no-op when all
 * roles already exist. This ensures production tenants created before the
 * standard-roles feature are automatically brought up to the full set.
 */
export async function seedTenantRoles(): Promise<void> {
  const tenants = await db.select({ id: tenantsTable.id }).from(tenantsTable);
  if (tenants.length === 0) return;

  for (const tenant of tenants) {
    const existing = await db
      .select({ name: rolesTable.name })
      .from(rolesTable)
      .where(eq(rolesTable.tenantId, tenant.id));

    const existingNames = new Set(existing.map((r) => r.name));
    const missing = STANDARD_TENANT_ROLES.filter((r) => !existingNames.has(r.name));

    if (missing.length === 0) continue;

    await db.insert(rolesTable).values(
      missing.map((r) => ({
        tenantId: tenant.id,
        name: r.name,
        level: r.level,
        isSystem: false,
        rights: r.rights,
      })),
    );
    logger.info(
      { tenantId: tenant.id, added: missing.map((r) => r.name) },
      "seedTenantRoles: filled in missing standard roles for tenant",
    );
  }
}

export async function seedAuth(): Promise<void> {
  const existingRole = await db
    .select()
    .from(rolesTable)
    .where(eq(rolesTable.name, SYSTEM_ADMIN_ROLE_NAME))
    .limit(1);

  let adminRoleId: number;
  if (existingRole.length === 0) {
    const [created] = await db
      .insert(rolesTable)
      .values({
        name: SYSTEM_ADMIN_ROLE_NAME,
        level: 1000,
        isSystem: true,
        rights: [...ALL_RIGHTS],
      })
      .returning();
    adminRoleId = created.id;
    logger.info({ roleId: adminRoleId }, "Seeded system admin role");
  } else {
    adminRoleId = existingRole[0].id;
  }

  const existingUsers = await db.select().from(usersTable).limit(1);
  if (existingUsers.length === 0) {
    const { username, password, generated } = resolveBootstrapCredentials();
    const passwordHash = await hashPassword(password);
    await db.insert(usersTable).values({
      username,
      displayName: "System Administrator",
      passwordHash,
      roleId: adminRoleId,
      mustChangePassword: true,
    });
    if (!generated) {
      logger.info(
        { username },
        "Seeded default admin user (must change password on first login)",
      );
    }
  }
}
