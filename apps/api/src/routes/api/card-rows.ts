import { and, asc, desc, eq, gte, ilike, isNull, lte, sql, type SQL } from 'drizzle-orm'
import {
  cardSchema,
  cardSummarySchema,
  cardSortSchema,
  sortOrderSchema,
  FACTION_NONE,
  type Card,
  type CardQuery,
  type CardSummary,
  type Page,
} from '@correlliayards/shared'
import { z } from 'zod'
import { db } from '../../db/client.js'
import { cards } from '../../db/schema.js'
import { badRequest } from '../../api/errors.js'

/* Everything both card list endpoints share. `GET /api/cards` and
   `GET /api/public/cards` differ in exactly one clause — whose rows they are
   allowed to see — so they are the same function with a scope argument rather
   than two implementations that have to be kept filtering identically. */

/** Which rows a list may return. The only difference between the private and
 *  public surfaces, and therefore the only thing that must never be defaulted:
 *  a scope is a required argument so that forgetting it is a compile error and
 *  not a listing of everyone's cards. */
export type CardScope = { kind: 'owner'; ownerSub: string } | { kind: 'public' }

const scopeCondition = (scope: CardScope): SQL =>
  scope.kind === 'owner' ? eq(cards.ownerSub, scope.ownerSub) : eq(cards.published, true)

// ---------------------------------------------------------------------------
// Projections
// ---------------------------------------------------------------------------

/** The list projection.
 *
 *  Columns, plus the four values summary.ts documents as coming out of the
 *  document by jsonb expression. The point of the whole column/document split
 *  is visible here: a sidebar of two hundred cards is answered by reading
 *  indexed columns and four `->>` lookups, without hydrating or validating two
 *  hundred payloads. */
const summaryFields = {
  id: cards.id,
  kind: cards.kind,
  name: cards.name,
  faction: cards.faction,
  points: cards.points,
  published: cards.published,
  updatedAt: cards.updatedAt,
  /* Each kind names its cover picture differently; the projection resolves that
     here so the list view never has to care which kind a row is. */
  thumbnail: sql<string | null>`case ${cards.kind}
    when 'ship' then ${cards.document} -> 'data' -> 'artwork' ->> 'thumbnail'
    else ${cards.document} -> 'data' -> 'artwork' ->> 'portrait' end`,
  hull: sql<number | null>`(${cards.document} -> 'data' ->> 'hull')::int`,
  baseSize: sql<string | null>`${cards.document} -> 'token' ->> 'baseSize'`,
  squadronType: sql<string | null>`${cards.document} -> 'data' ->> 'squadronType'`,
  /* `unique` is a reserved word in SQL and a property name here; the alias
     keeps the two from having to agree. */
  isUnique: sql<boolean | null>`(${cards.document} -> 'data' ->> 'unique')::boolean`,
  upgradeType: sql<string | null>`${cards.document} -> 'data' ->> 'upgradeType'`,
}

/* The row type, taken from the query builder rather than written out again.
   Drizzle builders are lazy — nothing runs until one is awaited — so declaring
   one here costs a few objects at import and buys a projection whose TypeScript
   shape cannot drift from its SQL. Writing the interface by hand would compile
   just as well right up until a column changed type underneath it. */
const summarySelect = db.select(summaryFields).from(cards)
export type SummaryRow = Awaited<typeof summarySelect>[number]

/** Assemble one projected row into the discriminated summary.
 *
 *  Parsed rather than cast. A row whose document is missing the field its kind
 *  requires is corruption, and it should fail here — loudly, naming the field —
 *  rather than reach the SPA as a summary with `hull: null` that type-checks
 *  everywhere and renders as a blank. */
export function toSummary(row: SummaryRow): CardSummary {
  const envelope = {
    id: row.id,
    name: row.name,
    faction: row.faction,
    points: row.points,
    published: row.published,
    updatedAt: row.updatedAt.toISOString(),
    thumbnail: row.thumbnail,
  }

  switch (row.kind) {
    case 'ship':
      return cardSummarySchema.parse({
        ...envelope,
        kind: 'ship',
        hull: row.hull,
        baseSize: row.baseSize,
      })
    case 'squadron':
      return cardSummarySchema.parse({
        ...envelope,
        kind: 'squadron',
        squadronType: row.squadronType,
        unique: row.isUnique,
      })
    case 'upgrade':
      return cardSummarySchema.parse({
        ...envelope,
        kind: 'upgrade',
        upgradeType: row.upgradeType,
        unique: row.isUnique,
      })
  }
}

/** The full-card projection: every column, document included. */
export const cardFields = {
  id: cards.id,
  ownerSub: cards.ownerSub,
  kind: cards.kind,
  name: cards.name,
  faction: cards.faction,
  points: cards.points,
  published: cards.published,
  publishedAt: cards.publishedAt,
  createdAt: cards.createdAt,
  updatedAt: cards.updatedAt,
  document: cards.document,
}

const cardSelect = db.select(cardFields).from(cards)
export type CardRow = Awaited<typeof cardSelect>[number]

/** A row back into the shape the contract promises.
 *
 *  The document is spread rather than nested, because `data` and `token` are
 *  fields of the card as far as anything outside this file is concerned — the
 *  document is a storage detail, and it stops existing at this boundary. */
export function toCard(row: CardRow): Card {
  return cardSchema.parse({
    id: row.id,
    ownerSub: row.ownerSub,
    kind: row.kind,
    name: row.name,
    faction: row.faction,
    points: row.points,
    published: row.published,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...row.document,
  })
}

