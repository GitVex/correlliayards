import type { FastifyReply, FastifyRequest } from 'fastify'
import { preconditionFailed } from './errors.js'

/* ETag, If-Match and If-None-Match.
 *
 * One tag does two jobs here, and they are not the same job:
 *
 *   - the *concurrency token* a write checks, which must move only when the
 *     content moves, so that two tabs editing one card cannot silently discard
 *     each other;
 *   - the *cache validator* a read checks, which must move whenever anything in
 *     the response body moves, or a client revalidates, gets 304, and keeps a
 *     stale copy.
 *
 * `updated_at` alone can only be the first. Publishing deliberately leaves it
 * where it is — otherwise publishing from one tab would 412 the next keystroke
 * in another — but `published` and `publishedAt` are in the body, so a publish
 * changes the representation without changing the validator. The same happens
 * to a collection when a card it holds is deleted or renamed elsewhere.
 *
 * So the tag is composite: `"<updatedAt>~<the rest>"`. Reads compare the whole
 * thing; If-Match compares only the leading component. That keeps both
 * properties at once, and it is why the concurrency part is first and separated
 * by a character that cannot occur in an ISO timestamp. */

const SEPARATOR = '~'

/** How each extra component is rendered. Null and undefined collapse to a
 *  placeholder rather than an empty string, so "absent" and "empty" cannot
 *  produce the same tag. */
function component(value: Date | string | number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  return value instanceof Date ? value.toISOString() : String(value)
}

/** Build the entity tag for a row. Strong, and quoted as HTTP requires.
 *
 *  `updatedAt` is the concurrency token and always comes first. `variant` is
 *  everything else the response body exposes that `updatedAt` does not already
 *  cover — a card passes its publish state, a collection its membership
 *  fingerprint.
 *
 *  The timestamp is rendered to its ISO form, so the leading component is the
 *  same string the client saw in the body's `updatedAt` rather than a second
 *  encoding that differs in some way nobody notices until a comparison fails. */
export function etagFor(
  updatedAt: Date,
  ...variant: (Date | string | number | null | undefined)[]
): string {
  const parts = [updatedAt.toISOString(), ...variant.map(component)]
  return `"${parts.join(SEPARATOR)}"`
}

/** The concurrency token out of a tag: everything before the first separator.
 *
 *  This is what makes a publish invisible to If-Match. A client that read a card
 *  before it was published holds `"<t>~-"`, the row now answers `"<t>~<when>"`,
 *  and the write still succeeds because the content half is unchanged — which is
 *  exactly the intent. */
function concurrencyPart(tag: string): string {
  const unquoted = tag.replace(/^W\//, '').replace(/^"|"$/g, '')
  const separator = unquoted.indexOf(SEPARATOR)
  return separator === -1 ? unquoted : unquoted.slice(0, separator)
}

/** Split the comma-separated list an If-Match or If-None-Match may carry. */
function parseTagList(header: string | string[]): string[] {
  return (Array.isArray(header) ? header.join(',') : header)
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
 *  - Otherwise: one of the listed tags must share the current tag's concurrency
 *    component. A weak tag is accepted here, since the comparison is on that
 *    component rather than on byte equality of the whole entity.
 *
 *  A failure is 412 and not 409, because the client's request was well formed
 *  and its precondition was simply no longer true — which is the difference the
 *  SPA needs in order to know that re-reading and retrying is the fix. */
export function assertIfMatch(request: FastifyRequest, current: string | undefined): void {
  const header = request.headers['if-match']
  if (header === undefined) return

  const tags = parseTagList(header)
  if (tags.length === 0) return

  if (tags.includes('*')) {
    if (current === undefined) {
      throw preconditionFailed('If-Match: * requires the resource to already exist.')
    }
    return
  }

  const expected = current === undefined ? undefined : concurrencyPart(current)
  if (expected === undefined || !tags.some((tag) => concurrencyPart(tag) === expected)) {
    throw preconditionFailed(
      'The resource has changed since you last read it. Re-read it and reapply your change.',
    )
  }
}

/** Answer a conditional GET.
 *
 *  Returns true when the caller's copy is still current and a 304 has been
 *  sent — the handler should then return without a body.
 *
 *  Compares the whole tag, unlike If-Match: a cached copy is only still good if
 *  nothing in the body has changed, publish state and membership included. */
export function notModified(
  request: FastifyRequest,
  reply: FastifyReply,
  etag: string,
): boolean {
  const header = request.headers['if-none-match']
  if (header === undefined) return false

  const tags = parseTagList(header)
  if (!tags.includes('*') && !tags.includes(etag)) return false

  reply.code(304).send()
  return true
}
