// ---------------------------------------------------------------------------
// The browser half of the BFF.
//
// There is no auth library here, and that is deliberate: the tokens live on the
// API and never cross the wire, so the only thing this side has is a session
// cookie it cannot read and three endpoints it can call. An OIDC client in the
// browser would be re-implementing the flow that `apps/api/src/routes/auth`
// already owns, against tokens it is not allowed to hold.
//
// Everything here assumes the SPA and the API answer on the same origin — see
// the proxy in vite.config.ts for development and the reverse_proxy in the
// Caddyfile for the deployed bundle. That is not a convenience: `cy.sid` is
// HttpOnly and SameSite=Lax, so a cross-origin fetch would not carry it and the
// login redirect would land the cookie on the wrong host.
// ---------------------------------------------------------------------------

import type { Account, MeResponse, SessionUser } from '@correlliayards/shared'

/* Imported as types, so none of Zod reaches the bundle. The API is the only
   thing that validates these — it built the response, and a second parse in the
   browser would only be able to disagree with the server about its own data. */
export type { Account, SessionUser }

/** Three states, not two. "Signed out" and "cannot tell" are different answers,
 *  and collapsing them makes the app claim you are signed out whenever the API
 *  is down — which is both wrong and, on an account page, alarming.
 *
 *  The authenticated case carries both halves of `/auth/me` and keeps them
 *  apart, because they are different kinds of fact: `user` is a cache of
 *  Zitadel's data that this app may not edit and that can be minutes stale,
 *  `account` is ours and is authoritative. See packages/shared/user.ts. */
export type Session =
  | { status: 'authenticated'; user: SessionUser; account: Account }
  | { status: 'anonymous' }
  | { status: 'unreachable' }

/** What to call someone in the chrome.
 *
 *  Falls all the way back to the subject claim, which is ugly but never absent —
 *  a blank chip would be worse than an opaque one, because it reads as a bug
 *  rather than as a profile with nothing filled in. */
export function displayName(user: SessionUser): string {
  return user.name || user.preferredUsername || user.email || user.sub
}

/** Where a sign-in starts.
 *
 *  A link, not a fetch. The whole point of `/auth/login` is a top-level
 *  navigation to Zitadel, which an XHR would follow invisibly and to no effect.
 *  Making it an href also buys the ordinary things anchors do — middle-click,
 *  the status bar, focus order.
 *
 *  `returnTo` must be an absolute same-origin path; the server rejects anything
 *  else and falls back to `/`, so a bad value is safe rather than an open
 *  redirect. */
export function loginHref(returnTo: string): string {
  return `/auth/login?returnTo=${encodeURIComponent(returnTo)}`
}

/** Read the session. 401 is not an error here — it is the answer. */
export async function fetchSession(signal?: AbortSignal): Promise<Session> {
  let res: Response
  try {
    res = await fetch('/auth/me', {
      /* The default, stated because it is the load-bearing part: this is what
         attaches `cy.sid`, and it only works because the request is same-origin. */
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
      signal,
    })
  } catch {
    // Network failure, or the dev proxy with nothing behind it.
    return { status: 'unreachable' }
  }

  if (res.status === 401) return { status: 'anonymous' }
  if (!res.ok) return { status: 'unreachable' }

  const body = (await res.json().catch(() => null)) as MeResponse | null
  /* A 200 missing either half would mean the API changed shape under us.
     Treating it as "cannot tell" rather than as an identity keeps a malformed
     response from being rendered as a half-empty account page. */
  if (!body?.user?.sub || !body.account) return { status: 'unreachable' }

  return { status: 'authenticated', user: body.user, account: body.account }
}

/** End the session and get back the URL that ends Zitadel's.
 *
 *  Two halves, and the second is the one that is easy to skip: destroying our
 *  session logs you out of this app, but Zitadel's own SSO session lives on its
 *  domain, and while it stands the next `/auth/login` signs the same user
 *  straight back in without asking anything. The API returns the end-session URL
 *  as JSON rather than redirecting precisely so this call can `fetch` and the
 *  caller can then navigate — a 302 followed by XHR would end nothing. */
export async function requestLogout(): Promise<{ logoutUrl: string }> {
  const res = await fetch('/auth/logout', {
    /* POST, not GET, and not negotiable: a GET logout is fireable by any page
       that embeds <img src="…/auth/logout">. SameSite=Lax withholds the cookie
       from cross-site POSTs, which is what makes that attack fail. */
    method: 'POST',
    credentials: 'same-origin',
    headers: { accept: 'application/json' },
  })

  if (!res.ok) throw new Error(`Logout failed (HTTP ${res.status})`)

  const body: unknown = await res.json().catch(() => null)
  const logoutUrl = (body as { logoutUrl?: string } | null)?.logoutUrl
  if (!logoutUrl) throw new Error('Logout response carried no end-session URL')

  return { logoutUrl }
}
