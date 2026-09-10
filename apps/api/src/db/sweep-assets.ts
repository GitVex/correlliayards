import { pathToFileURL } from 'node:url'
import { sql } from 'drizzle-orm'
import { db, pool } from './client.js'

/* Collecting the pictures nothing points at any more.
 *
 * Uploads happen when a picture is picked, not when the card is saved. That is
 * deliberate — it puts the wait where the user is already waiting, and it means
 * a saved card can never name bytes the server does not hold — but it produces
 * garbage as a matter of course rather than as an exception:
 *
 *   - picking a picture and then picking a different one,
 *   - picking a picture and closing the tab without ever saving,
 *   - deleting a card, which leaves its artwork behind.
 *
 * The last of those cannot be fixed with a foreign key. A card names its
 * artwork inside a jsonb document, and nothing can reference into one, which is
 * why this is a sweep rather than an ON DELETE CASCADE.
 *
 * Runs from a scheduler, not from the server: the API has no scheduler of its
 * own and does not want one for a job that runs nightly. See db:sweep in
 * package.json, and the deployment note in the README.
 */

/** Just enough of a logger to run under Fastify's or under bare `console`. */
export interface SweepLog {
  info(obj: object, msg: string): void
}

/** How old a row must be before it is eligible.
 *
 *  This is the whole safety of the job. An asset is uploaded seconds before the
 *  card naming it exists — the editor stores the picture on pick and writes the
 *  card on save, and the gap between those is however long someone spends
 *  typing. A sweep with no lower bound on age would delete a picture out from
 *  under an editor still open. An hour is generous against that and still
 *  collects the same day's garbage. */
export const DEFAULT_GRACE_SECONDS = 60 * 60

export interface SweepOptions {
  /** Rows younger than this are never touched. */
  graceSeconds?: number
  /** Count what would go, delete nothing. What to run the first few times, and
   *  what to run again if a number ever looks wrong. */
  dryRun?: boolean
}

export interface SweepResult {
  /** Rows deleted, or — under dryRun — rows that would have been. */
  count: number
  /** Their total `byte_size`. The number worth watching: this table is bytes in
   *  Postgres, so it is the one that answers "is the sweep keeping up". */
  bytes: number
  dryRun: boolean
}

/** Assets that no card of the same owner refers to, and that are old enough to
 *  be judged on that.
 *
 *  The owner match inside the NOT EXISTS is load-bearing, not tidiness: the
 *  primary key on `assets` is (owner_sub, id), so the same digest can be held
 *  by two people, and a bare `ref.value = a.id` would let one person's card
 *  keep another person's row alive — or, read the other way, would make one
 *  person's deletion depend on a stranger's library.
 *
 *  `jsonb_each_text` over `document -> 'data' -> 'artwork'` rather than three
 *  named keys, because the three kinds have different slots — ships have a
 *  thumbnail, a schematic and a tinycon, squadrons a portrait and a tinycon,
 *  upgrades a portrait — and naming them here would mean this file has to be
 *  edited every time packages/shared/src/artwork.ts gains one. Reading whatever
 *  the object holds is both shorter and harder to get wrong, and a slot that is
 *  null simply yields no row.
 *
 *  The CASE is there because `jsonb_each_text` raises on a non-object. A
 *  missing key gives SQL NULL, which a strict set-returning function answers
 *  with no rows — fine — but a card whose `artwork` was somehow a string or a
 *  number would abort the whole statement. Treating anything that is not an
 *  object as "names no assets" keeps one malformed row from stopping the job,
 *  and it cannot cause a wrongful delete: the worst it does is fail to protect
 *  a reference that was never readable as one.
 *
 *  Exported so it can be exercised on its own. It is the half of this file that
 *  can be wrong in a way that costs someone their pictures, and a check that
 *  re-typed the predicate rather than importing it would be checking a copy. */
