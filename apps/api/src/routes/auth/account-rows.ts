import { eq, sql } from 'drizzle-orm'
import type { Account } from '@correlliayards/shared'
import { db } from '../../db/client.js'
import { users } from '../../db/schema.js'

/* The `users` table, which exists for one fact OIDC has no claim for: when
 * someone joined. See the table's own comment in db/schema.ts.
 *
 * Named to match card-rows.ts and collection-rows.ts — row access for one
 * route group, kept out of the route file so the route reads as HTTP. */

/** Timestamps cross the wire as ISO 8601 strings, never as `Date`. A `Date`
 *  here would be a lie the compiler cannot catch: JSON.parse hands the SPA back
 *  a string, and `.getFullYear()` on it type-checks and then throws. */
function toAccount(row: typeof users.$inferSelect): Account {
  return {
    sub: row.sub,
    registeredAt: row.registeredAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
  }
}

/** Note this login. Creates the row the first time and touches only
 *  `last_seen_at` afterwards — which is precisely what keeps `registered_at`
 *  meaning "first seen" rather than "seen most recently".
 *
 *  `now()` rather than a JavaScript `Date` so the clock is Postgres's, the same
 *  one that filled the column's default. Two clocks writing one column is how a
 *  row ends up last seen before it was registered. */
export async function recordLogin(sub: string): Promise<Account> {
  const [row] = await db
    .insert(users)
    .values({ sub })
    .onConflictDoUpdate({ target: users.sub, set: { lastSeenAt: sql`now()` } })
    .returning()

  return toAccount(row)
}

export async function findAccount(sub: string): Promise<Account | null> {
  const [row] = await db.select().from(users).where(eq(users.sub, sub)).limit(1)
  return row ? toAccount(row) : null
}
