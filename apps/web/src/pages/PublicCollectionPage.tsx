import { useParams } from 'react-router'
import { Placeholder } from './Placeholder'

export function PublicCollectionPage() {
  const { id, slug } = useParams()

  return (
    <Placeholder
      title="Shared collection"
      lead="Every card in a published collection, whether or not each is published in its own right."
      feeds="GET /api/public/collections/:id"
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
