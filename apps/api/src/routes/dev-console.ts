import type { FastifyInstance } from 'fastify'

/* A deliberately tiny HTML page whose only job is to be a same-origin document
   you can drive the auth flow from by hand, before any frontend exists.

   It exists because every other route returns JSON, and Firefox renders JSON in
   a built-in viewer document with `default-src 'none'` — console code inherits
   that CSP, so fetch() from there is blocked outright. A real HTML page has no
   such restriction.

   Registered only outside production. It is a debugging affordance, not a
   feature, and it should never be reachable on a deployed instance.

   Note for editing: this is a template literal containing JavaScript, so any
   backslash escape intended for the browser has to survive being unescaped
   once here. The page is written to need none — the status line and the JSON
   body are separate elements rather than one string joined by newlines. */
const PAGE = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>API auth dev console</title>
<style>
  body { font: 14px/1.5 system-ui, sans-serif; max-width: 40rem; margin: 3rem auto; padding: 0 1rem; }
  pre { background: #f4f4f5; padding: 1rem; border-radius: 6px; overflow-x: auto; }
  button, a.btn { font: inherit; padding: .5rem .9rem; border: 1px solid #999; border-radius: 6px;
                  background: #fff; cursor: pointer; text-decoration: none; color: inherit;
                  display: inline-block; }
  .row { display: flex; gap: .5rem; margin-bottom: 1rem; }
  #status { font-family: ui-monospace, monospace; color: #444; }
</style>
<h1>API auth dev console</h1>
<div class="row">
  <a class="btn" href="/auth/login">Log in</a>
  <button id="refresh">Reload /auth/me</button>
  <button id="logout">Log out</button>
</div>
<p id="status">…</p>
<pre id="out"></pre>
<script>
  const statusEl = document.getElementById('status')
  const outEl = document.getElementById('out')

  function render (label, res, body) {
    statusEl.textContent = label + ' -> HTTP ' + res.status
    outEl.textContent = JSON.stringify(body, null, 2)
  }

  async function showMe () {
    const res = await fetch('/auth/me')
    render('GET /auth/me', res, await res.json())
  }

  document.getElementById('refresh').addEventListener('click', showMe)

  document.getElementById('logout').addEventListener('click', async () => {
    const res = await fetch('/auth/logout', { method: 'POST' })
    const body = await res.json()
    render('POST /auth/logout', res, body)
    statusEl.textContent += '  — navigating to end_session…'
    /* The navigation has to be top-level for Zitadel to see its own cookies. */
    setTimeout(() => { location.href = body.logoutUrl }, 700)
  })

  showMe()
</script>
</html>`

export async function registerDevConsole(server: FastifyInstance): Promise<void> {
  server.get('/', async (_request, reply) => {
    reply.header('cache-control', 'no-store')
    return reply.type('text/html; charset=utf-8').send(PAGE)
  })
}
