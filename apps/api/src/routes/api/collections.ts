import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import {
  collectionCardsWriteSchema,
  collectionWriteSchema,
  type CollectionDetail,
  type CollectionSummary,
  type PublishResult,
} from '@correlliayards/shared'
import { db, type DbExecutor } from '../../db/client.js'
import { cards, collectionCards, collections } from '../../db/schema.js'
import { assertIfMatch, etagFor, notModified } from '../../api/conditional.js'
import { badRequest, conflict, notFound, parseBody } from '../../api/errors.js'
import { idParam, ownerSub, requireApiAuth } from '../../api/guards.js'
import { publicUrlFor } from '../../api/public-url.js'
import { summaryFields, toSummary } from './card-rows.js'

/* Collections. The same shape of route as cards — client-minted id, idempotent
   PUT, ownership in every WHERE — with one addition: membership is a resource
   of its own at /cards.

   That split is the whole design. Membership is replaced wholesale, so one
   idempotent write covers add, remove and reorder together and matches how the
   editor already holds its state. Per-item POST and DELETE routes would still
   have needed a separate reorder endpoint, and three ways to change a list is
   three ways for two tabs to disagree about what the list is. */

const COLLECTION_BODY_LIMIT = 64 * 1024

const collectionFields = {
  id: collections.id,
  ownerSub: collections.ownerSub,
  name: collections.name,
  description: collections.description,
  published: collections.published,
  publishedAt: collections.publishedAt,
  createdAt: collections.createdAt,
  updatedAt: collections.updatedAt,
}

type CollectionRow = {
  id: string
  name: string
  description: string
  published: boolean
  publishedAt: Date | null
  createdAt: Date
  updatedAt: Date
  ownerSub: string
}

/* No Zod parse on the way out, unlike a card. Every field here is a typed
   column rather than a jsonb document, so there is nothing the database could
   hand back that the compiler has not already checked — the only conversion is
   the timestamps, which cross the wire as ISO strings for the reason set out in
   shared/user.ts. */
