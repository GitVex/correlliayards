// ---------------------------------------------------------------------------
// The one shape every `/api/*` route fails with.
//
// The point is typed error handling in the SPA: `catch (e: any)` followed by
// guesswork is what you get when each route invents its own failure body. One
// envelope, one parse, one exhaustive `switch` on the code.
//
// The `/auth/*` routes deliberately do *not* use this. They speak the OAuth 2
// error shape (`{ error, error_description }`) because that is what the spec
// and every OIDC client library expect, and bending them into this envelope
// would make them wrong in a more subtle way than being inconsistent does.
// ---------------------------------------------------------------------------

import { z } from 'zod'

/** A closed set, because the SPA is meant to branch on it. A string here would
 *  put us back where we started: no way to know what values are possible. */
export const API_ERROR_CODES = [
  /** Malformed input — a bad uuid, an unparseable body, a filter combination
   *  that cannot mean anything. Carries `details` when it was a body. */
  'bad_request',
  /** No session. The SPA's cue to send the user through /auth/login. */
  'unauthenticated',
  /** Authenticated, but this is not yours. Rare by design — an id that is not
   *  yours is a 404, not this, so that ids cannot be probed. */
  'forbidden',
  /** No such row, *or* not yours, *or* not published. Deliberately ambiguous. */
  'not_found',
  /** The write cannot apply: a uuid already owned by someone else, a duplicate
   *  card in a collection's membership list. */
  'conflict',
  /** If-Match lost the race — someone else wrote since you read. */
  'precondition_failed',
  /** The body is larger than this route accepts. */
  'payload_too_large',
  /** Public-surface rate limit. Retry-After says when. */
  'rate_limited',
  /** Anything unplanned. Never carries detail — that goes to the server log. */
  'internal',
] as const
export const apiErrorCodeSchema = z.enum(API_ERROR_CODES)
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>

/** One field-level complaint, flattened out of a Zod issue. `path` is dotted
 *  and index-bearing — `data.defenseTokens.2` — so a form can map a message
 *  back onto the input that caused it without re-walking a tree. */
export const apiErrorDetailSchema = z.object({
  path: z.string(),
  message: z.string(),
})
export type ApiErrorDetail = z.infer<typeof apiErrorDetailSchema>

export const apiErrorSchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    /** For a developer reading a log or a network tab. Not UI copy: the SPA
     *  should render its own wording off `code`, which is why the code is a
     *  closed enum and this is free text. */
    message: z.string(),
    details: z.array(apiErrorDetailSchema).optional(),
  }),
})
export type ApiError = z.infer<typeof apiErrorSchema>

/** Narrow an unknown response body to the envelope. The SPA's `!res.ok` branch
 *  is the whole reason this file exists. */
export function isApiError(body: unknown): body is ApiError {
  return apiErrorSchema.safeParse(body).success
}
