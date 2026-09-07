# API routes

A plan, not a description. **None of this is built yet** — `apps/api` on this
branch has no source, and the auth routes it refers to live on
`backend-auth-server`. Three of the routes below also depend on model and table
work that hasn't happened; those are listed under [Prerequisites](#prerequisites).

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

Three things these routes need that do not exist yet.

1. **Publishing needs model fields.** `published` and `publishedAt` on the card
   envelope — envelope rather than payload, because the public browse filters on
   them, so by the rule the model already follows they are columns. This means
   editing `packages/shared`.
2. **Collections are an entirely new entity.** A `collections` table plus an
   ordered `collection_cards` join. Nothing about them is modelled.
3. **A shared error envelope.** Every route here can fail, and one agreed shape
   is what gives the SPA typed error handling instead of `catch (e: any)`.

## Cross-cutting

**Ownership is part of every query, not just the id lookup.** `GET
/api/cards/:id` must be `WHERE id = $1 AND owner_sub = $2`. Looking up by id
alone lets any authenticated user read any card they can name, and uuids are not
secret — they turn up in URLs, logs and browser history. The same applies to
`PUT` and `DELETE`: a scoped `WHERE` that matches zero rows is a 404, and that is
the authorisation check.

**Concurrent edits.** Two tabs on one card, or a laptop and a phone later, and
last-write-wins discards one side silently. `updatedAt` is already a natural
version: return it as an `ETag`, have `PUT` honour `If-Match`, and reject a stale
write with 412. Worth deciding early, because adding it later means every client
has to learn to send the header.

**The public routes are the unauthenticated surface** and want their own rate
limit and body limit.

## Notes for the multi-page split

The `/api` prefix above is one half of it. The other half: whatever serves the
SPA needs a catch-all that returns `index.html` for unknown paths so client-side
routes survive a refresh — and that catch-all must not swallow `/api`.

If published links are meant to unfurl in Discord or Slack with a title and
preview image, the public **page** needs server-rendered meta tags. Crawlers do
not run the app's JavaScript, so an SPA shell returns the same empty `<head>` for
every card and every link previews identically. That turns the public surface
from "returns JSON" into "also returns HTML with OG tags," which is far cheaper
to plan for than to retrofit.

## Open questions

- **Public URL shape.** `/c/:uuid`, a slug, or `/c/:uuid/:slug` with the slug
  decorative? The third keeps identity stable when a card is renamed, which is
  the reason to prefer it.
- **Does publishing snapshot or track live?** If a published card is then edited,
  does the public page change? Live is simpler to build; a snapshot is closer to
  what people expect the word "publish" to mean.
- **Do link previews matter?** This is the difference between a JSON-only public
  API and one that also serves HTML.
