import { sql } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import { db, pool } from './client.js'
import { orphanPredicate } from './sweep-assets.js'

/* The sweep issues a DELETE against people's pictures, so the predicate
 * deciding what it hits is the one thing here worth proving rather than
 * reasoning about.
 *
 * It cannot be proven without a Postgres: it is jsonb traversal, a lateral
 * set-returning function and an anti-join, none of which has a meaningful
 * JavaScript stand-in — a fake would only assert that the fake agrees with
 * itself. So this needs a real database and skips without one:
 *
 *     TEST_DATABASE_URL=postgres://... npm test
 *
 * Any empty scratch database will do. It creates no tables and writes nothing:
 * the CTEs below are named `assets` and `cards`, which shadow the real tables
 * for the whole statement — the NOT EXISTS included — so the predicate runs
 * against five literal rows and reads nothing that belongs to anyone. */

const HAVE_DB = Boolean(process.env.TEST_DATABASE_URL)

const GRACE_SECONDS = 60 * 60

/** The five cases that matter, as literal rows.
 *
 *  `ddd` is the one worth reading twice: it belongs to bob and is named by
 *  alice's card. The owner match inside the anti-join is what makes it an
 *  orphan, and dropping that match is a plausible simplification that would
 *  quietly keep it — or, for a row the other way round, quietly delete a
 *  picture that was still in use. */
const FIXTURE = sql`
  with assets(id, owner_sub, byte_size, created_at) as (
    values
      ('aaa'::text, 'alice'::text, 10, now() - interval '2 hours'),
      ('bbb',       'alice',       20, now() - interval '2 hours'),
      ('ccc',       'alice',       30, now() - interval '5 minutes'),
      ('ddd',       'bob',         40, now() - interval '2 hours'),
      ('eee',       'bob',         50, now() - interval '2 hours')
  ),
  cards(owner_sub, document) as (
    values
      ('alice'::text, '{"data":{"artwork":{"thumbnail":"aaa","schematic":null,"tinycon":"ddd"}}}'::jsonb),
      ('bob',         '{"data":{"artwork":{"portrait":"eee","tinycon":null}}}'::jsonb),
      ('bob',         '{"data":{}}'::jsonb),
      ('bob',         '{"data":{"artwork":"not-an-object"}}'::jsonb)
  )
`

async function orphans(): Promise<string[]> {
  const { rows } = await db.execute(sql`
    ${FIXTURE}
    select a.id from assets a where ${orphanPredicate(GRACE_SECONDS)} order by a.id
  `)
  return rows.map((r) => String(r.id))
}

describe.skipIf(!HAVE_DB)('orphanPredicate', () => {
  afterAll(async () => {
    await pool.end()
  })

  it('selects exactly the unreferenced rows past the grace period', async () => {
    expect(await orphans()).toEqual(['bbb', 'ddd'])
  })

  it('keeps a picture its owner still refers to', async () => {
    expect(await orphans()).not.toContain('aaa')
  })

  it('keeps anything inside the grace period, referenced or not', async () => {
    // ccc is unreferenced. It survives only because it is five minutes old —
    // which is the case for a picture uploaded into an editor still being
    // typed into, and the reason the grace period exists at all.
    expect(await orphans()).not.toContain('ccc')
  })

  it('does not let one owner’s card protect another owner’s row', async () => {
    // ddd belongs to bob; only alice's card names it.
    expect(await orphans()).toContain('ddd')
  })

  it('reads slots it was never told about', async () => {
    // eee sits in `portrait`, a squadron slot. Nothing here names the slots —
    // that is the point, so a new one in shared/artwork.ts needs no edit here.
    expect(await orphans()).not.toContain('eee')
  })

  it('survives a card whose artwork is not an object', async () => {
    // jsonb_each_text raises on a non-object, which would abort the whole
    // statement and leave the sweep permanently broken by one bad row. Getting
    // an answer at all is the assertion.
    await expect(orphans()).resolves.toBeInstanceOf(Array)
  })

  it('collects nothing when the grace period covers everything', async () => {
    const { rows } = await db.execute(sql`
      ${FIXTURE}
      select a.id from assets a where ${orphanPredicate(60 * 60 * 24 * 365)}
    `)
    expect(rows).toHaveLength(0)
  })
})

describe.skipIf(HAVE_DB)('orphanPredicate (skipped)', () => {
  it('needs TEST_DATABASE_URL to run', () => {
    expect(HAVE_DB).toBe(false)
  })
})
