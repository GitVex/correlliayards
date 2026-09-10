import { ASSET_MIME_TYPES, MAX_ASSET_BYTES, assetPath, type Asset } from '@correlliayards/shared'
import { ApiRequestError, apiFetch } from './client'

export { assetPath }

/** Whether an artwork ref points at stored bytes.
 *
 *  An asset id is a sha-256 digest. Anything else in an artwork slot is a file
 *  name left by a card saved before uploads existed — a reference to something
 *  that only ever sat on somebody's disk, and which nothing can resolve. */
export const isAssetId = (ref: string): boolean => /^[0-9a-f]{64}$/.test(ref)

/** Refuse locally what the server would refuse anyway.
 *
 *  Not a security check — the server sniffs the content and is the only opinion
 *  that counts. This is so that picking a 40 MB TIFF says so at once instead of
 *  after it has been pushed up the wire and rejected. */
function precheck(file: File): string | null {
  if (file.size === 0) return 'That file is empty.'
  if (file.size > MAX_ASSET_BYTES) {
    return `That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${MAX_ASSET_BYTES / 1024 / 1024} MB.`
  }
  if (!(ASSET_MIME_TYPES as readonly string[]).includes(file.type)) {
    /* An empty `type` means the browser could not tell from the extension. */
    return file.type
      ? `${file.type} is not an image type this accepts.`
      : 'That file type could not be recognised.'
  }
  return null
}

/** Store one picture and get back the id a card refers to it by.
 *
 *  The body is the file itself rather than a multipart form: one request
 *  carries one image, so there is nothing to demultiplex, and the API needs no
 *  multipart parser for it. */
export async function uploadAsset(file: File): Promise<Asset> {
  const problem = precheck(file)
  if (problem) throw new ApiRequestError(0, 'unsupported_media_type', problem)

  const res = await apiFetch(`/api/assets?filename=${encodeURIComponent(file.name)}`, {
    method: 'POST',
    headers: { 'content-type': file.type },
    body: file,
  })

  return (await res.json()) as Asset
}
