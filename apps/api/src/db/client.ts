import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { config } from '../config.js'
import * as schema from './schema.js'

/* How to talk TLS to Postgres, translated from the three-valued setting in
   config.ts into what node-postgres wants. Kept as a function rather than
   inlined so the exhaustive switch is a compile error if a mode is ever added
   and forgotten here. */
function sslOption(): pg.PoolConfig['ssl'] {
  switch (config.database.ssl) {
    case 'disable':
      return undefined
    case 'no-verify':
      return { rejectUnauthorized: false }
    case 'require':
      return config.database.caCert
        ? { rejectUnauthorized: true, ca: config.database.caCert }
        : { rejectUnauthorized: true }
  }
}

export const pool = new pg.Pool({
  connectionString: config.database.url,
  ssl: sslOption(),
  /* Postgres counts connections, not requests, and the ceiling is the server's
     max_connections shared between every instance of this service. */
  max: config.database.poolMax,
  /* An idle client is a connection the database holds open for nobody. Thirty
     seconds is long enough that a busy service never reconnects, short enough
     that an idle one lets go. */
  idleTimeoutMillis: 30_000,
  /* Fail a request that cannot get a connection rather than queueing it behind
     a database that is down. Without this the pool waits forever and the
     symptom is a hung request with no error logged anywhere. */
  connectionTimeoutMillis: 5_000,
})

/* A pooled client can die between requests — a network blip, a database
   restart, an idle timeout on the server side. node-postgres surfaces that as
   an 'error' event on the pool, and an unhandled 'error' event on an
   EventEmitter takes the process down with it. The pool discards the broken
   client and carries on by itself; all this has to do is not be silent. */
pool.on('error', (err) => {
  console.error('[db] idle client error', err)
})

/** The handle every route uses.
 *
 *  Passing `schema` in is what makes the relational query API and the typed
 *  column references available; the routes here mostly use the query builder,
 *  but the schema is also what lets Drizzle map a jsonb column back to the
 *  `CardDocument` union rather than to `unknown`. */
export const db = drizzle(pool, { schema })

export type Db = typeof db

/** A transaction handle, as handed to the callback of `db.transaction`.
 *
 *  Worth naming, because the helpers in the routes have to accept either this
 *  or `db` — reading a collection is the same query whether or not it is part
 *  of the write that just changed it. */
export type DbExecutor = Db | Parameters<Parameters<Db['transaction']>[0]>[0]
