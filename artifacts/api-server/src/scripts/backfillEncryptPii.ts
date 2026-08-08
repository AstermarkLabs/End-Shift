/**
 * One-time backfill: encrypt existing plaintext `email`/`displayName` values
 * on `usersTable` in place, and populate `emailHash` for the equality-lookup
 * blind index.
 *
 * Idempotent — rows already holding an encryptField blob (detected via
 * isEncryptedFieldBlob's "v<N>:" prefix check) are skipped, so this is safe
 * to re-run (e.g. after adding new users mid-rollout, or interrupted runs).
 *
 * This only handles plaintext -> encrypted (first-time migration). To move
 * already-encrypted rows from an old key version to a new one, see
 * rotateFieldEncryptionKey.ts instead.
 *
 * Not run automatically by runMigrations() — that only applies committed SQL
 * migrations (the `email_hash` column/index). This script does the app-level
 * encryption work the SQL migration can't do on its own. Run once per
 * environment, after the `email_hash` column migration has been applied and
 * before (or as part of) the deploy that ships the encrypt/decrypt call
 * sites in profiles.ts/auth.ts/onboarding.ts — see HANDOFF-e2ee.md.
 *
 * Run with (from artifacts/api-server/):
 *   pnpm run backfill:pii
 */
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  encryptField,
  hashForLookup,
  isEncryptedFieldBlob,
} from "../lib/fieldCrypto";
import { normalizeEmail } from "../routes/profiles";

async function main(): Promise<void> {
  const rows = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      displayName: usersTable.displayName,
    })
    .from(usersTable);

  let migrated = 0;
  let skipped = 0;

  for (const row of rows) {
    const updates: Partial<typeof usersTable.$inferInsert> = {};

    if (row.email !== null && !isEncryptedFieldBlob(row.email)) {
      updates.email = encryptField(row.email);
      updates.emailHash = hashForLookup(normalizeEmail(row.email));
    }

    if (!isEncryptedFieldBlob(row.displayName)) {
      updates.displayName = encryptField(row.displayName);
    }

    if (Object.keys(updates).length === 0) {
      skipped += 1;
      continue;
    }

    await db.update(usersTable).set(updates).where(eq(usersTable.id, row.id));
    migrated += 1;
  }

  console.log(
    `Backfill complete — ${migrated} row(s) encrypted, ${skipped} already migrated/skipped (of ${rows.length} total).`,
  );
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => {
    // db/pool doesn't expose an explicit close from this import path; rely on
    // process exit. If this script starts hanging, import `pool` from
    // "@workspace/db" here and call `pool.end()`.
  });
