// ---------------------------------------------------------------------------
// The user-supplied artwork a card points at.
//
// These live in each kind's payload rather than in the card envelope, because
// the three kinds need different pictures: a ship has a thumbnail, a schematic
// and a tiny icon, a squadron has a portrait and a tiny icon, an upgrade has
// only a portrait. Hoisting the union of those into the envelope would put
// permanently-null fields on two kinds out of three.
// ---------------------------------------------------------------------------

import { z } from 'zod'

/** One picture slot.
 *
 *  A file name today, not something a reader can resolve: the pickers hand back
 *  object URLs that die with the session, so the name is a note of what was
 *  loaded. When uploads land this becomes an asset id — a string either way,
 *  which is why the slot is a named schema rather than a bare `z.string()`
 *  repeated six times. */
export const artworkRefSchema = z.string().nullable()
export type ArtworkRef = z.infer<typeof artworkRefSchema>

/** Artist/source line printed vertically down the left edge of the picture.
 *  Every kind has a picture, so every kind can credit it. */
export const imageCreditSchema = z.string()

export const shipArtworkSchema = z.object({
  thumbnail: artworkRefSchema,
  schematic: artworkRefSchema,
  tinycon: artworkRefSchema,
})
export type ShipArtwork = z.infer<typeof shipArtworkSchema>

export const squadronArtworkSchema = z.object({
  portrait: artworkRefSchema,
  tinycon: artworkRefSchema,
})
export type SquadronArtwork = z.infer<typeof squadronArtworkSchema>

export const upgradeArtworkSchema = z.object({
  portrait: artworkRefSchema,
})
export type UpgradeArtwork = z.infer<typeof upgradeArtworkSchema>
