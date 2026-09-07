// ---------------------------------------------------------------------------
// The whole editor state as one JSON document — everything it takes to redraw
// this card and token, in one place. Both the JSON tab and the Copy JSON button
// print this, so what you read is exactly what you copy.
//
// The dump is a real ShipCard minus the three fields the server owns. That is
// the shape a save request sends too: the id is in there because the editor
// mints it up front, so a card is addressable before it has ever been saved.
//
// Artwork is the one thing that can't survive the trip: the pickers hand back
// object URLs that die with the session, so only the file names go in, as a note
// of what was loaded rather than something a reader could resolve.
// ---------------------------------------------------------------------------

import type { Faction, ShipCard } from '@correlliayards/shared'
import type { ShipCardData } from './cardData'
import type { BaseSize } from './components/TokenRenderer'
import type { FiringArcs } from './firingArcs'

/** A card as the browser can know it. `ownerSub` and the timestamps are the
 *  server's to write, so they are absent rather than guessed at — the same cut
 *  a write route makes with `.omit()`, expressed as a type so none of Zod has to
 *  reach the browser bundle. */
export type LocalShipCard = Omit<ShipCard, 'ownerSub' | 'createdAt' | 'updatedAt'>

/** What the editor holds while you work. Flat rather than card-shaped because
 *  each field is its own `useState` in App. */
export type EditorState = {
  id: string
  name: string
  points: number
  faction: Faction
  baseSize: BaseSize
  cardData: ShipCardData
  arcs: FiringArcs
}

/** Dragged handles land on long floats. Four decimals is finer than the token
 *  can print — a ten-thousandth of the way round a small base is 4 microns — and
 *  keeps the dump readable. */
const round = (value: number) => Math.round(value * 1e4) / 1e4

/** The editor's live state as the shape that gets stored. Split out from
 *  cardJson because a save request wants the object, not the text. */
export function localCard({ id, name, points, faction, baseSize, cardData, arcs }: EditorState): LocalShipCard {
  return {
    id,
    kind: 'ship',
    name,
    faction,
    points,
    data: cardData,
    token: {
      baseSize,
      arcs: {
        front: round(arcs.front),
        rear: round(arcs.rear),
        frontPivot: round(arcs.frontPivot),
        rearPivot: round(arcs.rearPivot),
        split: arcs.split,
      },
    },
  }
}

export function cardJson(state: EditorState): string {
  return JSON.stringify(localCard(state), null, 2)
}
