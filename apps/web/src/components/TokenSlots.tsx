// ---------------------------------------------------------------------------
// THIS IS THE FILE TO EDIT to hand-place every stat on the base token — the same
// job CardSlots.tsx does for the card, and the same rules apply: every box is a
// percentage of whatever it sits in, so the numbers hold at any zoom or base size.
//
// The difference is what a box is a percentage *of*. The token's printed stats
// live inside panels that move: the hull sections slide around the token edge as
// the firing arcs are dragged, and the side ones are mirrored. So a slot is a
// percentage of its own panel, not of the token, and travels with it for free —
// TokenRenderer draws the guides inside each panel's transform.
//
// TOKEN_SLOTS is for anything pinned to the token itself instead.
// ---------------------------------------------------------------------------

export const SHOW_TOKEN_GUIDES = false

export type TokenSlotBox = {
  leftPct: number
  topPct: number
  widthPct: number
  heightPct: number
}

export type TokenSlot = {
  key: string
  label: string
  box: TokenSlotBox
  kind: 'text' | 'icon' | 'group'
  /** Inset in millimetres, taken off all four sides of the box. Absolute rather
   *  than a percentage so it reads the same on every panel. */
  padMm?: number
  note?: string
}

/** 5px, the inset the card gives its shield icons (.card-icon--shield in
 *  App.css), converted at the 96dpi CSS reference so both faces match. */
export const ICON_PAD_MM = (2.5 * 25.4) / 96

// Each hull section gets its own list rather than three arcs sharing one, so a
// box can be nudged on the front without dragging the sides with it. They start
// out identical — boxes read off blank_hull_section.png, the shield circle on the
// outward half and the armament strip filling the rest — and drift apart as you
// tune. The left one is mirrored when it's drawn, so its numbers stay measured
// from the same edge as the others: leftPct is the distance from the *outward*
// end of the panel on every section.

/** Front arc, the panel across the top of the token. */
// eslint-disable-next-line react-refresh/only-export-components
export const FRONT_SECTION_SLOTS: TokenSlot[] = [
  { key: 'shield', label: 'Shield', kind: 'icon', padMm: ICON_PAD_MM,
    box: { leftPct: 7.93, topPct: 16.9, widthPct: 26.7, heightPct: 42 } },
  { key: 'armament', label: 'Armament', kind: 'group',
    box: { leftPct: 40, topPct: 17.7, widthPct: 50, heightPct: 42 },
    note: 'Dice for this arc — the striped strip beside the shield circle.' },
]

/** Right arc. */
// eslint-disable-next-line react-refresh/only-export-components
export const RIGHT_SECTION_SLOTS: TokenSlot[] = [
  { key: 'shield', label: 'Shield', kind: 'icon', padMm: ICON_PAD_MM,
    box: { leftPct: 8.7, topPct: 18, widthPct: 24.7, heightPct: 42 } },
  { key: 'armament', label: 'Armament', kind: 'group',
    box: { leftPct: 40, topPct: 17.7, widthPct: 50, heightPct: 42 } },
]

/** Left arc — drawn mirrored, tuned unmirrored. */
// eslint-disable-next-line react-refresh/only-export-components
export const LEFT_SECTION_SLOTS: TokenSlot[] = [
  { key: 'shield', label: 'Shield', kind: 'icon', padMm: ICON_PAD_MM,
    box: { leftPct: 7.93, topPct: 19, widthPct: 26.7, heightPct: 42 } },
  { key: 'armament', label: 'Armament', kind: 'group',
    box: { leftPct: 40, topPct: 17.7, widthPct: 50, heightPct: 42 } },
]

/** Percentages of the footer panel at the foot of the centre axis, read off
 *  blank_hull_footer.png. */
// eslint-disable-next-line react-refresh/only-export-components
export const HULL_FOOTER_SLOTS: TokenSlot[] = [
  { key: 'armamentAntiSquadron', label: 'A1', kind: 'icon',
    box: { leftPct: 16, topPct: 42, widthPct: 10, heightPct: 37 } },
  { key: 'armamentRear', label: 'ARe', kind: 'text',
    box: { leftPct: 29.9, topPct: 40.5, widthPct: 27.8, heightPct: 39.7 } },
  { key: 'shieldRear', label: 'shieldRear', kind: 'icon', padMm: ICON_PAD_MM,
    box: { leftPct: 60.1, topPct: 40.5, widthPct: 14.9, heightPct: 39.7 } },
  { key: 'hull', label: 'hull', kind: 'text', padMm: ICON_PAD_MM,
    box: { leftPct: 81, topPct: 40.5, widthPct: 16, heightPct: 39.7 } },
]

/** Percentages of the whole token, for anything that isn't inside a panel. */
// eslint-disable-next-line react-refresh/only-export-components
export const TOKEN_SLOTS: TokenSlot[] = [
  { key: 'shipClass', label: 'Ship class', kind: 'text',
    box: { leftPct: 3, topPct: 78, widthPct: 94, heightPct: 6.8 },
    note: 'The name band above the footer. blank_ship_name_slot.png is stretched to fill this box exactly, so the backdrop always covers whatever is tuned here.' },
  { key: 'tinycon', label: 'Tinycon', kind: 'icon',
    box: { leftPct: 40, topPct: 20, widthPct: 20, heightPct: 11 },
    note: "The faction icon, inverted, in the clear band between the front hull panel and the artwork window. Square on a small base; the icon keeps its own aspect ratio inside the box, so widening it won't stretch it." },
]

/** Shared lookup, the one source of truth for position that a face component
 *  reads to paint the real icons and text. */
// eslint-disable-next-line react-refresh/only-export-components
export function getTokenSlot(slots: TokenSlot[], key: string): TokenSlot | undefined {
  return slots.find((slot) => slot.key === key)
}

/** The rect a slot's contents actually occupy, in its container's own mm space:
 *  its percentages of that container, less its padding. Guides draw this too, so
 *  the dashed box always shows exactly where the contents land.
 *
 *  `mirrored` flips it horizontally, for the left-hand hull section whose artwork
 *  is mirrored — the box moves with the art, whatever is drawn in it need not. */
// eslint-disable-next-line react-refresh/only-export-components
export function tokenSlotRect(slot: TokenSlot, width: number, height: number, mirrored = false) {
  const { box } = slot
  const w = (box.widthPct / 100) * width
  const h = (box.heightPct / 100) * height
  const left = mirrored ? width - (box.leftPct / 100) * width - w : (box.leftPct / 100) * width
  const top = (box.topPct / 100) * height
  // Never let the padding eat past the middle of its own box.
  const pad = Math.min(slot.padMm ?? 0, w / 2.5, h / 2.5)
  return { x: left + pad, y: top + pad, width: w - pad * 2, height: h - pad * 2 }
}

/** Dashed outlines over a panel (or the token) so placement can be tuned by eye.
 *  Guides only — turning SHOW_TOKEN_GUIDES off doesn't move anything. */
export function TokenSlotGuides({
  slots,
  width,
  height,
  mirrored = false,
}: {
  slots: TokenSlot[]
  width: number
  height: number
  mirrored?: boolean
}) {
  if (!SHOW_TOKEN_GUIDES) return null

  return (
    <>
      {slots.map((slot) => {
        const rect = tokenSlotRect(slot, width, height, mirrored)
        return (
          <g key={slot.key}>
            <rect className={`token-slot token-slot--${slot.kind}`} {...rect} />
            <text className="token-slot__label" x={rect.x + 0.2} y={rect.y + 1.1}>
              {slot.label}
            </text>
          </g>
        )
      })}
    </>
  )
}
