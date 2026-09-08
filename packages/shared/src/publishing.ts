// ---------------------------------------------------------------------------
// What the four publish routes return.
//
// The URL is built server-side and handed back rather than assembled by the
// client, because the client does not know the public origin — the SPA and the
// API can be served from different hosts, and a link the user is about to paste
// into Discord must be the one that works from outside.
// ---------------------------------------------------------------------------

import { z } from 'zod'

export const publishResultSchema = z.object({
  published: z.literal(true),
  publishedAt: z.iso.datetime(),
  /** Absolute, and shaped `/c/:id/:slug` for a card or `/k/:id/:slug` for a
   *  collection. The slug is decorative: it is derived from the name at the
   *  moment of publishing and nothing resolves it, so renaming a published card
   *  does not break links already in circulation. */
  url: z.url(),
})
export type PublishResult = z.infer<typeof publishResultSchema>
