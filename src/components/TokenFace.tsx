import { parseDiceRows, type CardData, type DiceLetter } from '../cardData'
import { DICE_ICON, HULL_ICON, SHIELD_ICON } from '../icons'
import {
  getTokenSlot,
  tokenSlotRect,
  HULL_FOOTER_SLOTS,
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
 *  field out its own way. */
function DiceInSlot({ dice, rect, stack = false }: { dice: string; rect: Rect | null; stack?: boolean }) {
  const parsed = parseDiceRows(dice).filter((row) => row.length > 0)
  const rows = stack ? parsed.flat().map((letter) => [letter]) : parsed
  if (!rect || rows.length === 0) return null

  const { places, width, height } = diceLayout(rows, stack)
  const size = Math.min(MAX_DIE_MM, rect.width / width, rect.height / height)
  const left = rect.x + (rect.width - width * size) / 2 + .2
  const top = rect.y + (rect.height - height * size) / 2 + .2

  return (
    <>
      {places.map((place, i) => (
        <image
          key={i}
          href={DICE_ICON[place.letter]}
          x={left + place.x * size}
          y={top + place.y * size}
          width={size}
          height={size}
          preserveAspectRatio="xMidYMid meet"
        />
      ))}
    </>
  )
}

/** The shield value and dice for one arc, inside a hull section panel. */
export function HullSectionFace({
  slots,
  shield,
  dice,
  width,
  height,
  panelRotation = 0,
  mirrored = false,
}: {
  /** This arc's own slot list, so the three sections tune independently. */
  slots: TokenSlot[]
  shield: number
  dice: string
  width: number
  height: number
  /** How far the panel itself is turned, so the shield value can be turned back. */
  panelRotation?: number
  mirrored?: boolean
}) {
  return (
    <>
      <IconInSlot
        icon={SHIELD_ICON[shield]}
        rect={rectFor(slots, 'shield', width, height, mirrored)}
        panelRotation={panelRotation}
      />
      <DiceInSlot dice={dice} rect={rectFor(slots, 'armament', width, height, mirrored)} />
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
