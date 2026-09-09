import { Link, useLocation } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { displayName, loginHref } from '../auth/session'
import { Avatar } from './Avatar'
import { paths } from '../paths'

/** The identity end of the topbar: sign in, or who you are and the way out. */
export function AuthControls() {
  const { session, refresh, logOut, loggingOut, logOutError } = useAuth()
  const location = useLocation()

  /* Nothing at all until `/auth/me` has answered, which is a moment. The
     alternative — assume signed out and correct yourself — puts a Sign in
     button under the cursor of someone who is already signed in, which is the
     one moment they are most likely to click it. */
  if (session === undefined) return null

  /* "Cannot tell" gets its own control rather than rendering nothing.
     Rendering nothing was the first attempt and it is the worse failure: the
     topbar simply has no auth in it, which looks like a missing feature rather
     than a server that is down, and there is no way to ask again short of a
     reload. A Sign in button would be the other wrong answer — it would promise
     something that is not going to work. */
  if (session.status === 'unreachable') {
    return (
      <span className="tip" data-tip="Can’t reach the server, so it isn’t known whether you’re signed in. Click to retry.">
        <button className="btn btn--quiet" onClick={() => void refresh()}>
          Offline
        </button>
      </span>
    )
  }

  if (session.status === 'anonymous') {
    return (
      <a className="btn btn--accent" href={loginHref(location.pathname + location.search)}>
        Sign in
      </a>
    )
  }

  const label = displayName(session.user)

  return (
    <div className="acct">
      <Link className="acct__chip" to={paths.account} title={`Signed in as ${label}`}>
        <Avatar user={session.user} size={22} />
        <span className="acct__name">{label}</span>
      </Link>

      <button className="btn" onClick={() => void logOut()} disabled={loggingOut}>
        {loggingOut ? 'Signing out…' : 'Log out'}
      </button>

      {/* Rare, and worth saying out loud where the click happened rather than
          only on the account page — a logout that quietly did nothing is the
          kind of failure someone walks away from. */}
      {logOutError && (
        <span className="acct__error" role="alert">
          {logOutError}
        </span>
      )}
    </div>
  )
}
