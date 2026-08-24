import { useId, useState } from 'react'
import type { ReactNode } from 'react'
import { EditorOption } from './EditorOption'
import type { Faction } from './CardRenderer'
import type { BaseSize } from './TokenRenderer'
import { DEFENSE_TOKEN_OPTIONS, UPGRADE_OPTIONS } from '../cardData'
import type { CardData, DefenseTokenType, UpgradeType } from '../cardData'
import type { CardImageKey, CardImages } from '../cardImages'
import { withSplit, type FiringArcs } from '../firingArcs'

type Tab = 'Fields' | 'JSON'
type GroupKey = 'identity' | 'artwork' | 'arcs' | 'defense' | 'armament' | 'command' | 'ability' | 'slots' | 'speed'

function Group({
  title,
  count,
  open,
  onToggle,
  children,
}: {
  title: string
  count: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className="group" data-open={open}>
      <button className="group__head" onClick={onToggle}>
        <span className="group__caret" />
        {title}
        <span className="group__n">{count}</span>
      </button>
      <div className="group__body">{children}</div>
    </div>
  )
}

/** One column of the speed pyramid: `values.length` cells, bottom-aligned, growing upward. */
function SpeedColumn({
  label,
  values,
  onChange,
}: {
  label: string
  values: (number | null)[]
  onChange: (index: number, value: number | null) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: 4 }}>
        {values.map((v, i) => (
          <input
            key={i}
            className="field field--num"
            style={{ width: 32, padding: '4px 2px' }}
            type="number"
            min={0}
            max={2}
            placeholder="–"
            value={v === null ? '' : v}
            onChange={(e) => {
              const raw = e.target.value
              onChange(i, raw === '' ? null : Math.max(0, Math.min(2, Number(raw))))
            }}
          />
        ))}
      </div>
      <span className="quad__cap">{label}</span>
    </div>
  )
}

