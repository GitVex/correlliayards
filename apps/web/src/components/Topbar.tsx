import { useState } from 'react'
import { Link, NavLink, useMatch } from 'react-router'
import { CecMark, WrenchMark } from './CecMark'
import { paths } from '../paths'

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

/** The nav's own links. Kept to the pages that are the person's own workspace —
 *  a shared link's page is somewhere you arrive, never somewhere you navigate
 *  to, and it has its own chrome for that reason. */
const NAV = [
  { to: paths.editor, label: 'Editor', end: true },
  { to: paths.cards, label: 'Cards', end: false },
  { to: paths.collections, label: 'Collections', end: false },
]

export function Topbar() {
  const [cardType, setCardType] = useState<CardType>('Ship')

  /* The switch chooses which kind of card the editor is editing, so it belongs
     to the editor and not to the plate it happens to sit on. On the list pages
     it would be a control with nothing to act on.

     When the squadron and upgrade editors are built this stops being local
     state and becomes part of the URL — they are three editors, and which one
     you have open is the sort of thing a reload should keep and a link should
     carry. That is a route change, which is why it is worth naming here rather
     than growing a second source of truth in the meantime. */
  const onEditor = useMatch(paths.editor) !== null

  return (
    <header className="topbar">
      <Link className="brand" to={paths.editor}>
        <CecMark className="brand__logo" />
        <span className="brand__mark">Corellia Yards</span>
      </Link>

      <nav className="nav" aria-label="Sections">
        {NAV.map(({ to, label, end }) => (
          <NavLink key={to} className="nav__link" to={to} end={end}>
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="topbar__spacer" />

      {onEditor && (
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
      )}
    </header>
  )
}
