import { useState } from 'react'
import { CecMark, WrenchMark } from './CecMark'

type CardType = 'Ship' | 'Squadron' | 'Upgrade'

/** Only the ship card and its base token are rendered today. The other two types
 *  stay visible so the shape of the tool is honest about where it's going, but
 *  they can't be selected — see the tooltip they carry. */
const BUILT: Record<CardType, boolean> = {
  Ship: true,
  Squadron: false,
  Upgrade: false,
}

const CARD_TYPES: CardType[] = ['Ship', 'Squadron', 'Upgrade']

export function Topbar() {
  const [cardType, setCardType] = useState<CardType>('Ship')

  return (
    <header className="topbar">
      <div className="brand">
        <CecMark className="brand__logo" />
        <span className="brand__mark">Corellia Yards</span>
      </div>

      <div className="topbar__spacer" />

      <div className="switch" role="group" aria-label="Card type">
        {CARD_TYPES.map((opt) =>
          BUILT[opt] ? (
            <button
              key={opt}
              className="switch__opt"
              aria-pressed={cardType === opt}
              onClick={() => setCardType(opt)}
            >
              {opt}
            </button>
          ) : (
            // The tooltip hangs off the wrapper, not the button: a disabled
            // button takes no pointer events, so nothing on it can be hovered.
            <span key={opt} className="tip" data-tip={`${opt} cards are still in development`}>
              <button className="switch__opt" disabled aria-pressed={false}>
                {opt}
                <WrenchMark className="switch__wip" />
              </button>
            </span>
          ),
        )}
      </div>
    </header>
  )
}