export function Editor({
  faction,
  setFaction,
  baseSize,
  setBaseSize,
  cardData,
  setCardData,
  images,
  setImage,
  arcs,
  setArcs,
}: {
  faction: Faction
  setFaction: (faction: Faction) => void
  baseSize: BaseSize
  setBaseSize: (baseSize: BaseSize) => void
  cardData: CardData
  setCardData: (updater: (data: CardData) => CardData) => void
  images: CardImages
  setImage: (key: CardImageKey, file: File | null) => void
  arcs: FiringArcs
  setArcs: (updater: (arcs: FiringArcs) => FiringArcs) => void
}) {
  const jsonTabId = useId()

  const [tab, setTab] = useState<Tab>('Fields')

  const [openGroups, setOpenGroups] = useState<Record<GroupKey, boolean>>({
    identity: true,
    artwork: true,
    arcs: true,
    defense: true,
    armament: true,
    command: true,
    ability: true,
    slots: true,
    speed: false,
  })
  const toggleGroup = (key: GroupKey) =>
    setOpenGroups((g) => ({ ...g, [key]: !g[key] }))

  function set<K extends keyof CardData>(key: K, value: CardData[K]) {
    setCardData((d) => ({ ...d, [key]: value }))
  }

  return (
    <section className="editor" aria-label="Card definition">
      <div className="tabs" role="tablist">
        <button
          className="tab"
          role="tab"
          aria-selected={tab === 'Fields'}
          onClick={() => setTab('Fields')}
        >
          Fields<span className="tab__count">24</span>
        </button>
        <button
          className="tab"
          role="tab"
          id={jsonTabId}
          aria-selected={tab === 'JSON'}
          onClick={() => setTab('JSON')}
        >
          JSON<span className="tab__count">61 ln</span>
        </button>
      </div>

      <div className="editor__scroll">
        <Group
          title="Identity"
          count="6 / 6"
          open={openGroups.identity}
          onToggle={() => toggleGroup('identity')}
        >
          <EditorOption kind="text" label="Ship class" value={cardData.shipClass} onChange={(v) => set('shipClass', v)} />
          <EditorOption kind="text" label="Variant" value={cardData.variant} onChange={(v) => set('variant', v)} />
          <EditorOption kind="text" label="Image credit" value={cardData.imageCredit} onChange={(v) => set('imageCredit', v)} />
          <EditorOption
            kind="select"
            label="Faction"
            value={faction}
            choices={['Galactic Empire', 'Rebel Alliance']}
            onChange={(v) => setFaction(v as Faction)}
          />
          <EditorOption
            kind="select"
            label="Base size"
            value={baseSize}
            choices={['Small', 'Medium', 'Large']}
            onChange={(v) => setBaseSize(v as BaseSize)}
          />
          <EditorOption
            kind="number" label="Points" maxWidth={64}
            value={String(cardData.points)}
            onChange={(v) => set('points', Number(v) || 0)}
          />
        </Group>

        <Group
          title="Artwork"
          count="3 images"
          open={openGroups.artwork}
          onToggle={() => toggleGroup('artwork')}
        >
          <p className="lbl" style={{ marginBottom: 8 }}>
            Files stay on this machine — they're read straight into the preview, not uploaded anywhere.
          </p>
          <EditorOption
            kind="file" label="Thumbnail"
            fileName={images.thumbnail?.name}
            onChange={(file) => setImage('thumbnail', file)}
          />
          <EditorOption
            kind="file" label="Schematic"
            fileName={images.schematic?.name}
            onChange={(file) => setImage('schematic', file)}
          />
          <EditorOption
            kind="file" label="Tiny icon"
            fileName={images.tinycon?.name}
            onChange={(file) => setImage('tinycon', file)}
          />
        </Group>

        <Group
          title="Firing arcs"
          count={arcs.split ? '6 handles' : '5 handles'}
          open={openGroups.arcs}
          onToggle={() => toggleGroup('arcs')}
        >
          <p className="lbl" style={{ marginBottom: 8 }}>
            Drag the handles on the base token. The four edge handles are mirrored
            left to right; the pivot slides along the centre axis.
          </p>
          <EditorOption
            kind="checkbox"
            label="Split pivot"
            checked={arcs.split}
            hint="Two pivots: the front boundaries meet at the upper one, the rear at the lower."
            onChange={(checked) => setArcs((prev) => withSplit(prev, checked))}
          />
        </Group>

        <Group
          title="Defense"
          count="6 / 6"
          open={openGroups.defense}
          onToggle={() => toggleGroup('defense')}
        >
          <EditorOption
            kind="number" label="Hull" maxWidth={64}
            value={String(cardData.hull)}
            onChange={(v) => set('hull', Number(v) || 0)}
          />
          <div className="row row--stack" style={{ marginTop: 10 }}>
            <div className="quad">
              <EditorOption kind="number" label="FRONT" compact value={String(cardData.shieldFront)} onChange={(v) => set('shieldFront', Number(v) || 0)} />
              <EditorOption kind="number" label="LEFT" compact value={String(cardData.shieldLeft)} onChange={(v) => set('shieldLeft', Number(v) || 0)} />
              <EditorOption kind="number" label="RIGHT" compact value={String(cardData.shieldRight)} onChange={(v) => set('shieldRight', Number(v) || 0)} />
              <EditorOption kind="number" label="REAR" compact value={String(cardData.shieldRear)} onChange={(v) => set('shieldRear', Number(v) || 0)} />
            </div>
          </div>
          <div className="row row--stack" style={{ marginTop: 12 }}>
            <span className="lbl" style={{ marginBottom: 5 }}>
              Defense tokens
            </span>
            <div className="quad" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
              {cardData.defenseTokens.map((token, i) => (
                <EditorOption
                  key={i}
                  kind="select"
                  compact
                  label={`DT${i + 1}`}
                  value={token}
                  choices={DEFENSE_TOKEN_OPTIONS}
                  onChange={(v) => {
                    const next = [...cardData.defenseTokens] as DefenseTokenType[]
                    next[i] = v as DefenseTokenType
                    set('defenseTokens', next)
                  }}
                />
              ))}
            </div>
          </div>
        </Group>

        <Group
          title="Armament"
          count="5 arcs"
          open={openGroups.armament}
          onToggle={() => toggleGroup('armament')}
        >
          <p className="lbl" style={{ marginBottom: 8 }}>
            R = red, U = blue, B = black. Separate rows with <code>;</code> — e.g. <code>RU;UUB</code>
          </p>
          <EditorOption kind="text" label="Front" value={cardData.armamentFront} onChange={(v) => set('armamentFront', v)} />
          <EditorOption kind="text" label="Left" value={cardData.armamentLeft} onChange={(v) => set('armamentLeft', v)} />
          <EditorOption kind="text" label="Right" value={cardData.armamentRight} onChange={(v) => set('armamentRight', v)} />
          <EditorOption kind="text" label="Rear" value={cardData.armamentRear} onChange={(v) => set('armamentRear', v)} />
          <div style={{ marginTop: 9, paddingTop: 9, borderTop: '1px solid var(--rule)' }}>
            <EditorOption kind="text" label="Anti-squadron" value={cardData.armamentAntiSquadron} onChange={(v) => set('armamentAntiSquadron', v)} />
          </div>
        </Group>

        <Group
          title="Command"
          count="3 / 3"
          open={openGroups.command}
          onToggle={() => toggleGroup('command')}
        >
          <div className="quad" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
            <EditorOption kind="number" label="COMMAND" compact value={String(cardData.command)} onChange={(v) => set('command', Number(v) || 0)} />
            <EditorOption kind="number" label="SQUADRON" compact value={String(cardData.squadron)} onChange={(v) => set('squadron', Number(v) || 0)} />
            <EditorOption kind="number" label="ENGINEER" compact value={String(cardData.engineer)} onChange={(v) => set('engineer', Number(v) || 0)} />
          </div>
        </Group>

        <Group
          title="Ability text"
          count="112 ch"
          open={openGroups.ability}
          onToggle={() => toggleGroup('ability')}
        >
          <textarea
            className="field"
            defaultValue="While attacking a squadron, you may reroll 1 die. If the defender is engaged, you may reroll 2 dice instead."
          />
        </Group>

        <Group
          title="Upgrade slots"
          count={String(cardData.upgrades.length)}
          open={openGroups.slots}
          onToggle={() => toggleGroup('slots')}
        >
          {cardData.upgrades.map((upgrade, i) => (
            <div key={i} className="row" style={{ gridTemplateColumns: '1fr 26px' }}>
              <select
                className="field"
                value={upgrade}
                onChange={(e) => {
                  const next = [...cardData.upgrades]
                  next[i] = e.target.value as UpgradeType
                  set('upgrades', next)
                }}
              >
                {UPGRADE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <button
                className="chip"
                title="Remove slot"
                onClick={() => set('upgrades', cardData.upgrades.filter((_, idx) => idx !== i))}
              >
                ×
              </button>
            </div>
          ))}
          <button
            className="chip chip--add"
            onClick={() => set('upgrades', [...cardData.upgrades, UPGRADE_OPTIONS[0].value])}
          >
            + add
          </button>
        </Group>

        <Group
          title="Speed chart"
          count="4 speeds"
          open={openGroups.speed}
          onToggle={() => toggleGroup('speed')}
        >
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', justifyContent: 'center', paddingTop: 4 }}>
            <SpeedColumn
              label="1" values={cardData.speed1}
              onChange={(i, v) => { const next = [...cardData.speed1]; next[i] = v; set('speed1', next) }}
            />
            <SpeedColumn
              label="2" values={cardData.speed2}
              onChange={(i, v) => { const next = [...cardData.speed2]; next[i] = v; set('speed2', next) }}
            />
            <SpeedColumn
              label="3" values={cardData.speed3}
              onChange={(i, v) => { const next = [...cardData.speed3]; next[i] = v; set('speed3', next) }}
            />
            <SpeedColumn
              label="4" values={cardData.speed4}
              onChange={(i, v) => { const next = [...cardData.speed4]; next[i] = v; set('speed4', next) }}
            />
          </div>
        </Group>
      </div>

      <div className="flags">
        <div className="flag">
          <span className="flag__tag">CHECK</span>
          <span className="flag__msg">
            Anti-squadron total is <b>4 dice</b> — 1 above the highest small-base
            ship in the core set. Compare against the other variant before locking
            points.
          </span>
        </div>
      </div>
    </section>
  )
}
