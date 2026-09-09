import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import './index.css'
import './App.css'
import { routes } from './routes'

/* Browser history, not hashes: these URLs are meant to be pasted, indexed and
   eventually server-rendered for link previews, and a fragment is invisible to
   the server. It costs a catch-all wherever the bundle is served — Caddy's
   `try_files {path} /index.html` in apps/web/Caddyfile, and Vite's dev server
   does the same by default. */
const router = createBrowserRouter(routes)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
