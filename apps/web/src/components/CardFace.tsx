import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { getSlotBox } from './CardSlots'
import {
  hasSpeedClicks,
  parseDiceRows,
  type CardData,
  type UpgradeType,
} from '../cardData'
import type { CardImage, CardImages } from '../cardImages'
import {
  COMMAND_VALUE_ICON,
  DEFENSE_TOKEN_CODE,
  DEFENSE_TOKEN_ICON,
  DICE_ICON,
  HULL_ICON,
  SHIELD_ICON,
  SPEED_BG,
  UPGRADE_ICON,
  YAW_ICON,
} from '../icons'

// ---------------------------------------------------------------------------
// The live card face — reads CardData and paints the real icons/text at the
// positions hand-tuned in CardSlots.tsx (via getSlotBox). Position lives
// there; this file only decides *what* goes in each box and *whether* it
// shows at all.
// ---------------------------------------------------------------------------

/** Row stagger/overlap unit for a dice cluster — roughly one die wide.
 *  Dice themselves are sized by .card-icon--dice in App.css. */
const DICE_MM = 2.3

function boxStyle(key: string, fill: boolean): CSSProperties | null {
  const box = getSlotBox(key)
  if (!box) return null
  return {
    position: 'absolute',
    left: `${box.leftPct}%`,
    top: `${box.topPct}%`,
    width: fill ? `${box.widthPct}%` : undefined,
    height: fill ? `${box.heightPct}%` : undefined,
  }
}

function IconInBox({
  slotKey,
  icon,
  alt,
  className = 'card-icon',
}: {
  slotKey: string
  icon: string | undefined
  alt: string
  className?: string
}) {
  const style = boxStyle(slotKey, true)
  if (!style || !icon) return null
  return (
    <div className="card-icon-box" style={style}>
      <img src={icon} alt={alt} className={className} />
    </div>
  )
}

/** Renders one arc's dice cluster, anchored in its slot box. Dice keep their true
 *  size while the cluster fits; once it would spill out of the box (e.g. six dice
 *  in a row) the whole cluster is scaled down just enough to fit inside.
 *
 *  `side` stands a broadside cluster on its edge. The left arc is the ground
 *  truth for how a broadside reads — first row of the dice string innermost, dice
 *  within a row running toward the rear, later rows stepping outward — and the
 *  right arc is that same cluster mirrored across the ship's centre line. That
 *  mirror is a quarter turn *plus* a flip, not the opposite quarter turn: turning
 *  it the other way instead sends the first row outward and its dice forward.
 *  The token repeats this layout at its own size — see DiceInSlot in
 *  TokenFace.tsx. */
