import { useLayoutEffect, useRef, useState } from 'react'
import shipNameBackdrop from '../assets/base_tokens/blank_ship_name_slot.png'
import { parseDiceRows, type CardData, type DiceLetter } from '../cardData'
import type { CardImages } from '../cardImages'
import { DICE_ICON, HULL_ICON, SHIELD_ICON } from '../icons'
import {
  getTokenSlot,
  tokenSlotRect,
  HULL_FOOTER_SLOTS,
  TOKEN_SLOTS,
  type TokenSlot,
} from './TokenSlots'

// ---------------------------------------------------------------------------
// The live base-token face — the counterpart to CardFace, reading the same
// CardData and painting it into the boxes hand-tuned in TokenSlots.tsx. Position
// lives there; this file only decides what goes in each box.
//
// Everything is drawn in its panel's own mm space, so it rides along as the hull
// sections slide around the token edge. A mirrored panel flips where the boxes
// are, never what's drawn in them — so a shield value stays upright on both sides.
// ---------------------------------------------------------------------------

type Rect = { x: number; y: number; width: number; height: number }

function rectFor(slots: TokenSlot[], key: string, width: number, height: number, mirrored: boolean): Rect | null {
  const slot = getTokenSlot(slots, key)
  return slot ? tokenSlotRect(slot, width, height, mirrored) : null
}

/** Largest a die prints on the token, however much room its box has. */
const MAX_DIE_MM = 1.8

/** Hand-tuned offset off the centre of an armament box — the printed strip the
 *  dice sit on isn't quite centred in the box it's tuned as. */
const NUDGE_MM = 0.2

/** One icon, centred in its box and scaled to fit — the SVG equivalent of the
 *  card's object-fit: contain. `panelRotation` is undone about the icon's own
 *  centre, so a value inside a panel that's turned on its side still reads
 *  upright. */
function IconInSlot({
  icon,
  rect,
  panelRotation = 0,
}: {
  icon: string | undefined
  rect: Rect | null
  panelRotation?: number
}) {
  if (!icon || !rect) return null
  const transform = panelRotation
    ? `rotate(${-panelRotation} ${rect.x + rect.width / 2} ${rect.y + rect.height / 2})`
    : undefined
  return (
    <image
      href={icon}
      x={rect.x}
      y={rect.y}
      width={rect.width}
      height={rect.height}
      preserveAspectRatio="xMidYMid meet"
      transform={transform}
    />
  )
}

// The card's cluster, in proportions of one die: dice in a row sit a hair apart,
// and each further row steps half a die right and a bit over half a die down.
// Lifted from CardFace's 2.3mm dice — 0.2mm between them, rows pulled 0.7mm back
// into each other — so the token reads the same, just smaller.
const DICE_GAP = 0.2 / 2.3
const DICE_ROW_STAGGER = 0.5
const DICE_ROW_STEP = (2.3 - 0.7) / 2.3

/** Where every die sits, in units of one die, plus the room the cluster needs.
 *  Both are in die-units so the caller can solve for the size that fits. */
function diceLayout(rows: DiceLetter[][], stack: boolean) {
  if (stack) {
    // Zigzag column, on the same proportions as the rows above: every other die
    // steps DICE_ROW_STAGGER to the right, and each one drops DICE_ROW_STEP rather
    // than a whole die, so consecutive dice interlock through each other's
    // transparent corners. The offset alternates instead of accumulating — a long
    // column would otherwise walk off the side of its box.
    return {
      places: rows.map((row, r) => ({
        letter: row[0],
        x: (r % 2) * DICE_ROW_STAGGER,
        y: r * DICE_ROW_STEP,
      })),
      width: rows.length > 1 ? 1 + DICE_ROW_STAGGER : 1,
      height: 1 + (rows.length - 1) * DICE_ROW_STEP,
    }
  }

  const rowWidth = (row: DiceLetter[]) => row.length + (row.length - 1) * DICE_GAP
  return {
    places: rows.flatMap((row, r) =>
      row.map((letter, i) => ({
        letter,
        x: r * DICE_ROW_STAGGER + i * (1 + DICE_GAP),
        y: r * DICE_ROW_STEP,
      })),
    ),
    // The staggered rows lean right, so the widest point is whichever row reaches
    // furthest once its own offset is counted.
    width: Math.max(...rows.map((row, r) => r * DICE_ROW_STAGGER + rowWidth(row))),
    height: 1 + (rows.length - 1) * DICE_ROW_STEP,
  }
}

