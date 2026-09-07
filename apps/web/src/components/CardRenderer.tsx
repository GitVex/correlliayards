import imperialCardBg from '../assets/base_cards/Imperial.png'
import rebelCardBg from '../assets/base_cards/Rebel.png'
import { CardSlots } from './CardSlots'
import { CardFace } from './CardFace'
import type { Faction } from '@correlliayards/shared'
import type { ShipCardData } from '../cardData'
import type { CardImages } from '../cardImages'

/* Faction is contract — it is stored on the card and validated by the API — so
   it lives in @correlliayards/shared now. Re-exported here because this is
   where the rest of the SPA has always reached for it. */
export type { Faction } from '@correlliayards/shared'

const CARD_BG: Record<Faction, string> = {
  'Galactic Empire': imperialCardBg,
  'Rebel Alliance': rebelCardBg,
}

export function CardRenderer({
  name,
  points,
  faction,
  cardData,
  images,
  chrome = true,
}: {
  name: string
  points: number
  faction: Faction
  cardData: ShipCardData
  images: CardImages
  /** The dashed slot guides. Off for the export copy — see TokenRenderer, which
   *  has the same switch for a harder reason. */
  chrome?: boolean
}) {
  return (
    <div className="card-frame">
      <div className="card-placeholder" aria-hidden="true" />
      <div className="card-art">
        <img
          className="card-image"
          src={CARD_BG[faction]}
          alt={`${faction} card background`}
        />
        <CardFace name={name} points={points} data={cardData} images={images} />
        {chrome && <CardSlots />}
      </div>
    </div>
  )
}
