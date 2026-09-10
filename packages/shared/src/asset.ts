// ---------------------------------------------------------------------------
// A stored image.
//
// Artwork used to be a file name and nothing else — a note of what had been
// picked, which no reader could resolve. An asset is the bytes themselves, held
// in Postgres, and `artworkRefSchema` now carries its id.
//
// Identity is the SHA-256 of the content, which buys three things at once: the
// same picture used on twenty cards is stored once, the id is a perfect ETag
// because the bytes can never change under it, and a response can be cached
// forever. Ownership is part of the key rather than a column beside it — see
// the table in apps/api/src/db/schema.ts for why that matters.
// ---------------------------------------------------------------------------

import { z } from 'zod'

/** What may be stored. A closed list, and checked against the file's leading
 *  bytes rather than against the Content-Type the client claimed — the header
 *  is the attacker's to choose and the magic number is not.
 *
 *  SVG is deliberately absent. It is XML that can carry script, and it would be
 *  served back from this app's own origin, which is the textbook shape of a
 *  stored cross-site scripting hole. Raster only. */
export const ASSET_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const
export const assetMimeSchema = z.enum(ASSET_MIME_TYPES)
export type AssetMime = z.infer<typeof assetMimeSchema>

/** Per file. Card artwork is printed at 69 × 89 mm, so anything past a couple of
 *  megabytes is resolution nobody will ever see — and the cap is what stops one
 *  upload becoming a denial of service against a jsonb-sized database. */
export const MAX_ASSET_BYTES = 5 * 1024 * 1024

/** The metadata an upload hands back. Never the bytes: those come from
 *  `GET /api/assets/:id`, so a card's JSON stays small enough to read. */
export const assetSchema = z.object({
  /** Lowercase hex SHA-256 of the content. */
  id: z.string().regex(/^[0-9a-f]{64}$/, 'An asset id is a sha-256 hex digest'),
  mime: assetMimeSchema,
  /** What the file was called on the way in, kept only so the editor can show
   *  you which picture is loaded. Nothing resolves it. */
  filename: z.string(),
  byteSize: z.int().min(0),
  createdAt: z.iso.datetime(),
})
export type Asset = z.infer<typeof assetSchema>

/** The path an asset is served from. One definition, so the SPA's `<img src>`
 *  and the route that answers it cannot drift apart. */
export function assetPath(id: string): string {
  return `/api/assets/${id}`
}
