import { Link } from 'react-router'
import { paths } from '../paths'

/** Under PublicShell rather than AppShell: a 404 is most often a bad or expired
 *  shared link, so it has to make sense to someone who has never signed in. */
export function NotFoundPage() {
  return (
    <main className="page">
      <div className="page__panel">
        <h1 className="page__title">Nothing at this address</h1>
        <p className="page__lead">
          The link may be mistyped, or it points at something that was unpublished or deleted.
        </p>
        <p>
          <Link className="btn" to={paths.editor}>
            Back to the editor
          </Link>
        </p>
      </div>
    </main>
  )
}
