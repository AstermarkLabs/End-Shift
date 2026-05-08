import { db, rolesTable, usersTable, ALL_RIGHTS, SYSTEM_ADMIN_ROLE_NAME } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword } from "./auth";
import { logger } from "./logger";

const DEFAULT_ADMIN_USERNAME = process.env["DEFAULT_ADMIN_USERNAME"] ?? "admin";
const DEFAULT_ADMIN_PASSWORD = process.env["DEFAULT_ADMIN_PASSWORD"] ?? "changeme123";

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
    const passwordHash = await hashPassword(DEFAULT_ADMIN_PASSWORD);
    await db.insert(usersTable).values({
      username: DEFAULT_ADMIN_USERNAME,
      displayName: "System Administrator",
      passwordHash,
      roleId: adminRoleId,
      mustChangePassword: true,
    });
    logger.info(
      { username: DEFAULT_ADMIN_USERNAME },
      "Seeded default admin user (must change password on first login)",
    );
  }
}
