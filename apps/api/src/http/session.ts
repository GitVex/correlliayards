import fastifyCookie from '@fastify/cookie'
import fastifySession from '@fastify/session'
import type { FastifyInstance } from 'fastify'
import type { SessionUser } from '@correlliayards/shared'
import { config } from '../config.js'

/** State for a login that is in flight: created by /auth/login, consumed and
    cleared by /auth/callback. It lives in the server-side session store, so the
    code verifier never reaches the browser at all. */
export interface OidcTransaction {
  state: string
  nonce: string
  codeVerifier: string
  returnTo: string
}

/** Tokens held server-side on the user's behalf. The browser never sees these;
    that is the entire point of the BFF. idToken is retained because logout must
    present it to Zitadel as id_token_hint. */
export interface StoredTokens {
  accessToken: string
  refreshToken?: string
  idToken?: string
  /** Epoch milliseconds. Used to decide when to refresh. */
  expiresAt?: number
}

declare module 'fastify' {
  interface Session {
    oidcTx?: OidcTransaction
    /** The authenticated identity, distilled from the OIDC claims. Declared in
     *  packages/shared because it is also the shape `/auth/me` returns, and the
     *  SPA has to name it to render it. Never the raw tokens — those are below,
     *  and they do not leave this process. */
    user?: SessionUser
    /** Epoch milliseconds, when `user` was last filled from the identity
     *  provider. The session outlives any single answer from Zitadel by days,
     *  so the profile needs its own, much shorter, freshness clock — see
     *  PROFILE_TTL_MS in routes/auth/profile.ts. */
    profileFetchedAt?: number
    tokens?: StoredTokens
  }
}

export async function registerSession(server: FastifyInstance): Promise<void> {
  await server.register(fastifyCookie)
  await server.register(fastifySession, {
    secret: config.sessionSecret,
    cookieName: 'cy.sid',
    /* Without this, every anonymous request to any route would allocate a
       session and set a cookie. We only want one once a login actually starts. */
    saveUninitialized: false,
    cookie: {
      /* Unreadable from JavaScript, so an XSS bug cannot lift the session id. */
      httpOnly: true,
      /* 'lax', not 'strict', and this is load-bearing: the return trip from
         Zitadel to /auth/callback is a cross-site top-level navigation. Under
         'strict' the browser withholds the cookie on exactly that request, the
         session looks empty, and the callback fails with a state mismatch that
         looks nothing like a cookie problem. 'lax' still blocks cross-site
         POSTs, which is the CSRF case that matters. */
      sameSite: 'lax',
      /* Https-only in production; off locally so plain http dev still works. */
      secure: config.isProduction,
      path: '/',
      /* Milliseconds here. Note the library's request.session.options() takes
         seconds instead — mixing the two silently gives you a cookie that
         expires 1000x too early or too late. */
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
}
