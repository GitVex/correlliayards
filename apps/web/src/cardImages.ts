// ---------------------------------------------------------------------------
// The three pieces of artwork a card needs that don't ship with the app — the
// user supplies them.
//
// They're kept out of ShipCardData deliberately: ShipCardData is the printed
// *values* of a card, whereas this is the live browser state around a picture.
// What a saved card stores instead is ArtworkRefs, in shared — now the asset id
// each picture was stored under.
//
// A picture is uploaded the moment it is picked, not when the card is saved, so
// each slot has an upload in flight, finished, or failed. The preview never
// waits on any of that: it paints from an object URL made locally, so the
// picture is on screen before a byte has left the machine.
// ---------------------------------------------------------------------------

export type CardImageKey = 'thumbnail' | 'schematic' | 'tinycon'

export type CardImageStatus = 'uploading' | 'stored' | 'failed'

export type CardImage = {
  /** What the preview and the export stage paint from. An object URL for the
   *  picked file, valid only for this session — kept even once the bytes are
   *  stored, because it is already decoded and costs no request. A card opened
   *  from the server instead gets `assetPath(id)` here. */
  url: string
  /** Original file name, shown next to the picker so you can tell what's
   *  loaded. Stored alongside the bytes for the same reason. */
  name: string
  status: CardImageStatus
  /** Where the bytes ended up. Null until the upload lands, and this is the
   *  value that goes into `cardData.artwork` — so a picture that never uploaded
   *  is a picture the saved card does not refer to. */
  assetId: string | null
  /** Why the upload failed, in words the picker can show. */
  error?: string
}

export type CardImages = Record<CardImageKey, CardImage | null>

export const EMPTY_CARD_IMAGES: CardImages = {
  thumbnail: null,
  schematic: null,
  tinycon: null,
}

export const CARD_IMAGE_KEYS: CardImageKey[] = ['thumbnail', 'schematic', 'tinycon']
