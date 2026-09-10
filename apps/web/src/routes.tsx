import type { RouteObject } from 'react-router'
import { AppShell } from './shell/AppShell'
import { SessionRoute } from './auth/SessionRoute'
import { PublicShell } from './shell/PublicShell'
import { NewCardPage } from './pages/NewCardPage'
import { EditCardPage } from './pages/EditCardPage'
import { CardsPage } from './pages/CardsPage'
import { CollectionsPage } from './pages/CollectionsPage'
import { AccountPage } from './pages/AccountPage'
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
      /* The editor is not behind the gate, and should not be. You can lay out
         a card, export it and copy its JSON without an account; signing in is
         what lets you keep one. Putting a login in front of the thing the site
         is for would be asking for a commitment before showing the work. */
      { index: true, element: <NewCardPage /> },
      {
        element: <SessionRoute />,
        children: [
          { path: paths.cards, element: <CardsPage /> },
          /* Behind the gate with the list, because the card being edited is
             yours — an id that is not returns 404 from the API either way. */
          { path: paths.card, element: <EditCardPage /> },
          { path: paths.collections, element: <CollectionsPage /> },
          { path: paths.account, element: <AccountPage /> },
        ],
      },
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
