# fastify-zitadel-bff

A Fastify backend-for-frontend that owns an OpenID Connect authorization-code
flow against a self-hosted [Zitadel](https://zitadel.com) instance.

The browser never receives a token. This server runs the login flow, keeps the
access, refresh and ID tokens in a server-side session, and hands the browser
only an httpOnly session cookie. An XSS bug in the frontend therefore cannot
exfiltrate credentials, and there is no silent-renew iframe machinery to
maintain.

The corollary is that **the frontend needs no auth library at all** — no
`oidc-client-ts`, no `@zitadel/react`. Login is a plain link, and session state
is one `fetch`.

## Routes

| Route | Purpose |
| --- | --- |
| `GET /auth/login` | Mints PKCE verifier, state and nonce; redirects to Zitadel |
| `GET /auth/callback` | Validates and exchanges the code, establishes the session |
| `GET /auth/me` | Returns the session identity (401 when anonymous) |
| `POST /auth/logout` | Destroys the session, returns Zitadel's `end_session` URL |
| `GET /health` | Liveness probe |
| `GET /` | Dev-only console for driving the flow by hand |

## Setup

### 1. Zitadel application

Create a **Web** application with authentication method **Code** — a
confidential client with a secret.

- **Redirect URI:** `http://localhost:8080/auth/callback`
- **Post Logout URI:** `http://localhost:8080/` — a *separate list* from the
  redirect URIs. Omit it and logout strands the user on Zitadel's own page.
- **Enable Dev Mode.** Zitadel rejects plaintext `http://` redirect URIs
  without it. This is the most common reason local setup stalls.
- **Grant types:** Authorization Code *and* Refresh Token. Refresh must be
  ticked explicitly, or sessions die at access-token expiry with no way to renew.
- **Token settings:** JWT rather than opaque, so tokens can be validated
  locally against JWKS instead of a network introspection call per request.

To get roles in claims, enable *Assert Roles on Authentication* on the project
and *User roles inside ID token* on the app. Roles silently missing from tokens
is the second most common stall.

### 2. Configure and run

```bash
cp .env.example .env.local   # then fill it in
npm install
npm run build
npm start
```

Open `http://localhost:8080/` and use the dev console to drive the flow.

## Design notes

Things that are load-bearing and easy to break:

- **`sameSite: 'lax'`, never `'strict'`.** The return trip from Zitadel to
  `/auth/callback` is a cross-site top-level navigation. Under `strict` the
  browser withholds the session cookie on exactly that request, the session
  reads empty, and you get a state-mismatch error that looks nothing like a
  cookie problem. `lax` still blocks cross-site POSTs.

- **`session.regenerate()` after login.** The user changes privilege level from
  anonymous to authenticated, so the session id must change too. Otherwise an
  attacker who planted a known session id in the victim's browser beforehand
  ends up holding a cookie for an authenticated session.

- **The OIDC transaction is single-use.** It is deleted on every exit path,
  success or failure, so a failed attempt cannot be retried against the same
  `state`.

- **Logout is POST and returns JSON.** POST because a GET logout can be fired
  by any third-party page embedding an `<img>`. JSON because RP-initiated
  logout must be a *top-level navigation* for Zitadel to see its own cookies —
  a 302 followed by `fetch()` in the background ends nothing. The caller
  navigates to `logoutUrl` itself.

- **Destroying the local session does not end the Zitadel SSO session.** Skip
  the `end_session` navigation and the next `/auth/login` silently signs the
  same user back in.

- **`/auth/me` returns `session.user`, never `session.tokens`.** A BFF that
  leaks tokens to the page has discarded the reason it exists.

- **Keep the SPA and this API same-origin** — Vite `server.proxy` in dev, a
  reverse-proxy rule in prod. Cross-origin makes the session cookie
  third-party, and browsers are actively killing those.

- **The dev console exists because of a CSP quirk.** Firefox renders JSON
  responses in a viewer document with `default-src 'none'`, so console
  `fetch()` from a JSON page is blocked outright. A real HTML page is not
  restricted. It is mounted only when `NODE_ENV !== 'production'`.

## Not included

Deliberate gaps, in rough priority order:

1. **Token refresh.** The access token expires (typically ~1h) and nothing
   renews it, though a refresh token is stored. Add a refresh step to
   `requireAuth` that renews near `expiresAt` and destroys the session when the
   refresh token is rejected.
2. **Persistent sessions.** `@fastify/session` defaults to an in-memory store,
   so every restart is a forced logout and a second instance shares nothing.
   Swap in Redis or Postgres.
3. **CSRF tokens.** `sameSite: 'lax'` covers the common cases; add
   `@fastify/csrf-protection` for defence in depth on state-changing routes.
4. **Rate limiting** on the auth endpoints.
