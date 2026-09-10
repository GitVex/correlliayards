import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AuthContext, type AuthValue } from './AuthContext'
import { fetchSession, requestLogout, type Session } from './session'

/** Asks `/auth/me` once on mount and holds the answer for the whole app.
 *
 *  One request, not one per screen: the topbar, the route guards and the
 *  account page all want the same fact, and three components each fetching it
 *  would give three answers that disagree while they are in flight. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | undefined>(undefined)
  const [logOutError, setLogOutError] = useState<string | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)

  const refresh = useCallback(async () => {
    const next = await fetchSession()
    setSession(next)
  }, [])

  useEffect(() => {
    /* StrictMode mounts effects twice in development, so this runs twice. The
       abort is not about the wasted GET — it is idempotent and cheap — but
       about the second unmount landing a setState from the first request. */
    const controller = new AbortController()
    fetchSession(controller.signal).then(
      (next) => {
        if (!controller.signal.aborted) setSession(next)
      },
      () => {
        /* fetchSession only rejects if it was aborted; a real failure comes
           back as { status: 'unreachable' }. Nothing to do either way. */
      },
    )
    return () => controller.abort()
  }, [])

  const logOut = useCallback(async () => {
    setLoggingOut(true)
    setLogOutError(null)
    try {
      const { logoutUrl } = await requestLogout()
      /* assign, not the router: this leaves the app for Zitadel's domain, which
         client-side routing cannot reach. Zitadel sends the browser back to the
         API's configured post-logout URI once its SSO session is gone. */
      window.location.assign(logoutUrl)
      /* Deliberately left `loggingOut`. The navigation is already committed, and
         flipping the button back to "Log out" in the moment before the page goes
         away just looks like the click did nothing. */
    } catch (err) {
      setLoggingOut(false)
      setLogOutError(err instanceof Error ? err.message : 'Logout failed')
      /* Our session may well have been destroyed before whatever failed, so the
         cached answer here cannot be trusted any more. */
      void refresh()
    }
  }, [refresh])

  const value = useMemo<AuthValue>(
    () => ({ session, refresh, logOut, logOutError, loggingOut }),
    [session, refresh, logOut, logOutError, loggingOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
