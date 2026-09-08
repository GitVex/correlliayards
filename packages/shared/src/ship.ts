// ---------------------------------------------------------------------------
// Everything printed on a ship card, minus what the envelope already holds.
//
// The card's printed title is the ship class, and that is exactly what the
// envelope's `name` is for, so there is no `shipClass` here — one field, on the
// envelope, where a list view can read it without opening the document.
// `points` is on the envelope for the same reason.
// ---------------------------------------------------------------------------

import { z } from 'zod'
import { shipArtworkSchema, imageCreditSchema } from './artwork.js'
import {
  commandValueSchema,
  defenseTokenTypeSchema,
  diceRowsSchema,
  hullSchema,
  shieldSchema,
  upgradeTypeSchema,
} from './vocabulary.js'

/** Yaw value per pyramid cell, or null while the field is blank. A column that
 *  is all zeros means the ship simply doesn't have that speed. Values are
 *  bounded by assets/icons/speed, which holds yaw_0 through yaw_2. */
const yawSchema = z.int().min(0).max(2).nullable()

export const shipCardDataSchema = z.object({
  hull: hullSchema,
  shieldFront: shieldSchema,
  shieldLeft: shieldSchema,
  shieldRight: shieldSchema,
  shieldRear: shieldSchema,
  command: commandValueSchema,
  squadron: commandValueSchema,
  engineer: commandValueSchema,

  /** Exactly four — one per DT1..DT4 slot on the card, '—' for an empty one.
   *  This was a docstring promise before; now a three-token card is rejected. */
  defenseTokens: z.array(defenseTokenTypeSchema).length(4),

  armamentFront: diceRowsSchema,
  armamentLeft: diceRowsSchema,
  armamentRight: diceRowsSchema,
  armamentRear: diceRowsSchema,
  armamentAntiSquadron: diceRowsSchema,

  upgrades: z.array(upgradeTypeSchema),

  /** The speed chart is a pyramid: speed N has exactly N cells. Speeds 1 and 2
   *  are always printed; 3 and 4 print nothing at all unless they hold a click. */
  speed1: z.array(yawSchema).length(1),
  speed2: z.array(yawSchema).length(2),
  speed3: z.array(yawSchema).length(3),
  speed4: z.array(yawSchema).length(4),

  artwork: shipArtworkSchema,
  imageCredit: imageCreditSchema,
})
export type ShipCardData = z.infer<typeof shipCardDataSchema>
