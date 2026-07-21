/**
 * One-time baseline for databases created with `drizzle-kit push`.
 *
 * Production moved from runtime `drizzle-kit push` to committed SQL migrations
 * applied by drizzle-orm's migrator. A database built by `push` already has the
 * tables but has no `drizzle.__drizzle_migrations` journal, so the migrator
 * would try to replay `0000_*.sql` against existing tables and fail with
 * `relation "..." already exists`.
 *
 * This script records the existing migrations as already-applied WITHOUT running
 * their SQL, so subsequent `migrate()` calls pick up from the next migration.
 *
 * Run once per pre-existing database:
 *   pnpm --filter @workspace/db run baseline
 *
 * New/empty databases must NOT be baselined — they should just run the migrator,
 * which creates the tables. This script refuses to run against an empty database.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { readMigrationFiles } from "drizzle-orm/migrator";

const { Pool } = pg;

const MIGRATIONS_SCHEMA = "drizzle";
const MIGRATIONS_TABLE = "__drizzle_migrations";

// A table that must already exist for baselining to make sense.
const SENTINEL_TABLE = "users";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL must be set to baseline a database.");
  }

  const migrationsFolder = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../migrations",
  );
  // Use drizzle's own reader so the hashes are computed identically to the
  // migrator's. Hand-rolling sha256 here would silently drift if drizzle changes.
  const migrations = readMigrationFiles({ migrationsFolder });
  if (migrations.length === 0) {
    throw new Error(`No migrations found in ${migrationsFolder}`);
  }

  const pool = new Pool({ connectionString: url });
  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const { rows: sentinel } = await client.query<{ count: string }>(
        `SELECT COUNT(*) AS count
           FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = $1`,
        [SENTINEL_TABLE],
      );
      if (parseInt(sentinel[0]?.count ?? "0", 10) === 0) {
        throw new Error(
          `Table "${SENTINEL_TABLE}" does not exist — this database is empty. ` +
            "Do not baseline it; run the server (or `pnpm --filter @workspace/db " +
            "run migrate`) and let the migrator create the schema instead.",
        );
      }

      await client.query(`CREATE SCHEMA IF NOT EXISTS "${MIGRATIONS_SCHEMA}"`);
      await client.query(
        `CREATE TABLE IF NOT EXISTS "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" (
           id SERIAL PRIMARY KEY,
           hash text NOT NULL,
           created_at bigint
         )`,
      );

      let inserted = 0;
      for (const migration of migrations) {
        const { rows } = await client.query<{ count: string }>(
          `SELECT COUNT(*) AS count
             FROM "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}"
            WHERE hash = $1`,
          [migration.hash],
        );
        if (parseInt(rows[0]?.count ?? "0", 10) > 0) {
          console.log(`already recorded, skipping: ${migration.hash}`);
          continue;
        }
        await client.query(
          `INSERT INTO "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" (hash, created_at)
           VALUES ($1, $2)`,
          [migration.hash, migration.folderMillis],
        );
        inserted += 1;
        console.log(`baselined: ${migration.hash}`);
      }

      await client.query("COMMIT");
      console.log(
        `Baseline complete — ${inserted} migration(s) marked as applied, ` +
          `${migrations.length - inserted} already present.`,
      );
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
