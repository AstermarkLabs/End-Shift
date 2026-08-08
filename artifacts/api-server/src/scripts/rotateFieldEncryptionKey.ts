/**
 * Rotate `email`/`displayName` ciphertext from an old AES key version to the
 * currently-active one (FIELD_ENCRYPTION_ACTIVE_KEY_VERSION). Decrypts each
 * field under its own embedded version, re-encrypts under the active
 * version, and writes it back — one row at a time, no transaction spanning
 * the whole table.
 *
 * Crash-safe by construction: every blob carries its own version tag
 * (see fieldCrypto.ts), so a run interrupted partway through leaves a mix
 * of old- and new-version rows, and every row — old or new — still decrypts
 * correctly via decryptField(). Just re-run the script to pick up where it
 * left off (it's idempotent: rows already on the active version are
 * skipped).
 *
 * Does NOT touch `emailHash` — the blind index is derived from a separate,
 * stable secret (FIELD_INDEX_KEY) that doesn't rotate with the AES key, by
 * design (see fieldCrypto.ts header comment). Rotating the AES key must
 * never change emailHash values.
 *
 * Usage (from artifacts/api-server/):
 *   1. Add the new key: set FIELD_ENCRYPTION_KEY_V{N} for the new version.
 *   2. Flip FIELD_ENCRYPTION_ACTIVE_KEY_VERSION to N (new writes now use it;
 *      old rows still decrypt fine under their original version's key).
 *   3. Run: pnpm run rotate:pii-key
 *   4. Once the summary reports 0 rows remaining on old versions, the old
 *      FIELD_ENCRYPTION_KEY_V{old} env var can be safely removed.
 */
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  encryptField,
  decryptField,
  blobKeyVersion,
  getActiveKeyVersion,
} from "../lib/fieldCrypto";

async function main(): Promise<void> {
  const activeVersion = getActiveKeyVersion();

  const rows = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      displayName: usersTable.displayName,
    })
    .from(usersTable);

  let rotated = 0;
  let alreadyCurrent = 0;

  for (const row of rows) {
    const updates: Partial<typeof usersTable.$inferInsert> = {};

    if (row.email !== null && blobKeyVersion(row.email) !== null && blobKeyVersion(row.email) !== activeVersion) {
      updates.email = encryptField(decryptField(row.email));
      // emailHash intentionally untouched — see module doc comment.
    }

    if (blobKeyVersion(row.displayName) !== null && blobKeyVersion(row.displayName) !== activeVersion) {
      updates.displayName = encryptField(decryptField(row.displayName));
    }

    if (Object.keys(updates).length === 0) {
      alreadyCurrent += 1;
      continue;
    }

    await db.update(usersTable).set(updates).where(eq(usersTable.id, row.id));
    rotated += 1;
  }

  console.log(
    `Rotation to key v${activeVersion} complete — ${rotated} row(s) re-encrypted, ${alreadyCurrent} already on the active version (of ${rows.length} total).`,
  );
  if (rotated > 0) {
    console.log(
      "Re-run this script (safe/idempotent) to confirm 0 rows remain on an old version before retiring that key's env var — this run's own updates aren't reflected in the count above since rows were read once at start.",
    );
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => {
    // See backfillEncryptPii.ts — same note on pool lifetime.
  });
