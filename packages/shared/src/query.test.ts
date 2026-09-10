import { describe, expect, it } from 'vitest'
import { FACTION_NONE, cardQuerySchema, cardQueryToParams } from './query.js'

/* Everything here arrives as a string out of a query string, and both sides
   build it: the SPA writes the URL, the API reads it. A disagreement between
   them is invisible — the list simply comes back filtered by something other
   than what the page says it is filtered by. */

const parse = (raw: Record<string, unknown>) => cardQuerySchema.parse(raw)

describe('cardQuerySchema', () => {
  it('applies defaults for an empty query', () => {
    expect(parse({})).toMatchObject({ sort: 'updatedAt', order: 'desc', limit: 50 })
  })

  it('reads "false" as false', () => {
    // The trap the schema is written around: z.coerce.boolean() is Boolean(v),
    // and Boolean("false") is true. Getting this wrong inverts the filter for
    // exactly the people who set it to false.
    expect(parse({ kind: 'upgrade', unique: 'false' }).unique).toBe(false)
    expect(parse({ kind: 'upgrade', unique: 'true' }).unique).toBe(true)
  })

  it('rejects a boolean that is neither word', () => {
    expect(() => parse({ kind: 'upgrade', unique: '1' })).toThrow()
    expect(() => parse({ kind: 'upgrade', unique: 'yes' })).toThrow()
  })

  it('keeps faction=none as a sentinel distinct from an absent faction', () => {
    // "no faction restriction" and "do not filter on faction" are different
    // questions, and only the second one is what omitting the parameter means.
    expect(parse({ faction: FACTION_NONE }).faction).toBe('none')
    expect(parse({}).faction).toBeUndefined()
  })

  it('treats an empty parameter as absent, the way a blank form submits', () => {
    const q = parse({ q: '', kind: '', faction: '', cursor: '' })
    expect(q.q).toBeUndefined()
    expect(q.kind).toBeUndefined()
    expect(q.faction).toBeUndefined()
    expect(q.cursor).toBeUndefined()
  })

  it('coerces numbers out of strings', () => {
    expect(parse({ minPoints: '10', maxPoints: '80', limit: '25' })).toMatchObject({
      minPoints: 10,
      maxPoints: 80,
      limit: 25,
    })
  })

  it('rejects a non-integer or negative point bound', () => {
    expect(() => parse({ minPoints: '1.5' })).toThrow()
    expect(() => parse({ minPoints: '-1' })).toThrow()
    expect(() => parse({ minPoints: 'lots' })).toThrow()
  })

  it('caps limit rather than letting the caller choose the server’s workload', () => {
    expect(() => parse({ limit: '201' })).toThrow()
    expect(() => parse({ limit: '0' })).toThrow()
    expect(parse({ limit: '200' }).limit).toBe(200)
  })

  it('rejects an inverted point range', () => {
    expect(() => parse({ minPoints: '80', maxPoints: '10' })).toThrow()
    // Equal is a valid range of one.
    expect(parse({ minPoints: '40', maxPoints: '40' }).minPoints).toBe(40)
  })

  it('rejects filters that are meaningless for the kind asked for', () => {
    // Saying so beats quietly returning nothing, which is what an unguarded
    // query against a partial index would do.
    expect(() => parse({ upgradeType: 'OF' })).toThrow()
    expect(() => parse({ kind: 'ship', upgradeType: 'OF' })).toThrow()
    expect(() => parse({ kind: 'ship', unique: 'true' })).toThrow()
    expect(parse({ kind: 'upgrade', upgradeType: 'OF' }).upgradeType).toBe('OF')
  })

  it('rejects a value outside a closed vocabulary', () => {
    expect(() => parse({ sort: 'random' })).toThrow()
    expect(() => parse({ order: 'sideways' })).toThrow()
    expect(() => parse({ kind: 'starfighter' })).toThrow()
  })
})

describe('cardQueryToParams round trip', () => {
  it('reproduces the state it was built from', () => {
    // This is the SPA/API agreement: a filter turned into a link and read back
    // has to be the same filter, or a shared URL narrows to something else.
    const state = parse({
      kind: 'upgrade',
      faction: FACTION_NONE,
      minPoints: '5',
      maxPoints: '50',
      upgradeType: 'OF',
      unique: 'true',
      q: 'veteran',
      sort: 'points',
      order: 'asc',
      limit: '20',
    })

    expect(parse(cardQueryToParams(state))).toEqual(state)
  })

  it('survives a round trip when only defaults are set', () => {
    const state = parse({})
    expect(parse(cardQueryToParams(state))).toEqual(state)
  })

  it('omits nothing that was set, so a link keeps meaning the same', () => {
    const params = cardQueryToParams(parse({ kind: 'upgrade', unique: 'false' }))
    // Notably present as the string "false" rather than dropped as falsy.
    expect(params.unique).toBe('false')
    expect(parse(params).unique).toBe(false)
  })
})
