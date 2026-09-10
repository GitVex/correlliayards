import { Link, Outlet } from 'react-router'
import { CecMark } from '../components/CecMark'
import { paths } from '../paths'

/** The chrome around a shared link.
 *
 *  Deliberately not `AppShell`: whoever opens `/c/…` is a visitor looking at
 *  one card, not a signed-in user in the middle of building one. Editor
 *  furniture — the card-type switch, the lists nav — would be dead controls to
 *  them. All that carries over is the brand, which doubles as the way in. */
export function PublicShell() {
  return (
    <div className="app">
      <header className="topbar">
        <Link className="brand" to={paths.editor}>
          <CecMark className="brand__logo" />
          <span className="brand__mark">Corellia Yards</span>
        </Link>
        <div className="topbar__spacer" />
        <Link className="btn" to={paths.editor}>
          Build your own
        </Link>
      </header>

      <Outlet />
    </div>
  )
}
