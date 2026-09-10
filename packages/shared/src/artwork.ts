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
 *  An asset id — the SHA-256 of the stored bytes, resolvable at
 *  `GET /api/assets/:id`. It used to be a bare file name, a note of what had
 *  been picked that nothing could resolve; uploads landed and it became this,
 *  without the schema changing, which is what the named slot was for.
 *
 *  Still a plain string rather than the stricter pattern on `assetSchema.id`:
 *  cards saved before uploads existed hold file names here, and a card that
 *  cannot be read back is worse than one with a picture missing. The SPA treats
 *  a ref it cannot resolve as no picture at all. */
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
