import type { ReactNode } from 'react'

/** What a route renders before the page behind it exists.
 *
 *  Every planned URL resolves from the day the router lands, which is the point
 *  of doing the split before the pages: a link can be followed, a refresh lands
 *  somewhere, and the shell around each page is already the right one. Each of
 *  these says what will fill it and which route in `docs/api-routes.md` feeds
 *  it, so the next person picking one up starts from the plan rather than
 *  guessing at it. */
export function Placeholder({
  title,
  lead,
  feeds,
  children,
}: {
  title: string
  /** One line on what this page is for, in the app's own voice. */
  lead: string
  /** The API route this page will read, verbatim, so it can be grepped for. */
  feeds: string
  children?: ReactNode
}) {
  return (
    <main className="page">
      <div className="page__panel">
        <h1 className="page__title">{title}</h1>
        <p className="page__lead">{lead}</p>
        {children}
        <p className="page__feeds">
          <span className="page__feeds-label">Not built yet — will read</span>
          <code>{feeds}</code>
        </p>
      </div>
    </main>
  )
}
