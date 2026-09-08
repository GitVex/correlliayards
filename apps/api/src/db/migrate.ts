import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import type { FastifyBaseLogger } from 'fastify'
import { db } from './client.js'

/* The generated SQL lives at apps/api/drizzle, outside src/, so it is not
   something tsc copies or misses — it is read from disk at runtime and the path
   is the same whether this file is running from src/ or dist/. Two levels up
   from either is the app root. */
const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url))

/** Bring the database up to the schema in schema.ts.
 *
 *  Run at boot, before the socket is listening, on the same reasoning as OIDC
 *  discovery in index.ts: a database that is unreachable, or a role that cannot
 *  create its own tables, should stop the process with a clear error rather
 *  than produce a server that accepts requests and fails every one of them.
 *
 *  Drizzle's migrator keeps its own record of what has run in
 *  `drizzle.__drizzle_migrations`, wraps each file in a transaction, and takes
 *  an advisory lock while it works — so two instances starting at once do not
 *  race, which is exactly what happens on a rolling deploy. */
export async function runMigrations(log: FastifyBaseLogger): Promise<void> {
  await migrate(db, { migrationsFolder })
  log.info({ migrationsFolder }, 'database migrations applied')
}
