import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/* Where the API is while you develop. The dev server and the API are two
   processes on two ports, but the session cookie does not care about ports —
   it cares about origin, and `cy.sid` is HttpOnly and SameSite=Lax. So the
   browser is only ever allowed to see one origin, and the dev server forwards
   the two prefixes the API owns.

   Overridable because not everyone runs the API on 8080, and it is read from
   the process rather than an import.meta.env variable on purpose: this is
   build-time configuration for the dev server, and it must never be inlined
   into the bundle. */
const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:8080'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      /* The OIDC endpoints. `/auth/login` answers with a 302 to Zitadel, which
         the browser follows out of the proxy entirely — which is why the API's
         APP_BASE_URL has to be this dev server's origin and not its own. Set it
         otherwise and Zitadel returns the user to the API's port, where the
         login lands in a session the SPA's origin never asked for. */
      '/auth': { target: apiOrigin },
      /* The data routes. Not used yet — the pages behind them are placeholders
         — but the prefix exists so that when they are, nothing about the origin
         has to change. */
      '/api': { target: apiOrigin },
    },
  },
})
