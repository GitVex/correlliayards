// ---------------------------------------------------------------------------
// The one place a request to /api is made.
//
// Its whole job is to turn the two ways a call can fail — the network did not
// carry it, and the server refused it — into one thrown type carrying the code
// from packages/shared/errors.ts. That code is a closed enum precisely so the
// SPA can branch on it, which it cannot do from a `catch (e)` holding whatever
// `fetch` felt like rejecting with.
//
// Same-origin throughout, for the reason in auth/session.ts: `cy.sid` is
// HttpOnly and SameSite=Lax, so a cross-origin request would simply not carry
// the session.
// ---------------------------------------------------------------------------

import type { ApiErrorCode, ApiErrorDetail } from '@correlliayards/shared'

/** A failed call, with the server's code where there was one.
 *
 *  `network` is this file's own addition to the enum: the request never
 *  arrived, so the server has no opinion about it. It is kept distinct from
 *  `internal` because they call for opposite advice — one is "try again", the
 *  other is "this will keep happening". */
export class ApiRequestError extends Error {
  readonly status: number
  readonly code: ApiErrorCode | 'network' | 'unknown'
  readonly details: ApiErrorDetail[]

  constructor(
    status: number,
    code: ApiErrorCode | 'network' | 'unknown',
    message: string,
    details: ApiErrorDetail[] = [],
  ) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.code = code
    this.details = details
  }
}

/** Narrow a response body to the shared error envelope.
 *
 *  Hand-written rather than `isApiError` from the shared package, which is a
 *  Zod parse. Reaching for it here would pull the validator into the bundle to
 *  check a shape this app does not own and cannot fix — and the fallback for an
 *  unrecognised body is the same either way. */
function readEnvelope(body: unknown): { code: ApiErrorCode; message: string; details: ApiErrorDetail[] } | null {
  if (typeof body !== 'object' || body === null) return null
  const error = (body as { error?: unknown }).error
  if (typeof error !== 'object' || error === null) return null

  const { code, message, details } = error as { code?: unknown; message?: unknown; details?: unknown }
  if (typeof code !== 'string' || typeof message !== 'string') return null

  return {
    code: code as ApiErrorCode,
    message,
    details: Array.isArray(details) ? (details as ApiErrorDetail[]) : [],
  }
}

async function errorFor(res: Response): Promise<ApiRequestError> {
  const body: unknown = await res.json().catch(() => null)
  const envelope = readEnvelope(body)

  if (envelope) return new ApiRequestError(res.status, envelope.code, envelope.message, envelope.details)

  /* A failure that did not come from the /api error handler at all — a proxy's
     own 502 page, most likely. Say so rather than inventing a code. */
  return new ApiRequestError(res.status, 'unknown', `The server answered ${res.status}.`)
}

/** Make the call, or throw an ApiRequestError. Returns the Response rather than
 *  a parsed body, because a caller sometimes wants the headers — the ETag a
 *  save has to hold on to for its next If-Match, above all. */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  let res: Response
  try {
    res = await fetch(path, {
      credentials: 'same-origin',
      ...init,
      headers: { accept: 'application/json', ...init.headers },
    })
  } catch (cause) {
    /* An abort is the caller changing its mind, not a failure, and it must not
       be reported to anyone as one. Rethrown so the caller's own check sees it. */
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause
    throw new ApiRequestError(0, 'network', 'Could not reach the server.')
  }

  if (!res.ok) throw await errorFor(res)
  return res
}

/** UI wording for a failure. Deliberately here and not on the server: the
 *  envelope's `message` is written for a developer reading a network tab, which
 *  is why `code` is an enum and the message is free text.
 *
 *  Each sentence stands alone, so a caller can put its own context in front —
 *  "Could not save. " + this — rather than this file having to know every
 *  action that might fail. */
export function describeError(err: unknown): string {
  if (!(err instanceof ApiRequestError)) return 'Something unexpected went wrong.'

  switch (err.code) {
    case 'network':
      return 'The server could not be reached.'
    case 'unauthenticated':
      return 'Your session has ended — sign in again.'
    case 'precondition_failed':
      return 'It changed somewhere else since you last read it. Reload before writing again.'
    case 'not_found':
      return 'It no longer exists.'
    case 'conflict':
      return 'That id already belongs to someone else.'
    case 'payload_too_large':
      return 'It is too large to store.'
    case 'rate_limited':
      return 'Too many requests just now — try again in a moment.'
    case 'bad_request':
      return err.details.length > 0
        ? `It is not valid: ${err.details.map((d) => `${d.path} — ${d.message}`).join('; ')}`
        : `It is not valid: ${err.message}`
    default:
      return 'The server had a problem.'
  }
}
