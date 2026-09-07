import fastify from 'fastify'
import { config } from './config.js'
import { discoverZitadel } from './auth/oidc.js'
import { registerSession } from './plugins/session.js'
import { registerAuthRoutes } from './routes/auth.js'
import { registerDevConsole } from './routes/dev-console.js'

const server = fastify({ logger: true })

/* Discovery first: if Zitadel is unreachable or misconfigured we want to know
   before the socket is listening, not on the first login. */
const oidc = await discoverZitadel()

await registerSession(server)
await registerAuthRoutes(server, oidc)

server.get('/health', async () => ({ status: 'ok' }))

/* Debugging affordance only — never mounted on a deployed instance. */
if (!config.isProduction) {
  await registerDevConsole(server)
  server.log.warn('dev auth console mounted at /')
}

try {
  await server.listen({ port: config.port, host: '127.0.0.1' })
} catch (err) {
  server.log.error(err)
  process.exit(1)
}
