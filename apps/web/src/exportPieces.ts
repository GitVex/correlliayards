// ---------------------------------------------------------------------------
// Getting the two pieces off the screen and onto paper — as PNGs, as a print
// sheet PDF, or straight to the printer.
//
// Everything here reads the *export stage* (ExportStage.tsx), never the live
// preview. The preview carries a zoom factor and the arc-dragging handles, and
// both would end up baked into the output. The export stage is the same two
// components at 1:1 with the editing chrome styled away.
// ---------------------------------------------------------------------------

import { toBlob, toPng } from 'html-to-image'

/** CSS fixes a millimetre at exactly 96/25.4 px, so a box laid out in mm can be
 *  measured back into mm with no DOM probing. Only holds where nothing scales
 *  the box on its way up the tree — which is the whole reason the export stage
 *  exists outside the zoomed preview. */
const PX_PER_MM = 96 / 25.4

/** Raster factor over CSS pixels. 4x turns the 96dpi layout into ~384dpi, past
 *  what a desk printer resolves and still a file you can email. The preview
 *  toolbar quotes this number, so keep the two in step. */
export const EXPORT_SCALE = 4

/** A4 in mm, and how much of it the sheet keeps clear. The margin has to leave
 *  room for the crop marks, which sit outside the pieces they belong to. */
const PAGE_MM = { width: 210, height: 297 }
const PAGE_MARGIN_MM = 14
/** Gap between the card and the token on the printed sheet. */
const PIECE_GAP_MM = 10

export type PieceKind = 'card' | 'token'

/** The two nodes an export works from. Null while the stage is still mounting. */
export type PieceNodes = Record<PieceKind, HTMLElement | null>

type Piece = {
  kind: PieceKind
  node: HTMLElement
  /** Printed size, taken from the node's own layout rather than restated here —
   *  the card frame and the token frame both get their mm from CSS. */
  widthMm: number
  heightMm: number
}

const PIECE_LABEL: Record<PieceKind, string> = { card: 'Ship card', token: 'Base token' }

function collect(nodes: PieceNodes): Piece[] {
  const pieces: Piece[] = []
  for (const kind of ['card', 'token'] as const) {
    const node = nodes[kind]
    if (!node) continue
    // offsetWidth/Height rather than the fractional bounding rect: the same
    // rounded number then drives both the raster size and the mm the PDF places
    // it at, so the image can never come out stretched. The cost is at most half
    // a pixel — under a tenth of a millimetre on paper.
    pieces.push({
      kind,
      node,
      widthMm: node.offsetWidth / PX_PER_MM,
      heightMm: node.offsetHeight / PX_PER_MM,
    })
  }
  if (pieces.length === 0) throw new Error('Nothing to export — the export stage has not mounted.')
  return pieces
}

/** html-to-image inlines every font and image into the clone it serialises, but
 *  it can only inline what the browser has already finished loading. The export
 *  stage stays mounted for exactly this reason; this just makes sure of it. */
async function ready(pieces: Piece[]) {
  await document.fonts.ready
  await Promise.all(
    pieces.flatMap((piece) =>
      Array.from(piece.node.querySelectorAll('img')).map((img) =>
        // A decode() rejection means a broken source, not a reason to abort the
        // whole export — that image just comes out blank, as it does on screen.
        img.decode().catch(() => undefined),
      ),
    ),
  )
}

/** Options shared by every raster pass. `backgroundColor` is left off for PNGs so
 *  the card's rounded corners stay transparent, and set to white for the PDF,
 *  where a transparent PNG would depend on the reader compositing alpha. */
function rasterOptions(backgroundColor?: string) {
  return { pixelRatio: EXPORT_SCALE, backgroundColor, cacheBust: false }
}

function slugify(name: string) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return slug || 'ship'
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  // Revoking straight away races the download in some browsers; a minute is far
  // longer than any of them need and the blob is freed with the tab regardless.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** One PNG per piece, at EXPORT_SCALE, with transparency kept. */
export async function exportPngs(nodes: PieceNodes, shipClass: string) {
  const pieces = collect(nodes)
  await ready(pieces)
  const name = slugify(shipClass)

  for (const [i, piece] of pieces.entries()) {
    const blob = await toBlob(piece.node, rasterOptions())
    if (!blob) throw new Error(`Could not rasterise the ${piece.kind}.`)
    // Browsers treat a burst of downloads as a popup and drop all but the first.
    // A beat between them is enough to keep both.
    if (i > 0) await new Promise((resolve) => window.setTimeout(resolve, 300))
    download(blob, `${name}-${piece.kind}.png`)
  }
}

/** Four corner marks just outside a piece, so it can be cut out without a rule
 *  crossing the artwork. */
function cropMarks(doc: import('jspdf').jsPDF, x: number, y: number, w: number, h: number) {
  const offset = 1.2
  const length = 3.5
  doc.setDrawColor(140)
  doc.setLineWidth(0.08)
  for (const [cx, dx] of [[x, -1], [x + w, 1]] as const) {
    for (const [cy, dy] of [[y, -1], [y + h, 1]] as const) {
      doc.line(cx + dx * offset, cy, cx + dx * (offset + length), cy)
      doc.line(cx, cy + dy * offset, cx, cy + dy * (offset + length))
    }
  }
}

/** An A4 sheet with both pieces at true physical size and crop marks around
 *  each. jsPDF is loaded on demand — it is several times the size of the app
 *  itself and only a PDF export ever needs it. */
export async function exportPdf(nodes: PieceNodes, shipClass: string) {
  const pieces = collect(nodes)
  await ready(pieces)

  const images = await Promise.all(
    pieces.map((piece) => toPng(piece.node, rasterOptions('#ffffff'))),
  )

  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
  doc.setProperties({ title: shipClass, creator: 'Corellia Yards' })

  const title = shipClass.trim() || 'Ship card'
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(40)
  doc.text(title, PAGE_MARGIN_MM, PAGE_MARGIN_MM)

  // The pieces sit in one centred row. Both fit across A4 even on a large base
  // (69 + 10 + 73.5 mm against 210), so there is no wrapping case to handle.
  const rowWidth = pieces.reduce((sum, p) => sum + p.widthMm, 0) + PIECE_GAP_MM * (pieces.length - 1)
  const top = PAGE_MARGIN_MM + 9
  let x = Math.max(PAGE_MARGIN_MM, (PAGE_MM.width - rowWidth) / 2)

  pieces.forEach((piece, i) => {
    doc.addImage(images[i], 'PNG', x, top, piece.widthMm, piece.heightMm, piece.kind, 'FAST')
    cropMarks(doc, x, top, piece.widthMm, piece.heightMm)
    doc.setFontSize(7)
    doc.setTextColor(130)
    doc.text(PIECE_LABEL[piece.kind], x, top + piece.heightMm + 6.5)
    x += piece.widthMm + PIECE_GAP_MM
  })

  doc.setFontSize(7)
  doc.setTextColor(130)
  doc.text(
    'Print at 100% — turn off "fit to page" or the pieces come out the wrong size.',
    PAGE_MARGIN_MM,
    PAGE_MM.height - PAGE_MARGIN_MM,
  )

  doc.save(`${slugify(shipClass)}.pdf`)
}

/** Straight to the printer. Nothing is rasterised: the print stylesheet hides the
 *  app and unparks the export stage, so the browser prints the real DOM — live
 *  text and full-resolution artwork, which beats anything we could rasterise. */
export function printPieces() {
  window.print()
}
