import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import {
  CARD_KINDS,
  FACTIONS,
  FACTION_NONE,
  type CardQuery,
  type CardSummary,
} from '@correlliayards/shared'
import { listCards } from '../api/cards'
import { describeError } from '../api/client'
import { formatRelative } from '../format'
import { paths } from '../paths'

/* The filters this page exposes. A subset of what `cardQuerySchema` accepts —
   the points range and the per-kind flags are real parameters and can be added
   here when there is a library big enough to want them.

   They live in the query string rather than in component state, which is the
   reason filtering was built as query parameters on the route in the first
   place: a narrowed list has to be a link you can send someone, bookmark, and
   arrive back at with the Back button. */
const FILTER_KEYS = ['q', 'kind', 'faction', 'sort', 'order'] as const

function queryFromParams(params: URLSearchParams): Partial<CardQuery> {
  const query: Record<string, string> = {}
  for (const key of FILTER_KEYS) {
    const value = params.get(key)
    if (value) query[key] = value
  }
  /* Cast rather than re-validated. The server parses this back through
     cardQuerySchema and answers bad_request for anything it does not recognise,
     so checking here as well would be a second validator that can only disagree
     with the first — and a hand-edited URL is exactly the case where the
     server's answer is the one that matters. */
  return query as Partial<CardQuery>
}

/** The line under a card's name. Each kind has its own thing worth saying at a
 *  glance, which is what the per-kind summary fields exist for. */
function describeRow(row: CardSummary): string {
  const faction = row.faction ?? 'No faction'
  switch (row.kind) {
    case 'ship':
      return `${faction} · hull ${row.hull} · ${row.baseSize.toLowerCase()} base`
    case 'squadron':
      return `${faction} · ${row.squadronType}${row.unique ? ' · unique' : ''}`
    case 'upgrade':
      return `${faction} · ${row.upgradeType}${row.unique ? ' · unique' : ''}`
  }
}

function CardRow({ row }: { row: CardSummary }) {
  return (
    <li className="cardrow">
      {/* No picture, and there cannot be one yet: `thumbnail` is a file name
          rather than a URL, because artwork is read straight off the machine
          into the preview and never uploaded. When uploads land it becomes an
          asset id and this becomes an img. Until then the kind is the more
          useful thing to put in the space. */}
      <span className="cardrow__kind" aria-hidden="true">
        {row.kind.slice(0, 2).toUpperCase()}
      </span>

      <div className="cardrow__main">
        <span className="cardrow__name">{row.name}</span>
        <span className="cardrow__meta">{describeRow(row)}</span>
      </div>

      {row.published && <span className="badge badge--ok">published</span>}

      <span className="cardrow__points" title={`${row.points} points`}>
        {row.points}
      </span>

      <span className="cardrow__when" title={row.updatedAt}>
        {formatRelative(row.updatedAt)}
      </span>
    </li>
  )
}