/** An arc's dice, sized to fit its box and capped at MAX_DIE_MM. The token's
 *  boxes are far too small for the card's fixed-size dice, so here the box drives
 *  the size — up to that ceiling — and shrinks them further when the cluster
 *  reaches the bottom of the box.
 *
 *  `stack` puts every die on its own line regardless of the `;` rows in the dice
 *  string. That's the anti-squadron column on the token; the card lays the same
 *  field out its own way.
 *
 *  `flipX`/`flipY` mirror the finished cluster inside its box, which is how a
 *  broadside is turned to face the right way round — see HullSectionFace. Only
 *  the arrangement moves: a die is a plain diamond, so flipping one is invisible. */
function DiceInSlot({
  dice,
  rect,
  stack = false,
  flipX = false,
  flipY = false,
}: {
  dice: string
  rect: Rect | null
  stack?: boolean
  flipX?: boolean
  flipY?: boolean
}) {
  const parsed = parseDiceRows(dice).filter((row) => row.length > 0)
  const rows = stack ? parsed.flat().map((letter) => [letter]) : parsed
  if (!rect || rows.length === 0) return null

  const { places, width, height } = diceLayout(rows, stack)
  const size = Math.min(MAX_DIE_MM, rect.width / width, rect.height / height)
  // The nudge is taken in the cluster's own frame, not the panel's, so a flipped
  // cluster stays an exact mirror of the one it's flipped from.
  const left = rect.x + (rect.width - width * size) / 2 + (flipX ? -NUDGE_MM : NUDGE_MM)
  const top = rect.y + (rect.height - height * size) / 2 + (flipY ? -NUDGE_MM : NUDGE_MM)
  // A die is placed by its own top-left corner, so mirroring the cluster measures
  // from the far corner of the last die (width/height are in die units, and a die
  // is 1 of them) rather than from the cluster's edge.
  const placeX = (x: number) => left + (flipX ? width - 1 - x : x) * size
  const placeY = (y: number) => top + (flipY ? height - 1 - y : y) * size

  return (
    <>
      {places.map((place, i) => (
        <image
          key={i}
          href={DICE_ICON[place.letter]}
          x={placeX(place.x)}
          y={placeY(place.y)}
          width={size}
          height={size}
          preserveAspectRatio="xMidYMid meet"
        />
      ))}
    </>
  )
}

/** The shield value and dice for one arc, inside a hull section panel.
 *
 *  The broadsides print the card's left-arc cluster (DiceGroup in CardFace), just
 *  at the token's size: first row of the dice string innermost, dice within a row
 *  running toward the rear, later rows stepping outward — and the two sides
 *  mirror each other across the ship's centre line.
 *
 *  Getting there is a flip per axis the panel disagrees on. A panel's y already
 *  points inward, so both broadsides flip y to send their later rows back out.
 *  Its x runs down the token on the right-hand panel but *up* it on the left,
 *  whose boxes are mirrored along with its artwork — so the left one flips x too,
 *  and both broadsides then read front-to-rear. The front panel is laid out its
 *  own way and flips neither. */
export function HullSectionFace({
  slots,
  arc,
  shield,
  dice,
  width,
  height,
  panelRotation = 0,
}: {
  /** This arc's own slot list, so the three sections tune independently. */
  slots: TokenSlot[]
  /** Which section this is — it decides the mirroring, on the boxes and the dice. */
  arc: 'front' | 'left' | 'right'
  shield: number
  dice: string
  width: number
  height: number
  /** How far the panel itself is turned, so the shield value can be turned back. */
  panelRotation?: number
}) {
  const mirrored = arc === 'left'
  const broadside = arc !== 'front'
  return (
    <>
      <IconInSlot
        icon={SHIELD_ICON[shield]}
        rect={rectFor(slots, 'shield', width, height, mirrored)}
        panelRotation={panelRotation}
      />
      <DiceInSlot
        dice={dice}
        rect={rectFor(slots, 'armament', width, height, mirrored)}
        flipX={mirrored}
        flipY={broadside}
      />
    </>
  )
}

/** Turns an image's colours inside out while leaving its alpha alone — the same
 *  thing CSS `filter: invert(1)` does, written as an SVG filter so it works on an
 *  <image> in every browser. sRGB rather than the filter default of linearRGB, so
 *  the result matches the CSS version an artwork was likely checked against. */
const INVERT_FILTER_ID = 'token-invert'

