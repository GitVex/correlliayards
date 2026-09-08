import type { FastifyInstance, FastifyReply } from 'fastify'
import { ZodError, type z } from 'zod'
import type { ApiError as ApiErrorBody, ApiErrorCode, ApiErrorDetail } from '@correlliayards/shared'

/* Every failure inside /api leaves through here, in the envelope declared in
   packages/shared/errors.ts. The /auth routes keep the OAuth error shape they
   already speak — see the note at the top of that file.

   The design is: routes throw, one handler renders. A route that builds its own
   error response is a route that can forget the cache header, or the envelope,
   or return a 403 where the rest of the API returns a 404. */

/** A failure with an HTTP status and a code the SPA can branch on. */
export class HttpError extends Error {
  readonly statusCode: number
  readonly code: ApiErrorCode
  readonly details?: ApiErrorDetail[]

  constructor(
    statusCode: number,
    code: ApiErrorCode,
    message: string,
    details?: ApiErrorDetail[],
  ) {
    super(message)
    this.name = 'HttpError'
    this.statusCode = statusCode
    this.code = code
    this.details = details
  }
}

export const badRequest = (message: string, details?: ApiErrorDetail[]): HttpError =>
  new HttpError(400, 'bad_request', message, details)

export const unauthenticated = (message: string): HttpError =>
  new HttpError(401, 'unauthenticated', message)

/** The workhorse. Note what it is used for: not only "no such row", but also
 *  "not yours" and "not published". An id that exists but is not yours must be
 *  indistinguishable from one that does not exist, or the 403 confirms the id
 *  is real — and uuids are not secret, they sit in URLs, logs and browser
 *  history where anyone can pick one up. */
export const notFound = (message = 'No such resource.'): HttpError =>
  new HttpError(404, 'not_found', message)

export const conflict = (message: string): HttpError =>
  new HttpError(409, 'conflict', message)

export const preconditionFailed = (message: string): HttpError =>
  new HttpError(412, 'precondition_failed', message)

/** Flatten Zod's issue tree into the flat `path`/`message` pairs the envelope
 *  carries. The dotted path — `data.defenseTokens.2` — is what lets a form map
 *  a message back onto the input that produced it. */
function detailsFromZod(error: ZodError): ApiErrorDetail[] {
  return error.issues.map((issue) => ({
    path: issue.path.map((segment) => String(segment)).join('.'),
    message: issue.message,
  }))
}

/** Fastify's own failures, which arrive before any route code runs and so
 *  cannot be thrown as an HttpError. Mapping them by code keeps a body that is
 *  too large or a Content-Type that is wrong inside the same envelope as
 *  everything else, instead of leaking Fastify's default error shape. */
function fromFastify(error: unknown): HttpError | undefined {
  /* `unknown` rather than FastifyError: by the time this is called the handler
     has already narrowed away the two error types it knows, and what is left is
     genuinely anything a route or a plugin threw. Reading `code` off it is a
     check, not an assumption. */
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? (error as { code?: unknown }).code
      : undefined

  switch (code) {
    case 'FST_ERR_CTP_BODY_TOO_LARGE':
      return new HttpError(413, 'payload_too_large', 'Request body is too large.')
    case 'FST_ERR_CTP_INVALID_MEDIA_TYPE':
      return badRequest('Request body must be application/json.')
    case 'FST_ERR_CTP_EMPTY_JSON_BODY':
    case 'FST_ERR_CTP_INVALID_JSON_BODY':
      return badRequest('Request body is not valid JSON.')
    default:
      return undefined
  }
}

/** Install the envelope on one Fastify scope.
 *
 *  Called inside the /api plugin rather than on the root instance, because
 *  Fastify encapsulates error handlers per plugin: doing it this way is what
 *  keeps the OAuth-shaped errors on /auth intact while every /api route gets
 *  this one. */
export function registerErrorEnvelope(scope: FastifyInstance): void {
  scope.setErrorHandler((error, request, reply) => {
    const httpError =
      error instanceof HttpError
        ? error
        : error instanceof ZodError
          ? badRequest('Request body failed validation.', detailsFromZod(error))
          : fromFastify(error)

    if (httpError) {
      /* Client errors are the expected traffic of a validating API, so they are
         logged at info and only when something is actually wrong with the
         request. A 404 per missing card at error level is noise that hides the
         500s. */
      request.log.info(
        { code: httpError.code, statusCode: httpError.statusCode, err: error },
        'request rejected',
      )
      return sendError(reply, httpError)
    }

    /* Anything unrecognised is a bug in this service. The detail goes to the
       log, where it is useful; the response says nothing, because an exception
       message can carry a query, a connection string or a row of someone
       else's data. */
    request.log.error({ err: error }, 'unhandled error')
    return sendError(reply, new HttpError(500, 'internal', 'Something went wrong.'))
  })

  /* An unknown path under /api is a 404 in the envelope too. Without this it
     would be Fastify's default body, which is exactly the `catch (e: any)`
     shape the envelope exists to remove — and the SPA hitting a route this
     version does not have is not a hypothetical. */
  scope.setNotFoundHandler((request, reply) =>
    sendError(reply, notFound(`No route for ${request.method} ${request.url}.`)),
  )
}

export function sendError(reply: FastifyReply, error: HttpError): FastifyReply {
  const body: ApiErrorBody = {
    error: {
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    },
  }
  /* An error is never the right thing for a cache to keep and replay — least of
     all a 401, which would then be served to a request that does have a
     session. */
  reply.header('cache-control', 'no-store')
  return reply.code(error.statusCode).send(body)
}

/** Parse a body against a Zod schema, raising the envelope's own error rather
 *  than a raw ZodError, so a route reads as one expression and every route
 *  reports a bad body the same way. */
export function parseBody<S extends z.ZodType>(schema: S, body: unknown): z.infer<S> {
  const result = schema.safeParse(body)
  if (!result.success) {
    throw badRequest('Request body failed validation.', detailsFromZod(result.error))
  }
  return result.data
}

/** The same, for a query string. Split out only so the message names the right
 *  half of the request — a client that has mangled its filters should not be
 *  told its body is wrong. */
export function parseQuery<S extends z.ZodType>(schema: S, query: unknown): z.infer<S> {
  const result = schema.safeParse(query)
  if (!result.success) {
    throw badRequest('Query parameters failed validation.', detailsFromZod(result.error))
  }
  return result.data
}
