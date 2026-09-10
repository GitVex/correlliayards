import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { fetchCard } from '../api/cards'
import { describeError } from '../api/client'
import { seedFromCard, type EditorSeed } from '../cardHydration'
import { paths } from '../paths'
import { EditorPage } from './EditorPage'

/** What the last completed load produced, and which id produced it.
 *
 *  Carrying the id means "loading" is a derived fact — what we hold is not for
 *  the card in the URL — rather than a flag set alongside the fetch and able to
 *  fall out of step with it. */
type Loaded = { id: string; seed: EditorSeed | null; error: string | null }

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="page">
      <div className="page__panel">
        <h1 className="page__title">{title}</h1>
        {children}
      </div>
    </main>
  )
}

/** One saved card, open in the editor.
 *
 *  The fetch happens here rather than inside the editor so the editor never has
 *  to render a card it does not have yet. It mounts once, with everything it
 *  needs, and owns the state from then on — see the note on its `seed` prop. */
export function EditCardPage() {
  const { id = '' } = useParams()
  const [loaded, setLoaded] = useState<Loaded | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    fetchCard(id, controller.signal).then(
      ({ card, etag }) => {
        if (card.kind !== 'ship') {
          /* Only ship cards have an editor. Nothing can create the other two
             kinds yet, so this is reachable only by typing an id in by hand —
             but it is a 200 with a card in it, not an error, and saying so is
             cheaper than letting the editor fail on a missing `token`. */
          setLoaded({ id, seed: null, error: `That is a ${card.kind} card, and only ship cards can be edited yet.` })
          return
        }
        setLoaded({ id, seed: seedFromCard(card, etag), error: null })
      },
      (err: unknown) => {
        if (controller.signal.aborted) return
        setLoaded({ id, seed: null, error: `Could not open that card. ${describeError(err)}` })
      },
    )

    return () => controller.abort()
  }, [id])

  if (loaded?.id !== id) {
    return (
      <Panel title="Opening…">
        <p className="page__lead">Fetching the card.</p>
      </Panel>
    )
  }

  if (loaded.error || !loaded.seed) {
    return (
      <Panel title="Can’t open this card">
        <p className="page__lead">{loaded.error}</p>
        <p>
          <Link className="btn" to={paths.cards}>
            Back to your cards
          </Link>
        </p>
      </Panel>
    )
  }

  /* Keyed on the card, so moving from one card to another gives a fresh editor
     rather than pouring the new card into the old one's state. */
  return <EditorPage key={loaded.seed.state.id} seed={loaded.seed} />
}
