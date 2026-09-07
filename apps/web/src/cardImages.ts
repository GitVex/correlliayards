// ---------------------------------------------------------------------------
// The three pieces of artwork a card needs that don't ship with the app — the
// user supplies them. They're kept out of ShipCardData deliberately:
// ShipCardData is the printed *values* of a card, whereas these are per-session
// blob URLs. What a saved card stores instead is ArtworkRefs, in shared — the
// file names, which is all of this that survives the trip.
// ---------------------------------------------------------------------------

export type CardImageKey = 'thumbnail' | 'schematic' | 'tinycon'

export type CardImage = {
  /** Object URL for the picked file — valid only for this session. */
  url: string
  /** Original file name, shown next to the picker so you can tell what's loaded. */
  name: string
}

export type CardImages = Record<CardImageKey, CardImage | null>

export const EMPTY_CARD_IMAGES: CardImages = {
  thumbnail: null,
  schematic: null,
  tinycon: null,
}
