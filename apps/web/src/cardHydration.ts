// ---------------------------------------------------------------------------
// Turning a stored card back into an open editor, and starting a blank one.
//
// The inverse of `localCard` in cardJson.ts, and deliberately next to nothing
// else: the two directions have to agree field for field, so a change to one is
// a change to the other, and keeping them a file apart is what makes that
// obvious rather than a coincidence.
// ---------------------------------------------------------------------------

import { assetPath, type ShipArtwork, type ShipCard } from '@correlliayards/shared'
import { DEFAULT_CARD_DATA, DEFAULT_CARD_NAME, DEFAULT_POINTS } from './cardData'
import { EMPTY_CARD_IMAGES, type CardImage, type CardImages } from './cardImages'
import { DEFAULT_FIRING_ARCS } from './firingArcs'
import type { EditorState } from './cardJson'
import { isAssetId } from './api/assets'

/** Everything an editor needs to open with. */
export type EditorSeed = {
  state: EditorState
  images: CardImages
  /** The row's version, for the next save's `If-Match`. Null for a card the
   *  server has never seen. */
  etag: string | null
  /** True when this seed is exactly what the server holds, so there is nothing
   *  unsaved yet. False for a blank card, which is unsaved by definition. */
  clean: boolean
}

/** A new, unsaved card.
 *
 *  The uuid is minted here rather than handed back by a save, which is the same
 *  reason `PUT` is the write verb: a card is addressable from the moment the
 *  editor opens, so its first save is an upsert against an id that already
 *  exists and create-versus-update stops being a distinction anyone tracks. */
export function blankSeed(): EditorSeed {
  return {
    state: {
      id: crypto.randomUUID(),
      name: DEFAULT_CARD_NAME,
      points: DEFAULT_POINTS,
      faction: 'Rebel Alliance',
      baseSize: 'Small',
      cardData: DEFAULT_CARD_DATA,
      arcs: DEFAULT_FIRING_ARCS,
    },
    images: EMPTY_CARD_IMAGES,
    etag: null,
    clean: false,
  }
}

/** One artwork slot as the editor's live image state.
 *
 *  A dangling reference produces no picture rather than a broken one, and —
 *  importantly — it is *not* cleared from `cardData.artwork`. Rendering nothing
 *  is a display decision; rewriting the stored card because we could not draw
 *  it would be a data decision, and it is not this function's to make. The ref
 *  survives untouched until someone picks a new picture for that slot. */
function slotFromRef(ref: string | null): CardImage | null {
  if (!ref || !isAssetId(ref)) return null
  return {
    url: assetPath(ref),
    /* The stored card carries the id, not the original file name — that lives
       on the asset row and is not worth three extra requests to show. With the
       picture right there in the preview, the name was never the part doing the
       work anyway. */
    name: 'stored image',
    status: 'stored',
    assetId: ref,
  }
}

function imagesFromArtwork(artwork: ShipArtwork): CardImages {
  return {
    thumbnail: slotFromRef(artwork.thumbnail),
    schematic: slotFromRef(artwork.schematic),
    tinycon: slotFromRef(artwork.tinycon),
  }
}

/** A saved ship card, opened.
 *
 *  `faction` falls back rather than being allowed through as null: the column
 *  is nullable because an unrestricted upgrade is a real thing, but a ship card
 *  has a faction printed on it and the editor's picker has no "none" option to
 *  represent the absence. */
export function seedFromCard(card: ShipCard, etag: string | null): EditorSeed {
  return {
    state: {
      id: card.id,
      name: card.name,
      points: card.points,
      faction: card.faction ?? 'Rebel Alliance',
      baseSize: card.token.baseSize,
      cardData: card.data,
      arcs: card.token.arcs,
    },
    images: imagesFromArtwork(card.data.artwork),
    etag,
    clean: true,
  }
}
