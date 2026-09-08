// ---------------------------------------------------------------------------
// The card envelope, its three kinds, and the union over them.
//
// The split between this file and the per-kind payloads mirrors the split in
// the database: everything declared on the envelope becomes a real column,
// because it is what a collection view filters and sorts on, while `data` and
// `token` go into one `jsonb` document. The rule for deciding is not aesthetic
// — if you query it, it is a column.
//
// There is one card type per kind, not a draft and a saved form of each. A card
// is editable in place from the moment it exists, so nothing needs to describe
// a card that has never been saved. Where a write endpoint genuinely must
// refuse client-supplied bookkeeping, it can say so at the boundary — see
// `cardWriteSchema` at the foot of this file, which is that boundary written
// once rather than in each of the three routes that needs it.
//
// Note what is *not* here: a schema version. Dropped deliberately, on the
// grounds that the game is finished and these shapes are not going to move.
// ---------------------------------------------------------------------------

import { z } from 'zod'
import { shipCardDataSchema } from './ship.js'
import { squadronCardDataSchema } from './squadron.js'
import { upgradeCardDataSchema } from './upgrade.js'
import { shipTokenSchema } from './token.js'
import { factionSchema, pointsSchema } from './vocabulary.js'

/** The fields every kind has, whatever it is.
 *
 *  `faction` is nullable on all three rather than required on some, so the
 *  column means one thing everywhere: the faction this card is restricted to,
 *  or null for no restriction. Most upgrades are unrestricted, but commanders
 *  and officers are not — and if those stored their restriction in the payload
 *  instead, "show me everything Rebel" would quietly miss exactly the cards you
 *  most wanted to find. */
const cardEnvelope = z.object({
  /** Minted by the client, not the server. A card is addressable and editable
   *  the moment the editor opens one, so its first save is an upsert against an
   *  id that already exists rather than a create that hands one back. */
  id: z.uuid(),
  /** The owning user's Zitadel subject claim — stable across profile changes,
   *  so rows key on it rather than on anything the user can edit. */
  ownerSub: z.string().min(1),
  /** The card's printed title, and the label every list view shows. */
  name: z.string().min(1),
  faction: factionSchema.nullable(),
  points: pointsSchema,
  /** Visible to anyone with the link. A column rather than a payload field by
   *  the rule above: the public browse endpoint filters on it, so it has to be
   *  queryable without opening two hundred documents.
   *
   *  Only the publish routes move it. It is absent from `cardWriteSchema` on
   *  purpose — an autosave must not be able to make a card public, or make a
   *  public one disappear, as a side effect of saving a typo fix. */
  published: z.boolean(),
  /** When it was first published, and null whenever `published` is false.
   *  Re-publishing an unpublished card starts the clock again. */
  publishedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export const shipCardSchema = cardEnvelope.extend({
  kind: z.literal('ship'),
  data: shipCardDataSchema,
  /** Embedded rather than a row of its own — see token.ts. Only this kind has
   *  one, so the other two simply lack the field instead of storing a null. */
  token: shipTokenSchema,
})
export type ShipCard = z.infer<typeof shipCardSchema>

export const squadronCardSchema = cardEnvelope.extend({
  kind: z.literal('squadron'),
  data: squadronCardDataSchema,
})
export type SquadronCard = z.infer<typeof squadronCardSchema>

export const upgradeCardSchema = cardEnvelope.extend({
  kind: z.literal('upgrade'),
  data: upgradeCardDataSchema,
})
export type UpgradeCard = z.infer<typeof upgradeCardSchema>

/** A card of any kind. Discriminated on `kind`: narrowing gives you the right
 *  payload and, for a ship, the token. */
export const cardSchema = z.discriminatedUnion('kind', [
  shipCardSchema,
  squadronCardSchema,
  upgradeCardSchema,
])
export type Card = z.infer<typeof cardSchema>

// ---------------------------------------------------------------------------
// The write shape
// ---------------------------------------------------------------------------

/** The bookkeeping the server owns and a client may not assert. Stripped from
 *  every write, so a body that carries them is not an error — the fields are
 *  simply not read. That matters for the round trip the editor actually does:
 *  GET a card, edit it, PUT it back. Making the extra fields fatal would force
 *  every client to hand-strip a body it just received. */
const serverOwned = {
  ownerSub: true,
  published: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
} as const

/** `id` is optional on the way in and checked against the path by the route.
 *  The editor already knows the uuid — it minted it — so the body carrying one
 *  is the normal case, and a mismatch is a client bug worth a 400 rather than a
 *  silent write to whichever of the two the server happened to prefer. */
const writable = { id: z.uuid().optional() }

export const shipCardWriteSchema = shipCardSchema.omit(serverOwned).extend(writable)
export const squadronCardWriteSchema = squadronCardSchema.omit(serverOwned).extend(writable)
export const upgradeCardWriteSchema = upgradeCardSchema.omit(serverOwned).extend(writable)

/** The body of `PUT /api/cards/:id`. Still discriminated on `kind`, so a wrong
 *  payload for the kind fails against that kind's schema rather than against a
 *  union of all three, and the error names the field that is actually wrong. */
export const cardWriteSchema = z.discriminatedUnion('kind', [
  shipCardWriteSchema,
  squadronCardWriteSchema,
  upgradeCardWriteSchema,
])
export type CardWrite = z.infer<typeof cardWriteSchema>
