import { useLocation } from 'react-router'
import type { ReactNode } from 'react'
import { useAuth } from './useAuth'
import { loginHref } from './session'

/** The gate in front of anything that is *yours* — your cards, your
 *  collections, your account.
 *
 *  It renders a prompt rather than bouncing straight to Zitadel, and that is a
 *  deliberate choice against the more usual one. An automatic redirect turns
 *  every mistyped URL and every expired session into a trip through an identity
 *  provider, it cannot be backed out of with the back button, and if anything in
 *  the chain misbehaves it loops. A button costs one click and none of that.
 *
 *  It is not a security boundary and does not pretend to be one. The API checks
 *  the session on every route and answers 404 for rows that are not yours; this
 *  only decides what to draw. */
export function RequireSession({ children }: { children: ReactNode }) {
  const { session, refresh } = useAuth()
  const location = useLocation()

  if (session === undefined) {
    return (
      <main className="page">
        <div className="page__panel">
          <p className="page__lead">Checking your session…</p>
        </div>
      </main>
    )
  }

  if (session.status === 'unreachable') {
    return (
      <main className="page">
        <div className="page__panel">
          <h1 className="page__title">Can&rsquo;t reach the server</h1>
          <p className="page__lead">
            Your session could not be checked, so this page is not going to guess whether you are signed in.
          </p>
          <p>
            <button className="btn" onClick={() => void refresh()}>
              Try again
            </button>
          </p>
        </div>
      </main>
    )
  }

  if (session.status === 'anonymous') {
    /* Back to exactly where they were headed. The path and query only — the
       fragment never reaches the server, so there is nothing to be gained by
       sending it, and the server rejects anything that is not a local path. */
    const returnTo = location.pathname + location.search

    return (
      <main className="page">
        <div className="page__panel">
          <h1 className="page__title">Sign in to continue</h1>
          <p className="page__lead">
            This page shows things saved to your account. Signing in takes you to Zitadel and brings you straight back
            here.
          </p>
          <p>
            <a className="btn btn--accent" href={loginHref(returnTo)}>
              Sign in
            </a>
          </p>
        </div>
      </main>
    )
  }

  return <>{children}</>
}
