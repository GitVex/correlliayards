import { and, eq, sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import {
  cardQuerySchema,
  cardWriteSchema,
  type Card,
  type CardWrite,
  type PublishResult,
} from '@correlliayards/shared'
import { db } from '../../db/client.js'
import { cards, type CardDocument } from '../../db/schema.js'
import { assertIfMatch, etagFor, notModified } from '../../api/conditional.js'
import { badRequest, conflict, notFound, parseBody, parseQuery } from '../../api/errors.js'
import { idParam, ownerSub, requireApiAuth } from '../../api/guards.js'
import { publicUrlFor } from '../../api/public-url.js'
import { cardFields, listCards, toCard } from './card-rows.js'

/* The card routes. Every one of them is scoped by owner_sub, and that is not
   only the id lookup: `WHERE id = $1 AND owner_sub = $2` matching zero rows is
   both the "no such card" answer and the authorisation check, which is why
   there is no separate permission test anywhere in this file. Looking a card up
   by id alone and then comparing the owner would be one forgotten comparison
   away from letting any authenticated user read any card they can name — and
   uuids are not secret, they turn up in urls, logs and browser history. */

/** A card body is a printed card: some text, some numbers, a token. It has no
 *  business being large, and the artwork fields are references rather than
 *  images. Set per route rather than server-wide so the limit is stated where
 *  the shape it applies to is. */
const CARD_BODY_LIMIT = 256 * 1024

/** Split the validated write into the columns and the jsonb document.
 *
 *  This is the one place the storage layout is applied, and it is deliberately
 *  a total function over the union: adding a fourth kind makes this fail to
 *  compile rather than quietly storing a document nothing can read back. */
function toDocument(body: CardWrite): CardDocument {
  switch (body.kind) {
    case 'ship':
      return { data: body.data, token: body.token }
    case 'squadron':
      return { data: body.data }
    case 'upgrade':
      return { data: body.data }
  }
}

export async function registerCardRoutes(scope: FastifyInstance): Promise<void> {
  /* Own cards as summaries. Filtering, sorting and paging all live in the query
     string — see the reasoning in shared/query.ts. */
  scope.get('/cards', { preHandler: requireApiAuth }, async (request, reply) => {
    const query = parseQuery(cardQuerySchema, request.query)
    const page = await listCards(query, { kind: 'owner', ownerSub: ownerSub(request) })

    /* Private, because this is one user's library, and no-cache rather than
       no-store so a browser may keep it and revalidate. */
    reply.header('cache-control', 'private, no-cache')
    return page
  })

  scope.get('/cards/:id', { preHandler: requireApiAuth }, async (request, reply) => {
    const id = idParam(request)
    const [row] = await db
      .select(cardFields)
      .from(cards)
      .where(and(eq(cards.id, id), eq(cards.ownerSub, ownerSub(request))))
      .limit(1)

    if (!row) throw notFound('No such card.')

    const etag = etagFor(row.updatedAt)
    /* Returns true having already sent a 304. The editor re-opening a card it
       still holds then costs headers rather than a document. */
    if (notModified(request, reply, etag)) return reply

    reply.header('etag', etag)
    reply.header('cache-control', 'private, no-cache')
    return toCard(row)
  })

  /* Create or replace. PUT rather than POST because the editor mints the uuid,
     so a card is addressable before it has ever been saved and there is no
     create-versus-update for the client to track. That makes saving idempotent,
     which is what you want when an autosave retries over a flaky connection. */
  scope.put(
    '/cards/:id',
    { preHandler: requireApiAuth, bodyLimit: CARD_BODY_LIMIT },
    async (request, reply) => {
      const id = idParam(request)
      const owner = ownerSub(request)
      const body = parseBody(cardWriteSchema, request.body)

      if (body.id !== undefined && body.id !== id) {
        throw badRequest('The id in the body does not match the id in the path.')
      }

      const document = toDocument(body)
      const now = new Date()

      const result = await db.transaction(async (tx) => {
        /* Locked, because If-Match is a read-modify-write and is only an
           optimistic concurrency check if nothing can land between the two
           halves. On a row that does not exist yet there is nothing to lock,
           and nothing to have raced with either. */
        const [existing] = await tx
          .select({ ownerSub: cards.ownerSub, updatedAt: cards.updatedAt })
          .from(cards)
          .where(eq(cards.id, id))
          .for('update')
          .limit(1)

        /* Someone else's uuid. 404 and not 403, for the reason at the top of
           this file — a 403 would confirm the id is real. */
        if (existing && existing.ownerSub !== owner) throw notFound('No such card.')

        assertIfMatch(request, existing ? etagFor(existing.updatedAt) : undefined)

        const [row] = await tx
          .insert(cards)
          .values({
            id,
            ownerSub: owner,
            kind: body.kind,
            name: body.name,
            faction: body.faction,
            points: body.points,
            document,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: cards.id,
            set: {
              kind: body.kind,
              name: body.name,
              faction: body.faction,
              points: body.points,
              document,
              updatedAt: now,
            },
            /* The ownership check, restated where it also covers the race: if
               another user claimed this uuid between the select above and this
               statement, the update matches nothing and returns no row rather
               than overwriting theirs. createdAt and the publish columns are
               absent from `set` on purpose — a replace is a content write, and
               it may not reset when a card was made or whether it is public. */
            setWhere: eq(cards.ownerSub, owner),
          })
          .returning({
            ...cardFields,
            /* Postgres exposes the inserting transaction id as xmax on the
               returned row, and it is zero only for a row this statement
               inserted. It is the one way to tell an upsert's two outcomes
               apart without a second query. */
            inserted: sql<boolean>`(xmax = 0)`,
          })

        if (!row) {
          throw conflict('That id belongs to another user, and cannot be written here.')
        }
        return row
      })

      const card: Card = toCard(result)
      reply.header('etag', etagFor(result.updatedAt))
      reply.header('cache-control', 'no-store')
      return reply.code(result.inserted ? 201 : 200).send(card)
    },
  )

  scope.delete('/cards/:id', { preHandler: requireApiAuth }, async (request, reply) => {
    const id = idParam(request)
    const [row] = await db
      .delete(cards)
      .where(and(eq(cards.id, id), eq(cards.ownerSub, ownerSub(request))))
      .returning({ id: cards.id })

    if (!row) throw notFound('No such card.')

    /* Membership rows in any collection holding this card go with it, by the
       cascade declared on collection_cards.card_id. */
    return reply.code(204).send()
  })

  // -------------------------------------------------------------------------
  // Publishing
  // -------------------------------------------------------------------------

  /* Its own route rather than a field on PUT, because publishing is a
     visibility decision and not a content edit. Keeping them apart is what
     stops an autosave from being able to make a card public, or from quietly
     unpublishing one by echoing back a body it read before the user published.

     Note what the update does not touch: updated_at. That column is the ETag,
     and moving it here would invalidate the version an open editor is holding —
     the user would publish from one tab and get a 412 on their next keystroke
     in the other. */
  scope.post('/cards/:id/publish', { preHandler: requireApiAuth }, async (request, reply) => {
    const id = idParam(request)
    const [row] = await db
      .update(cards)
      .set({
        published: true,
        /* Idempotent: publishing an already-published card leaves the original
           date alone, so the route can be retried. Unpublishing clears it, so a
           card that is published again starts the clock afresh. */
        publishedAt: sql`coalesce(${cards.publishedAt}, now())`,
      })
      .where(and(eq(cards.id, id), eq(cards.ownerSub, ownerSub(request))))
      .returning({ name: cards.name, publishedAt: cards.publishedAt })

    if (!row || !row.publishedAt) throw notFound('No such card.')

    const result: PublishResult = {
      published: true,
      publishedAt: row.publishedAt.toISOString(),
      url: publicUrlFor('card', id, row.name),
    }
    reply.header('cache-control', 'no-store')
    return result
  })

  scope.delete('/cards/:id/publish', { preHandler: requireApiAuth }, async (request, reply) => {
    const id = idParam(request)
    const [row] = await db
      .update(cards)
      .set({ published: false, publishedAt: null })
      .where(and(eq(cards.id, id), eq(cards.ownerSub, ownerSub(request))))
      .returning({ id: cards.id })

    if (!row) throw notFound('No such card.')
    return reply.code(204).send()
  })
}
