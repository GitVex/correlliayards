// ---------------------------------------------------------------------------
// The account behind a card. What /auth/me returns, and what cards are owned by.
// ---------------------------------------------------------------------------

import { z } from 'zod'

export const userSchema = z.object({
  usr: z.string().min(1),
  /** The Zitadel subject claim — stable across profile changes, so it is what
   *  rows are keyed on rather than anything the user can edit. */
  sub: z.string().min(1),
  /** ISO 8601, like every other timestamp that crosses the wire. A `Date` here
   *  would be a lie the compiler cannot catch: JSON.parse hands the SPA back a
   *  string, and `.getFullYear()` on it type-checks and then throws. */
  registeredAt: z.iso.datetime(),
})
export type User = z.infer<typeof userSchema>