// ---------------------------------------------------------------------------
// Cursors
// ---------------------------------------------------------------------------

/* A cursor names the row the next page starts after, in the ordering it was
   minted under. Carrying the sort and order inside it is what makes it safe:
   paging to the second page and then changing the sort would otherwise compare
   a name against a timestamp, which either errors or, worse, does not. */
const cursorSchema = z.object({
  s: cardSortSchema,
  o: sortOrderSchema,
  /** The sort column's value on the last row of the previous page. */
  v: z.union([z.string(), z.number()]),
  i: z.uuid(),
})

function encodeCursor(query: CardQuery, row: { id: string; value: string | number }): string {
  const payload = { s: query.sort, o: query.order, v: row.value, i: row.id }
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

function decodeCursor(raw: string, query: CardQuery): z.infer<typeof cursorSchema> {
  let parsed: unknown
  try {
    parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'))
  } catch {
    throw badRequest('The cursor is not readable. Start the listing again without one.')
  }

  const cursor = cursorSchema.safeParse(parsed)
  if (!cursor.success) {
    throw badRequest('The cursor is not readable. Start the listing again without one.')
  }
  if (cursor.data.s !== query.sort || cursor.data.o !== query.order) {
    throw badRequest(
      'The cursor was issued for a different sort order. Start the listing again without one.',
    )
  }
  return cursor.data
}

// ---------------------------------------------------------------------------
// The listing itself
// ---------------------------------------------------------------------------

const sortColumns = {
  updatedAt: cards.updatedAt,
  points: cards.points,
  name: cards.name,
}

/** `%` and `_` are wildcards in LIKE, so a user searching for "Command_Ship"
 *  would otherwise match anything with a character where the underscore is. */
const escapeLike = (value: string): string => value.replace(/[\\%_]/g, (char) => `\\${char}`)

export async function listCards(query: CardQuery, scope: CardScope): Promise<Page<CardSummary>> {
  const conditions: SQL[] = [scopeCondition(scope)]

  if (query.kind) conditions.push(eq(cards.kind, query.kind))

  if (query.faction) {
    /* The sentinel from shared/query.ts: null in this column means unrestricted,
       which is a thing you can ask for, and distinct from not filtering. */
    conditions.push(
      query.faction === FACTION_NONE ? isNull(cards.faction) : eq(cards.faction, query.faction),
    )
  }

  if (query.minPoints !== undefined) conditions.push(gte(cards.points, query.minPoints))
  if (query.maxPoints !== undefined) conditions.push(lte(cards.points, query.maxPoints))

  if (query.upgradeType !== undefined) {
    /* Written to match cards_upgrade_type_idx exactly — the expression and the
       kind predicate both — or the partial index does not apply and this is a
       scan of every upgrade. The schema guarantees kind is already 'upgrade'
       here; repeating it is what the index needs to see. */
    conditions.push(eq(cards.kind, 'upgrade'))
    conditions.push(sql`${cards.document} -> 'data' ->> 'upgradeType' = ${query.upgradeType}`)
  }

  if (query.unique !== undefined) {
    conditions.push(sql`(${cards.document} -> 'data' ->> 'unique')::boolean = ${query.unique}`)
  }

  if (query.q) conditions.push(ilike(cards.name, `%${escapeLike(query.q)}%`))

  const sortColumn = sortColumns[query.sort]

  if (query.cursor) {
    const cursor = decodeCursor(query.cursor, query)
    /* Row comparison, not a pair of ORs: `(a, b) < (x, y)` is one index range
       scan, where the OR form makes the planner work for the same answer. The
       casts are explicit because the parameters arrive untyped and Postgres
       would otherwise have to guess from a context that does not determine it. */
    const value =
      cursor.s === 'updatedAt'
        ? sql`${new Date(String(cursor.v))}::timestamptz`
        : cursor.s === 'points'
          ? sql`${Number(cursor.v)}::int`
          : sql`${String(cursor.v)}::text`

    conditions.push(
      query.order === 'desc'
        ? sql`(${sortColumn}, ${cards.id}) < (${value}, ${cursor.i}::uuid)`
        : sql`(${sortColumn}, ${cards.id}) > (${value}, ${cursor.i}::uuid)`,
    )
  }

  const ordering =
    query.order === 'desc' ? [desc(sortColumn), desc(cards.id)] : [asc(sortColumn), asc(cards.id)]

  /* One row more than asked for. Its existence is the whole answer to "is there
     another page", which comparing the page length against the limit gets wrong
     precisely when the last page happens to be exactly full. */
  const rows = await db
    .select(summaryFields)
    .from(cards)
    .where(and(...conditions))
    .orderBy(...ordering)
    .limit(query.limit + 1)

  const hasMore = rows.length > query.limit
  const page = hasMore ? rows.slice(0, query.limit) : rows
  const last = page.at(-1)

  return {
    items: page.map(toSummary),
    nextCursor:
      hasMore && last
        ? encodeCursor(query, {
            id: last.id,
            value:
              query.sort === 'updatedAt'
                ? last.updatedAt.toISOString()
                : query.sort === 'points'
                  ? last.points
                  : last.name,
          })
        : null,
  }
}

/** The summary projection, for the one caller that needs it against a join
 *  rather than against the table on its own: a collection's ordered cards. */
export { summaryFields }
