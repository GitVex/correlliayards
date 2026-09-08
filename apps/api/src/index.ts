import fastify from 'fastify'
import { config } from './config.js'
import { discoverZitadel } from './routes/auth/oidc.js'
import { pool } from './db/client.js'
import { runMigrations } from './db/migrate.js'
import { registerSession } from './http/session.js'
import { registerAuthRoutes } from './routes/auth/index.js'
import { registerApiRoutes } from './routes/api/index.js'
import { registerDevConsole } from './routes/dev-console.js'

const server = fastify({ logger: true })

/* Note on `request.ip`, which the public rate limit in http/rate-limit.ts keys
   on: it is the socket's peer address unless Fastify is told to trust a proxy.
   Behind Coolify's reverse proxy that peer is the proxy for every caller, so
   the limit would be one shared budget rather than one per client. Turning on
   `trustProxy` fixes that — and must not be turned on until the proxy is known
   to strip inbound X-Forwarded-For, or any caller can claim any address and the
   limit becomes free to evade. Left off deliberately: a shared budget is wrong
   in a way that is merely inconvenient. */

/* Discovery first: if Zitadel is unreachable or misconfigured we want to know
   before the socket is listening, not on the first login. */
const oidc = await discoverZitadel()

/* And the database for the same reason. A server that accepts requests and
   fails every one of them because a migration never ran is worse than one that
   refused to start and said why. */
if (config.database.migrateOnBoot) {
  await runMigrations(server.log)
} else {
  server.log.info('DATABASE_MIGRATE=false; skipping migrations')
  /* Still prove the connection works, so a bad DATABASE_URL fails here rather
     than on the first card someone tries to save. */
  await pool.query('select 1')
}

await registerSession(server)
await registerAuthRoutes(server, oidc)
await registerApiRoutes(server)

server.get('/health', async () => ({ status: 'ok' }))

/* Debugging affordance only — never mounted on a deployed instance. */
if (!config.isProduction) {
  await registerDevConsole(server)
  server.log.warn('dev auth console mounted at /')
}

/* Close the pool on the way out, so in-flight queries finish and Postgres is
   not left holding connections for a process that has gone. Fastify runs this
   after it has stopped accepting requests. */
server.addHook('onClose', async () => {
  await pool.end()
})

/* Without these the container's stop signal kills the process outright: open
   requests are cut off mid-response and the pool never closes. */
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    server.log.info({ signal }, 'shutting down')
    server.close().then(
      () => process.exit(0),
      (err) => {
        server.log.error(err)
        process.exit(1)
      },
    )
  })
}

try {
  await server.listen({ port: config.port, host: '127.0.0.1' })
} catch (err) {
  server.log.error(err)
  process.exit(1)
}
