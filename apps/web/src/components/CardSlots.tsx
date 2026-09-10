import { CARD_SLOTS, SHOW_GUIDES } from '../cardSlots'

/** The dashed placement guide, drawn over the card art.
 *
 *  A debugging affordance and nothing more: it renders only while SHOW_GUIDES
 *  is on in ../cardSlots.ts, which is also where every box it draws is defined.
 *  Nothing here decides position. */
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
