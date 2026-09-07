import { CardRenderer, type Faction } from './CardRenderer'
import { TokenRenderer, type BaseSize } from './TokenRenderer'
import type { ShipCardData } from '../cardData'
import type { CardImages } from '../cardImages'
import type { FiringArcs } from '../firingArcs'

export function Stage({
  name,
  points,
  faction,
  baseSize,
  zoom,
  cardData,
  images,
  arcs,
  setArcs,
}: {
  /** The card's title and cost. They live on the card envelope rather than in
   *  its payload, so they arrive alongside `cardData` rather than inside it. */
  name: string
  points: number
  faction: Faction
  baseSize: BaseSize
  /** Display zoom, as a percentage (100 = actual physical size). Applied with the
   *  `zoom` property rather than a scale() transform: a transform leaves layout
   *  size untouched, so the stage never learns the content grew and everything
   *  above and left of centre ends up unreachable. The pieces keep their mm
   *  dimensions in their own coordinates — anything reading a measurement off the
   *  DOM (dice fitting, arc handles) works from ratios, which are zoom-invariant. */
  zoom: number
  cardData: ShipCardData
  images: CardImages
  arcs: FiringArcs
  setArcs: (updater: (arcs: FiringArcs) => FiringArcs) => void
}) {
  return (
    <div className="stage">
      <div className="stage__canvas" style={{ zoom: zoom / 100 }}>
        <div className="piece">
          <p className="cap">Ship card</p>
          <CardRenderer name={name} points={points} faction={faction} cardData={cardData} images={images} />
        </div>

        <div className="piece">
          <p className="cap">Base token</p>
          <TokenRenderer
            name={name}
            baseSize={baseSize}
            faction={faction}
            cardData={cardData}
            images={images}
            arcs={arcs}
            setArcs={setArcs}
          />
        </div>
      </div>
    </div>
  )
}
