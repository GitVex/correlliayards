/* Everything the server needs from the environment, read once at boot and
   validated before anything else starts. The point is that a missing or
   malformed value fails here, by name, instead of surfacing later as an opaque
   OIDC error halfway through a login redirect. */

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function requiredUrl(name: string): URL {
  const raw = required(name)
  try {
    return new URL(raw)
  } catch {
    throw new Error(`Environment variable ${name} must be an absolute URL, got: ${raw}`)
  }
}

function optionalUrl(name: string, fallback: URL): URL {
  const raw = process.env[name]
  if (!raw) return fallback
  try {
    return new URL(raw)
  } catch {
    throw new Error(`Environment variable ${name} must be an absolute URL, got: ${raw}`)
  }
}

function optionalInt(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const value = Number(raw)
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Environment variable ${name} must be a positive integer, got: ${raw}`)
  }
  return value
}

function optionalFlag(name: string, fallback: boolean): boolean {
  const raw = process.env[name]
  if (raw === undefined || raw === '') return fallback
  if (raw === 'true') return true
  if (raw === 'false') return false
  throw new Error(`Environment variable ${name} must be "true" or "false", got: ${raw}`)
}

const sessionSecret = required('SESSION_SECRET')
if (sessionSecret.length < 32) {
  throw new Error(
    `SESSION_SECRET must be at least 32 characters, got ${sessionSecret.length}`,
  )
}

const appBaseUrl = requiredUrl('APP_BASE_URL')
const isProduction = process.env.NODE_ENV === 'production'

/* One connection string rather than five variables, because that is the form
   every managed Postgres hands you — including the Coolify resource this points
   at — and splitting it apart just to reassemble it is a chance to get the
   password escaping wrong. */
const databaseUrl = required('DATABASE_URL')

/* How to talk TLS to Postgres. Three values rather than a boolean because
   "encrypted but do not check who I am talking to" is a genuinely different
   posture from "encrypted and verified", and conflating them is how a
   connection ends up trusting any certificate at all without anyone deciding
   that it should.

     require    encrypt and verify the server certificate.
     no-verify  encrypt, accept any certificate. For a Postgres presenting a
                self-signed cert whose CA you have not got to hand.
     disable    no TLS. Correct on a private container network — Coolify's
                internal one, where the database is not reachable from outside
                the host at all — and wrong on anything routed over the
                internet. */
const DATABASE_SSL_MODES = ['disable', 'require', 'no-verify'] as const
type DatabaseSslMode = (typeof DATABASE_SSL_MODES)[number]

/* node-postgres merges the parsed connection string *over* the options object
   (see Object.assign in pg/lib/connection-parameters.js), and pg-connection-string
   emits an `ssl` key only when the url carries `sslmode`. So a url with no
   sslmode leaves DATABASE_SSL in charge — the normal case — while a url that has
   one silently wins, and DATABASE_SSL becomes a setting that reads as if it
   works and does nothing.

   Rather than document that, refuse it. One setting decides TLS, and it is the
   one named after what it does. This also sidesteps pg's own deprecation of
   `sslmode=require`, whose meaning is changing in the next major. */
function assertNoSslInUrl(raw: string): void {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    /* Not a url — a libpq key/value dsn, or simply wrong. Either way the
       connection attempt is where that gets reported, with a better message
       than anything guessable here. */
    return
  }

  for (const key of ['sslmode', 'ssl']) {
    if (parsed.searchParams.has(key)) {
      throw new Error(
        `DATABASE_URL must not carry "${key}"; it would silently override DATABASE_SSL. ` +
          `Remove it from the url and set DATABASE_SSL to one of ${DATABASE_SSL_MODES.join(', ')}.`,
      )
    }
  }
}

assertNoSslInUrl(databaseUrl)

function databaseSslMode(): DatabaseSslMode {
  /* Defaults to the safe end in production and the convenient end locally,
     because getting it wrong in production is a plaintext password on a wire
     and getting it wrong locally is a connection that will not open. A failed
     connection is a loud, fixable mistake; the other one is silent. */
  const fallback: DatabaseSslMode = isProduction ? 'require' : 'disable'
  const raw = process.env.DATABASE_SSL
  if (!raw) return fallback
  if ((DATABASE_SSL_MODES as readonly string[]).includes(raw)) return raw as DatabaseSslMode
  throw new Error(
    `Environment variable DATABASE_SSL must be one of ${DATABASE_SSL_MODES.join(', ')}, got: ${raw}`,
  )
}

export const config = {
  issuer: requiredUrl('ZITADEL_ISSUER'),
  clientId: required('ZITADEL_CLIENT_ID'),
  clientSecret: required('ZITADEL_CLIENT_SECRET'),
  appBaseUrl,
  redirectUri: new URL('/auth/callback', appBaseUrl).href,
  /* Where Zitadel sends the browser after it has ended the SSO session. Like
     redirectUri this must be registered on the Zitadel application — under Post
     Logout URIs, a separate list from the redirect URIs — or Zitadel drops the
     parameter and strands the user on its own page. */
  postLogoutRedirectUri: new URL('/', appBaseUrl).href,
  sessionSecret,
  port: Number(process.env.PORT ?? 8080),
  isProduction,

  database: {
    url: databaseUrl,
    ssl: databaseSslMode(),
    /* A PEM chain, when the server's certificate is signed by a CA node does
       not already trust. Lets `require` stay verified instead of dropping to
       `no-verify` just because the CA is private. */
    caCert: process.env.DATABASE_CA_CERT,
    /* Postgres counts connections, not requests, and the ceiling is the
       server's max_connections shared out between every instance of this
       service. Small on purpose. */
    poolMax: optionalInt('DATABASE_POOL_MAX', 10),
    /* Whether to apply the generated migrations in apps/api/drizzle at boot. On
       by default, because it makes a fresh environment work with no second
       step and Drizzle's migrator is safe to run concurrently — it records what
       has run and takes a lock, so a rolling deploy does not race itself.
       Turned off by a deployment that would rather migrate as its own
       deliberate act, in which case `npm run db:migrate` is that act. */
    migrateOnBoot: optionalFlag('DATABASE_MIGRATE', true),
  },

  /* Where published links point. Separate from appBaseUrl because a published
     URL is a page a human opens, and the SPA may well be served from a
     different origin than this API — the link that gets pasted into Discord has
     to be the one that works from outside. Defaults to appBaseUrl for the
     single-origin deployment, which is the common case. */
  publicBaseUrl: optionalUrl('PUBLIC_BASE_URL', appBaseUrl),
} as const
