import { useRef, useState } from 'react'
import './App.css'
import { Topbar } from './components/Topbar'
import { Stage } from './components/Stage'
import { ExportStage } from './components/ExportStage'
import { ExportControls } from './components/ExportControls'
import { Editor } from './components/Editor'
import type { Faction } from './components/CardRenderer'
import { TOKEN_SIZE_MM, type BaseSize } from './components/TokenRenderer'
import { DEFAULT_CARD_DATA, type CardData } from './cardData'
import { EMPTY_CARD_IMAGES, type CardImageKey, type CardImages } from './cardImages'
import { DEFAULT_FIRING_ARCS, type FiringArcs } from './firingArcs'
import { cardJson } from './cardJson'
import { EXPORT_SCALE } from './exportPieces'

const MIN_ZOOM = 25
const MAX_ZOOM = 300

function App() {
  const [zoom, setZoom] = useState(100)
  const [faction, setFaction] = useState<Faction>('Rebel Alliance')
  const [baseSize, setBaseSize] = useState<BaseSize>('Small')
  const [cardData, setCardData] = useState<CardData>(DEFAULT_CARD_DATA)
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
      await navigator.clipboard.writeText(cardJson({ faction, baseSize, cardData, images, arcs }))
      setCopied('done')
    } catch {
      // Blocked clipboard — an insecure origin, or the window not focused. The
      // JSON tab shows the same text, so there is always a way to get at it.
      setCopied('failed')
    }
    window.setTimeout(() => setCopied('idle'), 1600)
  }

  /** Picking or clearing an image frees the object URL the previous one held. */
  function setImage(key: CardImageKey, file: File | null) {
    const next = file ? { url: URL.createObjectURL(file), name: file.name } : null
    setImages((prev) => {
      const previous = prev[key]
      if (previous) URL.revokeObjectURL(previous.url)
      return { ...prev, [key]: next }
    })
  }

  return (
    <>
      <div className="app">
        <Topbar />

        <div className="workspace">
          <Editor
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
              <ExportControls cardRef={exportCardRef} tokenRef={exportTokenRef} shipClass={cardData.shipClass} />
            </div>
          </section>
        </div>
      </div>

      {/* Outside .app on purpose: .app is a clipped 100vh column, and the print
          stylesheet has to be able to hide the whole of it and let this through. */}
      <ExportStage
        cardRef={exportCardRef}
        tokenRef={exportTokenRef}
        faction={faction}
        baseSize={baseSize}
        cardData={cardData}
        images={images}
        arcs={arcs}
      />
    </>
  )
}

export default App
