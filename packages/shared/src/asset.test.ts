import { describe, expect, it } from 'vitest'
import { ASSET_MIME_TYPES, assetPath, assetSchema, assetMimeSchema } from './asset.js'
import { artworkRefSchema, shipArtworkSchema } from './artwork.js'

const DIGEST = 'a'.repeat(64)

describe('assetMimeSchema', () => {
  it('accepts exactly the raster types and nothing else', () => {
    for (const mime of ASSET_MIME_TYPES) expect(assetMimeSchema.parse(mime)).toBe(mime)
  })

  it('refuses SVG', () => {
    // Not an oversight and not a TODO: it is XML that can carry script, served
    // back from this app's own origin.
    expect(() => assetMimeSchema.parse('image/svg+xml')).toThrow()
    expect(() => assetMimeSchema.parse('text/html')).toThrow()
  })
})

describe('assetSchema', () => {
  const valid = {
    id: DIGEST,
    mime: 'image/png',
    filename: 'ship.png',
    byteSize: 1234,
    createdAt: '2026-01-01T00:00:00.000Z',
  }

  it('accepts a well-formed row', () => {
    expect(assetSchema.parse(valid).id).toBe(DIGEST)
  })

  it('requires the id to be a lowercase sha-256 digest', () => {
    // The id is the address these bytes are served from, so anything that is
    // not a digest is either a bug or someone probing the route.
    expect(() => assetSchema.parse({ ...valid, id: DIGEST.toUpperCase() })).toThrow()
    expect(() => assetSchema.parse({ ...valid, id: 'a'.repeat(63) })).toThrow()
    expect(() => assetSchema.parse({ ...valid, id: 'g'.repeat(64) })).toThrow()
    expect(() => assetSchema.parse({ ...valid, id: '../etc/passwd' })).toThrow()
  })
})

describe('artworkRefSchema', () => {
  it('is nullable, because an empty slot is normal', () => {
    expect(artworkRefSchema.parse(null)).toBeNull()
  })

  it('still accepts a bare filename, which is the compatibility promise', () => {
    // Cards saved before uploads existed hold a file name here. A card that
    // cannot be read back at all is worse than one with a picture missing, so
    // this stays a plain string rather than taking assetSchema's stricter
    // pattern. The SPA treats a ref it cannot resolve as no picture.
    expect(artworkRefSchema.parse('old-thumbnail.png')).toBe('old-thumbnail.png')
  })

  it('carries all three ship slots', () => {
    const artwork = shipArtworkSchema.parse({
      thumbnail: DIGEST,
      schematic: null,
      tinycon: 'legacy.png',
    })
    expect(artwork).toEqual({ thumbnail: DIGEST, schematic: null, tinycon: 'legacy.png' })
  })

  it('requires every slot to be present, even when empty', () => {
    // Absent and null are different, and only one of them round-trips.
    expect(() => shipArtworkSchema.parse({ thumbnail: DIGEST })).toThrow()
  })
})

describe('assetPath', () => {
  it('is the one definition the img src and the route both use', () => {
    expect(assetPath(DIGEST)).toBe(`/api/assets/${DIGEST}`)
  })
})
