import * as client from 'openid-client'
import type { FastifyBaseLogger, FastifyRequest } from 'fastify'
import type { SessionUser } from '@correlliayards/shared'

/* Where the identity in a session comes from, and how it is kept from going
 * stale.
 *
 * Two sources say who someone is, and the difference matters:
 *
 *   The id_token, which arrives with the tokens and costs nothing to read —
 *   but only carries profile claims if the Zitadel application is configured
 *   to put them there. That is a per-application toggle in its console (user
 *   info inside the id token), and with it off `claims()` gives you `sub` and
 *   little else. An app that reads only the id_token therefore works or does
 *   not work depending on a setting nobody here can see, and its failure mode
 *   is an account page where every field reads "not set".
 *
 *   The userinfo endpoint, which always has the full picture, costs a request,
 *   and needs an access token that has not expired.
 *
 * So: read the id_token, then overlay userinfo when it can be had. The overlay
 * is what makes the console toggle stop mattering; the fallback is what keeps a
 * login working when Zitadel's userinfo endpoint is briefly unhappy.
 */

/** How long a cached profile is trusted before the next `/auth/me` tries to
 *  refresh it.
 *
 *  The session lives seven days. Without a refresh, a name or avatar changed in
 *  Zitadel would not appear here until the next login — which for someone who
 *  stays signed in is a week of showing the wrong face. Five minutes is short
 *  enough that a profile edit feels like it took, and long enough that a page
 *  reload is not an outbound request. */
export const PROFILE_TTL_MS = 5 * 60 * 1000

/** The claims we keep, from whichever source produced them.
 *
 *  Keys whose claim is absent or the wrong type are left *off* the object
 *  rather than set to `undefined`, and that is load-bearing: this result gets
 *  spread over the id_token's version, and an explicit `undefined` would
 *  overwrite a good value with nothing. */
function pickClaims(source: Record<string, unknown>): Partial<SessionUser> {
  const picked: Partial<SessionUser> = {}

  const str = (key: keyof SessionUser & string, claim: string) => {
    const value = source[claim]
    if (typeof value === 'string' && value !== '') Object.assign(picked, { [key]: value })
  }

  str('name', 'name')
  str('email', 'email')
  str('preferredUsername', 'preferred_username')
  str('picture', 'picture')

  if (typeof source.email_verified === 'boolean') picked.emailVerified = source.email_verified

  return picked
}

/** Ask the userinfo endpoint. Returns nothing at all if it cannot be reached —
 *  a failure here must never be able to fail a login, because the id_token has
 *  already proved who this is and userinfo is only decorating that. */
async function fetchUserInfoClaims(
  oidc: client.Configuration,
  accessToken: string,
  sub: string,
  log: FastifyBaseLogger,
): Promise<Partial<SessionUser>> {
  try {
    /* The subject is checked against the one we already hold rather than
       skipped: a userinfo response describing a different user is not a
       curiosity to merge in, it is a token mix-up, and openid-client throws. */
    const info = await client.fetchUserInfo(oidc, accessToken, sub)
    return pickClaims(info as unknown as Record<string, unknown>)
  } catch (err) {
    log.warn({ err }, 'userinfo request failed; falling back to the id_token claims')
    return {}
  }
}

/** The identity to store on a session that has just been established. */
export async function buildProfile(
  oidc: client.Configuration,
  idTokenClaims: Record<string, unknown>,
  accessToken: string,
  sub: string,
  log: FastifyBaseLogger,
): Promise<SessionUser> {
  const fromIdToken = pickClaims(idTokenClaims)
  const fromUserInfo = await fetchUserInfoClaims(oidc, accessToken, sub, log)

  /* userinfo wins where it answered, because it is the source that is always
     complete. Where it said nothing, the id_token's value survives. */
  return { sub, ...fromIdToken, ...fromUserInfo }
}

/** Bring a session's cached profile up to date, if it is worth trying.
 *
 *  Every branch that declines to try is a case where the request would be
 *  wasted or actively wrong, so each one returns rather than pressing on. */
export async function refreshProfileIfStale(
  request: FastifyRequest,
  oidc: client.Configuration,
): Promise<void> {
  const { user, tokens, profileFetchedAt } = request.session
  if (!user || !tokens?.accessToken) return

  if (profileFetchedAt !== undefined && Date.now() - profileFetchedAt < PROFILE_TTL_MS) return

  /* An access token we already know has expired would earn a guaranteed 401.
     There is no refresh-token handling in this service yet — require-auth.ts
     says so explicitly — so the honest thing is to keep serving the cached
     profile rather than to spend a round trip proving we cannot refresh it.
     When refresh does land, this is the branch that grows the refresh call. */
  if (tokens.expiresAt !== undefined && tokens.expiresAt <= Date.now()) return

  const fresh = await fetchUserInfoClaims(oidc, tokens.accessToken, user.sub, request.log)

  /* Stamped even when the fetch came back empty, which is what turns a failing
     userinfo endpoint into one attempt every five minutes rather than one on
     every page load. */
  request.session.profileFetchedAt = Date.now()
  if (Object.keys(fresh).length > 0) request.session.user = { ...user, ...fresh }
}
