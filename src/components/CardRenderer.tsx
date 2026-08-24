import imperialCardBg from '../assets/base_cards/Imperial.png'
import rebelCardBg from '../assets/base_cards/Rebel.png'
import { CardSlots } from './CardSlots'
import { CardFace } from './CardFace'
import type { CardData } from '../cardData'

export type Faction = 'Galactic Empire' | 'Rebel Alliance'

const CARD_BG: Record<Faction, string> = {
  'Galactic Empire': imperialCardBg,
  'Rebel Alliance': rebelCardBg,
}

export function CardRenderer({ faction, cardData }: { faction: Faction; cardData: CardData }) {
  return (
    <div className="card-frame">
      <div className="card-placeholder" aria-hidden="true" />
      <div className="card-art">
        <img
          className="card-image"
          src={CARD_BG[faction]}
          alt={`${faction} card background`}
        />
        <CardFace data={cardData} />
        <CardSlots />
      </div>
    </div>
  )
}
