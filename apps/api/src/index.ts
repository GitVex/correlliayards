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

const oidc = await discoverZitadel()

if (config.database.migrateOnBoot) {
  await runMigrations(server.log)
} else {
  server.log.info('DATABASE_MIGRATE=false; skipping migrations')
  await pool.query('select 1')
}

await registerSession(server)
await registerAuthRoutes(server, oidc)
await registerApiRoutes(server)

server.get('/health', async () => ({ status: 'ok' }))

if (!config.isProduction) {
  await registerDevConsole(server)
  server.log.warn('dev auth console mounted at /')
}

server.addHook('onClose', async () => {
  await pool.end()
})

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
