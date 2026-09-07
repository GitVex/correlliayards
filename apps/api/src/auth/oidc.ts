import * as client from 'openid-client'
import { config } from '../config.js'

/* Discovery reads the issuer's /.well-known/openid-configuration once at boot
   and returns a Configuration holding every endpoint plus our client
   credentials. Doing it once means no extra round trip to Zitadel per login,
   and an unreachable IdP or a typo in ZITADEL_ISSUER fails at startup rather
   than on a user's first login attempt. */
export async function discoverZitadel(): Promise<client.Configuration> {
  const insecure = config.issuer.protocol === 'http:'

  /* openid-client refuses plaintext http issuers by default, which is the
     correct default: an http token endpoint puts the client secret and the
     authorization code on the wire in the clear. A Zitadel running on
     localhost is the one legitimate exception, so it stays opt-in and can
     never be switched on in production. */
  if (insecure) {
    if (config.isProduction) {
      throw new Error('ZITADEL_ISSUER must use https in production')
    }
    console.warn(
      `[auth] ZITADEL_ISSUER is plaintext http (${config.issuer.origin}); ` +
        'allowing insecure requests. Development only.',
    )
  }

  return client.discovery(
    config.issuer,
    config.clientId,
    config.clientSecret,
    undefined,
    insecure ? { execute: [client.allowInsecureRequests] } : undefined,
  )
}
