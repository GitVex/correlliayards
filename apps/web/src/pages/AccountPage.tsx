import { Link } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { displayName } from '../auth/session'
import { Avatar } from '../components/Avatar'
import { paths } from '../paths'

/** Formats an ISO 8601 timestamp in the reader's own locale and zone.
 *
 *  `undefined` as the locale on purpose — that is what asks the browser for the
 *  user's, rather than pinning everyone to one this code happened to pick. */
function formatDate(iso: string, withTime = false): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'long',
    ...(withTime ? { timeStyle: 'short' as const } : {}),
  }).format(date)
}

/** Everything the app knows about you, which is deliberately not much — and
 *  split by who owns it, because that is the difference that decides what you
 *  can do about any of it.
 *
 *  The claims are Zitadel's: there is nothing here to edit, because editing
 *  happens there and arrives here on the next refresh. The account row is ours,
 *  and exists for the one fact OIDC has no claim for — when you joined. */
export function AccountPage() {
  /* Rendered under RequireSession, so the session is known and authenticated by
     the time this runs. Anything else is a routing bug, not a state to draw. */
  const { session, logOut, loggingOut, logOutError } = useAuth()
  if (session?.status !== 'authenticated') return null

  const { user, account } = session

  return (
    <main className="page">
      <div className="page__panel">
        <div className="account__head">
          <Avatar user={user} size={64} />
          <div>
            <h1 className="page__title">{displayName(user)}</h1>
            <p className="page__note">Member since {formatDate(account.registeredAt)}</p>
          </div>
        </div>

        <h2 className="page__subtitle">Profile</h2>
        <p className="page__lead">
          From your Zitadel profile. Change any of it there and it will follow you back here within a few minutes.
        </p>

        <dl className="facts">
          <dt>Name</dt>
          <dd>{user.name ?? <span className="page__note">not set</span>}</dd>

          <dt>Username</dt>
          <dd>{user.preferredUsername ?? <span className="page__note">not set</span>}</dd>

          <dt>Email</dt>
          <dd>
            {user.email ? (
              <>
                {user.email}{' '}
                {/* The claim is tri-state: true, false, or absent because the
                    provider did not say. "Unverified" and "unstated" are not the
                    same claim about someone's mailbox, so they are not the same
                    badge. */}
                {user.emailVerified === true && <span className="badge badge--ok">verified</span>}
                {user.emailVerified === false && <span className="badge">unverified</span>}
              </>
            ) : (
              <span className="page__note">not set</span>
            )}
          </dd>

          <dt>Picture</dt>
          <dd>
            {user.picture ? (
              <span className="page__note">Set in Zitadel.</span>
            ) : (
              <span className="page__note">
                No avatar set. Add one in Zitadel and it will appear here — until then you get your initial.
              </span>
            )}
          </dd>
        </dl>

        <h2 className="page__subtitle">Account</h2>
        <p className="page__lead">Kept by Corellia Yards, and the part that is ours to be sure about.</p>

        <dl className="facts">
          <dt>Registered</dt>
          <dd>
            {formatDate(account.registeredAt)}
            <span className="page__note">
              The first time you signed in here. There is no OIDC claim for when an account was created, so this is
              measured from when we first saw you rather than from anything Zitadel says.
            </span>
          </dd>

          <dt>Last seen</dt>
          <dd>{formatDate(account.lastSeenAt, true)}</dd>

          <dt>Subject</dt>
          <dd>
            <code>{user.sub}</code>
            <span className="page__note">
              Your stable id at Zitadel. Every card and collection you save is owned by this, not by your name or
              email, so changing either keeps your work attached to you.
            </span>
          </dd>
        </dl>

        <h2 className="page__subtitle">Your work</h2>
        <p className="page__lead">
          <Link to={paths.cards}>Cards</Link> · <Link to={paths.collections}>Collections</Link>
        </p>

        <h2 className="page__subtitle">Session</h2>
        <p className="page__lead">
          Logging out ends your session here <em>and</em> your single sign-on session at Zitadel — without the second
          half, signing back in would not stop to ask you for anything.
        </p>
        <p>
          <button className="btn" onClick={() => void logOut()} disabled={loggingOut}>
            {loggingOut ? 'Signing out…' : 'Log out'}
          </button>
        </p>
        {logOutError && (
          <p className="page__error" role="alert">
            {logOutError} — you may still be signed in.
          </p>
        )}
      </div>
    </main>
  )
}
