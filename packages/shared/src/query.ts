// ---------------------------------------------------------------------------
// The filter and pagination contract for the two card list endpoints.
//
// Query parameters rather than a search body, because the SPA is going
// multi-page and filter state therefore has to live in a URL that can be
// bookmarked, shared and hit Back. That decision is what makes this a schema
// over strings: everything arrives out of a query string, so every non-string
// field needs a coercion, and the coercions belong next to the shapes rather
// than open-coded in whichever route parsed the request.
//
// The SPA builds the same object and serialises it with `cardQueryToParams`, so
// the two sides cannot disagree about what `faction=none` means.
// ---------------------------------------------------------------------------

import { z } from 'zod'
import { cardKindSchema, factionSchema, upgradeTypeSchema } from './vocabulary.js'

/** What a list can be ordered by. Closed, because each of these is an index and
 *  an unindexed sort column is a sequential scan wearing a nice name. */
export const CARD_SORTS = ['updatedAt', 'points', 'name'] as const
export const cardSortSchema = z.enum(CARD_SORTS)
export type CardSort = z.infer<typeof cardSortSchema>

export const sortOrderSchema = z.enum(['asc', 'desc'])
export type SortOrder = z.infer<typeof sortOrderSchema>

/** `faction=none` asks for cards with no faction restriction.
 *
 *  This has to be a real convention rather than an omitted parameter, because
 *  null in that column means "unrestricted", which is a different question from
 *  "do not filter on faction at all" — and the second is what an absent
 *  parameter already means. Without the sentinel there is no way to ask the
 *  first one. */
export const FACTION_NONE = 'none'

/** Query strings have no booleans. `z.coerce.boolean()` is not the answer: it
 *  is `Boolean(value)`, so the string "false" comes out true. */
const queryBoolean = z.enum(['true', 'false']).transform((v) => v === 'true')

const queryInt = z.coerce.number().int()

const cardQueryFields = z
  .object({
    kind: cardKindSchema.optional(),
    faction: z.union([factionSchema, z.literal(FACTION_NONE)]).optional(),
    minPoints: queryInt.min(0).optional(),
    maxPoints: queryInt.min(0).optional(),
    /** A payload field, served by the partial expression index documented in
     *  upgrade.ts. Only meaningful alongside `kind=upgrade` — see the refine
     *  below, which says so rather than quietly returning nothing. */
    upgradeType: upgradeTypeSchema.optional(),
    /** Also a payload field, and only ships lack it. */
    unique: queryBoolean.optional(),
    /** Name search. A substring match today; it wants a trigram index before it
     *  is pointed at a large table. */
    q: z.string().min(1).max(100).optional(),
    sort: cardSortSchema.default('updatedAt'),
    order: sortOrderSchema.default('desc'),
    /** Capped, because the caller does not get to choose how much work the
     *  server does. 200 is roughly one very long sidebar. */
    limit: queryInt.min(1).max(200).default(50),
    /** Opaque. It encodes the sort it was minted under, so a cursor cannot be
     *  carried across to a different ordering and silently skip rows. */
    cursor: z.string().max(512).optional(),
  })
  .refine(
    (q) => q.minPoints === undefined || q.maxPoints === undefined || q.minPoints <= q.maxPoints,
    { message: 'minPoints must not exceed maxPoints', path: ['minPoints'] },
  )
  .refine((q) => q.upgradeType === undefined || q.kind === 'upgrade', {
    message: 'upgradeType is only meaningful with kind=upgrade',
    path: ['upgradeType'],
  })
  .refine((q) => q.unique === undefined || q.kind !== 'ship', {
    message: 'unique is only meaningful for squadron and upgrade cards',
    path: ['unique'],
  })

/** `?q=&kind=` is what an HTML form submits for untouched inputs, and it should
 *  mean "no filter" rather than "a name that is the empty string". Stripping
 *  empties here keeps that out of both the route and the SPA. */
export const cardQuerySchema = z.preprocess((raw) => {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return raw
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).filter(([, v]) => v !== '' && v !== undefined),
  )
}, cardQueryFields)
export type CardQuery = z.infer<typeof cardQuerySchema>

/** The inverse, for the SPA: a filter state to the parameters that reproduce
 *  it. Whatever is set is emitted, so a link built from a fully-specified state
 *  keeps meaning the same thing if a default ever changes.
 *
 *  Returns a plain record rather than URLSearchParams so this package needs no
 *  DOM lib — `new URLSearchParams(cardQueryToParams(q))` at the call site. */
export function cardQueryToParams(query: Partial<CardQuery>): Record<string, string> {
  const params: Record<string, string> = {}
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue
    params[key] = String(value)
  }
  return params
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

/** Keyset, not offset. A cursor over `(sort column, id)` neither skips nor
 *  repeats a row when something is edited mid-scroll, which is exactly what
 *  OFFSET does the moment the set it is counting into changes underneath it.
 *
 *  `nextCursor` is null on the last page, so "is there more" is a null check
 *  rather than comparing `items.length` against the limit — which gets it wrong
 *  precisely when the last page is exactly full. */
export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  })
}

export interface Page<T> {
  items: T[]
  nextCursor: string | null
}
