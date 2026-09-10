import { Outlet } from 'react-router'
import { RequireSession } from './RequireSession'

/** RequireSession as a layout route, so the route table can say "everything
 *  below this line needs a session" once instead of per page. */
export function SessionRoute() {
  return (
    <RequireSession>
      <Outlet />
    </RequireSession>
  )
}
