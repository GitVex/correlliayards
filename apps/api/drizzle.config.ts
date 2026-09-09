import { defineConfig } from 'drizzle-kit'

try {
  process.loadEnvFile('.env.local')
} catch {}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://localhost:5432/postgres',
  },
  verbose: true,
  strict: true,
})
