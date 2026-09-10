import { useState } from 'react'
import { Link, NavLink, useMatch } from 'react-router'
import { CecMark, WrenchMark } from './CecMark'
import { AuthControls } from './AuthControls'
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
 *  to, and it has its own chrome for that reason.
 *
 *  `built` is the same honesty the card-type switch above applies, for the same
 *  reason. Collections has a full set of API routes and a route in the SPA, but
 *  the page behind it is a placeholder — so a link styled like the working ones
 *  promises a page and delivers a note about one. Marked this way it reads as
 *  what it is: coming, not broken.
 *
 *  The route stays registered either way. A nav link is a promise; a URL that
 *  resolves is just a URL that resolves, and typing /collections or reloading
 *  on it should still land somewhere rather than 404. */
const NAV: { to: string; label: string; end: boolean; built: boolean }[] = [
  { to: paths.editor, label: 'Editor', end: true, built: true },
  { to: paths.cards, label: 'Cards', end: false, built: true },
  { to: paths.collections, label: 'Collections', end: false, built: false },
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
        {NAV.map(({ to, label, end, built }) =>
          built ? (
            <NavLink key={to} className="nav__link" to={to} end={end}>
              {label}
            </NavLink>
          ) : (
            // Same shape as the disabled card types: the tooltip hangs off the
            // wrapper because the thing inside takes no pointer events.
            <span key={to} className="tip" data-tip={`${label} are still in development`}>
              <span className="nav__link nav__link--wip" aria-disabled="true">
                {label}
                <WrenchMark className="nav__wip" />
              </span>
            </span>
          ),
        )}
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

      <AuthControls />
    </header>
  )
}
