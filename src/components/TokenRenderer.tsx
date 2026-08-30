import { useRef, useState } from 'react'
import smallToken from '../assets/base_tokens/small_blank.png'
import mediumToken from '../assets/base_tokens/medium_blank.png'
import largeToken from '../assets/base_tokens/large_blank.png'
import hullSection from '../assets/base_tokens/blank_hull_section.png'
import hullFooter from '../assets/base_tokens/blank_hull_footer.png'
import { HullFooterFace, HullSectionFace, TokenFace } from './TokenFace'
import type { CardData } from '../cardData'
import type { CardImages } from '../cardImages'
import type { Faction } from './CardRenderer'
import {
  HULL_FOOTER_SLOTS,
  FRONT_SECTION_SLOTS,
  LEFT_SECTION_SLOTS,
  RIGHT_SECTION_SLOTS,
  TOKEN_SLOTS,
  TokenSlotGuides,
  type TokenSlot,
} from './TokenSlots'
import {
  arcBoundaries,
  arcHandlePoints,
  arcPanelPlacement,
  mirrorPerimeter,
  nearestPerimeterPoint,
  pivotPoint,
  withFrontHandle,
  withPivot,
  withRearHandle,
  ARC_HANDLE_LABELS,
  type FiringArcs,
  type PanelPlacement,
} from '../firingArcs'

export type BaseSize = 'Small' | 'Medium' | 'Large'

const TOKEN_IMG: Record<BaseSize, string> = {
  Small: smallToken,
  Medium: mediumToken,
  Large: largeToken,
}

export const TOKEN_SIZE_MM: Record<BaseSize, { width: number; height: number }> = {
  Small: { width: 39, height: 71 },
  Medium: { width: 59, height: 102 },
  Large: { width: 73.5, height: 129 },
}

/** Printed width of the hull panels in mm. Fixed rather than a share of the token,
 *  so they come out the same physical size on every base — heights follow each
 *  asset's own aspect ratio, measured from the files. */
const HULL_SECTION_MM = 17.8
const HULL_SECTION_RATIO = 195 / 124
const HULL_FOOTER_MM = 30
const HULL_FOOTER_RATIO = 348 / 126

/** A hull panel anchored to a point on the token's edge, turned so its top faces
 *  away from the token and the chevrons point in at the arc. Everything inside is
 *  positioned in the panel's own space — origin at its outward corner — so the
 *  slots ride along as the panel moves.
 *
 *  `mirrored` is the left-hand section: its artwork is flipped so the shield
 *  circle stays on the same side as the right-hand one. Slot boxes flip with it;
 *  whatever gets drawn in them does not, which is what keeps a shield value the
 *  right way round on both sides. */
/** Puts a panel's own coordinate space onto the token: origin at the middle of
 *  its outward edge, x running along that edge, y pointing inward. Everything a
 *  panel draws — artwork, values, guides — is placed in those coordinates. */
function panelTransform(placement: PanelPlacement, panelWidth: number) {
  return `rotate(${placement.rotation} ${placement.x} ${placement.y}) translate(${placement.x - panelWidth / 2} ${placement.y})`
}

function HullSection({
  placement,
  panelHeight,
  slots,
  arc,
  shield,
  dice,
}: {
  placement: PanelPlacement
  panelHeight: number
  /** This arc's own slot list — see TokenSlots.tsx, one per section. */
  slots: TokenSlot[]
  /** Which section this is. The left one is the mirrored panel. */
  arc: 'front' | 'left' | 'right'
  shield: number
  dice: string
}) {
  const mirrored = arc === 'left'
  return (
    <g transform={panelTransform(placement, HULL_SECTION_MM)}>
      <g transform={mirrored ? `translate(${HULL_SECTION_MM} 0) scale(-1 1)` : undefined}>
        <image className="hull-panel" href={hullSection} x={0} y={0} width={HULL_SECTION_MM} height={panelHeight} />
      </g>
      <HullSectionFace
        slots={slots}
        arc={arc}
        shield={shield}
        dice={dice}
        width={HULL_SECTION_MM}
        height={panelHeight}
        panelRotation={placement.rotation}
      />
      <TokenSlotGuides slots={slots} width={HULL_SECTION_MM} height={panelHeight} mirrored={mirrored} />
    </g>
  )
}

/** Which handle is being dragged: an edge handle by index, or a pivot by name. */
type Grabbed = number | 'front' | 'rear' | null

