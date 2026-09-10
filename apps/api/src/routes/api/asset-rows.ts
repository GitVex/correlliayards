import { createHash } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import type { Asset, AssetMime } from '@correlliayards/shared'
import { db } from '../../db/client.js'
import { assets } from '../../db/schema.js'

/* Row access for the asset routes, kept out of the route file so the route
   reads as HTTP — the same split as card-rows.ts and collection-rows.ts. */

/** The content digest, which is also the row's id. */
export function digest(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/** Store the bytes, or notice they are already stored.
 *
 *  `onConflictDoNothing` rather than an upsert: the id *is* the content, so a
 *  conflict means an identical file, and there is nothing about it worth
 *  rewriting. It also makes the route idempotent for free — a retried upload
 *  over a flaky connection costs a hash and a no-op.
 *
 *  The insert returns no row when it conflicts, so the metadata is read back
 *  rather than assumed: what comes out is the row that exists, which is the
 *  first upload's filename rather than this one's. That is the honest answer —
 *  there is one row and it has one name.
 */
export async function storeAsset(input: {
  ownerSub: string
  bytes: Buffer
  mime: AssetMime
  filename: string
}): Promise<{ asset: Asset; created: boolean }> {
  const id = digest(input.bytes)

  const [inserted] = await db
    .insert(assets)
    .values({
      id,
      ownerSub: input.ownerSub,
      mime: input.mime,
      filename: input.filename,
      byteSize: input.bytes.byteLength,
      bytes: input.bytes,
    })
    .onConflictDoNothing({ target: [assets.ownerSub, assets.id] })
    .returning({
      id: assets.id,
      mime: assets.mime,
      filename: assets.filename,
      byteSize: assets.byteSize,
      createdAt: assets.createdAt,
    })

  if (inserted) {
    return { asset: { ...inserted, createdAt: inserted.createdAt.toISOString() }, created: true }
  }

  const existing = await findAssetMeta(input.ownerSub, id)
  /* Only reachable if the row was deleted between the insert and this read,
     which nothing in this service does. Reported rather than papered over with
     a fabricated row. */
  if (!existing) throw new Error(`asset ${id} conflicted on insert but could not be read back`)
  return { asset: existing, created: false }
}

/** Metadata alone — used by the upload's conflict path, where the caller
 *  already has the bytes and has no use for another copy of them. */
export async function findAssetMeta(ownerSub: string, id: string): Promise<Asset | null> {
  const [row] = await db
    .select({
      id: assets.id,
      mime: assets.mime,
      filename: assets.filename,
      byteSize: assets.byteSize,
      createdAt: assets.createdAt,
    })
    .from(assets)
    .where(and(eq(assets.ownerSub, ownerSub), eq(assets.id, id)))
    .limit(1)

  return row ? { ...row, createdAt: row.createdAt.toISOString() } : null
}

/** The bytes, for the route that serves them.
 *
 *  Scoped by owner like every other read in this API: a matching id that
 *  belongs to someone else returns nothing, and the route turns that into the
 *  same 404 as an id that does not exist. */
export async function findAssetBytes(
  ownerSub: string,
  id: string,
): Promise<{ bytes: Buffer; mime: AssetMime; byteSize: number } | null> {
  const [row] = await db
    .select({ bytes: assets.bytes, mime: assets.mime, byteSize: assets.byteSize })
    .from(assets)
    .where(and(eq(assets.ownerSub, ownerSub), eq(assets.id, id)))
    .limit(1)

  return row ?? null
}
