import { and, eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { cardQuerySchema } from '@correlliayards/shared'
import { db } from '../../db/client.js'
import { cards } from '../../db/schema.js'
import { etagFor, notModified } from '../../http/conditional.js'
import { notFound, parseQuery } from '../../http/errors.js'
import { idParam } from '../../http/guards.js'
import { registerRateLimit } from '../../http/rate-limit.js'
import { cardFields, listCards, toCard } from './card-rows.js'
import { collectionEtag, loadCollectionDetail } from './collection-rows.js'

/* The unauthenticated surface — what a shared link points at.
 *
 * Two things are different here and both are deliberate. There is no session,
 * so `published` does the work `owner_sub` does everywhere else: it is the only
 * thing standing between a request and a row, which is why it appears in every
 * WHERE below rather than being checked after the fact.
 *
 * And an unpublished card answers 404, not 403. A 403 confirms that the id
 * exists, which is precisely what an unauthenticated caller should not be able
 * to learn — uuids are guessable in the sense that matters: they leak, and the
 * difference between "no such card" and "a card you may not see" is the whole
 * signal someone walking a list of leaked ids is looking for. */

/** Anonymous traffic gets a budget. See the note in http/rate-limit.ts about
 *  what this is and is not: a courtesy against a scraper in a tight loop, not a
 *  security control. Generous enough that a person clicking through published
 *  cards will never see it. */
const RATE_LIMIT = { max: 120, windowMs: 60_000 }

/** Published content is the same for everyone, so it may be cached by shared
 *  caches. A minute is short enough that unpublishing takes effect while
 *  someone is still looking at the tab. */
const PUBLIC_CACHE = 'public, max-age=60'

export async function registerPublicRoutes(scope: FastifyInstance): Promise<void> {
  registerRateLimit(scope, RATE_LIMIT)

  scope.get('/cards/:id', async (request, reply) => {
    const id = idParam(request)
    const [row] = await db
      .select(cardFields)
      .from(cards)
      .where(and(eq(cards.id, id), eq(cards.published, true)))
      .limit(1)

    if (!row) throw notFound('No such published card.')

    const etag = etagFor(row.updatedAt, row.publishedAt)
    if (notModified(request, reply, etag)) return reply

    reply.header('etag', etag)
    reply.header('cache-control', PUBLIC_CACHE)
    return toCard(row)
  })

  /* A published collection shows every card it holds, whether or not those
     cards are published in their own right.
   *
   * This is a decision worth being explicit about, because the alternative is
   * defensible too. Publishing a collection is a deliberate act on a set the
   * owner assembled, and a shared list that silently omits half its entries is
   * broken in a way the person who shared it cannot see. So the collection is
   * the unit of publication here, and being in a published collection is what
   * makes a card visible through it.
   *
   * What it does not do is make those cards public in general: each still
   * answers 404 at /public/cards/:id until it is published on its own. */
  scope.get('/collections/:id', async (request, reply) => {
    const id = idParam(request)
    const detail = await loadCollectionDetail(db, id, { kind: 'public' })
    if (!detail) throw notFound('No such published collection.')

    const etag = collectionEtag(detail)
    if (notModified(request, reply, etag)) return reply

    reply.header('etag', etag)
    reply.header('cache-control', PUBLIC_CACHE)
    return detail
  })

  /* Browse everything published. Optional, in the sense that publishing works
     without it — but a published card nobody can find is only reachable by
     someone who already has the link, and this is what makes the feature worth
     having. Same filters and same keyset paging as the private list; the only
     difference is the scope. */
  scope.get('/cards', async (request, reply) => {
    const query = parseQuery(cardQuerySchema, request.query)
    const page = await listCards(query, { kind: 'public' })

    reply.header('cache-control', PUBLIC_CACHE)
    return page
  })
}
