// ---------------------------------------------------------------------------
// A named, ordered set of cards.
//
// The entity `docs/api-routes.md` listed as a prerequisite and nothing else in
// this package modelled. Two shapes go on the wire and they are deliberately
// different: a list of collections returns counts, and one collection returns
// its rows. Fetching the sidebar should not fetch every card in every
// collection, and opening one should not need a second round trip.
//
// Unlike a card, a collection has no jsonb document. Every field it has is
// queried — name and updatedAt to list it, published to serve it publicly — so
// by the rule in card.ts every field is a column, and membership is the join
// table those columns cannot express.
// ---------------------------------------------------------------------------

import { z } from 'zod'
import { cardSummarySchema } from './summary.js'

const collectionEnvelope = z.object({
  /** Client-minted, exactly like a card's: the same "addressable before it is
   *  saved" property, so the same idempotent PUT works here. */
  id: z.uuid(),
  ownerSub: z.string().min(1),
  name: z.string().min(1),
  /** Free text, and empty rather than absent when there is none — the column is
   *  `not null default ''`, so no consumer has to handle two kinds of nothing. */
  description: z.string(),
  published: z.boolean(),
  publishedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

/** One row of `GET /api/collections`. The count comes from the join table, so
 *  listing collections never touches the cards themselves. */
export const collectionSummarySchema = collectionEnvelope.extend({
  cardCount: z.int().min(0),
})
export type CollectionSummary = z.infer<typeof collectionSummarySchema>

/** `GET /api/collections/:id`, and what a membership write returns. `cards` is
 *  in the collection's own order, not the cards' — that order is the thing the
 *  join table exists to store. */
export const collectionDetailSchema = collectionEnvelope.extend({
  cards: z.array(cardSummarySchema),
})
export type CollectionDetail = z.infer<typeof collectionDetailSchema>

/** The bare entity, for anywhere that wants neither the count nor the rows. */
export const collectionSchema = collectionEnvelope
export type Collection = z.infer<typeof collectionSchema>

/** The body of `PUT /api/collections/:id`. Same server-owned exclusions as a
 *  card, and for the same reason: publishing is its own route.
 *
 *  Membership is not here either. It is a separate write because the two change
 *  at completely different rates — renaming a collection should not require
 *  restating forty card ids, and reordering it should not require restating the
 *  description. */
export const collectionWriteSchema = collectionEnvelope
  .omit({
    ownerSub: true,
    published: true,
    publishedAt: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    id: z.uuid().optional(),
    /** Optional on the way in, `''` in the column. Saves the editor from having
     *  to send an empty string it does not have a field for yet. */
    description: z.string().default(''),
  })
export type CollectionWrite = z.infer<typeof collectionWriteSchema>

/** The body of `PUT /api/collections/:id/cards` — the whole membership, in
 *  order, every time. Add, remove and reorder are all this one write.
 *
 *  Duplicates are rejected rather than deduplicated. A repeated id means the
 *  client built the list wrong, and silently collapsing it would return a
 *  different order than was asked for with no indication why. */
export const collectionCardsWriteSchema = z.object({
  cardIds: z
    .array(z.uuid())
    .max(500)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: 'cardIds must not contain duplicates',
    }),
})
export type CollectionCardsWrite = z.infer<typeof collectionCardsWriteSchema>
