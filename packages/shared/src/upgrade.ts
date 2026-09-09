// ---------------------------------------------------------------------------
// Everything printed on an upgrade card, minus what the envelope holds.
//
// The thinnest of the three: a type, a picture, some text and a cost. The type
// reuses the same vocabulary as a ship card's upgrade slots, which is what makes
// "which of my upgrades fit this slot" a question the data can answer.
//
// upgradeType stays in the payload rather than becoming a column: it is
// meaningless on the other two kinds, so a column would be null on most rows.
// A partial expression index over the document gives the same query speed:
//
//     CREATE INDEX ON cards ((document->'data'->>'upgradeType'))
//       WHERE kind = 'upgrade';
// ---------------------------------------------------------------------------

import { z } from 'zod'
import { imageCreditSchema, upgradeArtworkSchema } from './artwork.js'
import { cardTextSchema, upgradeTypeSchema } from './vocabulary.js'

export const upgradeCardDataSchema = z.object({
  upgradeType: upgradeTypeSchema,

  /** The • bullet — commanders, officers and titles are typically unique. */
  unique: z.boolean(),

  /** The card's ability, with the inline markup described on cardTextSchema. */
  text: cardTextSchema,

  artwork: upgradeArtworkSchema,
  imageCredit: imageCreditSchema,
})
export type UpgradeCardData = z.infer<typeof upgradeCardDataSchema>
