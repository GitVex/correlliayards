import { defineConfig } from 'drizzle-kit'

/* The same .env.local the server reads via `node --env-file-if-exists`. Loaded
   here rather than by wrapping the CLI, because drizzle-kit's binary hoists to
   the repo root under npm workspaces — a script that tries to invoke it through
   a path inside apps/api is a script that breaks the first time someone
   reinstalls. This way `drizzle-kit studio` and `push` find DATABASE_URL with
   no wrapper at all.

   Absent in a deployed environment, where the variable is set directly, so a
   missing file is not an error. */
try {
  process.loadEnvFile('.env.local')
} catch {
  /* no .env.local — the environment is expected to carry DATABASE_URL already */
}

/* drizzle-kit's config, used only by the CLI — the server never loads this
   file. `generate` diffs src/db/schema.ts against the snapshot in drizzle/meta
   and writes the SQL; it needs no database, which is why the credentials below
   fall back to a placeholder rather than making `npm run db:generate` require a
   running Postgres.
 *
 * `push` and `studio` do connect, and for those DATABASE_URL must really be
 * set. `push` is a development convenience: it applies the schema directly
 * without writing a migration, so nothing it does is reproducible on another
 * machine. Deployments run the generated migrations at boot instead — see
 * src/db/migrate.ts. */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://localhost:5432/postgres',
  },
  /* No `casing` on purpose. Every column in schema.ts is given its SQL name
     explicitly, so there is nothing to convert — and a conversion rule set here
     would silently become the authority the day someone adds a column without
     one, which is how a rename turns into a migration that drops and recreates
     the wrong thing. */
  verbose: true,
  strict: true,
})