export function TokenRenderer({
  baseSize,
  faction,
  cardData,
  images,
  arcs,
  setArcs,
}: {
  baseSize: BaseSize
  /** Only reaches CSS, which colours the firing arcs by it. */
  faction: Faction
  cardData: CardData
  /** The user-supplied artwork — the token only uses the tinycon. */
  images: CardImages
  arcs: FiringArcs
  setArcs: (updater: (arcs: FiringArcs) => FiringArcs) => void
}) {
  const { width, height } = TOKEN_SIZE_MM[baseSize]
  const svgRef = useRef<SVGSVGElement>(null)
  const [grabbed, setGrabbed] = useState<Grabbed>(null)

  const points = arcHandlePoints(arcs, width, height)
  const lines = arcBoundaries(arcs, width, height)
  const frontPanel = arcPanelPlacement(arcs, 'front', width, height)
  const rightPanel = arcPanelPlacement(arcs, 'right', width, height)
  const leftPanel = arcPanelPlacement(arcs, 'left', width, height)
  const sectionHeight = HULL_SECTION_MM / HULL_SECTION_RATIO
  const footerHeight = HULL_FOOTER_MM / HULL_FOOTER_RATIO
  const pivots: { which: 'front' | 'rear'; label: string }[] = arcs.split
    ? [{ which: 'front', label: 'Front pivot' }, { which: 'rear', label: 'Rear pivot' }]
    : [{ which: 'front', label: 'Arc pivot' }]

  /** Pointer position in the token's own mm space. The rect is measured after the
   *  stage's zoom transform, so this stays correct at any zoom level. */
  function toTokenSpace(clientX: number, clientY: number) {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return null
    return {
      x: ((clientX - rect.left) / rect.width) * width,
      y: ((clientY - rect.top) / rect.height) * height,
    }
  }

  function dragEdgeHandle(index: number, clientX: number, clientY: number) {
    const at = toTokenSpace(clientX, clientY)
    if (!at) return
    const p = nearestPerimeterPoint(at.x, at.y, width, height)
    // Handles 1 and 3 are the mirrored halves of the pair, so what they report has
    // to be reflected back onto the handle that actually stores the position.
    setArcs((prev) =>
      index === 0 ? withFrontHandle(prev, p)
      : index === 1 ? withFrontHandle(prev, mirrorPerimeter(p))
      : index === 2 ? withRearHandle(prev, p)
      : withRearHandle(prev, mirrorPerimeter(p)),
    )
  }

  function dragPivot(which: 'front' | 'rear', clientX: number, clientY: number) {
    const at = toTokenSpace(clientX, clientY)
    if (!at) return
    // Only the vertical position is taken — the pivot is locked to the centre axis.
    setArcs((prev) => withPivot(prev, which, at.y / height))
  }

  return (
    <div className="token-frame" data-faction={faction} style={{ width: `${width}mm`, height: `${height}mm` }}>
      <img className="token-image" src={TOKEN_IMG[baseSize]} alt={`${baseSize} base token`} />

      <svg
        ref={svgRef}
        className="token-arcs"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
      >
        <TokenFace data={cardData} images={images} width={width} height={height} />

        {/* One hull panel per arc, sat where that arc's pivot bisects it, hugging
            the edge it lands on. The footer takes the rear arc's place at the foot
            of the centre axis.

            The left section's artwork is mirrored rather than rotated the other
            way, which would stand its shield value on its head. */}
        <HullSection
          placement={frontPanel} panelHeight={sectionHeight}
          slots={FRONT_SECTION_SLOTS} arc="front"
          shield={cardData.shieldFront} dice={cardData.armamentFront}
        />
        <HullSection
          placement={rightPanel} panelHeight={sectionHeight}
          slots={RIGHT_SECTION_SLOTS} arc="right"
          shield={cardData.shieldRight} dice={cardData.armamentRight}
        />
        <HullSection
          placement={leftPanel} panelHeight={sectionHeight}
          slots={LEFT_SECTION_SLOTS} arc="left"
          shield={cardData.shieldLeft} dice={cardData.armamentLeft}
        />

        <g transform={`translate(${width / 2 - HULL_FOOTER_MM / 2} ${height - footerHeight})`}>
          <image className="hull-panel" href={hullFooter} x={0} y={0} width={HULL_FOOTER_MM} height={footerHeight} />
          <HullFooterFace data={cardData} width={HULL_FOOTER_MM} height={footerHeight} />
          <TokenSlotGuides slots={HULL_FOOTER_SLOTS} width={HULL_FOOTER_MM} height={footerHeight} />
        </g>

        <TokenSlotGuides slots={TOKEN_SLOTS} width={width} height={height} />

        {/* Boundaries draw over the panels, the way they're printed on the token.
            Each is drawn twice: a wide soft pass for the glow, a thin bright one
            for the core. */}
        <g className="arc-lines">
          {lines.map((line, i) => (
            <line key={i} x1={line.from.x} y1={line.from.y} x2={line.to.x} y2={line.to.y} className="arc-line__glow" />
          ))}
          {lines.map((line, i) => (
            <line key={i} x1={line.from.x} y1={line.from.y} x2={line.to.x} y2={line.to.y} className="arc-line__core" />
          ))}
        </g>

        {points.map((point, i) => (
          <circle
            key={i}
            className="arc-handle"
            data-grabbed={grabbed === i}
            cx={point.x}
            cy={point.y}
            r={1.6}
            aria-label={`${ARC_HANDLE_LABELS[i]} arc boundary`}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              setGrabbed(i)
            }}
            onPointerMove={(e) => {
              if (grabbed === i) dragEdgeHandle(i, e.clientX, e.clientY)
            }}
            onPointerUp={(e) => {
              e.currentTarget.releasePointerCapture(e.pointerId)
              setGrabbed(null)
            }}
            onPointerCancel={() => setGrabbed(null)}
          />
        ))}

        {pivots.map(({ which, label }) => {
          const point = pivotPoint(arcs, which, width, height)
          return (
            <circle
              key={which}
              className="arc-handle arc-handle--pivot"
              data-grabbed={grabbed === which}
              cx={point.x}
              cy={point.y}
              r={1.9}
              aria-label={label}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId)
                setGrabbed(which)
              }}
              onPointerMove={(e) => {
                if (grabbed === which) dragPivot(which, e.clientX, e.clientY)
              }}
              onPointerUp={(e) => {
                e.currentTarget.releasePointerCapture(e.pointerId)
                setGrabbed(null)
              }}
              onPointerCancel={() => setGrabbed(null)}
            />
          )
        })}
      </svg>
    </div>
  )
}
