/** Every URL the app answers to, in one place.
 *
 *  The public two mirror `apps/api/src/http/public-url.ts`, which is what
 *  actually mints the links that get pasted around — `/c/:id/:slug` for a card,
 *  `/k/:id/:slug` for a collection, with the slug decorative and the uuid the
 *  only part that resolves. That file is the source of truth for their shape;
 *  these are the patterns the SPA matches them with.
 *
 *  Nothing here is prefixed `/api`, and nothing under `/api` is routed here —
 *  that separation is the reason the data routes were given the prefix in the
 *  first place (see docs/api-routes.md). */
export const paths = {
  editor: '/',
  cards: '/cards',
  collections: '/collections',
  account: '/account',
  /* The slug is optional so a hand-trimmed link — everything after the uuid
     deleted — still resolves rather than falling through to the 404. */
  publicCard: '/c/:id/:slug?',
  publicCollection: '/k/:id/:slug?',
} as const
