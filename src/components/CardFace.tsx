import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { getSlotBox } from './CardSlots'
import {
  parseDiceRows,
  type CardData,
  type DiceLetter,
  type DefenseTokenType,
  type UpgradeType,
} from '../cardData'

// ---------------------------------------------------------------------------
// The live card face — reads CardData and paints the real icons/text at the
// positions hand-tuned in CardSlots.tsx (via getSlotBox). Position lives
// there; this file only decides *what* goes in each box and *whether* it
// shows at all.
// ---------------------------------------------------------------------------

const hullModules = import.meta.glob('../assets/icons/hull/*.png', { eager: true, import: 'default' }) as Record<string, string>
const HULL_ICON: Record<number, string> = {}
for (const path in hullModules) {
  const match = /hull_(\d+)\.png$/.exec(path)
  if (match) HULL_ICON[Number(match[1])] = hullModules[path]
}

const shieldModules = import.meta.glob('../assets/icons/shield/*.png', { eager: true, import: 'default' }) as Record<string, string>
const SHIELD_ICON: Record<number, string> = {}
for (const path in shieldModules) {
  const match = /shield_(\d+)\.png$/.exec(path)
  if (match) SHIELD_ICON[Number(match[1])] = shieldModules[path]
}

const commandModules = import.meta.glob('../assets/icons/commandvalues/*.png', { eager: true, import: 'default' }) as Record<string, string>
const COMMAND_VALUE_ICON: Record<number, string> = {}
for (const path in commandModules) {
  const match = /command_(\d+)\.png$/.exec(path)
  if (match) COMMAND_VALUE_ICON[Number(match[1])] = commandModules[path]
}

const diceModules = import.meta.glob('../assets/icons/dice/*.png', { eager: true, import: 'default' }) as Record<string, string>
const DICE_ICON: Record<DiceLetter, string | undefined> = { R: undefined, U: undefined, B: undefined }
for (const path in diceModules) {
  if (path.includes('dice_red')) DICE_ICON.R = diceModules[path]
  if (path.includes('dice_blue')) DICE_ICON.U = diceModules[path]
  if (path.includes('dice_black')) DICE_ICON.B = diceModules[path]
}

const defenseTokenModules = import.meta.glob('../assets/icons/defensetokens/*.png', { eager: true, import: 'default' }) as Record<string, string>
const DEFENSE_TOKEN_CODE: Record<Exclude<DefenseTokenType, '—'>, string> = {
  Brace: 'BR', Redirect: 'RE', Evade: 'EV', Scatter: 'SC', Contain: 'CO', Salvo: 'SA',
}
const DEFENSE_TOKEN_ICON: Record<string, string> = {}
for (const path in defenseTokenModules) {
  const match = /([A-Z]{2})\.png$/.exec(path)
  if (match) DEFENSE_TOKEN_ICON[match[1]] = defenseTokenModules[path]
}

const upgradeModules = import.meta.glob('../assets/icons/upgrades/*.png', { eager: true, import: 'default' }) as Record<string, string>
const UPGRADE_ICON: Record<string, string> = {}
for (const path in upgradeModules) {
  const match = /([A-Z]{2})\.png$/.exec(path)
  if (match) UPGRADE_ICON[match[1]] = upgradeModules[path]
}

const speedModules = import.meta.glob('../assets/icons/speed/*.png', { eager: true, import: 'default' }) as Record<string, string>
const YAW_ICON: Record<number, string> = {}
const SPEED_BG: Record<number, string> = {}
for (const path in speedModules) {
  const yawMatch = /yaw_(\d+)\.png$/.exec(path)
  if (yawMatch) YAW_ICON[Number(yawMatch[1])] = speedModules[path]
  const bgMatch = /speed_(\d+)\.png$/.exec(path)
  if (bgMatch) SPEED_BG[Number(bgMatch[1])] = speedModules[path]
}

/** Row stagger/overlap unit for a dice cluster — roughly one die wide.
 *  Dice themselves are sized by .card-icon--dice in App.css. */
const DICE_MM = 2.3

