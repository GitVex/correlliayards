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

const sessionSecret = required('SESSION_SECRET')
if (sessionSecret.length < 32) {
  throw new Error(
    `SESSION_SECRET must be at least 32 characters, got ${sessionSecret.length}`,
  )
}

const appBaseUrl = requiredUrl('APP_BASE_URL')

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
  isProduction: process.env.NODE_ENV === 'production',
} as const
