import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Stage } from '../components/Stage'
import { ExportStage } from '../components/ExportStage'
import { ExportControls } from '../components/ExportControls'
import { Editor } from '../components/Editor'
import type { Faction } from '../components/CardRenderer'
import { TOKEN_SIZE_MM, type BaseSize } from '../components/TokenRenderer'
import { DEFAULT_CARD_DATA, DEFAULT_CARD_NAME, DEFAULT_POINTS, type ShipCardData } from '../cardData'
import { EMPTY_CARD_IMAGES, type CardImageKey, type CardImages } from '../cardImages'
import { DEFAULT_FIRING_ARCS, type FiringArcs } from '../firingArcs'
import { cardJson } from '../cardJson'
import { EXPORT_SCALE } from '../exportPieces'

const MIN_ZOOM = 25
const MAX_ZOOM = 300

export function EditorPage() {
  const [zoom, setZoom] = useState(100)

  /* The card's own identity, minted here rather than handed back by a save.
     A card is editable from the moment the editor opens, so it needs to be
     addressable from that moment too, and its first save is an upsert against
     an id that already exists. */
  const [id] = useState(() => crypto.randomUUID())
  const [name, setName] = useState(DEFAULT_CARD_NAME)
  const [points, setPoints] = useState(DEFAULT_POINTS)

  const [faction, setFaction] = useState<Faction>('Rebel Alliance')
  const [baseSize, setBaseSize] = useState<BaseSize>('Small')
  const [cardData, setCardData] = useState<ShipCardData>(DEFAULT_CARD_DATA)
  const [images, setImages] = useState<CardImages>(EMPTY_CARD_IMAGES)
  const [arcs, setArcs] = useState<FiringArcs>(DEFAULT_FIRING_ARCS)

  /** The two nodes every export reads — see ExportStage.tsx for why they aren't
   *  the ones the preview is showing. */
  const exportCardRef = useRef<HTMLDivElement>(null)
  const exportTokenRef = useRef<HTMLDivElement>(null)

  /** What the copy button last did, so it can say so and then go quiet again. */
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle')

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(cardJson({ id, name, points, faction, baseSize, cardData, arcs }))
      setCopied('done')
    } catch {
      // Blocked clipboard — an insecure origin, or the window not focused. The
      // JSON tab shows the same text, so there is always a way to get at it.
      setCopied('failed')
    }
    window.setTimeout(() => setCopied('idle'), 1600)
  }

  /** Picking or clearing an image frees the object URL the previous one held.
   *
   *  It writes to two places, and this is the only function that does: `images`
   *  holds the object URL the preview paints from and dies with the session,
   *  while `cardData.artwork` holds the file name, which is the part a saved
   *  card keeps. Keeping the single writer here is what stops the two drifting. */
  function setImage(key: CardImageKey, file: File | null) {
    const next = file ? { url: URL.createObjectURL(file), name: file.name } : null
    setImages((prev) => {
      const previous = prev[key]
      if (previous) URL.revokeObjectURL(previous.url)
      return { ...prev, [key]: next }
    })
    setCardData((d) => ({ ...d, artwork: { ...d.artwork, [key]: next?.name ?? null } }))
  }

  return (
    <>
      <div className="workspace">
        <Editor
          id={id}
          name={name}
          setName={setName}
          points={points}
          setPoints={setPoints}
          faction={faction}
          setFaction={setFaction}
          baseSize={baseSize}
          setBaseSize={setBaseSize}
          cardData={cardData}
          setCardData={setCardData}
          images={images}
          setImage={setImage}
          arcs={arcs}
          setArcs={setArcs}
        />

        {/* ===================== PREVIEW ===================== */}
        <section className="preview" aria-label="Preview">
          <Stage
            name={name}
            points={points}
            faction={faction}
            baseSize={baseSize}
            zoom={zoom}
            cardData={cardData}
            images={images}
            arcs={arcs}
            setArcs={setArcs}
          />

          <div className="ptools">
            <div className="zoom" role="group" aria-label="Zoom">
              <input
                className="zoom__range"
                type="range"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={5}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                aria-label="Zoom level"
              />
              <span className="zoom__pct">{zoom}%</span>
            </div>
            <span className="dims">
              card 69 × 89 mm · token {TOKEN_SIZE_MM[baseSize].width} × {TOKEN_SIZE_MM[baseSize].height} mm · export @{' '}
              {EXPORT_SCALE}×
            </span>
            <div className="ptools__spacer" />
            <button className="btn" onClick={copyJson}>
              {copied === 'done' ? 'Copied' : copied === 'failed' ? 'Copy blocked' : 'Copy JSON'}
            </button>
            <ExportControls cardRef={exportCardRef} tokenRef={exportTokenRef} cardName={name} />
          </div>
        </section>
      </div>

      {/* Portalled to the body on purpose, and this is the one thing the routing
          split changed about the editor. The export stage has to sit outside
          `.app`, because `.app` is a clipped 100vh column that the print
          stylesheet hides wholesale — and `.app` is now AppShell's, several
          levels above this page. A portal is what keeps the stage where the
          stylesheet needs it while the page that owns its state stays here. */}
      {createPortal(
        <ExportStage
          cardRef={exportCardRef}
          tokenRef={exportTokenRef}
          name={name}
          points={points}
          faction={faction}
          baseSize={baseSize}
          cardData={cardData}
          images={images}
          arcs={arcs}
        />,
        document.body,
      )}
    </>
  )
}