function boxStyle(key: string, fill: boolean): CSSProperties | null {
  const box = getSlotBox(key)
  if (!box) return null
  return {
    position: 'absolute',
    left: `${box.leftPct}%`,
    top: `${box.topPct}%`,
    width: fill ? `${box.widthPct}%` : undefined,
    height: fill ? `${box.heightPct}%` : undefined,
  }
}

function IconInBox({ slotKey, icon, alt }: { slotKey: string; icon: string | undefined; alt: string }) {
  const style = boxStyle(slotKey, true)
  if (!style || !icon) return null
  return (
    <div className="card-icon-box" style={style}>
      <img src={icon} alt={alt} className="card-icon" />
    </div>
  )
}

/** Renders one arc's dice cluster, anchored in its slot box. Dice keep their true
 *  size while the cluster fits; once it would spill out of the box (e.g. six dice
 *  in a row) the whole cluster is scaled down just enough to fit inside. */
function DiceGroup({ slotKey, dice, rotateRight, rotateLeft }: { slotKey: string; dice: string; rotateRight?: boolean, rotateLeft?: boolean }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const clusterRef = useRef<HTMLDivElement>(null)
  // Mirrors `scale` so the measuring pass can undo the transform it already applied
  // without having to re-run the effect (which would just measure itself in a loop).
  const scaleRef = useRef(1)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const box = boxRef.current
    const cluster = clusterRef.current
    if (!box || !cluster) return;
    const rotate = rotateRight || rotateLeft

    const fit = () => {
      const boxRect = box.getBoundingClientRect()
      const clusterRect = cluster.getBoundingClientRect()
      const applied = scaleRef.current || 1
      // Divide out our own scale to recover the cluster's natural footprint. The
      // 90° rotation on the side arcs swaps which side of the box each dimension
      // has to fit within.
      const naturalW = (rotate ? clusterRect.height : clusterRect.width) / applied
      const naturalH = (rotate ? clusterRect.width : clusterRect.height) / applied
      const availW = rotate ? boxRect.height : boxRect.width
      const availH = rotate ? boxRect.width : boxRect.height
      if (!naturalW || !naturalH || !availW || !availH) return

      // Never scale *up* — dice that already fit stay at their true size.
      const next = Math.min(1, availW / naturalW, availH / naturalH)
      if (Math.abs(next - scaleRef.current) > 0.002) {
        scaleRef.current = next
        setScale(next)
      }
    }

    fit()
    // The box is sized in % of the card art, whose height only settles once the
    // background image has loaded — so re-fit whenever either side resizes.
    const observer = new ResizeObserver(fit)
    observer.observe(box)
    observer.observe(cluster)
    return () => observer.disconnect()
  }, [dice, rotateRight, rotateLeft])

  const style = boxStyle(slotKey, true)
  const rows = parseDiceRows(dice)
  if (!style || rows.length === 0) return null;
  const rotation = rotateLeft ? 'rotate(90deg)' : rotateRight ? 'rotate(-90deg)' : ''

  const transform = [scale < 1 ? `scale(${scale})` : '', rotation]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="card-icon-box" style={style} ref={boxRef}>
      <div
        ref={clusterRef}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          // Keep the cluster at its natural size so the measurement above sees the
          // real overflow instead of a flex-shrunk width.
          flex: '0 0 auto',
          transform: transform || undefined,
        }}
      >
        {rows.map((row, r) => (
          <div
            key={r}
            style={{ display: 'flex', gap: '0.2mm', marginLeft: `${r * (DICE_MM / 2)}mm`, marginTop: r > 0 ? '-.7mm' : 0 }}
          >
            {row.map((letter, i) => (
              <img key={i} src={DICE_ICON[letter]} alt={letter} className="card-icon--dice" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function SpeedBackground({ speed, show }: { speed: 3 | 4; show: boolean }) {
  const style = boxStyle(speed === 3 ? 'speed3background' : 'speed4background', true)
  const icon = SPEED_BG[speed]
  if (!style || !icon || !show) return null
  return <img src={icon} alt={`Speed ${speed} lane`} style={{ ...style, objectFit: 'cover' }} />
}

function SpeedCells({ slotPrefix, values }: { slotPrefix: string; values: (number | null)[] }) {
  return (
    <>
      {values.map((value, i) =>
        value === null ? null : (
          <IconInBox key={i} slotKey={`${slotPrefix}y${i + 1}`} icon={YAW_ICON[value]} alt={`yaw ${value}`} />
        ),
      )}
    </>
  )
}

export function CardFace({ data }: { data: CardData }) {
  const shipClassStyle = boxStyle('shipClass', true)
  const pointsStyle = boxStyle('points', true)

  return (
    <>
      {shipClassStyle && (
        <div style={{ ...shipClassStyle, display: 'flex', alignItems: 'center', color: '#111', fontSize: '3.2mm', fontWeight: 600, overflow: 'hidden' }}>
          {data.shipClass}
        </div>
      )}
      {pointsStyle && (
        <div style={{ ...pointsStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#111', fontSize: '3mm', fontWeight: 700 }}>
          {data.points}
        </div>
      )}

      <IconInBox slotKey="hull" icon={HULL_ICON[data.hull]} alt={`Hull ${data.hull}`} />
      <IconInBox slotKey="shieldFront" icon={SHIELD_ICON[data.shieldFront]} alt={`Shield front ${data.shieldFront}`} />
      <IconInBox slotKey="shieldLeft" icon={SHIELD_ICON[data.shieldLeft]} alt={`Shield left ${data.shieldLeft}`} />
      <IconInBox slotKey="shieldRight" icon={SHIELD_ICON[data.shieldRight]} alt={`Shield right ${data.shieldRight}`} />
      <IconInBox slotKey="shieldRear" icon={SHIELD_ICON[data.shieldRear]} alt={`Shield rear ${data.shieldRear}`} />

      <IconInBox slotKey="command" icon={COMMAND_VALUE_ICON[data.command]} alt={`Command ${data.command}`} />
      <IconInBox slotKey="squadron" icon={COMMAND_VALUE_ICON[data.squadron]} alt={`Squadron ${data.squadron}`} />
      <IconInBox slotKey="engineer" icon={COMMAND_VALUE_ICON[data.engineer]} alt={`Engineer ${data.engineer}`} />

      {data.defenseTokens.map((token, i) => (
        <IconInBox
          key={i}
          slotKey={`DT${i + 1}`}
          icon={token === '—' ? undefined : DEFENSE_TOKEN_ICON[DEFENSE_TOKEN_CODE[token]]}
          alt={token}
        />
      ))}

      <DiceGroup slotKey="armamentFront" dice={data.armamentFront} />
      <DiceGroup slotKey="armamentLeft" dice={data.armamentLeft} rotateLeft />
      <DiceGroup slotKey="armamentRight" dice={data.armamentRight} rotateRight />
      <DiceGroup slotKey="armamentRear" dice={data.armamentRear} />
      <DiceGroup slotKey="armamentAntiSquadron" dice={data.armamentAntiSquadron} />

      {(() => {
        const style = boxStyle('upgradeSlots', true)
        if (!style) return null
        return (
          <div className="card-icon-box" style={{ ...style, flexWrap: 'wrap' }}>
            {data.upgrades.map((upgrade: UpgradeType, i) => (
              <img key={i} src={UPGRADE_ICON[upgrade]} alt={upgrade} className="card-icon" style={{ maxWidth: '14%' }} />
            ))}
          </div>
        )
      })()}

      <SpeedCells slotPrefix="s1" values={data.speed1} />
      <SpeedCells slotPrefix="s2" values={data.speed2} />
      <SpeedBackground speed={3} show={data.speed3.some((v) => v !== null)} />
      <SpeedCells slotPrefix="s3" values={data.speed3} />
      <SpeedBackground speed={4} show={data.speed4.some((v) => v !== null)} />
      <SpeedCells slotPrefix="s4" values={data.speed4} />
    </>
  )
}
