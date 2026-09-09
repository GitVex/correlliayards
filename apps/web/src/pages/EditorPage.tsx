import { useMemo, useRef, useState } from 'react'
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
import { cardJson, localCard, type EditorState } from '../cardJson'
import { saveCard } from '../api/cards'
import { ApiRequestError, describeError } from '../api/client'
import { useAuth } from '../auth/useAuth'
import { SaveButton } from '../components/SaveButton'
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

  const { refresh } = useAuth()

  /** The card as it would be stored, and the exact text Copy JSON prints. It is
   *  also what "unsaved" is measured against — see `dirty`. */
  const editorState = useMemo<EditorState>(
    () => ({ id, name, points, faction, baseSize, cardData, arcs }),
    [id, name, points, faction, baseSize, cardData, arcs],
  )
  const snapshot = useMemo(() => cardJson(editorState), [editorState])

  /** The serialised card as the server last accepted it, and null until the
   *  first save. Comparing whole documents rather than tracking a dirty flag
   *  per field is what makes an edit-then-undo correctly count as no change —
   *  a flag would still be set, and the button would still be offering to save
   *  something identical to what is already stored. */
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null)
  /** The row's version, for the next save's If-Match. Null before the first
   *  save, when there is no version to be stale against. */
  const [etag, setEtag] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const dirty = snapshot !== savedSnapshot

  async function save() {
    /* Captured before the await, because the editor stays live while the
       request is in flight. Recording what was actually sent — rather than
       whatever the state has become by the time the reply lands — is what makes
       an edit made mid-save correctly leave the button unsaved again. */
    const sent = snapshot

    setSaving(true)
    setSaveError(null)
    try {
      const result = await saveCard(localCard(editorState), etag)
      setEtag(result.etag)
      setSavedSnapshot(sent)
      setJustSaved(true)
      window.setTimeout(() => setJustSaved(false), 1600)
    } catch (err) {
      setSaveError(`Could not save. ${describeError(err)}`)
      /* A 401 means the session ended under us. Re-reading it is what swaps the
         topbar back to Sign in, so the page stops looking signed in. */
      if (err instanceof ApiRequestError && err.code === 'unauthenticated') void refresh()
    } finally {
      setSaving(false)
    }
  }

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(snapshot)
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

          {/* Above the toolbar rather than inside it: .ptools is a single
              non-wrapping row, and a sentence in there would squeeze the zoom
              slider off the end of it. */}
          {saveError && (
            <p className="preview__error" role="alert">
              {saveError}
            </p>
          )}

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
            <SaveButton dirty={dirty} saving={saving} justSaved={justSaved} onSave={() => void save()} />
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
