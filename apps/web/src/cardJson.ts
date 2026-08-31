// ---------------------------------------------------------------------------
// The whole editor state as one JSON document — everything it takes to redraw
// this card and token, in one place. Both the JSON tab and the Copy JSON button
// print this, so what you read is exactly what you copy.
//
// Artwork is the one thing that can't survive the trip: the pickers hand back
// object URLs that die with the session, so only the file names go in, as a note
// of what was loaded rather than something a reader could resolve.
// ---------------------------------------------------------------------------

import type { CardData } from './cardData'
import type { CardImages } from './cardImages'
import type { Faction } from './components/CardRenderer'
import type { BaseSize } from './components/TokenRenderer'
import type { FiringArcs } from './firingArcs'

export type EditorState = {
  faction: Faction
  baseSize: BaseSize
  cardData: CardData
  images: CardImages
  arcs: FiringArcs
}

/** Dragged handles land on long floats. Four decimals is finer than the token
 *  can print — a ten-thousandth of the way round a small base is 4 microns — and
 *  keeps the dump readable. */
const round = (value: number) => Math.round(value * 1e4) / 1e4

export function cardJson({ faction, baseSize, cardData, images, arcs }: EditorState): string {
  return JSON.stringify(
    {
      faction,
      baseSize,
      card: cardData,
      arcs: {
        front: round(arcs.front),
        rear: round(arcs.rear),
        frontPivot: round(arcs.frontPivot),
        rearPivot: round(arcs.rearPivot),
        split: arcs.split,
      },
      artwork: {
        thumbnail: images.thumbnail?.name ?? null,
        schematic: images.schematic?.name ?? null,
        tinycon: images.tinycon?.name ?? null,
      },
    },
    null,
    2,
  )
}
