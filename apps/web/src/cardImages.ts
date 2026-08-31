// ---------------------------------------------------------------------------
// The three pieces of artwork a card needs that don't ship with the app — the
// user supplies them. They're kept out of CardData deliberately: CardData is the
// printed *values* of a card (and the thing a JSON dump wants to be), whereas
// these are per-session blob URLs.
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
