import type { FastifyReply, FastifyRequest } from 'fastify'
import { preconditionFailed } from './errors.js'

/* Optimistic concurrency, as ETag and If-Match.
 *
 * The problem it solves is the one `docs/api-routes.md` sets out: two tabs open
 * on one card, or a laptop and a phone. Last-write-wins silently discards one
 * side, and the user finds out later, if at all.
 *
 * `updated_at` is already a version — it changes on every content write and on
 * nothing else, which is why publishing deliberately leaves it alone. So the
 * ETag is that timestamp, and no version column is needed.
 *
 * The header is required to be sent only if the client wants the check. A PUT
 * without If-Match still wins the race, which keeps a first save — where there
 * is nothing to have raced with — a single request. */

/** Build the entity tag for a row. Strong, and quoted as HTTP requires.
 *
 *  The timestamp is rendered to its ISO form first, so the tag a client
 *  receives is the same string it saw in the body's `updatedAt`, not a second
 *  encoding of it that happens to differ in a way nobody notices until a
 *  comparison fails. */
export function etagFor(updatedAt: Date): string {
  return `"${updatedAt.toISOString()}"`
}

/** Split the comma-separated list an If-Match or If-None-Match may carry, and
 *  drop the weak-comparison marker: a weak tag can never match under the strong
 *  comparison If-Match requires, so `W/"x"` is simply not `"x"`. */
function parseTagList(header: string): string[] {
  return header
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
}

/** Enforce `If-Match` for a write.
 *
 *  `current` is the row's tag, or undefined when there is no such row yet.
 *
 *  - No header: no check. The write proceeds.
 *  - `*`: the row must exist. This is how a client says "replace, do not
 *    create" without knowing the current version.
 *  - Otherwise: one of the listed tags must be the current one.
 *
 *  A failure is 412 and not 409, because the client's request was well formed
 *  and its precondition was simply no longer true — which is the difference the
 *  SPA needs in order to know that re-reading and retrying is the fix. */
export function assertIfMatch(request: FastifyRequest, current: string | undefined): void {
  const header = request.headers['if-match']
  if (header === undefined) return

  const tags = parseTagList(Array.isArray(header) ? header.join(',') : header)
  if (tags.length === 0) return

  if (tags.includes('*')) {
    if (current === undefined) {
      throw preconditionFailed('If-Match: * requires the resource to already exist.')
    }
    return
  }

  if (current === undefined || !tags.includes(current)) {
    throw preconditionFailed(
      'The resource has changed since you last read it. Re-read it and reapply your change.',
    )
  }
}

/** Answer a conditional GET.
 *
 *  Returns true when the caller's copy is still current and a 304 has been
 *  sent — the handler should then return without a body. Pairs with the ETag
 *  the write side already has to produce, so it costs nothing extra: the editor
 *  polling a card it already holds transfers headers instead of a document. */
export function notModified(
  request: FastifyRequest,
  reply: FastifyReply,
  etag: string,
): boolean {
  const header = request.headers['if-none-match']
  if (header === undefined) return false

  const tags = parseTagList(Array.isArray(header) ? header.join(',') : header)
  if (!tags.includes('*') && !tags.includes(etag)) return false

  reply.code(304).send()
  return true
}
