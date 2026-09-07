// ---------------------------------------------------------------------------
// The editor's door onto the ship-card contract. The shape itself now lives in
// @correlliayards/shared, because the API has to name it too in order to store
// and validate it. What stays here is what only the SPA needs: the starting
// card, the picker lists with their display labels, and the helpers CardFace
// and Editor render by.
// ---------------------------------------------------------------------------

import {
  DEFENSE_TOKEN_TYPES,
  type DefenseTokenType,
  type DiceLetter,
  type ShipCardData,
  type UpgradeType,
} from '@correlliayards/shared'

/* Re-exported so every component that already imports these from here keeps
   working, and so there stays one obvious place to look from inside the SPA. */
export type { DefenseTokenType, DiceLetter, ShipCardData, UpgradeType }

/* The card's title and cost sit on the envelope rather than in its payload —
   every kind has them, and a list view reads them without opening the document —
   so they get their own defaults out here. For a ship card the title *is* the
   ship class, which is why there is no separate `shipClass` field any more. */
export const DEFAULT_CARD_NAME = 'CR90 Corvette Flak'
export const DEFAULT_POINTS = 44

export const DEFAULT_CARD_DATA: ShipCardData = {
  imageCredit: 'Artist Name',
  /* Filenames of the artwork that has been picked, kept in step with the live
     object URLs by App's setImage — see the note there. */
  artwork: { thumbnail: null, schematic: null, tinycon: null },
  hull: 4,
  shieldFront: 2,
  shieldLeft: 2,
  shieldRight: 2,
  shieldRear: 1,
  command: 1,
  squadron: 1,
  engineer: 2,
  defenseTokens: ['Evade', 'Evade', 'Redirect', '—'],
  armamentFront: 'UU',
  armamentLeft: 'UB',
  armamentRight: 'BU',
  armamentRear: 'UU',
  armamentAntiSquadron: 'BU',
  upgrades: ['OF', 'ST', 'DR', 'TU'],
  speed1: [2],
  speed2: [1, 2],
  speed3: [0, 1, 2],
  speed4: [0, 1, 1, 2],
}

/** The dropdown offers exactly the set the API validates against, in the order
 *  the shared list declares them — one list, so the editor cannot offer a token
 *  the server will reject. */
export const DEFENSE_TOKEN_OPTIONS: readonly DefenseTokenType[] = DEFENSE_TOKEN_TYPES

/** Each code is the filename of its icon in assets/icons/upgrades — that glob is
 *  the whole of UPGRADE_ICON, so a code and its artwork have to agree here. The
 *  codes are contract and live in shared; the labels are UI copy and live here. */
export const UPGRADE_OPTIONS: { value: UpgradeType; label: string }[] = [
  { value: 'OF', label: 'Officer' },
  { value: 'WT', label: 'Weapons Team' },
  { value: 'DR', label: 'Defensive Retrofit' },
  { value: 'OR', label: 'Offensive Retrofit' },
  { value: 'TU', label: 'Turbolaser' },
  { value: 'IC', label: 'Ion Cannon' },
  { value: 'ST', label: 'Support Team' },
  { value: 'OD', label: 'Ordnance' },
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

/** How many speeds the ship has. Speeds 1 and 2 are always printed; 3 and 4 only
 *  once they hold a click — the same rule CardFace renders the pyramid by, so the
 *  editor's count and the printed card can't disagree. */
export function speedCount(data: ShipCardData): number {
  return 2 + (hasSpeedClicks(data.speed3) ? 1 : 0) + (hasSpeedClicks(data.speed4) ? 1 : 0)
}

/** "RU;UUB" -> [[R,U],[U,U,B]]. Invalid characters are dropped; blank input -> no rows. */
export function parseDiceRows(input: string): DiceLetter[][] {
  if (!input.trim()) return []
  return input
    .toUpperCase()
    .split(';')
    .map((row) => row.split('').filter((ch): ch is DiceLetter => ch === 'R' || ch === 'U' || ch === 'B'))
}
