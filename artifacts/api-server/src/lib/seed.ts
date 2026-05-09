import { db, rolesTable, usersTable, ALL_RIGHTS, SYSTEM_ADMIN_ROLE_NAME } from "@workspace/db";
import { eq } from "drizzle-orm";
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
