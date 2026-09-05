import * as client from 'openid-client'
import type { FastifyInstance } from 'fastify'
import { config } from '../config.js'
import { requireAuth } from '../auth/require-auth.js'

/* Only same-origin, absolute-path destinations may be returned to after login.
   Without this check, /auth/login?returnTo=https://evil.example turns the
   server into an open redirect that borrows Zitadel's credibility for a
   phishing hop. A leading '//' is rejected because '//evil.example' is a
   protocol-relative URL, not a local path. */
function safeReturnTo(raw: unknown): string {
  if (typeof raw !== 'string') return '/'
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/'
  return raw
}

export async function registerAuthRoutes(
  server: FastifyInstance,
  oidc: client.Configuration,
): Promise<void> {
  /* Step one of the authorization code flow. Mints the one-time values that
     bind this login to this browser, parks them server-side, and hands the
     user off to Zitadel. Nothing here is secret to the user — the security
     comes from the verifier staying on the server. */
  server.get('/auth/login', async (request, reply) => {
    /* PKCE. We send only the SHA-256 hash of the verifier now, and the verifier
       itself at token exchange. An attacker who intercepts the authorization
       code cannot redeem it without the verifier they never saw. */
    const codeVerifier = client.randomPKCECodeVerifier()
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier)

    /* state ties the callback to this session and is the CSRF defence for the
       flow: a callback arriving with a state we did not issue is rejected. */
    const state = client.randomState()

    /* nonce is carried inside the id_token and checked on the way back, which
       is what stops a token minted for a different login being replayed here. */
    const nonce = client.randomNonce()

    request.session.oidcTx = {
      state,
      nonce,
      codeVerifier,
      returnTo: safeReturnTo((request.query as Record<string, unknown>)?.returnTo),
    }

    const authorizationUrl = client.buildAuthorizationUrl(oidc, {
      redirect_uri: config.redirectUri,
      /* openid is what makes this OIDC rather than bare OAuth2 and produces the
         id_token. profile/email populate the claims. offline_access is what
         makes Zitadel issue a refresh token — without it the session dies when
         the access token expires and the user is bounced back to login. */
      scope: 'openid profile email offline_access',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
      nonce,
    })

    return reply.redirect(authorizationUrl.href, 302)
  })

  /* Step two: Zitadel sends the user back here with an authorization code. This
     route is the security boundary of the whole flow — everything it does
     before trusting the code is a check that the code belongs to this browser's
     login and no one else's. */
  server.get('/auth/callback', async (request, reply) => {
    const query = request.query as Record<string, string | undefined>

    /* Zitadel signals a refused or failed login with ?error=, not by omitting
       the code. Handling it explicitly turns "user clicked Deny" into a clear
       message instead of an opaque exchange failure further down. */
    if (query.error) {
      request.log.warn(
        { error: query.error, description: query.error_description },
        'authorization request rejected by the identity provider',
      )
      delete request.session.oidcTx
      return reply.code(400).send({
        error: query.error,
        error_description: query.error_description,
      })
    }

    /* No transaction means this browser never started a login here: a bookmarked
       callback URL, a replayed request, or a session that expired mid-flow.
       There is nothing to validate the code against, so it cannot be trusted. */
    const tx = request.session.oidcTx
    if (!tx) {
      return reply.code(400).send({
        error: 'no_login_in_progress',
        error_description:
          'No pending login for this session. Start again at /auth/login.',
      })
    }

    /* Rebuild the URL openid-client should inspect from our own configured base
       rather than from the Host header, which is attacker-influenced and, behind
       a reverse proxy, usually wrong anyway. */
    const currentUrl = new URL(request.url, config.appBaseUrl)

    let tokens
    try {
      /* This single call does the work that makes the flow safe: it checks the
         returned state equals the one we issued, exchanges the code at the token
         endpoint with our client secret and the PKCE verifier, validates the
         id_token signature against Zitadel's JWKS, and checks the nonce inside
         it matches. Any mismatch throws instead of returning tokens. */
      tokens = await client.authorizationCodeGrant(oidc, currentUrl, {
        pkceCodeVerifier: tx.codeVerifier,
        expectedState: tx.state,
        expectedNonce: tx.nonce,
      })
    } catch (err) {
      request.log.warn({ err }, 'authorization code exchange failed')
      /* The transaction is single-use whether it succeeded or not. Leaving it
         behind would let a failed attempt be retried against the same state. */
      delete request.session.oidcTx
      return reply.code(401).send({
        error: 'login_failed',
        error_description: 'The authorization code could not be exchanged.',
      })
    }

    const claims = tokens.claims()
    if (!claims?.sub) {
      request.log.error('token response carried no id_token subject')
      delete request.session.oidcTx
      return reply.code(502).send({ error: 'invalid_id_token' })
    }

    const expiresIn = tokens.expiresIn()
    const returnTo = tx.returnTo

    /* Session fixation defence. The user is changing privilege level from
       anonymous to authenticated, so the session identifier they arrived with
       must not be the one they leave with — otherwise an attacker who planted a
       known session id in the victim's browser beforehand would now hold a
       cookie for an authenticated session. regenerate() issues a fresh id and
       drops all prior data, which also disposes of oidcTx for us. */
    await request.session.regenerate()

    request.session.user = {
      sub: claims.sub,
      name: typeof claims.name === 'string' ? claims.name : undefined,
      email: typeof claims.email === 'string' ? claims.email : undefined,
      emailVerified:
        typeof claims.email_verified === 'boolean' ? claims.email_verified : undefined,
      preferredUsername:
        typeof claims.preferred_username === 'string'
          ? claims.preferred_username
          : undefined,
    }

    request.session.tokens = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      idToken: tokens.id_token,
      expiresAt: expiresIn === undefined ? undefined : Date.now() + expiresIn * 1000,
    }

    request.log.info(
      { sub: claims.sub, hasRefreshToken: Boolean(tokens.refresh_token) },
      'login complete',
    )

    return reply.redirect(returnTo, 302)
  })

  /* Who am I? The frontend's single source of truth for session state, and the
     only place the identity crosses back to the browser.

     What it returns is as important as what it does not: session.user, never
     session.tokens. The access and refresh tokens stay on this side of the
     wire — a BFF that leaks them to the page has thrown away the reason it
     exists. */
  server.get('/auth/me', { preHandler: requireAuth }, async (request, reply) => {
    /* This response differs per session, so it must never be stored by a
       browser cache or any proxy in between. */
    reply.header('cache-control', 'no-store')
    return { user: request.session.user }
  })

  /* Logging out has two halves, and forgetting the second one is why you were
     never asked for credentials earlier: destroying our session ends the
     application session, but Zitadel's own SSO session lives on its domain and
     is untouched by anything we do here. Skip the second half and /auth/login
     silently signs the same user straight back in.

     POST, not GET, because a GET logout can be fired by any third-party page
     embedding <img src="…/auth/logout">. With SameSite=lax the session cookie
     is withheld from cross-site POSTs, so requiring POST is what actually makes
     that forced-logout attack fail. */
  server.post('/auth/logout', async (request, reply) => {
    /* Read before destroying — the id_token is our proof to Zitadel of which
       session to end, and it is gone the moment the session is. */
    const idToken = request.session.tokens?.idToken
    const wasAuthenticated = Boolean(request.session.user)

    await request.session.destroy()

    const endSessionUrl = client.buildEndSessionUrl(oidc, {
      /* Without id_token_hint Zitadel cannot tell which session is being ended
         and will typically stop to ask the user to confirm. */
      ...(idToken ? { id_token_hint: idToken } : {}),
      post_logout_redirect_uri: config.postLogoutRedirectUri,
    })

    reply.header('cache-control', 'no-store')

    /* Returned as JSON rather than sent as a 302 on purpose. RP-initiated
       logout has to be a top-level browser navigation for Zitadel to see its
       own cookies, but this endpoint is called with fetch(), which would follow
       a redirect invisibly in the background and end nothing. The caller
       navigates to logoutUrl itself. */
    return { wasAuthenticated, logoutUrl: endSessionUrl.href }
  })
}
