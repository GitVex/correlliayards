// ---------------------------------------------------------------------------
// Who you are, which is two questions with two different answers.
//
// `SessionUser` is a cache of Zitadel's data. Every field but the subject is a
// claim, which means Zitadel owns it, this app cannot edit it, and what we hold
// is only as fresh as the last time we asked. `Account` is the row we keep
// ourselves, and it is authoritative — nobody else has an opinion about when
// someone first used Corellia Yards.
//
// They are separate rather than flattened into one object on purpose. The
// distinction is not academic: it tells a screen which fields it may offer to
// edit (none of the first set), and which ones can be quietly stale (all of
// them). Merged, that is invisible.
//
// Note what is *not* here: tokens. They stay on the API. A BFF that lets its
// access token reach the browser has thrown away the reason it exists.
// ---------------------------------------------------------------------------

import { z } from 'zod'

/** The identity `/auth/me` reports, distilled from the OIDC claims.
 *
 *  Everything but `sub` is optional because claims are. A Zitadel user with no
 *  surname set produces a token with no `name` in it, and that is an ordinary
 *  state rather than an error — which is why the account page draws "not set"
 *  instead of refusing to render. */
export const sessionUserSchema = z.object({
  /** The subject claim. Stable across profile edits — a rename or a new email
   *  does not move it — which is why every row is keyed on this and not on
   *  anything a person can change about themselves. */
  sub: z.string().min(1),
  name: z.string().optional(),
  /** Left as a bare string rather than `z.email()`. The format is Zitadel's to
   *  vouch for, and being stricter here than the identity provider is only a
   *  way to reject a real user's real address. */
  email: z.string().optional(),
  /** Tri-state, and the third state is meaningful: absent means the provider
   *  did not say, which is a different claim about a mailbox than `false`. */
  emailVerified: z.boolean().optional(),
  preferredUsername: z.string().optional(),
  /** Avatar URL. Validated as a url — unlike the email, this one ends up in an
   *  `<img src>`, so "is it even a url" is worth knowing before it gets there. */
  picture: z.url().optional(),
})
export type SessionUser = z.infer<typeof sessionUserSchema>

/** The row this app keeps about a person, which is deliberately almost nothing.
 *
 *  Its whole reason for existing is that "registered at" is not an OIDC claim
 *  and never will be — there is no standard claim for when an account was
 *  created, and `auth_time` answers a different question (when this login
 *  happened). Asking Zitadel's management API for its creation date would be
 *  the other option, and the wrong one: it needs an administrative credential,
 *  and it answers "when did this Zitadel account appear", which is not the
 *  question a person means when they read *member since* on our page. */
export const accountSchema = z.object({
  sub: z.string().min(1),
  /** First time we saw this subject complete a login. */
  registeredAt: z.iso.datetime(),
  /** Most recent one. Cheap to keep, and the only way to answer "is this
   *  account still in use" without reading every card it owns. */
  lastSeenAt: z.iso.datetime(),
})
export type Account = z.infer<typeof accountSchema>

/** The body of `GET /auth/me`. */
export const meResponseSchema = z.object({
  user: sessionUserSchema,
  account: accountSchema,
})
export type MeResponse = z.infer<typeof meResponseSchema>
