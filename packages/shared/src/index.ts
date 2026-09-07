/* The contract both apps compile against. This package builds to `dist/`, and
   `main`, `types`, and `exports` all resolve there — the API ships as plain
   compiled JS under node, so it cannot import this file's source the way Vite
   can. The stale-`dist/` hazard that argued against a build step here is real,
   so every root script that builds or runs a consumer rebuilds this package
   first, and `npm run dev-shared` keeps it fresh while you're editing. */

/** Bumped whenever the stored shape of a saved card changes. Every persisted
    blob carries the version it was written under, so a v1 row stays
    distinguishable from a v3 one instead of silently rendering wrong. */
export const SCHEMA_VERSION = 1

/** The envelope the API stores and returns. `data` is the versioned card
    payload; the columns around it are the server's own bookkeeping. */
export interface Resource<T> {
  id: string
  name: string
  schemaVersion: number
  data: T
  createdAt: string
  updatedAt: string
}

export interface User {
  id: string
  name: string
  sub: string
}
