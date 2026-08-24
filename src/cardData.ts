// ---------------------------------------------------------------------------
// The single shared shape of "everything printed on the card." The Editor
// writes to this, CardFace reads it to render the actual card face icons/text.
// ---------------------------------------------------------------------------

/** R = red, U = blue, B = black — matches the letters typed into armament fields. */
export type DiceLetter = 'R' | 'U' | 'B'

/** '—' means "no token in this slot." */
export type DefenseTokenType = '—' | 'Brace' | 'Redirect' | 'Evade' | 'Scatter' | 'Contain' | 'Salvo'

export type UpgradeType = 'CO' | 'DR' | 'EX' | 'FC' | 'FS' | 'IC' | 'OD' | 'OF' | 'OR' | 'ST' | 'SW' | 'TU' | 'WT'

export interface CardData {
  shipClass: string
  variant: string
  /** Artist/source line printed vertically down the left edge of the thumbnail. */
  imageCredit: string
  points: number
  hull: number
  shieldFront: number
  shieldLeft: number
  shieldRight: number
  shieldRear: number
  command: number
  squadron: number
  engineer: number
  /** Always length 4 — one per DT1..DT4 slot on the card. */
  defenseTokens: DefenseTokenType[]
  /** Dice string syntax: letters R/U/B per die, rows separated by `;`. */
  armamentFront: string
  armamentLeft: string
  armamentRight: string
  armamentRear: string
  armamentAntiSquadron: string
  upgrades: UpgradeType[]
  /** Yaw value (0/1/2) per pyramid cell, or null while the field is blank.
   *  A column that is all zeros means the ship simply doesn't have that speed. */
  speed1: (number | null)[]
  speed2: (number | null)[]
  speed3: (number | null)[]
  speed4: (number | null)[]
}

export const DEFAULT_CARD_DATA: CardData = {
  shipClass: 'Lancer-class Pursuit Craft',
  variant: 'Interceptor Refit',
  imageCredit: 'Artist Name',
  points: 48,
  hull: 4,
  shieldFront: 2,
  shieldLeft: 2,
  shieldRight: 2,
  shieldRear: 1,
  command: 1,
  squadron: 3,
  engineer: 2,
  defenseTokens: ['Evade', 'Evade', 'Brace', 'Redirect'],
  armamentFront: 'RU',
  armamentLeft: 'U',
  armamentRight: 'U',
  armamentRear: 'U',
  armamentAntiSquadron: 'UU',
  upgrades: ['OF', 'WT', 'DR'],
  speed1: [0],
  speed2: [0, 0],
  speed3: [0, 0, 0],
  speed4: [0, 0, 0, 0],
}

export const DEFENSE_TOKEN_OPTIONS: DefenseTokenType[] = ['—', 'Brace', 'Redirect', 'Evade', 'Scatter', 'Contain', 'Salvo']

export const UPGRADE_OPTIONS: { value: UpgradeType; label: string }[] = [
  { value: 'OF', label: 'Officer' },
  { value: 'WT', label: 'Weapons Team' },
  { value: 'DR', label: 'Defensive Retrofit' },
  { value: 'OD', label: 'Offensive Retrofit' },
  { value: 'TU', label: 'Turbolaser' },
  { value: 'IC', label: 'Ion Cannon' },
  { value: 'ST', label: 'Support Team' },
  { value: 'OR', label: 'Ordnance' },
  { value: 'FC', label: 'Fleet Command' },
  { value: 'FS', label: 'Fleet Support' },
  { value: 'EX', label: 'Experimental Retrofit' },
  { value: 'SW', label: 'Superweapon' },
  { value: 'CO', label: 'Commander' },
]

/** True once a speed column has at least one real click in it. An all-zero (or
 *  blank) column reads as "this ship has no such speed" — speeds 3 and 4 print
 *  nothing at all in that case, lane art included. */
export function hasSpeedClicks(values: (number | null)[]): boolean {
  return values.some((value) => value !== null && value !== 0)
}

/** "RU;UUB" -> [[R,U],[U,U,B]]. Invalid characters are dropped; blank input -> no rows. */
export function parseDiceRows(input: string): DiceLetter[][] {
  if (!input.trim()) return []
  return input
    .toUpperCase()
    .split(';')
    .map((row) => row.split('').filter((ch): ch is DiceLetter => ch === 'R' || ch === 'U' || ch === 'B'))
}