export function orphanPredicate(graceSeconds: number) {
  return sql`
    a.created_at < now() - (${graceSeconds}::int * interval '1 second')
    and not exists (
      select 1
      from cards c
      cross join lateral jsonb_each_text(
        case
          when jsonb_typeof(c.document -> 'data' -> 'artwork') = 'object'
            then c.document -> 'data' -> 'artwork'
          else '{}'::jsonb
        end
      ) as ref(slot, value)
      where c.owner_sub = a.owner_sub
        and ref.value = a.id
    )
  `
}

/** Delete every orphan in one statement, across all owners.
 *
 *  One pass rather than a loop per owner: the owner match lives inside the
 *  anti-join, so the planner gets the whole problem at once and a per-owner
 *  loop would only be the same work with more round trips. If this table ever
 *  grows past what a single statement should hold a lock for, the fix named in
 *  docs/api-routes.md is a `card_assets` join table maintained by the card
 *  write — worth doing only once the simple version hurts.
 *
 *  The delete and its accounting are one statement too, via the CTE: counting
 *  first and deleting second would report a number that was already stale, and
 *  RETURNING is what makes the total exact rather than approximately right. */
export async function sweepOrphanAssets(
  log: SweepLog,
  { graceSeconds = DEFAULT_GRACE_SECONDS, dryRun = false }: SweepOptions = {},
): Promise<SweepResult> {
  const where = orphanPredicate(graceSeconds)

  const query = dryRun
    ? sql`
        select count(*)::int as count, coalesce(sum(a.byte_size), 0)::bigint as bytes
        from assets a
        where ${where}
      `
    : sql`
        with deleted as (
          delete from assets a
          where ${where}
          returning a.byte_size
        )
        select count(*)::int as count, coalesce(sum(byte_size), 0)::bigint as bytes
        from deleted
      `

  const started = Date.now()
  const result = await db.execute(query)
  const row = result.rows[0] as { count: number; bytes: string | number } | undefined

  /* `bytes` comes back as a string: pg hands bigint over as text rather than
     silently losing precision past 2^53, and this sum is a total of file sizes
     that has every reason to get large. Number() is safe at the point it is
     only ever logged. */
  const swept: SweepResult = {
    count: row?.count ?? 0,
    bytes: Number(row?.bytes ?? 0),
    dryRun,
  }

  log.info(
    { ...swept, graceSeconds, ms: Date.now() - started },
    dryRun ? 'orphan sweep (dry run) — nothing deleted' : 'orphan sweep complete',
  )

  return swept
}

/** `--dry-run` and `--grace-hours=N`, and nothing else.
 *
 *  Hours rather than seconds on the command line because that is the unit the
 *  decision is actually made in — "leave today's alone", not "leave the last
 *  3600 seconds alone". The function underneath takes seconds so a test does
 *  not have to wait in hours. */
function parseArgs(argv: readonly string[]): SweepOptions {
  const options: SweepOptions = { dryRun: argv.includes('--dry-run') }

  const graceArg = argv.find((a) => a.startsWith('--grace-hours='))
  if (graceArg) {
    const hours = Number(graceArg.slice('--grace-hours='.length))
    if (!Number.isFinite(hours) || hours < 0) {
      throw new Error(`--grace-hours must be a non-negative number, got: ${graceArg}`)
    }
    options.graceSeconds = Math.round(hours * 60 * 60)
  }

  return options
}

async function main(): Promise<void> {
  try {
    await sweepOrphanAssets(console, parseArgs(process.argv.slice(2)))
  } finally {
    /* Or the process hangs on an idle pool client rather than exiting, which in
       a scheduled task reads as a job that never finished. */
    await pool.end()
  }
}

/* Runnable as a file, which is what a scheduled task needs: a Coolify task runs
   `node apps/api/dist/db/sweep-assets.js` inside the running container, with no
   npm in the way. Importing this module — as a test would — runs nothing. */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
