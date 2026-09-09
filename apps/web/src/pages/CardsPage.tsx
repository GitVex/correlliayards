import { Placeholder } from './Placeholder'

export function CardsPage() {
  return (
    <Placeholder
      title="Your cards"
      lead="Everything you have saved, newest first, with the filters that narrow it down."
      feeds="GET /api/cards"
    >
      {/* The filter state belongs in the query string rather than in component
          state — a filtered list has to be linkable and bookmarkable, which is
          the reason filtering was built as query params on the route instead of
          a search endpoint. `useSearchParams` is what reads them. */}
      <p className="page__lead">
        Filters — kind, faction, points, upgrade type, name — live in this page&rsquo;s query string, so a narrowed list
        is a link you can send someone.
      </p>
    </Placeholder>
  )
}
