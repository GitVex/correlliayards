// ---------------------------------------------------------------------------
// Everything printed on a squadron card, minus what the envelope holds.
//
// A squadron has two names: the card's title, which is the ace's name and lives
// on the envelope as `name`, and the squadron type it belongs to ("A-wing"),
// which is printed underneath and is genuinely a second field. Ships collapse
// the two — a ship card's title *is* its class — which is why only this kind
// carries a type alongside its name.
// ---------------------------------------------------------------------------

import { z } from 'zod'
import { imageCreditSchema, squadronArtworkSchema } from './artwork.js'
import { cardTextSchema, defenseTokenSchema, diceRowsSchema, hullSchema } from './vocabulary.js'

export const squadronCardDataSchema = z.object({
  /** The squadron this ace flies with — "A-wing", "TIE Fighter". Printed under
   *  the name. A generic (non-unique) squadron card names its type here too. */
  squadronType: z.string(),

  /** The • bullet. Unique cards may only be fielded once in a fleet, and it is
   *  the ace cards that carry it. */
  unique: z.boolean(),

  hull: hullSchema,

  /** Squadrons print a single speed value rather than a chart of clicks. */
  speed: z.int().min(0).max(9),

  /** Variable length and never padded, unlike a ship's fixed four slots: most
   *  squadrons have none, aces have one or two. '—' has no meaning here, so
   *  these are DefenseToken rather than DefenseTokenType. */
  defenseTokens: z.array(defenseTokenSchema).max(3),

  armamentAntiSquadron: diceRowsSchema,
  armamentAntiShip: diceRowsSchema,

  /** Keywords and ability text, with the inline markup described on
   *  cardTextSchema. This is the larger of the two text areas on the card. */
  text: cardTextSchema,

  artwork: squadronArtworkSchema,
  imageCredit: imageCreditSchema,
})
export type SquadronCardData = z.infer<typeof squadronCardDataSchema>
