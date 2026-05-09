import app from "./app";
import { logger } from "./lib/logger";
import { seedAuth } from "./lib/seed";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

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

async function verifySchema(): Promise<void> {
  // Verify that critical auth tables exist before serving traffic.
  // If the DB schema has not been migrated (e.g. after deploying with the new
  // refresh_tokens table), this surfaces a clear startup error instead of a
  // confusing runtime failure on the first token operation.
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
      "DB schema check failed: one or more required auth tables are missing. " +
      "Run `pnpm --filter @workspace/db run push` to apply pending migrations.",
    );
  }
}

async function start() {
  await verifySchema();
  try {
    await seedAuth();
  } catch (err) {
    logger.error({ err }, "Auth seed failed");
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
