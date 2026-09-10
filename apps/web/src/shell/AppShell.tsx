import { Outlet } from 'react-router'
import { Topbar } from '../components/Topbar'

/** The chrome around every page you reach as the person using the tool: the
 *  editor and, once they exist, your own card and collection lists.
 *
 *  `.app` is a clipped 100vh column and the print stylesheet hides the whole of
 *  it, so anything that has to survive printing — the export stage — cannot
 *  live inside this tree. EditorPage portals its copy out to the body for
 *  exactly that reason. */
export function AppShell() {
  return (
    <div className="app">
      <Topbar />
      <Outlet />
    </div>
  )
}
