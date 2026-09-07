// ---------------------------------------------------------------------------
// The closed sets both apps have to agree on. The editor offers exactly these
// and the API rejects anything else before it reaches the database.
//
// Each one is declared once as an `as const` list and turned into a schema; the
// TypeScript type is inferred back off the schema rather than written by hand,
// so the list, the validator and the type cannot drift from one another.
// ---------------------------------------------------------------------------

import { z } from 'zod'

export const FACTIONS = ['Galactic Empire', 'Rebel Alliance'] as const
export const factionSchema = z.enum(FACTIONS)
export type Faction = z.infer<typeof factionSchema>

/** Which of the three printed components a card is. The discriminant of the
 *  card union, and a real column on the table — every list view filters on it. */
export const CARD_KINDS = ['ship', 'squadron', 'upgrade'] as const
export const cardKindSchema = z.enum(CARD_KINDS)
export type CardKind = z.infer<typeof cardKindSchema>

export const BASE_SIZES = ['Small', 'Medium', 'Large'] as const
export const baseSizeSchema = z.enum(BASE_SIZES)
export type BaseSize = z.infer<typeof baseSizeSchema>

/** R = red, U = blue, B = black — matches the letters typed into armament fields. */
export const DICE_LETTERS = ['R', 'U', 'B'] as const
export const diceLetterSchema = z.enum(DICE_LETTERS)
export type DiceLetter = z.infer<typeof diceLetterSchema>

/** An actual token. Squadrons carry a short variable-length list of these. */
export const DEFENSE_TOKENS = ['Brace', 'Redirect', 'Evade', 'Scatter', 'Contain', 'Salvo'] as const
export const defenseTokenSchema = z.enum(DEFENSE_TOKENS)
export type DefenseToken = z.infer<typeof defenseTokenSchema>

/** A ship's slot, which may be empty. Ship cards print exactly four of these and
 *  '—' is how a slot says it holds nothing — distinct from DefenseToken, where
 *  every entry is a token that exists. */
export const EMPTY_DEFENSE_SLOT = '—'
export const DEFENSE_TOKEN_TYPES = [EMPTY_DEFENSE_SLOT, ...DEFENSE_TOKENS] as const
export const defenseTokenTypeSchema = z.enum(DEFENSE_TOKEN_TYPES)
export type DefenseTokenType = z.infer<typeof defenseTokenTypeSchema>

/** Each code is the filename of its icon in assets/icons/upgrades. Used twice:
 *  as a ship card's upgrade slots, and as an upgrade card's own type. */
export const UPGRADE_TYPES = [
  'CO',
  'DR',
  'EX',
  'FC',
  'FS',
  'IC',
  'OD',
  'OF',
  'OR',
  'ST',
  'SW',
  'TU',
  'WT',
] as const
export const upgradeTypeSchema = z.enum(UPGRADE_TYPES)
export type UpgradeType = z.infer<typeof upgradeTypeSchema>

// ---------------------------------------------------------------------------
// Shared field shapes
// ---------------------------------------------------------------------------

/** Dice string syntax: letters R/U/B per die, rows separated by `;`. Empty means
 *  no dice at all. The pattern matches what parseDiceRows accepts, so a string
 *  that validates here is a string the renderer can draw. */
export const DICE_ROWS_PATTERN = /^[RUB]*(?:;[RUB]*)*$/i
export const diceRowsSchema = z
  .string()
  .regex(DICE_ROWS_PATTERN, 'Dice rows are R/U/B letters, rows separated by ";"')

/** Hull is printed from assets/icons/hull, which covers 0–9. A value outside
 *  that range has no icon to render, so it is rejected rather than dropped
 *  silently at paint time. The same reasoning bounds every stat below. */
export const hullSchema = z.int().min(0).max(9)

/** Shields print from assets/icons/shield (1–6); 0 prints nothing at all. */
export const shieldSchema = z.int().min(0).max(6)

/** Command, squadron and engineer values share assets/icons/commandvalues (1–6);
 *  0 is legal and prints blank. */
export const commandValueSchema = z.int().min(0).max(6)

/** Points are a real column, because sorting and filtering a collection by cost
 *  is the first thing any card browser wants to do. */
export const pointsSchema = z.int().min(0)

/** Ability text, with inline markup for the icons and keywords Armada prints
 *  mid-sentence:
 *
 *      "{bomber} {counter:2} While attacking a ship, you may…"
 *
 *  The markup is deliberately in the stored text rather than derived from it,
 *  because it is the one part that cannot be recomputed later — text saved as
 *  plain prose would have to be hand-edited to gain icons.
 *
 *  Pulling a filterable keyword list back out of this is deferred on purpose:
 *  that list is derived data, so it can be backfilled from the text at any
 *  point without touching a single stored card. */
export const KEYWORD_MARKUP_PATTERN = /\{([a-z][a-z0-9-]*)(?::([^}]+))?\}/gi
export const cardTextSchema = z.string()
