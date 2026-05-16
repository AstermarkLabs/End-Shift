import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import type { AuthedUser } from "../middlewares/auth";

/**
 * Returns the set of org_unit IDs that a caller is permitted to see,
 * or null if the caller has no org-unit restriction (tenant-wide or system).
 *
 * The subtree is computed via a Postgres recursive CTE so even deep
 * hierarchies (region → district → location) are resolved in one query.
 */
export async function visibleOrgUnitIds(
  caller: AuthedUser,
): Promise<number[] | null> {
  if (caller.role.isSystem) return null;
  if (!caller.tenantId) return null;
  if (!caller.orgUnitId) return null;

  const result = await db.execute<{ id: number }>(sql`
    WITH RECURSIVE subtree AS (
      SELECT id FROM org_units WHERE id = ${caller.orgUnitId}
      UNION ALL
      SELECT o.id
      FROM org_units o
      JOIN subtree s ON o.parent_id = s.id
    )
    SELECT id FROM subtree
  `);
  return result.rows.map((r) => r.id);
}

/**
 * Returns all org_unit IDs in the subtree rooted at rootId.
 * Used when validating whether a target org unit is within the caller's scope.
 */
export async function orgUnitSubtreeIds(rootId: number): Promise<number[]> {
  const result = await db.execute<{ id: number }>(sql`
    WITH RECURSIVE subtree AS (
      SELECT id FROM org_units WHERE id = ${rootId}
      UNION ALL
      SELECT o.id
      FROM org_units o
      JOIN subtree s ON o.parent_id = s.id
    )
    SELECT id FROM subtree
  `);
  return result.rows.map((r) => r.id);
}
