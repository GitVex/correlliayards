# API routes

Built, in `apps/api/src/routes/api`. This file is now both the plan and the
description of what is there: the reasoning below is why each route has the
shape it has, and the code follows it.

The three prerequisites this plan listed are done — see
[Prerequisites](#prerequisites) for what each turned into. Persistence is
Postgres via Drizzle: the tables live in `apps/api/src/db/schema.ts` and the
migrations generated from it in `apps/api/drizzle`.

Written against the domain model in `packages/shared`, and with the eventual
split of the SPA into a multi-page app in mind — user lists on their own page,
and shareable links to published cards and collections.

## Two decisions that shape the rest

**Every data route is prefixed `/api`.** This matters because the SPA is going
multi-page: a page at `/cards` and an API route at `/cards` collide, and that is
much cheaper to avoid now than to untangle later. The existing `/auth/*` and
`/health` stay where they are — they are already distinct.

**Cards are written with `PUT`, not `POST`.** The editor mints the card's uuid,
so a card is addressable before it has ever been saved and create-versus-update
stops being a distinction the client tracks. Saving is therefore idempotent,
which is what you want when an editor autosaves over a flaky connection: a
retried save is harmless.

## Cards

| Route | Purpose |
| --- | --- |
| `GET /api/cards` | Own cards as summaries. Filtering and pagination by query param — see below. |
| `GET /api/cards/:id` | One full card. |
| `PUT /api/cards/:id` | Create or replace. Body is the card without `ownerSub`, `createdAt`, `updatedAt`; a body `id` must match the path or be absent. |
| `DELETE /api/cards/:id` | Delete. |

There is deliberately no `PATCH`. Merging a partial update into a discriminated
union stored as a jsonb document is fiddly, and the editor holds the whole card
anyway. The one case that argues for it is renaming from a list without loading
the card — if that is wanted, the version to write is a narrow `PATCH` limited to
envelope fields (`name`, `points`, `faction`), and it should wait until the list
page actually needs it.

## Assets

Built, in `apps/api/src/routes/api/assets.ts`. Card artwork, stored as bytes in
Postgres rather than named and forgotten.

| Route | Purpose |
| --- | --- |
| `POST /api/assets` | Store one image. Body is the file itself, Content-Type is its type, `?filename=` is what to call it. Returns the metadata; 201 when the bytes are new, 200 when they were already held. |
| `GET /api/assets/:id` | The bytes. Owner-scoped. |

**The id is the SHA-256 of the content.** That gives deduplication, an entity
tag that cannot go stale, and a URL safe to cache forever — all from the same
property, that the bytes cannot change under an id derived from them.

**Ownership is in the primary key**, `(owner_sub, id)`, not a column beside it.
Keying on the digest alone would deduplicate across the whole instance, and a
shared row is an oracle: uploading a file and being told it already existed
tells you somebody else holds that exact file. Keyed this way you deduplicate
within your own library and learn nothing about anyone else's.

**The type is decided by sniffing the content**, never by the Content-Type the
client sent. These bytes are served back from the app's own origin, so a file
the browser decides is HTML would run as the app, with the app's session cookie.
SVG is refused outright for the same reason — it is XML that can carry script.
Responses carry `nosniff` and a `default-src 'none'` CSP as well.

There is deliberately no unauthenticated path yet. Published cards will need
one, but the public card page is still a placeholder, and opening a hole for a
page nobody can reach is the wrong order to do it in. When it lands the question
to answer is whether an asset id is a capability — unguessable, so serve it to
anyone who has it — or whether the route should check that some published card
actually refers to it.

### Orphan collection — needed, not built

**A daily job has to sweep unreferenced assets, and nothing does this yet.**

Pictures are stored the moment they are picked, not when the card is saved. That
is deliberate — it puts the upload where the waiting already is, and it means a
saved card can never refer to bytes the server does not hold — but it produces
garbage as a matter of course, not as an exception:

- picking a picture and then picking a different one,
- picking a picture and closing the tab without ever saving,
- deleting a card, which leaves its artwork behind. No foreign key can prevent
  this: a card names its artwork inside a jsonb document, which nothing can
  reference into.

Nothing collects any of it, so `assets` grows without bound.

The sweep is: delete rows in `assets` older than some grace period whose `id` is
named by no card of the same owner. The grace period matters — an asset is
uploaded seconds before the card that refers to it exists, so a sweep with no
lower bound on age would delete a picture out from under an editor still being
typed into. An hour is generous.

Finding the referenced ids means reading `document -> 'data' -> 'artwork'`
across that owner's cards. Ships have three slots, squadrons two, upgrades one,
and the shapes are in `packages/shared/src/artwork.ts`. At the sizes this table
will see, a nightly full pass per owner is fine; if it ever is not, the fix is a
`card_assets` join table maintained by the card write, which turns the sweep
into an anti-join and is worth doing only once the simple version hurts.

Where it runs is open. The API has no scheduler, so the honest options are a
Coolify scheduled task invoking a small script next to `db/migrate.ts`, or
`pg_cron` in the database. The script is easier to reason about and easier to
run by hand the first few times.

## Collections

| Route | Purpose |
| --- | --- |
| `GET /api/collections` | Own collections. |
| `GET /api/collections/:id` | One collection, with its ordered card summaries. |
| `PUT /api/collections/:id` | Create or replace. Same client-minted-id pattern as cards. |
| `DELETE /api/collections/:id` | Delete the collection. Its cards survive. |
| `PUT /api/collections/:id/cards` | Replace the ordered membership wholesale. |

Membership is replaced rather than edited item by item: one idempotent write
covers add, remove and reorder together, and it matches how the card editor
already works. Per-item `POST`/`DELETE` routes would need a separate reorder
endpoint regardless.

## Publishing

| Route | Purpose |
| --- | --- |
| `POST /api/cards/:id/publish` | Publish. Returns the public URL. |
| `DELETE /api/cards/:id/publish` | Unpublish. |
| `POST /api/collections/:id/publish` | As above, for a collection. |
| `DELETE /api/collections/:id/publish` | |

Kept separate from `PUT` on purpose. Publishing is a visibility decision rather
than a content edit, and an autosave should never be able to toggle it.

## Public

Unauthenticated. This is the surface those shareable links point at.

| Route | Purpose |
| --- | --- |
| `GET /api/public/cards/:id` | A published card. |
| `GET /api/public/collections/:id` | A published collection with its cards. |
| `GET /api/public/cards` | Browse everything published. Optional, but it is what makes publishing worth having. |

An unpublished card returns **404, not 403** — a 403 confirms the id exists,
which is a thing an unauthenticated caller should not be able to learn.

## Filtering

Filtering is query parameters on `GET /api/cards`, not a route of its own. The
deciding reason is the multi-page plan: shareable links mean filter state has to
live in the URL, and a `POST /api/cards/search` cannot be bookmarked, linked or
cached.

```
GET /api/cards?kind=upgrade&faction=none&upgradeType=OR
              &minPoints=0&maxPoints=20&unique=true
              &q=turbolaser&sort=updatedAt&order=desc&limit=50&cursor=…
```

| Param | Notes |
| --- | --- |
| `kind` | `ship` \| `squadron` \| `upgrade`. Column. |
| `faction` | A faction name, or `none` for unrestricted. Column. |
| `minPoints`, `maxPoints` | Column. |
| `upgradeType` | Payload field; served by the partial expression index documented in `upgrade.ts`. Only meaningful with `kind=upgrade`. |
| `unique` | Payload field. |
| `q` | Name search. Wants a trigram index when it lands. |
| `sort`, `order` | `updatedAt` \| `points` \| `name`. |
| `limit`, `cursor` | See pagination. |

`faction=none` has to be a real convention, because null means "unrestricted" and
is a different thing from "do not filter on faction."

Keyword filtering will be a jsonb containment query against a GIN index, once
keyword extraction exists — the markup convention it will read is already
documented on `cardTextSchema`.

### Pagination

Keyset, not offset: a cursor over `(updated_at, id)` does not skip or duplicate
rows when something is edited mid-scroll, which offset does.

```jsonc
{ "items": [ /* CardSummary[] */ ], "nextCursor": "…" | null }
```

## Prerequisites

The three things these routes needed that did not exist. All three are now in
`packages/shared`, which is what lets the SPA name them too.

1. **Publishing model fields.** `published` and `publishedAt` on the card
   envelope, and the same pair on a collection. Columns rather than payload,
   because the public browse filters on them — the rule the model already
   follows. They are absent from `cardWriteSchema` on purpose: publishing is
   its own route, so an autosave cannot toggle it.
2. **Collections.** `collection.ts` in the contract, a `collections` table and
   an ordered `collection_cards` join in the schema. Deleting a collection
   cascades to the membership rows and not to the cards, which is where the
   promise that its cards survive is actually kept.
3. **A shared error envelope.** `errors.ts`, with a closed `code` enum the SPA
   can `switch` on. Installed on the `/api` scope only — `/auth/*` keeps the
   OAuth error shape its client libraries expect.
## Cross-cutting

**Ownership is part of every query, not just the id lookup.** `GET
/api/cards/:id` must be `WHERE id = $1 AND owner_sub = $2`. Looking up by id
alone lets any authenticated user read any card they can name, and uuids are not
secret — they turn up in URLs, logs and browser history. The same applies to
`PUT` and `DELETE`: a scoped `WHERE` that matches zero rows is a 404, and that is
the authorisation check.

**Concurrent edits.** Two tabs on one card, or a laptop and a phone later, and
last-write-wins discards one side silently. `updatedAt` is the version: `PUT`
honours `If-Match` against it and rejects a stale write with 412.

The `ETag` is not that timestamp alone, though, because one tag is doing two
jobs. A write needs a token that moves only when the *content* moves — which is
why publishing deliberately leaves `updatedAt` alone, so publishing in one tab
cannot 412 the next keystroke in another. A read needs a validator that moves
whenever anything *in the body* moves, or a client revalidates, is told 304, and
keeps a stale copy for good.

So the tag is composite — `"<updatedAt>~<the rest>"`. A card adds its publish
state; a collection adds its member count and a hash over its members, because
its body embeds their summaries and those change when a card is deleted,
renamed or published elsewhere. Reads compare the whole tag; `If-Match`
compares only the leading component, so both properties hold at once.

**The public routes are the unauthenticated surface** and want their own rate
limit and body limit.

## Notes for the multi-page split

The SPA now has the router these notes were written for: one route table in
`apps/web/src/routes.tsx`, with the paths it matches named in
`apps/web/src/paths.ts`. `/cards`, `/collections` and both public shapes
resolve, behind placeholder pages that name the route below which will fill
them. Nothing fetches yet.

The `/api` prefix above is one half of it. The other half: whatever serves the
SPA needs a catch-all that returns `index.html` for unknown paths so client-side
routes survive a refresh — and that catch-all must not swallow `/api`. Both hold
already: `apps/web/Caddyfile` ends in `try_files {path} /index.html`, Vite's dev
server does the same by default, and the API is a separate service that is never
handed a page URL.

If published links are meant to unfurl in Discord or Slack with a title and
preview image, the public **page** needs server-rendered meta tags. Crawlers do
not run the app's JavaScript, so an SPA shell returns the same empty `<head>` for
every card and every link previews identically. That turns the public surface
from "returns JSON" into "also returns HTML with OG tags," which is far cheaper
to plan for than to retrofit.

## Open questions

Two of the three are now decided, by having been built one way.

- **Public URL shape.** Settled as `/c/:uuid/:slug`, the third option: the uuid
  resolves and the slug is decorative, so renaming a published card does not
  break a link already in circulation. A collection is `/k/:uuid/:slug` — `k`
  only because `c` was taken, and worth renaming before anything is published.
  Built in `apps/api/src/http/public-url.ts`; nothing parses these back, the
  public routes read the id and ignore the slug.
- **Snapshot or live?** Live. `GET /api/public/cards/:id` reads the same row the
  editor writes, so editing a published card changes the public page. Snapshots
  would mean a second copy of the document and a "republish" action to move it,
  which is a feature and not a detail — worth doing deliberately if the word
  "publish" turns out to mean the other thing to people using it.
- **A published collection shows every card it holds**, whether or not those
  cards are published in their own right. The collection is the unit of
  publication; a shared list that silently omits half its entries is broken in a
  way the person sharing it cannot see. Those cards are still 404 at
  `/api/public/cards/:id` until published individually.
- **Do link previews matter?** Still open, and still the one that decides whether
  the public surface is JSON-only. It is JSON-only today.