function DiceGroup({ slotKey, dice, side }: { slotKey: string; dice: string; side?: 'left' | 'right' }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const clusterRef = useRef<HTMLDivElement>(null)
  // Mirrors `scale` so the measuring pass can undo the transform it already applied
  // without having to re-run the effect (which would just measure itself in a loop).
  const scaleRef = useRef(1)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const box = boxRef.current
    const cluster = clusterRef.current
    if (!box || !cluster) return;
    const rotate = side !== undefined

    const fit = () => {
      const boxRect = box.getBoundingClientRect()
      const clusterRect = cluster.getBoundingClientRect()
      const applied = scaleRef.current || 1
      // Divide out our own scale to recover the cluster's natural footprint. The
      // 90° rotation on the side arcs swaps which side of the box each dimension
      // has to fit within.
      const naturalW = (rotate ? clusterRect.height : clusterRect.width) / applied
      const naturalH = (rotate ? clusterRect.width : clusterRect.height) / applied
      const availW = rotate ? boxRect.height : boxRect.width
      const availH = rotate ? boxRect.width : boxRect.height
      if (!naturalW || !naturalH || !availW || !availH) return

      // Never scale *up* — dice that already fit stay at their true size.
      const next = Math.min(1, availW / naturalW, availH / naturalH)
      if (Math.abs(next - scaleRef.current) > 0.002) {
        scaleRef.current = next
        setScale(next)
      }
    }

    fit()
    // The box is sized in % of the card art, whose height only settles once the
    // background image has loaded — so re-fit whenever either side resizes.
    const observer = new ResizeObserver(fit)
    observer.observe(box)
    observer.observe(cluster)
    return () => observer.disconnect()
  }, [dice, side])

  const style = boxStyle(slotKey, true)
  const rows = parseDiceRows(dice)
  if (!style || rows.length === 0) return null;
  // Right = left, mirrored: scaleX(-1) is applied *outside* the same quarter turn
  // the left arc gets. The dice art is a plain diamond, so the flip only moves
  // dice around — it doesn't show up on any one of them.
  const rotation = side === 'left' ? 'rotate(90deg)' : side === 'right' ? 'scaleX(-1) rotate(90deg)' : ''

  const transform = [scale < 1 ? `scale(${scale})` : '', rotation]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="card-icon-box" style={style} ref={boxRef}>
      <div
        ref={clusterRef}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          // Keep the cluster at its natural size so the measurement above sees the
          // real overflow instead of a flex-shrunk width.
          flex: '0 0 auto',
          transform: transform || undefined,
        }}
      >
        {rows.map((row, r) => (
          <div
            key={r}
            style={{ display: 'flex', gap: '0.2mm', marginLeft: `${r * (DICE_MM / 2)}mm`, marginTop: r > 0 ? '-.7mm' : 0 }}
          >
            {row.map((letter, i) => (
              <img key={i} src={DICE_ICON[letter]} alt={letter} className="card-icon--dice" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/** A line of small print set on its side inside its slot box: rotateLeft for the
 *  card's left edge (reads top-to-bottom), rotateRight for its right (reads
 *  bottom-to-top). The line sits at the far end of the strip rather than centred
 *  in it. */
function VerticalText({
  slotKey,
  text,
  rotateLeft,
  rotateRight,
}: {
  slotKey: string
  text: string
  rotateLeft?: boolean
  rotateRight?: boolean
}) {
  const style = boxStyle(slotKey, true)
  if (!style || !text.trim()) return null

  return (
    // flex-end pushes the line to the bottom of the strip; anything longer than the
    // box grows upward from there instead of spilling past the bottom edge.
    <div className="card-icon-box" style={{ ...style, alignItems: 'flex-end' }}>
      <div
        style={{
          // Real vertical text flow rather than a rotate() transform: a rotated box
          // still lays out horizontally, so aligning it to one end of the strip
          // would leave half the line hanging outside the box.
          writingMode: rotateLeft || rotateRight ? 'vertical-rl' : undefined,
          transform: rotateRight ? 'rotate(180deg)' : undefined,
          whiteSpace: 'nowrap',
          fontSize: '1.8mm',
          letterSpacing: '.02em',
          // Sits over the thumbnail art rather than the printed card, so it's light
          // with a soft shadow to stay readable on any image behind it.
          color: 'rgba(255, 255, 255, .82)',
          textShadow: '0 0 1px rgba(0, 0, 0, .8)',
        }}
      >
        {text}
      </div>
    </div>
  )
}

/** The ship art. It paints *behind* the card image (z-index -1 inside .card-art's
 *  stacking context), so the card's own opaque top edge overlaps the bottom of the
 *  art and becomes its border — no frame of our own is drawn. */
function Thumbnail({ image }: { image: CardImage | null }) {
  const style = boxStyle('thumbnail', true)
  if (!style || !image) return null
  return (
    <img
      src={image.url}
      alt="Ship artwork"
      style={{ ...style, zIndex: -1, objectFit: 'cover' }}
    />
  )
}

/** Schematic / tiny icon: centred in their box and sized to its height, letting a
 *  wide source run past the box sides rather than squashing it. */
function FittedImage({ slotKey, image, alt }: { slotKey: string; image: CardImage | null; alt: string }) {
  const style = boxStyle(slotKey, true)
  if (!style || !image) return null
  return (
    <div className="card-icon-box" style={style}>
      <img src={image.url} alt={alt} style={{ height: '100%', width: 'auto' }} />
    </div>
  )
}

function SpeedBackground({ speed }: { speed: 3 | 4 }) {
  const style = boxStyle(speed === 3 ? 'speed3background' : 'speed4background', true)
  const icon = SPEED_BG[speed]
  if (!style || !icon) return null
  return <img src={icon} alt={`Speed ${speed} lane`} style={{ ...style, objectFit: 'cover' }} />
}

function SpeedCells({ slotPrefix, values }: { slotPrefix: string; values: (number | null)[] }) {
  return (
    <>
      {values.map((value, i) =>
        value === null ? null : (
          <IconInBox key={i} slotKey={`${slotPrefix}y${i + 1}`} icon={YAW_ICON[value]} alt={`yaw ${value}`} />
        ),
      )}
    </>
  )
}

export function CardFace({ data, images }: { data: CardData; images: CardImages }) {
  const shipClassStyle = boxStyle('shipClass', true)
  const pointsStyle = boxStyle('points', true)

  return (
    <>
      {shipClassStyle && (
        <div style={{ ...shipClassStyle, display: 'flex', alignItems: 'center', color: '#111', fontSize: '5mm', fontWeight: 300, overflow: 'hidden' }}>
          {data.shipClass}
        </div>
      )}
      {pointsStyle && (
        <div style={{ ...pointsStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#111', fontSize: '3mm', fontWeight: 300 }}>
          {data.points}
        </div>
      )}

      <Thumbnail image={images.thumbnail} />
      <FittedImage slotKey="schematic" image={images.schematic} alt="Ship schematic" />
      <FittedImage slotKey="Tinycon" image={images.tinycon} alt="Faction icon" />

      <VerticalText slotKey="imageCredit" text={data.imageCredit} rotateLeft />

      <IconInBox slotKey="hull" icon={HULL_ICON[data.hull]} alt={`Hull ${data.hull}`} />
      <IconInBox slotKey="shieldFront" icon={SHIELD_ICON[data.shieldFront]} alt={`Shield front ${data.shieldFront}`} className="card-icon card-icon--shield" />
      <IconInBox slotKey="shieldLeft" icon={SHIELD_ICON[data.shieldLeft]} alt={`Shield left ${data.shieldLeft}`} className="card-icon card-icon--shield" />
      <IconInBox slotKey="shieldRight" icon={SHIELD_ICON[data.shieldRight]} alt={`Shield right ${data.shieldRight}`} className="card-icon card-icon--shield" />
      <IconInBox slotKey="shieldRear" icon={SHIELD_ICON[data.shieldRear]} alt={`Shield rear ${data.shieldRear}`} className="card-icon card-icon--shield" />

      <IconInBox slotKey="command" icon={COMMAND_VALUE_ICON[data.command]} alt={`Command ${data.command}`} />
      <IconInBox slotKey="squadron" icon={COMMAND_VALUE_ICON[data.squadron]} alt={`Squadron ${data.squadron}`} />
      <IconInBox slotKey="engineer" icon={COMMAND_VALUE_ICON[data.engineer]} alt={`Engineer ${data.engineer}`} />

      {data.defenseTokens.map((token, i) => (
        <IconInBox
          key={i}
          slotKey={`DT${i + 1}`}
          icon={token === '—' ? undefined : DEFENSE_TOKEN_ICON[DEFENSE_TOKEN_CODE[token]]}
          alt={token}
        />
      ))}

      <DiceGroup slotKey="armamentFront" dice={data.armamentFront} />
      <DiceGroup slotKey="armamentLeft" dice={data.armamentLeft} side="left" />
      <DiceGroup slotKey="armamentRight" dice={data.armamentRight} side="right" />
      <DiceGroup slotKey="armamentRear" dice={data.armamentRear} />
      <DiceGroup slotKey="armamentAntiSquadron" dice={data.armamentAntiSquadron} />

      {(() => {
        const style = boxStyle('upgradeSlots', true)
        if (!style) return null
        return (
          // Icons pack against the right end of the bar; the .2mm gap is the real
          // spacing between them, so these drop .card-icon's default padding and
          // the box carries the 3px inset off its own edges instead.
          <div className="card-icon-box" style={{ ...style, flexWrap: 'wrap', justifyContent: 'flex-end', gap: '0.2mm', padding: '2px' }}>
            {data.upgrades.map((upgrade: UpgradeType, i) => (
              <img key={i} src={UPGRADE_ICON[upgrade]} alt={upgrade} className="card-icon" style={{ maxWidth: '14%', padding: 0 }} />
            ))}
          </div>
        )
      })()}

      {/* Speeds 3 and 4 are optional: an all-zero column means the ship doesn't
          reach that speed, so its lane art *and* its yaw icons drop away again. */}
      <SpeedCells slotPrefix="s1" values={data.speed1} />
      <SpeedCells slotPrefix="s2" values={data.speed2} />
      {hasSpeedClicks(data.speed3) && (
        <>
          <SpeedBackground speed={3} />
          <SpeedCells slotPrefix="s3" values={data.speed3} />
        </>
      )}
      {hasSpeedClicks(data.speed4) && (
        <>
          <SpeedBackground speed={4} />
          <SpeedCells slotPrefix="s4" values={data.speed4} />
        </>
      )}
    </>
  )
}
