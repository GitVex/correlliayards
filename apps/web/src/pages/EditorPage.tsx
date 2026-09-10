import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Stage } from '../components/Stage'
import { ExportStage } from '../components/ExportStage'
import { ExportControls } from '../components/ExportControls'
import { Editor } from '../components/Editor'
import type { Faction } from '../components/CardRenderer'
import { TOKEN_SIZE_MM, type BaseSize } from '../components/TokenRenderer'
import { type ShipCardData } from '../cardData'
import { CARD_IMAGE_KEYS, type CardImageKey, type CardImages } from '../cardImages'
import { type FiringArcs } from '../firingArcs'
import type { EditorSeed } from '../cardHydration'
import { cardJson, localCard, type EditorState } from '../cardJson'
import { saveCard } from '../api/cards'
import { uploadAsset } from '../api/assets'
import { ApiRequestError, describeError } from '../api/client'
import { useAuth } from '../auth/useAuth'
import { SaveButton } from '../components/SaveButton'
import { EXPORT_SCALE } from '../exportPieces'

const MIN_ZOOM = 25
const MAX_ZOOM = 300

/** The editor, opened on whatever the seed says — a blank card or a saved one.
 *
 *  The seed is read once, into the initialisers below, and never again: this
 *  component owns the card from the moment it mounts. A caller that wants a
 *  different card mounts a different editor, with `key` set to the card's id.
 *  Feeding a new seed into a live editor through an effect would be the other
 *  way to do it, and it would mean every field could be overwritten underneath
 *  someone mid-keystroke. */
export function EditorPage({ seed }: { seed: EditorSeed }) {
  const [zoom, setZoom] = useState(100)

  /* The card's own identity. Minted by `blankSeed` rather than handed back by a
     save, so a card is addressable from the moment the editor opens and its
     first save is an upsert against an id that already exists; or the id of the
     saved card this was opened from. */
  const [id] = useState(seed.state.id)
  const [name, setName] = useState(seed.state.name)
  const [points, setPoints] = useState(seed.state.points)

  const [faction, setFaction] = useState<Faction>(seed.state.faction)
  const [baseSize, setBaseSize] = useState<BaseSize>(seed.state.baseSize)
  const [cardData, setCardData] = useState<ShipCardData>(seed.state.cardData)
  const [images, setImages] = useState<CardImages>(seed.images)
  const [arcs, setArcs] = useState<FiringArcs>(seed.state.arcs)

  /* Object URLs live until something frees them. While the editor was the only
     page there was, that meant "until the tab closes"; now that you can walk
     back to the card list, it means a leaked picture per pick per visit. Only
     blob: URLs are ours to revoke — a card opened from the server paints from
     ordinary asset URLs, and revoking one of those would do nothing at best. */
  const imagesRef = useRef(images)
  useEffect(() => {
    imagesRef.current = images
  }, [images])
  useEffect(
    () => () => {
      for (const image of Object.values(imagesRef.current)) {
        if (image?.url.startsWith('blob:')) URL.revokeObjectURL(image.url)
      }
    },
    [],
  )

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
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(() =>
    /* A card opened from the server starts clean: what is on screen is exactly
       what is stored, so the Save button has nothing to offer yet. A blank card
       starts dirty, because it has never been saved at all. */
    seed.clean ? cardJson(seed.state) : null,
  )
  /** The row's version, for the next save's If-Match. Null before the first
   *  save, when there is no version to be stale against — and the tag the card
   *  was loaded at when it came from the server. */
  const [etag, setEtag] = useState<string | null>(seed.etag)
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

  /** Which upload is the current one for each slot.
   *
   *  Pick a picture, change your mind, pick another: two requests are now in
   *  flight for one slot and they can land in either order. Without this the
   *  slower first upload would overwrite the second's id and the card would
   *  point at the picture you rejected. Only the newest number counts. */
  const uploadSeq = useRef<Record<CardImageKey, number>>({ thumbnail: 0, schematic: 0, tinycon: 0 })

  /** Picking or clearing an image. Frees the object URL the previous one held,
   *  and — since a picture is stored when it is picked rather than when the
   *  card is saved — starts the upload.
   *
   *  It writes to two places, and this is the only function that does: `images`
   *  is the live browser state around the picture, `cardData.artwork` is the
   *  asset id a saved card keeps. Keeping the single writer here is what stops
   *  the two drifting — and the id is written only once the bytes are actually
   *  stored, so a card can never refer to a picture the server does not have. */
  function setImage(key: CardImageKey, file: File | null) {
    const seq = (uploadSeq.current[key] += 1)

    setImages((prev) => {
      const previous = prev[key]
      if (previous) URL.revokeObjectURL(previous.url)
      return {
        ...prev,
        [key]: file
          ? { url: URL.createObjectURL(file), name: file.name, status: 'uploading', assetId: null }
          : null,
      }
    })

    if (!file) {
      setCardData((d) => ({ ...d, artwork: { ...d.artwork, [key]: null } }))
      return
    }

    void uploadAsset(file).then(
      (asset) => {
        if (uploadSeq.current[key] !== seq) return
        setImages((prev) =>
          prev[key] ? { ...prev, [key]: { ...prev[key], status: 'stored', assetId: asset.id } } : prev,
        )
        setCardData((d) => ({ ...d, artwork: { ...d.artwork, [key]: asset.id } }))
      },
      (err: unknown) => {
        if (uploadSeq.current[key] !== seq) return
        setImages((prev) =>
          prev[key]
            ? { ...prev, [key]: { ...prev[key], status: 'failed', error: describeError(err) } }
            : prev,
        )
        /* The picture stays on screen — it is a local object URL and nothing
           about a failed upload makes it unrenderable. What it must not do is
           leave a reference behind in the card, which would be a promise the
           server cannot keep. */
        setCardData((d) => ({ ...d, artwork: { ...d.artwork, [key]: null } }))
      },
    )
  }

  /** True while any picture is still on its way up. The save waits for it: a
   *  card written now would store a null where an id is seconds away, and then
   *  go dirty again the moment the upload lands. */
  const uploading = CARD_IMAGE_KEYS.some((key) => images[key]?.status === 'uploading')

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
            <SaveButton
              dirty={dirty}
              saving={saving}
              justSaved={justSaved}
              waitingForUploads={uploading}
              onSave={() => void save()}
            />
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
