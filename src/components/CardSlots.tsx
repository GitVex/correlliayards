// ---------------------------------------------------------------------------
// THIS IS THE FILE TO EDIT to hand-place every stat on the card.
//
// Every box below is a percentage of the *card artwork's own* width/height
// (0,0 = top-left corner of the art, 100,100 = bottom-right corner), not of
// the screen. That means the numbers stay correct no matter the zoom level
// or the physical mm size the card renders at — only edit the numbers here.
//
// Position lives here and only here — CardFace.tsx reads these boxes (via
// getSlotBox) to render the real, data-driven icons/text. This file just
// draws the dashed outline + label guide on top so you can keep tuning
// placement without hunting through CardFace's rendering logic. Turn
// SHOW_GUIDES off once you're happy — that only hides the guide, it doesn't
// touch position or the live render.
// ---------------------------------------------------------------------------

export const SHOW_GUIDES = true

export type SlotBox = {
  leftPct: number
  topPct: number
  widthPct: number
  heightPct: number
}

type CardSlot = {
  key: string
  label: string
  box: SlotBox
  kind: 'text' | 'icon' | 'group' | 'unmapped'
  note?: string
}

export const CARD_SLOTS: CardSlot[] = [
  // ---- Identity ----
  { key: 'shipClass', label: 'Ship class', kind: 'text', box: { leftPct: 14, topPct: 2, widthPct: 83, heightPct: 6.3 } },
  { key: 'points', label: 'Points', kind: 'text', box: { leftPct: 86, topPct: 94.6, widthPct: 11.2, heightPct: 3.5 } },
  { key: 'Tinycon', label: 'Tinycon', kind: 'icon',
    box: { leftPct: 7.5, topPct: 94, widthPct: 10.7, heightPct: 4 } },
  { key: 'schematic', label: 'schmematic', kind: 'icon',
    box: { leftPct: 59.5, topPct: 50.5, widthPct: 23, heightPct: 28 } },
  // Sits above the card art (negative top) and paints behind it. The bottom edge
  // runs to +2%, past the ~1.5% where the card PNG becomes fully opaque, so the
  // card's own top edge overlaps the art instead of leaving a transparent seam.
  { key: 'thumbnail', label: 'thumbnail', kind: 'icon',
    box: { leftPct: 0, topPct: -26, widthPct: 100, heightPct: 28 } },
  { key: 'imageCredit', label: 'image credit', kind: 'text',
    box: { leftPct: 0, topPct: -26, widthPct: 4, heightPct: 24 } },

  // ---- Defense ----
  { key: 'hull', label: 'Hull', kind: 'icon', box: { leftPct: 18, topPct: 17, widthPct: 10, heightPct: 7 },
    note: 'The big central dial. Could also be the anti-squadron cluster — see that slot\'s note.' },
  { key: 'shieldFront', label: 'Shield · Front', kind: 'icon', box: { leftPct: 77, topPct: 41.5, widthPct: 8, heightPct: 6.5 } },
  { key: 'shieldLeft', label: 'Shield · Left', kind: 'icon', box: { leftPct: 50.5, topPct: 69.2, widthPct: 8, heightPct: 6.5 } },
  { key: 'shieldRight', label: 'Shield · Right', kind: 'icon', box: { leftPct: 84.2, topPct: 69.2, widthPct: 8, heightPct: 6.5 } },
  { key: 'shieldRear', label: 'Shield · Rear', kind: 'icon', box: { leftPct: 76.5, topPct: 80.5, widthPct: 8, heightPct: 6.5 } },
  // One rectangle per cell of the green 2x2 grid — each holds a single token icon.
  { key: 'DT1', label: 'DT1', kind: 'group', box: { leftPct: 6.8, topPct: 31.5, widthPct: 15, heightPct: 7 } },
  { key: 'DT2', label: 'DT2', kind: 'group', box: { leftPct: 22.4, topPct: 31.5, widthPct: 15, heightPct: 7 } },
  { key: 'DT3', label: 'DT3', kind: 'group', box: { leftPct: 6.8, topPct: 39, widthPct: 15, heightPct: 7 } },
  { key: 'DT4', label: 'DT4', kind: 'group', box: { leftPct: 22.4, topPct: 39, widthPct: 15, heightPct: 7 } },

  // ---- Armament ----
  // Dice render at their true size while the cluster fits inside the box below;
  // if it would overflow (e.g. six dice to a row) CardFace scales the whole
  // cluster down to fit. So these boxes set both the anchor *and* the ceiling.
  { key: 'armamentFront', label: 'Armament · Front', kind: 'group', box: { leftPct: 57.5, topPct: 41.7, widthPct: 16.5, heightPct: 6 } },
  { key: 'armamentLeft', label: 'Armament · Left', kind: 'group', box: { leftPct: 50, topPct: 55, widthPct: 9.6, heightPct: 15.3 } },
  { key: 'armamentRight', label: 'Armament · Right', kind: 'group', box: { leftPct: 83.5, topPct: 55, widthPct: 9.6, heightPct: 15.3 } },
  { key: 'armamentRear', label: 'Armament · Rear', kind: 'group', box: { leftPct: 57.1, topPct: 80.75, widthPct: 20, heightPct: 6 } },
  { key: 'armamentAntiSquadron', label: 'Armament · Anti-squadron', kind: 'group', box: { leftPct: 41, topPct: 17.5, widthPct: 9.7, heightPct: 6 } },

  // ---- Command ----
  { key: 'command', label: 'Command', kind: 'icon', box: { leftPct: 56.7, topPct: 15.5, widthPct: 6.7, heightPct: 4.6 } },
  { key: 'squadron', label: 'Squadron', kind: 'icon', box: { leftPct: 56.7, topPct: 21, widthPct: 6.7, heightPct: 4.6 } },
  { key: 'engineer', label: 'Engineer', kind: 'icon', box: { leftPct: 56.7, topPct: 26.6, widthPct: 6.7, heightPct: 4.9 } },

  // ---- Upgrade slots ----
  { key: 'upgradeSlots', label: 'Upgrade slots', kind: 'group',
    box: { leftPct: 19.2, topPct: 93.4, widthPct: 61, heightPct: 5.7 },
    note: 'The bottom black bar — tile one small icon per equipped upgrade slot.' },

  // ---- Speed chart ----
  // -- Speed 1 --
  { key: 's1y1', label: 's1y1', kind: 'icon', box: { leftPct: 6.5, topPct: 74.5, widthPct: 8, heightPct: 6.3 } },
  // -- Speed 2 --
  { key: 's2y1', label: 's2y1', kind: 'icon', box: { leftPct: 14.8, topPct: 74.5, widthPct: 8, heightPct: 6.3 } },
  { key: 's2y2', label: 's2y2', kind: 'icon', box: { leftPct: 14.8, topPct: 68, widthPct: 8, heightPct: 6.3 } },
  // -- Speed 3 --
  { key: 'speed3background', label: 's3backgroun', kind: 'icon', box: { leftPct: 23, topPct: 61.5, widthPct: 8, heightPct: 19.2 } },
  { key: 's3y1', label: 's3y1', kind: 'icon', box: { leftPct: 23, topPct: 74.5, widthPct: 8, heightPct: 6.3 } },
  { key: 's3y2', label: 's3y2', kind: 'icon', box: { leftPct: 23, topPct: 68, widthPct: 8, heightPct: 6.3 } },
  { key: 's3y3', label: 's3y3', kind: 'icon', box: { leftPct: 23, topPct: 61.5, widthPct: 8, heightPct: 6.3 } },
  // -- Speed 4 --
  { key: 'speed4background', label: 's4background', kind: 'icon', box: { leftPct: 31.5, topPct: 55, widthPct: 8, heightPct: 25.7 } },
  { key: 's4y1', label: 's4y1', kind: 'icon', box: { leftPct: 31.5, topPct: 74.5, widthPct: 8, heightPct: 6.3 } },
  { key: 's4y2', label: 's4y2', kind: 'icon', box: { leftPct: 31.5, topPct: 68, widthPct: 8, heightPct: 6.3 } },
  { key: 's4y3', label: 's4y3', kind: 'icon', box: { leftPct: 31.5, topPct: 61.5, widthPct: 8, heightPct: 6.3 } },
  { key: 's4y4', label: 's4y4', kind: 'icon', box: { leftPct: 31.5, topPct: 55, widthPct: 8, heightPct: 6.3 } },
]

/** Looks up a slot's hand-tuned box by key — the one source of truth for position,
 *  shared between this debug guide and CardFace's live rendering. */
export function getSlotBox(key: string): SlotBox | undefined {
  return CARD_SLOTS.find((slot) => slot.key === key)?.box
}

export function CardSlots() {
  if (!SHOW_GUIDES) return null

  return (
    <>
      {CARD_SLOTS.map((slot) => (
        <div
          key={slot.key}
          className={`card-slot card-slot--${slot.kind}`}
          style={{
            left: `${slot.box.leftPct}%`,
            top: `${slot.box.topPct}%`,
            width: `${slot.box.widthPct}%`,
            height: `${slot.box.heightPct}%`,
          }}
          title={slot.note}
        >
          <span className="card-slot__label">{slot.label}</span>
        </div>
      ))}
    </>
  )
}
