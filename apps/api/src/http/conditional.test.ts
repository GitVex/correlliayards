import type { FastifyReply, FastifyRequest } from 'fastify'
import { describe, expect, it, vi } from 'vitest'
import { assertIfMatch, etagFor, notModified } from './conditional.js'
import { HttpError } from './errors.js'

/* One tag does two jobs — concurrency token for a write, cache validator for a
   read — and the composite format is what lets it. The tests that matter here
   are the ones where the two jobs disagree: a publish must be invisible to
   If-Match and visible to If-None-Match, and a bug in either direction is
   silent. One loses somebody's edit, the other serves a stale card forever. */

const T1 = new Date('2026-01-01T00:00:00.000Z')
const T2 = new Date('2026-02-02T12:30:00.000Z')

const req = (headers: Record<string, string | string[]>) =>
  ({ headers }) as unknown as FastifyRequest

function fakeReply() {
  const reply = {
    code: vi.fn(() => reply),
    send: vi.fn(() => reply),
  }
  return reply as unknown as FastifyReply & { code: ReturnType<typeof vi.fn> }
}

describe('etagFor', () => {
  it('leads with the ISO timestamp, quoted', () => {
    expect(etagFor(T1)).toBe('"2026-01-01T00:00:00.000Z"')
  })

  it('joins variants after the separator', () => {
    expect(etagFor(T1, 'x', 3)).toBe('"2026-01-01T00:00:00.000Z~x~3"')
  })

  it('renders a Date variant as ISO, not as whatever String() gives', () => {
    expect(etagFor(T1, T2)).toBe('"2026-01-01T00:00:00.000Z~2026-02-02T12:30:00.000Z"')
  })

  it('distinguishes absent from empty', () => {
    // Both collapsing to "" would make an unpublished card and a card published
    // at an empty instant share a validator.
    expect(etagFor(T1, null)).not.toBe(etagFor(T1, ''))
    expect(etagFor(T1, null)).toBe(etagFor(T1, undefined))
  })
})

describe('assertIfMatch', () => {
  const current = etagFor(T1, '-')

  it('does not check when the header is absent', () => {
    expect(() => assertIfMatch(req({}), current)).not.toThrow()
    expect(() => assertIfMatch(req({}), undefined)).not.toThrow()
  })

  it('accepts a tag whose concurrency component matches', () => {
    expect(() => assertIfMatch(req({ 'if-match': current }), current)).not.toThrow()
  })

  it('lets a publish through — the property the composite tag exists for', () => {
    // The client read the card before it was published and holds "<t>~-".
    // The row now answers "<t>~<when>". updated_at has not moved, so the write
    // is not stale and must not 412 — otherwise publishing in one tab would
    // reject the next keystroke in another.
    const held = etagFor(T1, '-')
    const now = etagFor(T1, T2.toISOString())
    expect(() => assertIfMatch(req({ 'if-match': held }), now)).not.toThrow()
  })

  it('rejects when the concurrency component has moved', () => {
    expect(() => assertIfMatch(req({ 'if-match': etagFor(T1) }), etagFor(T2))).toThrow(HttpError)
    // 412 rather than 409: the request was well formed, its precondition simply
    // is not true any more, and that is the difference that tells the SPA
    // re-reading and retrying is the fix.
    expect(() => assertIfMatch(req({ 'if-match': etagFor(T1) }), etagFor(T2))).toThrowError(
      expect.objectContaining({ statusCode: 412, code: 'precondition_failed' }),
    )
  })

  it('accepts a weak tag, since the comparison is not on byte equality', () => {
    expect(() => assertIfMatch(req({ 'if-match': `W/${current}` }), current)).not.toThrow()
  })

  it('accepts a list when any member matches', () => {
    const header = `${etagFor(T2)}, ${current}`
    expect(() => assertIfMatch(req({ 'if-match': header }), current)).not.toThrow()
  })

  it('treats * as "must already exist"', () => {
    expect(() => assertIfMatch(req({ 'if-match': '*' }), current)).not.toThrow()
    expect(() => assertIfMatch(req({ 'if-match': '*' }), undefined)).toThrow(HttpError)
  })

  it('rejects any concrete tag when the row does not exist', () => {
    expect(() => assertIfMatch(req({ 'if-match': current }), undefined)).toThrow(HttpError)
  })

  it('does not check when the header is present but empty', () => {
    expect(() => assertIfMatch(req({ 'if-match': '  ' }), current)).not.toThrow()
  })
})

describe('notModified', () => {
  const etag = etagFor(T1, 'published')

  it('is false with no If-None-Match', () => {
    expect(notModified(req({}), fakeReply(), etag)).toBe(false)
  })

  it('sends 304 on an exact match', () => {
    const reply = fakeReply()
    expect(notModified(req({ 'if-none-match': etag }), reply, etag)).toBe(true)
    expect(reply.code).toHaveBeenCalledWith(304)
  })

  it('compares the whole tag, unlike If-Match', () => {
    // Same concurrency component, different variant. A write would be allowed
    // through; a cached copy must not be, or publishing would never become
    // visible to anyone holding one.
    const held = etagFor(T1, '-')
    expect(notModified(req({ 'if-none-match': held }), fakeReply(), etag)).toBe(false)
  })

  it('honours *', () => {
    expect(notModified(req({ 'if-none-match': '*' }), fakeReply(), etag)).toBe(true)
  })
})
