// ---------------------------------------------------------------------------
// Every printed icon in the app, keyed by the value it stands for. Both faces
// read from here — the card and the base token print the same stats, so the
// lookup tables shouldn't be duplicated per face.
// ---------------------------------------------------------------------------

import type { DefenseTokenType, DiceLetter } from './cardData'

const hullModules = import.meta.glob('./assets/icons/hull/*.png', { eager: true, import: 'default' }) as Record<string, string>
export const HULL_ICON: Record<number, string> = {}
for (const path in hullModules) {
  const match = /hull_(\d+)\.png$/.exec(path)
  if (match) HULL_ICON[Number(match[1])] = hullModules[path]
}

const shieldModules = import.meta.glob('./assets/icons/shield/*.png', { eager: true, import: 'default' }) as Record<string, string>
export const SHIELD_ICON: Record<number, string> = {}
for (const path in shieldModules) {
  const match = /shield_(\d+)\.png$/.exec(path)
  if (match) SHIELD_ICON[Number(match[1])] = shieldModules[path]
}

const commandModules = import.meta.glob('./assets/icons/commandvalues/*.png', { eager: true, import: 'default' }) as Record<string, string>
export const COMMAND_VALUE_ICON: Record<number, string> = {}
for (const path in commandModules) {
  const match = /command_(\d+)\.png$/.exec(path)
  if (match) COMMAND_VALUE_ICON[Number(match[1])] = commandModules[path]
}

const diceModules = import.meta.glob('./assets/icons/dice/*.png', { eager: true, import: 'default' }) as Record<string, string>
export const DICE_ICON: Record<DiceLetter, string | undefined> = { R: undefined, U: undefined, B: undefined }
for (const path in diceModules) {
  if (path.includes('dice_red')) DICE_ICON.R = diceModules[path]
  if (path.includes('dice_blue')) DICE_ICON.U = diceModules[path]
  if (path.includes('dice_black')) DICE_ICON.B = diceModules[path]
}

const defenseTokenModules = import.meta.glob('./assets/icons/defensetokens/*.png', { eager: true, import: 'default' }) as Record<string, string>
export const DEFENSE_TOKEN_CODE: Record<Exclude<DefenseTokenType, '—'>, string> = {
  Brace: 'BR', Redirect: 'RE', Evade: 'EV', Scatter: 'SC', Contain: 'CO', Salvo: 'SA',
}
export const DEFENSE_TOKEN_ICON: Record<string, string> = {}
for (const path in defenseTokenModules) {
  const match = /([A-Z]{2})\.png$/.exec(path)
  if (match) DEFENSE_TOKEN_ICON[match[1]] = defenseTokenModules[path]
}

const upgradeModules = import.meta.glob('./assets/icons/upgrades/*.png', { eager: true, import: 'default' }) as Record<string, string>
export const UPGRADE_ICON: Record<string, string> = {}
for (const path in upgradeModules) {
  const match = /([A-Z]{2})\.png$/.exec(path)
  if (match) UPGRADE_ICON[match[1]] = upgradeModules[path]
}

const speedModules = import.meta.glob('./assets/icons/speed/*.png', { eager: true, import: 'default' }) as Record<string, string>
export const YAW_ICON: Record<number, string> = {}
export const SPEED_BG: Record<number, string> = {}
for (const path in speedModules) {
  const yawMatch = /yaw_(\d+)\.png$/.exec(path)
  if (yawMatch) YAW_ICON[Number(yawMatch[1])] = speedModules[path]
  const bgMatch = /speed_(\d+)\.png$/.exec(path)
  if (bgMatch) SPEED_BG[Number(bgMatch[1])] = speedModules[path]
}
