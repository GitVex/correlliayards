// ---------------------------------------------------------------------------
// The base token a ship card is printed with.
//
// Its own schema, because a token is a separate printed piece — the export
// stage renders it as its own node at its own physical size, and the arcs can
// be re-tuned without a card value changing. But it is *stored* inside the
// card's document rather than in a table of its own: five numbers and a size,
// always one-to-one with its card, never queried on its own.
//
// It carries no `kind` of its own. Embedded in a ship card, the card's kind
// already says what this is.
// ---------------------------------------------------------------------------

import { z } from 'zod'
import { baseSizeSchema } from './vocabulary'

/** Where the arc boundaries sit on the token.
 *
 *  A handle's position is a perimeter coordinate: the whole part picks the edge,
 *  the fraction is how far along it, running clockwise from the top-left corner,
 *  so the corners are exactly 0, 1, 2 and 3. The geometry that turns these into
 *  points, and the clamping that keeps handles from crossing, live in the SPA —
 *  the server only has to know these are numbers in range. */
export const firingArcsSchema = z.object({
  /** Front-left handle. The front-right one is always its mirror image. */
  front: z.number().min(0).lt(4),
  /** Rear-right handle. The rear-left one is always its mirror image. */
  rear: z.number().min(0).lt(4),
  /** Where the front boundaries converge, as a fraction down the centre axis. */
  frontPivot: z.number().min(0).max(1),
  /** Where the rear boundaries converge. Only distinct from frontPivot when split. */
  rearPivot: z.number().min(0).max(1),
  /** Two convergence points instead of one. */
  split: z.boolean(),
})
export type FiringArcs = z.infer<typeof firingArcsSchema>

export const shipTokenSchema = z.object({
  baseSize: baseSizeSchema,
  arcs: firingArcsSchema,
})
export type ShipToken = z.infer<typeof shipTokenSchema>
