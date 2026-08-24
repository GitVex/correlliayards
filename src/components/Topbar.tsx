import { useState } from 'react'

type CardType = 'Ship' | 'Squadron' | 'Upgrade'

export function Topbar() {
  const [cardType, setCardType] = useState<CardType>('Ship')

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand__mark">Forge</span>
        <span className="brand__note">lancer-pursuit.json</span>
      </div>

      <div className="switch" role="group" aria-label="Card type">
        {(['Ship', 'Squadron', 'Upgrade'] as CardType[]).map((opt) => (
          <button
            key={opt}
            className="switch__opt"
            aria-pressed={cardType === opt}
            onClick={() => setCardType(opt)}
          >
            {opt}
          </button>
        ))}
      </div>

      <div className="topbar__spacer" />

      <div className="readout">
        <span className="readout__dot" />1 warning
      </div>
      <button className="btn">Load definition</button>
      <button className="btn">Print sheet</button>
      <button className="btn btn--primary">Export PNG</button>
    </header>
  )
}