export function CardsPage() {
  const [params, setParams] = useSearchParams()
  /* The serialised form is the dependency, not the object: URLSearchParams is a
     new instance on every render and would restart the fetch each time. */
  const search = params.toString()

  /* One state object, and it remembers which filters produced it. That is what
     makes "loading" a derived fact — the answer we hold is not for the question
     currently in the URL — rather than a flag set alongside every fetch and
     able to fall out of step with it. It also means the previous page stays on
     screen while the next one is fetched, instead of the list blinking empty
     between two sets of results. */
  type ListState = {
    search: string
    items: CardSummary[]
    cursor: string | null
    failed: string | null
  }

  const [list, setList] = useState<ListState>({ search: '', items: [], cursor: null, failed: null })
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    listCards(queryFromParams(new URLSearchParams(search)), controller.signal).then(
      (page) => setList({ search, items: page.items, cursor: page.nextCursor, failed: null }),
      (err: unknown) => {
        /* An abort is this effect being superseded, not a failure to report. */
        if (controller.signal.aborted) return
        setList({ search, items: [], cursor: null, failed: `Could not load your cards. ${describeError(err)}` })
      },
    )

    return () => controller.abort()
  }, [search])

  const loading = list.search !== search
  const status = loading ? 'loading' : list.failed ? 'error' : 'ready'
  const { items, cursor } = list

  const loadMore = useCallback(async () => {
    if (!cursor) return
    setLoadingMore(true)
    try {
      /* Keyset paging: the cursor encodes the sort it was minted under, so the
         filters have to go with it unchanged rather than being dropped here. */
      const page = await listCards({ ...queryFromParams(new URLSearchParams(search)), cursor })
      setList((prev) =>
        /* Dropped if the filters moved while this was in flight — appending a
           page of the old question onto the answer to a new one would silently
           mix two result sets. */
        prev.search === search
          ? { ...prev, items: [...prev.items, ...page.items], cursor: page.nextCursor }
          : prev,
      )
      setMoreError(null)
    } catch (err) {
      setMoreError(`Could not load more. ${describeError(err)}`)
    } finally {
      setLoadingMore(false)
    }
  }, [cursor, search])

  /** Write one filter into the URL, which is what triggers the refetch.
   *  `replace` so a session of narrowing down does not fill the Back button
   *  with every intermediate state. */
  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(search)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const filtered = FILTER_KEYS.some((key) => params.get(key))

  return (
    <main className="page">
      <div className="page__panel page__panel--wide">
        <header className="cards__head">
          <h1 className="page__title">Your cards</h1>
          <Link className="btn btn--accent" to={paths.editor}>
            New card
          </Link>
        </header>

        <form
          className="filters"
          onSubmit={(e) => {
            e.preventDefault()
            const value = new FormData(e.currentTarget).get('q')
            setFilter('q', typeof value === 'string' ? value.trim() : '')
          }}
        >
          {/* Submitted rather than filtered as you type: every keystroke would
              otherwise be a request, and debouncing that is more machinery than
              a search box over your own cards needs. */}
          <input
            className="field filters__search"
            type="search"
            name="q"
            defaultValue={params.get('q') ?? ''}
            placeholder="Search names…"
            aria-label="Search card names"
          />

          <select
            className="field filters__select"
            value={params.get('kind') ?? ''}
            onChange={(e) => setFilter('kind', e.target.value)}
            aria-label="Card kind"
          >
            <option value="">Any kind</option>
            {CARD_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kind[0].toUpperCase() + kind.slice(1)}
              </option>
            ))}
          </select>

          <select
            className="field filters__select"
            value={params.get('faction') ?? ''}
            onChange={(e) => setFilter('faction', e.target.value)}
            aria-label="Faction"
          >
            <option value="">Any faction</option>
            {FACTIONS.map((faction) => (
              <option key={faction} value={faction}>
                {faction}
              </option>
            ))}
            {/* Not the same as "any": this asks for the cards carrying no
                faction restriction at all. See FACTION_NONE in shared/query.ts. */}
            <option value={FACTION_NONE}>Unrestricted</option>
          </select>

          <select
            className="field filters__select"
            value={`${params.get('sort') ?? 'updatedAt'}:${params.get('order') ?? 'desc'}`}
            onChange={(e) => {
              const [sort, order] = e.target.value.split(':')
              const next = new URLSearchParams(search)
              next.set('sort', sort)
              next.set('order', order)
              setParams(next, { replace: true })
            }}
            aria-label="Sort order"
          >
            <option value="updatedAt:desc">Newest first</option>
            <option value="updatedAt:asc">Oldest first</option>
            <option value="name:asc">Name A–Z</option>
            <option value="name:desc">Name Z–A</option>
            <option value="points:asc">Cheapest first</option>
            <option value="points:desc">Priciest first</option>
          </select>

          {filtered && (
            <button type="button" className="btn btn--quiet" onClick={() => setParams({}, { replace: true })}>
              Clear
            </button>
          )}
        </form>

        {status === 'loading' && <p className="page__note">Loading…</p>}

        {status === 'error' && (
          <p className="page__error" role="alert">
            {list.failed}
          </p>
        )}

        {status === 'ready' && items.length === 0 && (
          /* Two different nothings, and telling them apart is the whole value of
             the empty state: one is a filter to clear, the other is a card to go
             and make. */
          <div className="empty">
            {filtered ? (
              <>
                <p className="page__lead">Nothing matches those filters.</p>
                <button className="btn" onClick={() => setParams({}, { replace: true })}>
                  Clear filters
                </button>
              </>
            ) : (
              <>
                <p className="page__lead">You haven&rsquo;t saved a card yet.</p>
                <Link className="btn btn--accent" to={paths.editor}>
                  Build one
                </Link>
              </>
            )}
          </div>
        )}

        {items.length > 0 && (
          <>
            <ul className="cardlist">
              {items.map((row) => (
                <CardRow key={row.id} row={row} />
              ))}
            </ul>

            {/* Keyset paging, so this is "load the next page" and not "jump to
                page 4" — a cursor over (sort column, id) neither skips nor
                repeats a row when something is edited while you read. */}
            {cursor && (
              <p className="cardlist__more">
                <button className="btn" onClick={() => void loadMore()} disabled={loadingMore}>
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
                {moreError && (
                  <span className="page__error" role="alert">
                    {moreError}
                  </span>
                )}
              </p>
            )}
          </>
        )}
      </div>
    </main>
  )
}
