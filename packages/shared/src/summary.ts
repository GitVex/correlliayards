// ---------------------------------------------------------------------------
// What a card looks like in a list, as opposed to open in the editor.
//
// This is the payoff for putting kind, name, faction and points in columns: a
// sidebar of two hundred cards answers from the table itself instead of parsing
// two hundred documents.
//
// The per-kind fields below are the exception, and they are deliberate. A
// squadron called "Tycho Celchu" is meaningless in a list without "A-wing" next
// to it, and an upgrade is browsed by its slot icon before anything else — so
// those come out of the document, via a jsonb expression in the projection:
//
//     SELECT id, kind, name, faction, points, updated_at,
//            document->'data'->>'squadronType'
//       FROM cards WHERE kind = 'squadron';
//
// That reads the document but does not need to validate or hydrate it, which is
// still far cheaper than returning whole cards. Keep this list short — every
// field added here is one the list view pays for on every row.
// ---------------------------------------------------------------------------

import { z } from 'zod'
import { artworkRefSchema } from './artwork.js'
import { baseSizeSchema, factionSchema, hullSchema, pointsSchema, upgradeTypeSchema } from './vocabulary.js'
import type { Card } from './card.js'

const summaryEnvelope = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  faction: factionSchema.nullable(),
  points: pointsSchema,
  /** Whether this row is visible to anyone with the link. A list shows it as a
   *  badge, and the public browse endpoint needs it on the row it returns;
   *  either way it is already a column, so it costs the projection nothing. */
  published: z.boolean(),
  updatedAt: z.iso.datetime(),
  /** The one picture a row shows. Each kind has its own name for it — a ship's
   *  thumbnail, a squadron's or upgrade's portrait — so the projection picks the
   *  right one and the list view stops caring which kind it is looking at. */
  thumbnail: artworkRefSchema,
})

export const shipCardSummarySchema = summaryEnvelope.extend({
  kind: z.literal('ship'),
  hull: hullSchema,
  /** Small/medium/large is how you tell a corvette from a star destroyer at a
   *  glance, which is exactly what a list is for. */
  baseSize: baseSizeSchema,
})
export type ShipCardSummary = z.infer<typeof shipCardSummarySchema>

export const squadronCardSummarySchema = summaryEnvelope.extend({
  kind: z.literal('squadron'),
  squadronType: z.string(),
  unique: z.boolean(),
})
export type SquadronCardSummary = z.infer<typeof squadronCardSummarySchema>

export const upgradeCardSummarySchema = summaryEnvelope.extend({
  kind: z.literal('upgrade'),
  upgradeType: upgradeTypeSchema,
  unique: z.boolean(),
})
export type UpgradeCardSummary = z.infer<typeof upgradeCardSummarySchema>

/** A row of any kind. Discriminated the same way a Card is, so a mixed list
 *  narrows with the same `switch (row.kind)` the editor uses. */
export const cardSummarySchema = z.discriminatedUnion('kind', [
  shipCardSummarySchema,
  squadronCardSummarySchema,
  upgradeCardSummarySchema,
])
export type CardSummary = z.infer<typeof cardSummarySchema>

/** Collapse a full card into its list row.
 *
 *  The server does not normally need this — its list endpoint projects the
 *  columns directly, which is the point of the type. It is here for the case
 *  where one side already holds the whole card and wants the row without a
 *  round trip: the SPA refreshing a sidebar entry after an edit.
 *
 *  It also pins down which picture each kind contributes as its thumbnail, so
 *  that mapping is enforced in one place instead of being a convention the SQL
 *  and the client have to independently remember. */
export function toCardSummary(card: Card): CardSummary {
  const envelope = {
    id: card.id,
    name: card.name,
    faction: card.faction,
    points: card.points,
    published: card.published,
    updatedAt: card.updatedAt,
  }

  switch (card.kind) {
    case 'ship':
      return {
        ...envelope,
        kind: 'ship',
        thumbnail: card.data.artwork.thumbnail,
        hull: card.data.hull,
        baseSize: card.token.baseSize,
      }
    case 'squadron':
      return {
        ...envelope,
        kind: 'squadron',
        thumbnail: card.data.artwork.portrait,
        squadronType: card.data.squadronType,
        unique: card.data.unique,
      }
    case 'upgrade':
      return {
        ...envelope,
        kind: 'upgrade',
        thumbnail: card.data.artwork.portrait,
        upgradeType: card.data.upgradeType,
        unique: card.data.unique,
      }
  }
}
