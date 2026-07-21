import path from "node:path";
import app from "./app";
import { logger } from "./lib/logger";
import { seedAuth, seedTenantRoles, resetAdminIfRequested } from "./lib/seed";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function runMigrations(): Promise<void> {
  // Apply any pending Drizzle migrations before serving traffic.
  //
  // Migrations are generated at development time (`pnpm --filter @workspace/db
  // run generate`) and committed as SQL under lib/db/migrations. build.mjs
  // copies that folder next to the bundle, so it resolves identically in local
  // dev and in the Docker runtime image.
  //
  // This uses drizzle-orm's migrator rather than `drizzle-kit push` so the
  // runtime image needs no drizzle-kit, no schema sources, and no node_modules —
  // and so migrations never prompt interactively on a non-TTY container.
  const migrationsFolder = path.join(__dirname, "migrations");
  logger.info({ migrationsFolder }, "Applying database migrations");
  await migrate(db, { migrationsFolder });
  logger.info("Database migrations up to date");
}

async function verifySchema(): Promise<void> {
  // Belt-and-braces check that the migrations actually produced the critical
  // auth tables, so a misconfigured migrations folder surfaces a clear startup
  // error instead of a confusing runtime failure on the first token operation.
  const result = await db.execute(sql`
    SELECT COUNT(*) AS count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('users', 'roles', 'refresh_tokens')
  `);
  const rows = result.rows as Array<{ count: string }>;
  const count = parseInt(rows[0]?.count ?? "0", 10);
  if (count < 3) {
    throw new Error(
      "DB schema check failed: one or more required auth tables are missing " +
      "after running migrations. Check that lib/db/migrations is present in " +
      "the build output and that new schema changes have been committed via " +
      "`pnpm --filter @workspace/db run generate`.",
    );
  }
}

async function start() {
  await runMigrations();
  await verifySchema();
  try {
    await resetAdminIfRequested();
  } catch (err) {
    logger.error({ err }, "Admin reset failed");
  }
  try {
    await seedAuth();
  } catch (err) {
    logger.error({ err }, "Auth seed failed");
  }
  try {
    await seedTenantRoles();
  } catch (err) {
    logger.error({ err }, "Tenant role seed failed");
  }
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
}

start();
