import type { FastifyInstance } from 'fastify'
import {
  ASSET_MIME_TYPES,
  MAX_ASSET_BYTES,
  type AssetMime,
} from '@correlliayards/shared'
import { HttpError, badRequest, notFound } from '../../http/errors.js'
import { ownerSub, requireApiAuth } from '../../http/guards.js'
import { findAssetBytes, storeAsset } from './asset-rows.js'

/* Image storage.
 *
 * Uploads are their own route rather than fields on the card body, and the card
 * route's 256 KB body limit is the reason: a card is text and numbers and has
 * no business being large, while a picture is several megabytes. Keeping them
 * apart also keeps `PUT /api/cards/:id` cheap to retry, which the editor's save
 * depends on.
 *
 * The bytes arrive raw, with the file type as the Content-Type. That avoids a
 * multipart parser this service would otherwise not need — one request carries
 * exactly one file, so there is nothing to demultiplex.
 */

/** Leading bytes for each type we accept.
 *
 *  The whole security posture of this route rests here. A response served from
 *  this app's own origin that the browser decides is HTML runs as this app,
 *  with this app's session cookie — so the type has to be established from the
 *  content, which an attacker cannot lie about, rather than from the
 *  Content-Type header, which is theirs to write. What the client claimed is
 *  used only to reject the request early; what gets stored and served is what
 *  the bytes say they are. */
export function sniff(bytes: Buffer): AssetMime | null {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) {
    return 'image/png'
  }
  /* JPEG has several flavours and they share only the SOI marker plus the
     start of the first segment. */
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString('latin1') === 'RIFF' &&
    bytes.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'image/webp'
  }
  if (bytes.length >= 6 && ['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString('latin1'))) {
    return 'image/gif'
  }
  return null
}

const unsupportedMedia = (message: string): HttpError =>
  new HttpError(415, 'unsupported_media_type', message)

/** Keep a filename printable and short. It is shown beside the editor's picker
 *  and nothing resolves it, so the only requirements are that it survives being
 *  put in a header and cannot be used to smuggle one. */
export function cleanFilename(raw: unknown): string {
  if (typeof raw !== 'string' || raw.trim() === '') return 'image'
  return (
    raw
      .replace(/[\u0000-\u001f\u007f"\\]/g, '')
      .replace(/[/\\]/g, '-')
      .trim()
      .slice(0, 120) || 'image'
  )
}

export async function registerAssetRoutes(scope: FastifyInstance): Promise<void> {
  /* Raw bodies for the image types, capped. Registered on this scope, so the
     card and collection routes keep the JSON parser they already use — a
     content type parser only claims the types it names. */
  scope.addContentTypeParser(
    [...ASSET_MIME_TYPES],
    { parseAs: 'buffer', bodyLimit: MAX_ASSET_BYTES },
    (_request, body, done) => done(null, body),
  )

  /* POST, not PUT, and this is the one write in the API that is not
     client-addressed. Everywhere else the client mints the uuid; here the id is
     the content's own digest, so the client cannot know it before the server
     has hashed the bytes. Idempotence comes from the addressing rather than
     from the verb: uploading the same file twice yields the same row. */
  scope.post(
    '/assets',
    { preHandler: requireApiAuth, bodyLimit: MAX_ASSET_BYTES },
    async (request, reply) => {
      const bytes = request.body

      if (!Buffer.isBuffer(bytes) || bytes.byteLength === 0) {
        throw badRequest('The request body must be the image itself.')
      }

      const mime = sniff(bytes)
      if (!mime) {
        /* Deliberately does not name what was detected. The list of what is
           accepted is public; what a rejected file appeared to be is only ever
           useful to someone probing the sniffer. */
        throw unsupportedMedia(
          `That file is not one of ${ASSET_MIME_TYPES.join(', ')}. SVG is not accepted.`,
        )
      }

      const { asset, created } = await storeAsset({
        ownerSub: ownerSub(request),
        bytes,
        mime,
        filename: cleanFilename((request.query as Record<string, unknown>)?.filename),
      })

      reply.header('cache-control', 'no-store')
      /* 200 when the bytes were already held. Not a failure — the caller ends
         up with a usable id either way — but the distinction is free and says
         whether anything was actually written. */
      return reply.code(created ? 201 : 200).send(asset)
    },
  )

  /* Serve the bytes. Owner-scoped, like every other read here: an id belonging
     to someone else is a 404, not a 403.

     Published cards will need an unauthenticated path to their pictures, and
     this is not it — the public card page does not exist yet, and opening a
     hole for a page nobody can reach would be the wrong order to do it in. */
  scope.get('/assets/:id', { preHandler: requireApiAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }

    /* Checked before it reaches a query for the same reason `idParam` checks a
       uuid: the column is text, so a malformed id is a miss rather than an
       error, but rejecting it here keeps the shape of an id in one place. */
    if (!/^[0-9a-f]{64}$/.test(id)) throw notFound('No such asset.')

    const row = await findAssetBytes(ownerSub(request), id)
    if (!row) throw notFound('No such asset.')

    /* The id is the content digest, so it is already a perfect entity tag —
       there is no version of these bytes that this id could also name. */
    const etag = `"${id}"`
    if (request.headers['if-none-match'] === etag) return reply.code(304).send()

    reply
      .header('content-type', row.mime)
      .header('content-length', row.byteSize)
      .header('etag', etag)
      /* Immutable in the strongest sense the word has: the URL is derived from
         the bytes. Private because the route is owner-scoped — a shared cache
         must not hand one person's picture to the next caller. */
      .header('cache-control', 'private, max-age=31536000, immutable')
      /* Belt and braces around the sniffing above. `nosniff` stops the browser
         second-guessing the content type it was given, and a CSP that permits
         nothing renders the response inert if it is ever opened as a document
         rather than loaded into an <img>. */
      .header('x-content-type-options', 'nosniff')
      .header('content-security-policy', "default-src 'none'; sandbox")

    return reply.send(row.bytes)
  })
}
