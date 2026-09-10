import { useState } from 'react'
import { displayName, type SessionUser } from '../auth/session'

/** Someone's picture, or the first letter of their name when there isn't one.
 *
 *  The `picture` claim is a URL on Zitadel's side, which means it can 404 after
 *  an avatar is removed, or fail behind a network that cannot reach it. A
 *  broken-image glyph is a worse answer than the initial, so a load failure
 *  falls back rather than showing one.
 *
 *  `alt=""` throughout: every use of this sits directly beside the person's
 *  name in text, so announcing it again would only make a screen reader say the
 *  same thing twice. */
export function Avatar({ user, size }: { user: SessionUser; size: number }) {
  const [broken, setBroken] = useState(false)
  const box = { width: size, height: size }

  if (user.picture && !broken) {
    return (
      <img
        className="avatar"
        src={user.picture}
        alt=""
        style={box}
        /* The avatar host has no business learning which page of this app
           someone is on. */
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
      />
    )
  }

  return (
    <span className="avatar avatar--initial" style={box} aria-hidden="true">
      {displayName(user).slice(0, 1).toUpperCase()}
    </span>
  )
}
