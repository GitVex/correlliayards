import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { config } from '../config.js'
import * as schema from './schema.js'

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
  max: config.database.poolMax,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})

pool.on('error', (err) => {
  console.error('[db] idle client error', err)
})

export const db = drizzle(pool, { schema })

export type Db = typeof db

export type DbExecutor = Db | Parameters<Parameters<Db['transaction']>[0]>[0]
