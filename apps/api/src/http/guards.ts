import type { FastifyRequest } from 'fastify'
import { z } from 'zod'
import type { SessionUser } from '@correlliayards/shared'
import { badRequest, unauthenticated } from './errors.js'

/* The two things every authenticated /api route does before it does anything
   else: establish who is asking, and establish which id they are asking about.
   Both are one-liners at the call site because both are wrong in the same way
   when they are written out by hand each time. */

/** The gate on every route under /api that is not public.
 *
 *  A separate function from `requireAuth` in ../auth/require-auth.ts, which
 *  guards /auth/me and answers in the OAuth error shape. Same question, two
 *  vocabularies — see the note at the top of packages/shared/errors.ts.
 *
 *  Deliberately not in scope here, exactly as there: whether the stored access
 *  token has expired. These routes talk to our own database, not to a resource
 *  server, so the identity is what matters and token freshness is a separate
 *  concern with its own refresh handling. */
export async function requireApiAuth(request: FastifyRequest): Promise<void> {
  if (!request.session.user) {
    throw unauthenticated('No active session. Start a login at /auth/login.')
  }
}

/** The authenticated identity, for a handler that runs behind `requireApiAuth`.
 *
 *  It throws rather than returning null so the handler can use it inline. The
 *  alternative is `request.session.user!.sub` at forty call sites, which is a
 *  non-null assertion standing exactly where the ownership check that makes the
 *  whole API safe begins. */
export function currentUser(request: FastifyRequest): SessionUser {
  const user = request.session.user
  if (!user) {
    throw unauthenticated('No active session. Start a login at /auth/login.')
  }
  return user
}

/** Shorthand for the only part of the identity the tables know about. */
export const ownerSub = (request: FastifyRequest): string => currentUser(request).sub

const idParamsSchema = z.object({ id: z.uuid() })

/** The `:id` out of the path, checked to be a uuid before it reaches a query.
 *
 *  This is not only tidiness: `id = $1` against a uuid column with a
 *  non-uuid string is a Postgres type error, which would surface as a 500 for
 *  what is plainly a bad request. */
export function idParam(request: FastifyRequest): string {
  const result = idParamsSchema.safeParse(request.params)
  if (!result.success) {
    throw badRequest('The id in the path must be a uuid.')
  }
  return result.data.id
}
