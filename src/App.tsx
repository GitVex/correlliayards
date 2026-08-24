import { useState } from 'react'
import './App.css'
import { Topbar } from './components/Topbar'
import { Stage } from './components/Stage'
import { Editor } from './components/Editor'
import type { Faction } from './components/CardRenderer'
import { TOKEN_SIZE_MM, type BaseSize } from './components/TokenRenderer'
import { DEFAULT_CARD_DATA, type CardData } from './cardData'
import { EMPTY_CARD_IMAGES, type CardImageKey, type CardImages } from './cardImages'

const MIN_ZOOM = 25
const MAX_ZOOM = 300

function App() {
  const [zoom, setZoom] = useState(100)
  const [faction, setFaction] = useState<Faction>('Galactic Empire')
  const [baseSize, setBaseSize] = useState<BaseSize>('Small')
  const [cardData, setCardData] = useState<CardData>(DEFAULT_CARD_DATA)
  const [images, setImages] = useState<CardImages>(EMPTY_CARD_IMAGES)

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
        />

        {/* ===================== PREVIEW ===================== */}
        <section className="preview" aria-label="Preview">
          <Stage faction={faction} baseSize={baseSize} zoom={zoom} cardData={cardData} images={images} />

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
              card 69 × 89 mm · token {TOKEN_SIZE_MM[baseSize].width} × {TOKEN_SIZE_MM[baseSize].height} mm · export @ 4×
            </span>
            <div className="ptools__spacer" />
            <button className="btn">Copy JSON</button>
          </div>
        </section>
      </div>
    </div>
  )
}

export default App
