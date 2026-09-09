import { createHash } from 'node:crypto'
import { and, asc, eq } from 'drizzle-orm'
import type { CollectionDetail } from '@correlliayards/shared'
import { db, type DbExecutor } from '../../db/client.js'
import { cards, collectionCards, collections } from '../../db/schema.js'
import { summaryFields, toSummary } from './card-rows.js'
import { etagFor } from '../../http/conditional.js'

/* The collection read path, kept out of the route module for the same reason
   card-rows.ts is: both the private and the public surface need it, and a route
   file importing from another route file to reach a query is a layer that has
   stopped being one. */

/** Which collections a read may see — the same idea as CardScope in
 *  card-rows.ts, and required as an argument for the same reason: forgetting it
 *  should be a compile error, not a listing of everyone's collections. */
export type CollectionScope = { kind: 'owner'; ownerSub: string } | { kind: 'public' }

const scopeCondition = (scope: CollectionScope) =>
  scope.kind === 'owner'
    ? eq(collections.ownerSub, scope.ownerSub)
    : eq(collections.published, true)

/** Every column. A collection has no jsonb document, so this is the whole row. */
export const collectionFields = {
  id: collections.id,
  ownerSub: collections.ownerSub,
  name: collections.name,
  description: collections.description,
  published: collections.published,
  publishedAt: collections.publishedAt,
  createdAt: collections.createdAt,
  updatedAt: collections.updatedAt,
}

/* Row type taken from the builder, as in card-rows.ts — nothing runs until one
   is awaited, and it keeps the nullability of publishedAt rather than restating
   the row by hand and getting it subtly wrong. */
const collectionSelect = db.select(collectionFields).from(collections)
export type CollectionRow = Awaited<typeof collectionSelect>[number]

/* No Zod parse on the way out, unlike a card. Every field here is a typed
   column rather than a jsonb document, so there is nothing the database could
   hand back that the compiler has not already checked — the only conversion is
   the timestamps, which cross the wire as ISO strings for the reason set out in
   shared/user.ts. */
export function toEnvelope(row: CollectionRow) {
  return {
    id: row.id,
    ownerSub: row.ownerSub,
    name: row.name,
    description: row.description,
    published: row.published,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** One collection with its ordered card summaries.
 *
 *  Takes an executor rather than reaching for `db` itself: the membership write
 *  wants this result from inside its own transaction, where the rows it has just
 *  inserted exist. */
export async function loadCollectionDetail(
  executor: DbExecutor,
  id: string,
  scope: CollectionScope,
): Promise<CollectionDetail | undefined> {
  const [row] = await executor
    .select(collectionFields)
    .from(collections)
    .where(and(eq(collections.id, id), scopeCondition(scope)))
    .limit(1)

  if (!row) return undefined

  /* Ordered by position, which is the column the join table exists to hold —
     the cards' own order is not the collection's order. */
  const memberRows = await executor
    .select(summaryFields)
    .from(collectionCards)
    .innerJoin(cards, eq(cards.id, collectionCards.cardId))
    .where(eq(collectionCards.collectionId, id))
    .orderBy(asc(collectionCards.position))

  return { ...toEnvelope(row), cards: memberRows.map(toSummary) }
}

/** The cache validator for a collection.
 *
 *  A collection's body embeds its members' summaries, so it changes when a
 *  member is added, removed, reordered, renamed or published — none of which
 *  touch `collections.updated_at`. Folding the members into the tag is what
 *  stops a client revalidating and being told 304 while holding a list that no
 *  longer exists.
 *
 *  Each member contributes its id, its own version and its publish state, in
 *  order; publish state has to be named explicitly because publishing a card
 *  deliberately does not move its updatedAt either. Hashed rather than
 *  concatenated so the header stays one line whatever the collection holds. */
export function collectionEtag(detail: CollectionDetail): string {
  const fingerprint = detail.cards
    .map((card) => `${card.id}:${card.updatedAt}:${card.published ? 1 : 0}`)
    .join('|')

  const members = createHash('sha1').update(fingerprint).digest('base64url').slice(0, 16)
  return etagFor(new Date(detail.updatedAt), detail.publishedAt, detail.cards.length, members)
}
