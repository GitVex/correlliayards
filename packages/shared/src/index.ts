/* The contract both apps compile against. No build step: `main` and `types`
   point straight at this source, and Vite and tsx transpile it in place. Adding
   a build here would mean a stale `dist/` is the thing the other side imports. */

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
