import { useState, type RefObject } from 'react'
import { exportPdf, exportPngs, printPieces, type PieceNodes } from '../exportPieces'

type Job = 'png' | 'pdf'

/** The three ways a finished card leaves the app. PNG and PDF both have to
 *  rasterise first and can take a second or two, so they report what they're
 *  doing; printing hands straight over to the browser's own dialog. */
export function ExportControls({
  cardRef,
  tokenRef,
  shipClass,
}: {
  cardRef: RefObject<HTMLDivElement | null>
  tokenRef: RefObject<HTMLDivElement | null>
  shipClass: string
}) {
  const [busy, setBusy] = useState<Job | null>(null)
  const [failed, setFailed] = useState<Job | null>(null)

  async function run(job: Job, work: (nodes: PieceNodes, name: string) => Promise<void>) {
    if (busy) return
    setBusy(job)
    setFailed(null)
    try {
      await work({ card: cardRef.current, token: tokenRef.current }, shipClass)
    } catch (error) {
      // Nothing here is recoverable in-app — a failed raster usually means an
      // image the browser refused to inline. Say so on the button and log the
      // reason for anyone with the console open.
      console.error('Export failed', error)
      setFailed(job)
      window.setTimeout(() => setFailed(null), 2600)
    } finally {
      setBusy(null)
    }
  }

  function label(job: Job, idle: string, working: string) {
    if (busy === job) return working
    if (failed === job) return 'Failed'
    return idle
  }

  return (
    <div className="export" role="group" aria-label="Export">
      <button
        className="btn"
        onClick={() => run('png', exportPngs)}
        disabled={busy !== null}
        title="Save the card and the token as two PNGs"
      >
        {label('png', 'PNG', 'Rendering')}
      </button>
      <button
        className="btn"
        onClick={() => run('pdf', exportPdf)}
        disabled={busy !== null}
        title="Build an A4 sheet with both pieces at true size"
      >
        {label('pdf', 'PDF', 'Building')}
      </button>
      <button className="btn" onClick={printPieces} disabled={busy !== null} title="Print both pieces at true size">
        Print
      </button>
    </div>
  )
}
