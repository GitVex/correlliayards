import type { RouteObject } from 'react-router'
import { AppShell } from './shell/AppShell'
import { PublicShell } from './shell/PublicShell'
import { EditorPage } from './pages/EditorPage'
import { CardsPage } from './pages/CardsPage'
import { CollectionsPage } from './pages/CollectionsPage'
import { PublicCardPage } from './pages/PublicCardPage'
import { PublicCollectionPage } from './pages/PublicCollectionPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { paths } from './paths'

/* Two layouts, not one, and the split is the point of the route table rather
 * than a detail of it. The editor and your own lists are the signed-in tool and
 * share its chrome; a shared link is a page for someone who has never seen the
 * tool, and handing them a card-type switch and a "your cards" nav would be
 * giving them controls that do nothing for them.
 *
 * Every page is imported eagerly for now. The place to split the bundle is the
 * `lazy` field on these route objects, and the split worth making is the public
 * pair: they have no reason to carry jspdf and html-to-image, which today are
 * pulled in by the editor's export controls and so land in the one shared
 * chunk. Worth doing when those pages render something real. */
export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { index: true, element: <EditorPage /> },
      { path: paths.cards, element: <CardsPage /> },
      { path: paths.collections, element: <CollectionsPage /> },
    ],
  },
  {
    element: <PublicShell />,
    children: [
      { path: paths.publicCard, element: <PublicCardPage /> },
      { path: paths.publicCollection, element: <PublicCollectionPage /> },
      /* The catch-all sits inside the public layout deliberately — see
         NotFoundPage. It matches anything the routes above did not, which in
         the deployed app means anything Caddy's `try_files` handed the shell
         instead of a file. */
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
