import { assetPath, type ShipCard } from '@correlliayards/shared'
import { describe, expect, it } from 'vitest'
import { blankSeed, seedFromCard } from './cardHydration'
import { localCard } from './cardJson'

/* seedFromCard and localCard are inverses, and the file header on cardHydration
   says so. Nothing enforces it — they are two hand-written mappings a field
   apart — so the round trip is the check. When they disagree the symptom is a
   card that opens with a field quietly reset to its default and saves that back
   over the real value, which nobody notices until the value mattered. */

const DIGEST = 'b'.repeat(64)

function storedCard(overrides: Partial<ShipCard> = {}): ShipCard {
  const blank = localCard(blankSeed().state)
  return {
    ...blank,
    name: 'Home One',
    points: 154,
    faction: 'Rebel Alliance',
    data: {
      ...blank.data,
      artwork: { thumbnail: DIGEST, schematic: null, tinycon: 'legacy-name.png' },
    },
    token: { baseSize: 'Large', arcs: { ...blank.token.arcs, front: 0.1234 } },
    // The five fields the server owns and the editor never sends.
    ownerSub: 'sub-123',
    published: false,
    publishedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  } as ShipCard
}

describe('seedFromCard / localCard round trip', () => {
  it('settles — a second trip changes nothing the first did not', () => {
    // A mapping that drops a field drops it on the first pass; one that invents
    // a default keeps re-inventing it. Either shows up as these two differing.
    const card = storedCard()
    const once = localCard(seedFromCard(card, null).state)
    const twice = localCard(seedFromCard({ ...card, ...once } as ShipCard, null).state)
    expect(twice).toEqual(once)
  })

  it('preserves every editable field through one trip', () => {
    const card = storedCard()
    const back = localCard(seedFromCard(card, null).state)

    expect(back.id).toBe(card.id)
    expect(back.name).toBe('Home One')
    expect(back.points).toBe(154)
    expect(back.faction).toBe('Rebel Alliance')
    expect(back.token.baseSize).toBe('Large')
    expect(back.token.arcs.front).toBe(0.1234)
    expect(back.data).toEqual(card.data)
  })

  it('does not send back the fields the server owns', () => {
    const back = localCard(seedFromCard(storedCard(), null).state)
    for (const key of ['ownerSub', 'published', 'publishedAt', 'createdAt', 'updatedAt']) {
      expect(back).not.toHaveProperty(key)
    }
  })

  it('carries the etag through for the next save’s If-Match', () => {
    expect(seedFromCard(storedCard(), '"v1"').etag).toBe('"v1"')
    expect(seedFromCard(storedCard(), null).etag).toBeNull()
  })

  it('opens clean, so the Save button has nothing to offer yet', () => {
    expect(seedFromCard(storedCard(), '"v1"').clean).toBe(true)
    // A blank card is unsaved by definition.
    expect(blankSeed().clean).toBe(false)
  })
})

describe('artwork hydration', () => {
  it('resolves an asset id to its served path', () => {
    const { images } = seedFromCard(storedCard(), null)
    expect(images.thumbnail).toMatchObject({
      url: assetPath(DIGEST),
      status: 'stored',
      assetId: DIGEST,
    })
  })

  it('shows no picture for an empty slot', () => {
    expect(seedFromCard(storedCard(), null).images.schematic).toBeNull()
  })

  it('shows no picture for a legacy filename, which nothing can resolve', () => {
    expect(seedFromCard(storedCard(), null).images.tinycon).toBeNull()
  })

  it('leaves an unresolvable ref in the card rather than rewriting it', () => {
    // Rendering nothing is a display decision. Clearing the stored value would
    // be a data decision, and saving afterwards would make it permanent.
    const back = localCard(seedFromCard(storedCard(), null).state)
    expect(back.data.artwork.tinycon).toBe('legacy-name.png')
  })
})

describe('blankSeed', () => {
  it('mints a fresh uuid each time, so two new cards are two cards', () => {
    const a = blankSeed().state.id
    const b = blankSeed().state.id
    expect(a).not.toBe(b)
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })

  it('produces a card the editor can save without touching anything', () => {
    expect(() => localCard(blankSeed().state)).not.toThrow()
    expect(localCard(blankSeed().state).kind).toBe('ship')
  })
})

describe('faction fallback', () => {
  it('substitutes a faction rather than passing null to the picker', () => {
    // The column is nullable because an unrestricted upgrade is a real thing,
    // but a ship card has a faction printed on it and the picker has no "none".
    const seed = seedFromCard(storedCard({ faction: null }), null)
    expect(seed.state.faction).toBe('Rebel Alliance')
  })
})