function InvertFilter() {
  return (
    <defs>
      <filter id={INVERT_FILTER_ID} colorInterpolationFilters="sRGB">
        <feComponentTransfer>
          <feFuncR type="table" tableValues="1 0" />
          <feFuncG type="table" tableValues="1 0" />
          <feFuncB type="table" tableValues="1 0" />
        </feComponentTransfer>
      </filter>
    </defs>
  )
}

/** How much of the band's height one line of the name is set at, before any
 *  squeeze — leaves the glow showing above and below the letters. */
const NAME_HEIGHT_SHARE = 0.62

/** The ship name across the backdrop band, centred both ways. The typeface is
 *  the card's own, inherited from .token-arcs — see the note there for why it
 *  can't be set on the text itself. The ink it does carry, since an export would
 *  otherwise fall back to SVG's plain black.
 *
 *  Size comes off the band's height, so it scales with the base; a name too long
 *  for the band is then squeezed to fit by a transform rather than by shrinking
 *  the font, which keeps getComputedTextLength measuring the *unsqueezed* text
 *  and stops the measure/resize loop that a font-size fit would need. Armada
 *  loads with font-display: swap, so the fit is taken again once fonts settle —
 *  the first pass would otherwise measure the fallback face. */
function ShipName({ name, rect }: { name: string; rect: Rect | null }) {
  const textRef = useRef<SVGTextElement>(null)
  const [squeeze, setSqueeze] = useState(1)

  useLayoutEffect(() => {
    if (!rect) return
    let live = true
    const fit = () => {
      const el = textRef.current
      if (!live || !el) return
      const drawn = el.getComputedTextLength()
      setSqueeze(drawn > 0 ? Math.min(1, rect.width / drawn) : 1)
    }
    fit()
    document.fonts?.ready.then(fit)
    return () => {
      live = false
    }
  }, [name, rect?.width, rect?.height])

  if (!rect || !name) return null
  const cx = rect.x + rect.width / 2
  const cy = rect.y + rect.height / 2

  return (
    <text
      ref={textRef}
      className="token-face"
      fill="#111"
      x={cx}
      y={cy}
      fontSize={rect.height * NAME_HEIGHT_SHARE}
      textAnchor="middle"
      dominantBaseline="central"
      transform={squeeze < 1 ? `translate(${cx} ${cy}) scale(${squeeze}) translate(${-cx} ${-cy})` : undefined}
    >
      {name}
    </text>
  )
}

/** What's pinned to the token itself rather than to a hull panel: the ship name
 *  and the backdrop behind it, and the inverted faction icon up top. Drawn before
 *  the panels so a panel dragged across any of it sits over it, the way the
 *  printed token stacks.
 *
 *  The backdrop is stretched to fill its slot rather than fitted inside it — it's
 *  a soft blurred glow, so it takes the stretch without showing it, and the band
 *  then covers exactly the box tuned in TokenSlots whatever the base size. The
 *  tinycon is user artwork, so that one is fitted and keeps its aspect ratio. */
export function TokenFace({
  data,
  images,
  width,
  height,
}: {
  data: CardData
  images: CardImages
  width: number
  height: number
}) {
  const rect = (key: string) => rectFor(TOKEN_SLOTS, key, width, height, false)
  const nameRect = rect('shipClass')
  const tinyconRect = rect('tinycon')
  const tinycon = images.tinycon

  return (
    <>
      <InvertFilter />
      {nameRect && (
        <image className="token-face" href={shipNameBackdrop} {...nameRect} preserveAspectRatio="none" />
      )}
      <ShipName name={data.shipClass} rect={nameRect} />
      {tinycon && tinyconRect && (
        <image
          className="token-face"
          href={tinycon.url}
          {...tinyconRect}
          preserveAspectRatio="xMidYMid meet"
          filter={`url(#${INVERT_FILTER_ID})`}
        />
      )}
    </>
  )
}

/** The rear arc, the anti-squadron dice and the hull value, inside the footer. */
export function HullFooterFace({ data, width, height }: { data: CardData; width: number; height: number }) {
  const rect = (key: string) => rectFor(HULL_FOOTER_SLOTS, key, width, height, false)
  return (
    <>
      <DiceInSlot dice={data.armamentAntiSquadron} rect={rect('armamentAntiSquadron')} stack />
      <DiceInSlot dice={data.armamentRear} rect={rect('armamentRear')} />
      <IconInSlot icon={SHIELD_ICON[data.shieldRear]} rect={rect('shieldRear')} />
      <IconInSlot icon={HULL_ICON[data.hull]} rect={rect('hull')} />
    </>
  )
}