function toEnvelope(row: CollectionRow) {
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

/** Which collections a read may see — the same idea as CardScope, and required
 *  for the same reason. */
export type CollectionScope = { kind: 'owner'; ownerSub: string } | { kind: 'public' }

const scopeCondition = (scope: CollectionScope) =>
  scope.kind === 'owner'
    ? eq(collections.ownerSub, scope.ownerSub)
    : eq(collections.published, true)

/** One collection with its ordered card summaries.
 *
 *  Shared by the private read, the public read and the membership write, which
 *  is why it takes an executor: the write wants the result from inside its own
 *  transaction, where the rows it just inserted exist. */
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

export async function registerCollectionRoutes(scope: FastifyInstance): Promise<void> {
  scope.get('/collections', { preHandler: requireApiAuth }, async (request, reply) => {
    /* Counted rather than loaded. A sidebar of collections has no use for the
       cards inside them, and fetching them would turn one query into one per
       collection. */
    const rows = await db
      .select({
        ...collectionFields,
        cardCount: sql<number>`count(${collectionCards.cardId})::int`,
      })
      .from(collections)
      .leftJoin(collectionCards, eq(collectionCards.collectionId, collections.id))
      .where(eq(collections.ownerSub, ownerSub(request)))
      .groupBy(collections.id)
      .orderBy(desc(collections.updatedAt), desc(collections.id))

    const items: CollectionSummary[] = rows.map((row) => ({
      ...toEnvelope(row),
      cardCount: row.cardCount,
    }))

    reply.header('cache-control', 'private, no-cache')
    return { items }
  })

  scope.get('/collections/:id', { preHandler: requireApiAuth }, async (request, reply) => {
    const id = idParam(request)
    const detail = await loadCollectionDetail(db, id, {
      kind: 'owner',
      ownerSub: ownerSub(request),
    })
    if (!detail) throw notFound('No such collection.')

    const etag = etagFor(new Date(detail.updatedAt))
    if (notModified(request, reply, etag)) return reply

    reply.header('etag', etag)
    reply.header('cache-control', 'private, no-cache')
    return detail
  })

  /* Create or replace the collection itself. Its membership is untouched — a
     rename is not a reason to restate forty card ids, and a client that had to
     would be one dropped field away from emptying the collection. */
  scope.put(
    '/collections/:id',
    { preHandler: requireApiAuth, bodyLimit: COLLECTION_BODY_LIMIT },
    async (request, reply) => {
      const id = idParam(request)
      const owner = ownerSub(request)
      const body = parseBody(collectionWriteSchema, request.body)

      if (body.id !== undefined && body.id !== id) {
        throw badRequest('The id in the body does not match the id in the path.')
      }

      const now = new Date()

      const result = await db.transaction(async (tx) => {
        const [existing] = await tx
          .select({ ownerSub: collections.ownerSub, updatedAt: collections.updatedAt })
          .from(collections)
          .where(eq(collections.id, id))
          .for('update')
          .limit(1)

        if (existing && existing.ownerSub !== owner) throw notFound('No such collection.')
        assertIfMatch(request, existing ? etagFor(existing.updatedAt) : undefined)

        const [row] = await tx
          .insert(collections)
          .values({
            id,
            ownerSub: owner,
            name: body.name,
            description: body.description,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: collections.id,
            set: { name: body.name, description: body.description, updatedAt: now },
            setWhere: eq(collections.ownerSub, owner),
          })
          .returning({ ...collectionFields, inserted: sql<boolean>`(xmax = 0)` })

        if (!row) {
          throw conflict('That id belongs to another user, and cannot be written here.')
        }
        return row
      })

      reply.header('etag', etagFor(result.updatedAt))
      reply.header('cache-control', 'no-store')
      return reply.code(result.inserted ? 201 : 200).send(toEnvelope(result))
    },
  )

  scope.delete('/collections/:id', { preHandler: requireApiAuth }, async (request, reply) => {
    const id = idParam(request)
    const [row] = await db
      .delete(collections)
      .where(and(eq(collections.id, id), eq(collections.ownerSub, ownerSub(request))))
      .returning({ id: collections.id })

    if (!row) throw notFound('No such collection.')

    /* The membership rows go with it, by the cascade on
       collection_cards.collection_id. The cards themselves do not — that
       cascade is only on the other foreign key, which is where the documented
       promise that a collection's cards survive it is actually kept. */
    return reply.code(204).send()
  })

  /* Membership, replaced whole. Add, remove and reorder are all this request. */
  scope.put(
    '/collections/:id/cards',
    { preHandler: requireApiAuth, bodyLimit: COLLECTION_BODY_LIMIT },
    async (request, reply) => {
      const id = idParam(request)
      const owner = ownerSub(request)
      const { cardIds } = parseBody(collectionCardsWriteSchema, request.body)

      const detail = await db.transaction(async (tx) => {
        const [existing] = await tx
          .select({ updatedAt: collections.updatedAt })
          .from(collections)
          .where(and(eq(collections.id, id), eq(collections.ownerSub, owner)))
          .for('update')
          .limit(1)

        if (!existing) throw notFound('No such collection.')
        assertIfMatch(request, etagFor(existing.updatedAt))

        if (cardIds.length > 0) {
          /* Every id must be a card of this user's. Without this check a
             collection would be a way to hold — and, once published, to
             show — cards belonging to someone else, which is the ownership
             rule the rest of the API keeps, sidestepped by one join.

             The foreign key alone would not do it: it only requires the card to
             exist, not to be yours. */
          const owned = await tx
            .select({ id: cards.id })
            .from(cards)
            .where(and(inArray(cards.id, cardIds), eq(cards.ownerSub, owner)))

          if (owned.length !== cardIds.length) {
            const found = new Set(owned.map((card) => card.id))
            const missing = cardIds.filter((cardId) => !found.has(cardId))
            /* One message for "no such card" and "not your card" together —
               the same reasoning as the 404s elsewhere, and the client already
               knows the ids because it sent them. */
            throw badRequest(
              'Some of those cards do not exist.',
              missing.map((cardId) => ({ path: 'cardIds', message: `Unknown card ${cardId}.` })),
            )
          }
        }

        /* Delete then insert, in that order and in one transaction, which is
           what lets collection_cards_position_key be a plain unique constraint
           instead of a deferred one: no two rows ever hold the same position,
           not even momentarily. */
        await tx.delete(collectionCards).where(eq(collectionCards.collectionId, id))

        if (cardIds.length > 0) {
          await tx.insert(collectionCards).values(
            cardIds.map((cardId, position) => ({ collectionId: id, cardId, position })),
          )
        }

        /* Membership is part of what the collection is, so changing it is a
           content write and moves the version the ETag is built from. */
        await tx.update(collections).set({ updatedAt: new Date() }).where(eq(collections.id, id))

        return loadCollectionDetail(tx, id, { kind: 'owner', ownerSub: owner })
      })

      if (!detail) throw notFound('No such collection.')

      reply.header('etag', etagFor(new Date(detail.updatedAt)))
      reply.header('cache-control', 'no-store')
      return detail
    },
  )

  // -------------------------------------------------------------------------
  // Publishing
  // -------------------------------------------------------------------------

  scope.post('/collections/:id/publish', { preHandler: requireApiAuth }, async (request, reply) => {
    const id = idParam(request)
    const [row] = await db
      .update(collections)
      .set({ published: true, publishedAt: sql`coalesce(${collections.publishedAt}, now())` })
      .where(and(eq(collections.id, id), eq(collections.ownerSub, ownerSub(request))))
      .returning({ name: collections.name, publishedAt: collections.publishedAt })

    if (!row || !row.publishedAt) throw notFound('No such collection.')

    const result: PublishResult = {
      published: true,
      publishedAt: row.publishedAt.toISOString(),
      url: publicUrlFor('collection', id, row.name),
    }
    reply.header('cache-control', 'no-store')
    return result
  })

  scope.delete(
    '/collections/:id/publish',
    { preHandler: requireApiAuth },
    async (request, reply) => {
      const id = idParam(request)
      const [row] = await db
        .update(collections)
        .set({ published: false, publishedAt: null })
        .where(and(eq(collections.id, id), eq(collections.ownerSub, ownerSub(request))))
        .returning({ id: collections.id })

      if (!row) throw notFound('No such collection.')
      return reply.code(204).send()
    },
  )
}
