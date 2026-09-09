import { createContext } from 'react'
import type { Session } from './session'

export type AuthValue = {
  /** `undefined` only before the first `/auth/me` has answered. Distinct from
   *  every value of Session, so a screen can tell "still asking" from "asked,
   *  and the answer was no". */
  session: Session | undefined
  /** Re-read `/auth/me`. Worth calling after anything that could have ended the
   *  session out from under the page — a 401 from a data route, above all. */
  refresh: () => Promise<void>
  /** Ends this session, then navigates to Zitadel to end its one. Resolves only
   *  if it failed; on success the page is already on its way elsewhere. */
  logOut: () => Promise<void>
  /** A logout that did not happen, in words a person can read. Cleared by the
   *  next attempt. */
  logOutError: string | null
  /** A logout is in flight — the button that started it should say so. */
  loggingOut: boolean
}

/* No default value. A `useAuth` outside the provider is a wiring bug, and the
   hook says so rather than handing back a plausible-looking anonymous session
   that would render a Sign in button forever. */
export const AuthContext = createContext<AuthValue | null>(null)
