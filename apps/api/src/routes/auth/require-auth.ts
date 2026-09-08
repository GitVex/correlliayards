import type { FastifyReply, FastifyRequest } from 'fastify'

/* The gate every protected route shares. It asks one question — is there an
   authenticated identity on this session — and answers 401 if not.

   Deliberately not in scope here: whether the stored access token has expired.
   That matters only for routes that actually call Zitadel or another resource
   server with it, and it needs refresh-token handling to be useful. Identity
   and token freshness are separate concerns, so they get separate code. */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply | undefined> {
  if (!request.session.user) {
    /* Never let an intermediary cache an authorization outcome. */
    reply.header('cache-control', 'no-store')
    return reply.code(401).send({
      error: 'unauthenticated',
      error_description: 'No active session. Start a login at /auth/login.',
    })
  }
  return undefined
}
