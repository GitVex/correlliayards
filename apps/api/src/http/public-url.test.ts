import { describe, expect, it } from 'vitest'
import { publicUrlFor, slugify } from './public-url.js'

/* The slug is decoration — the uuid is what resolves — so nothing here is a
   correctness requirement in the sense that a wrong answer breaks a link. What
   it must never do is produce a segment that is not a segment: an empty one, or
   one carrying characters that change what the path means. */

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Imperial Star Destroyer')).toBe('imperial-star-destroyer')
  })

  it('keeps the letter when stripping its accent', () => {
    // "tycho-celch" would silently lose a character from the name.
    expect(slugify('Tycho Celchü')).toBe('tycho-celchu')
    expect(slugify('Ackbar’s Flagship')).toBe('ackbar-s-flagship')
  })

  it('collapses runs and trims the ends', () => {
    expect(slugify('  --Nebulon-B   Frigate!!  ')).toBe('nebulon-b-frigate')
  })

  it('never emits a path separator or a leading dot', () => {
    expect(slugify('../../etc/passwd')).toBe('etc-passwd')
    expect(slugify('a/b')).toBe('a-b')
  })

  it('falls back rather than producing an empty segment', () => {
    // A card named entirely in stripped characters would otherwise give
    // "/c/<uuid>/", which is a different url shape than the route expects.
    expect(slugify('')).toBe('untitled')
    expect(slugify('!!!')).toBe('untitled')
    expect(slugify('日本語')).toBe('untitled')
  })

  it('caps the length without leaving a trailing hyphen', () => {
    const slug = slugify('x '.repeat(80))
    expect(slug.length).toBeLessThanOrEqual(60)
    expect(slug.endsWith('-')).toBe(false)
  })
})

describe('publicUrlFor', () => {
  const id = '11111111-2222-3333-4444-555555555555'

  it('builds a card link under /c and a collection link under /k', () => {
    expect(publicUrlFor('card', id, 'Home One')).toBe(
      `https://app.invalid/c/${id}/home-one`,
    )
    expect(publicUrlFor('collection', id, 'Home One')).toBe(
      `https://app.invalid/k/${id}/home-one`,
    )
  })

  it('is absolute and built from the configured base, not from a request', () => {
    // The Host header is attacker-influenced and, behind a proxy, usually wrong.
    expect(publicUrlFor('card', id, 'x').startsWith('https://app.invalid/')).toBe(true)
  })
})
