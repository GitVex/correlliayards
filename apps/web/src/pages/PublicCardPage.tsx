import { useParams } from 'react-router'
import { Placeholder } from './Placeholder'

/** A shared card, as whoever was sent the link sees it. Unauthenticated: the
 *  public API route it will read takes no session, and an unpublished card
 *  answers 404 rather than 403 so that a stranger cannot learn the id exists. */
export function PublicCardPage() {
  /* The slug is read only to show that it is ignored. The uuid resolves the
     card; the slug is decoration carried along so the link says what it points
     at, and it is free to be stale — renaming a published card does not break a
     link already in circulation. */
  const { id, slug } = useParams()

  return (
    <Placeholder
      title="Shared card"
      lead="The read-only view of one published card, with its base token."
      feeds="GET /api/public/cards/:id"
    >
      <dl className="page__params">
        <dt>id</dt>
        <dd>
          <code>{id}</code>
        </dd>
        <dt>slug</dt>
        <dd>
          <code>{slug ?? '—'}</code> <span className="page__note">decorative; nothing resolves from it</span>
        </dd>
      </dl>
    </Placeholder>
  )
}
