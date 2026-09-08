import type { FastifyInstance } from 'fastify'
import { registerErrorEnvelope } from '../../api/errors.js'
import { registerCardRoutes } from './cards.js'
import { registerCollectionRoutes } from './collections.js'
import { registerPublicRoutes } from './public.js'

/* Everything under /api, mounted as one plugin.
 *
 * The prefix is not decoration. The SPA is going multi-page, and a page at
 * /cards and an API route at /cards are the same url — much cheaper to keep
 * apart now than to untangle once links exist. /auth/* and /health stay where
 * they are; they were already distinct.
 *
 * Registering as a plugin rather than adding routes to the root instance is
 * what gives this scope its own error handler: Fastify encapsulates those per
 * plugin, so /api answers in the envelope from packages/shared/errors.ts while
 * /auth keeps the OAuth error shape its clients expect. */
export async function registerApiRoutes(server: FastifyInstance): Promise<void> {
  await server.register(
    async (api) => {
      registerErrorEnvelope(api)

      await registerCardRoutes(api)
      await registerCollectionRoutes(api)

      /* Nested one level deeper so it gets its own scope, and therefore its own
         rate limit hook, without those applying to the authenticated routes
         above — where the session cookie is already the thing limiting who can
         make the request at all. */
      await api.register(registerPublicRoutes, { prefix: '/public' })
    },
    { prefix: '/api' },
  )
}
