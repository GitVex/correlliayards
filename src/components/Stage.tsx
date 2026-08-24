import { CardRenderer, type Faction } from './CardRenderer'
import { TokenRenderer, type BaseSize } from './TokenRenderer'
import type { CardData } from '../cardData'
import type { CardImages } from '../cardImages'
import type { FiringArcs } from '../firingArcs'

export function Stage({
  faction,
  baseSize,
  zoom,
  cardData,
  images,
  arcs,
  setArcs,
}: {
  faction: Faction
  baseSize: BaseSize
  /** Display zoom, as a percentage (100 = actual physical size). Purely visual — the
   *  card/token elements underneath keep their real mm dimensions, so anything that
   *  reads those measurements (e.g. a PNG export) stays accurate regardless of zoom. */
  zoom: number
  cardData: CardData
  images: CardImages
  arcs: FiringArcs
  setArcs: (updater: (arcs: FiringArcs) => FiringArcs) => void
}) {
  return (
    <div className="stage">
      <div className="stage__canvas" style={{ transform: `scale(${zoom / 100})` }}>
        <div className="piece">
          <p className="cap">Ship card</p>
          <CardRenderer faction={faction} cardData={cardData} images={images} />
        </div>

        <div className="piece">
          <p className="cap">Base token</p>
          <TokenRenderer baseSize={baseSize} cardData={cardData} arcs={arcs} setArcs={setArcs} />
        </div>
      </div>
    </div>
  )
}
