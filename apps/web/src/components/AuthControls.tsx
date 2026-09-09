import { Link, useLocation } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { displayName, loginHref } from '../auth/session'
import { Avatar } from './Avatar'
import { paths } from '../paths'

/** The identity end of the topbar: sign in, or who you are and the way out. */
export function AuthControls() {
  const { session, logOut, loggingOut, logOutError } = useAuth()
  const location = useLocation()

  /* Nothing until /auth/me has answered. The alternative - assume signed
     out and correct yourself - puts a Sign in button under the cursor of
     someone who is already signed in, which is the one moment they are most
     likely to click it. */
  if (session === undefined || session.status === 'unreachable') return null

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
