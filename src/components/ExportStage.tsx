import type { RefObject } from 'react'
import { CardRenderer, type Faction } from './CardRenderer'
import { TokenRenderer, type BaseSize } from './TokenRenderer'
import type { CardData } from '../cardData'
import type { CardImages } from '../cardImages'
import type { FiringArcs } from '../firingArcs'

// ---------------------------------------------------------------------------
// A second copy of both pieces, at 1:1 and without the editing chrome, parked
// off-screen. Every export and the print sheet come from here.
//
// It's a copy rather than a reuse of the preview because the preview is the
// wrong thing to capture: it's zoomed to whatever the slider says, and it has
// the draggable arc handles sitting on top of the token. It stays mounted
// rather than being built on demand so its artwork is already decoded by the
// time someone asks for a file — see `ready` in exportPieces.ts.
// ---------------------------------------------------------------------------

/** The token owns its firing arcs through the same setter the preview uses. Out
 *  here nothing can reach a handle to drag one, so the setter goes nowhere. */
const NO_EDITS = () => {}

export function ExportStage({
  cardRef,
  tokenRef,
  faction,
  baseSize,
  cardData,
  images,
  arcs,
}: {
  cardRef: RefObject<HTMLDivElement | null>
  tokenRef: RefObject<HTMLDivElement | null>
  faction: Faction
  baseSize: BaseSize
  cardData: CardData
  images: CardImages
  arcs: FiringArcs
}) {
  return (
    // aria-hidden: this is a duplicate of what the preview already announces,
    // and it would otherwise read out twice.
    <div className="export-stage" aria-hidden="true">
      {/* Each wrapper is a flex item, so it shrink-wraps to the piece's own mm
          box — which is what makes its offsetWidth the printed width. */}
      <div className="export-piece" ref={cardRef}>
        <CardRenderer faction={faction} cardData={cardData} images={images} chrome={false} />
      </div>

      <div className="export-piece" ref={tokenRef}>
        <TokenRenderer
          baseSize={baseSize}
          faction={faction}
          cardData={cardData}
          images={images}
          arcs={arcs}
          setArcs={NO_EDITS}
          chrome={false}
        />
      </div>
    </div>
  )
}
