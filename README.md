# Corellia Yards

A layout tool for custom *Star Wars: Armada* components. You fill in a ship's
stats on the left, and the right-hand stage renders the printable ship card and
its matching base token live, at true physical size (69 × 89 mm card, base
tokens per size class). The same definition can be read back out as JSON.

## Stack

TypeScript throughout, in an npm workspaces monorepo. `packages/shared` holds
the domain schemas and is imported by both apps; it builds to `dist/`, and every
entry script builds it first.

### apps/api — Fastify service

| Package | Used for |
| --- | --- |
| `fastify` | HTTP server and routing. |
| `@fastify/session` | Server-side session store behind the `cy.sid` cookie. |
| `@fastify/cookie` | Cookie parsing, required by the session plugin. |
| `openid-client` | OIDC authorization code flow with PKCE against Zitadel. |
| `drizzle-orm` | Table definitions in `src/db/schema.ts`, and all query building. |
| `drizzle-kit` | Generates the SQL migrations in `apps/api/drizzle`. Dev dependency. |
| `pg` | Postgres driver and connection pool. |
| `zod` | Validates request bodies and query strings at the route boundary. |
| `@correlliayards/shared` | Domain schemas and types. |

### apps/web — React SPA

| Package | Used for |
| --- | --- |
| `react`, `react-dom` | UI. |
| `vite`, `@vitejs/plugin-react` | Dev server and bundler. |
| `html-to-image` | Renders the card and token DOM to PNG for export. |
| `jspdf` | Lays exported images out as a printable PDF with crop marks. |
| `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh` | Linting. |
| `@correlliayards/shared` | Domain types. |

### packages/shared

| Package | Used for |
| --- | --- |
| `zod` | Every domain shape is a Zod schema, with its TypeScript type inferred from it. |

### Services

| Service | Used for |
| --- | --- |
| PostgreSQL | Cards and collections. Queried fields are columns; each card’s payload is one `jsonb` document. |
| Zitadel | OIDC provider. The API is a confidential client, holds the tokens server-side, and gives the browser a session cookie. |
| Coolify | Hosts the deployed API and provisions the Postgres resource. |

## Running it

npm workspaces — install from the repo root, not from inside a workspace.

```
npm install
```

Root scripts:

| Command | What it does |
| --- | --- |
| `npm run dev-front` | Builds `packages/shared`, then starts the Vite dev server. |
| `npm run build-front` | Builds `packages/shared`, then type-checks and bundles the SPA to `apps/web/dist/`. |
| `npm run lint-front` | ESLint over the SPA. |
| `npm run preview-front` | Serves the built SPA bundle. |
| `npm run build-api` | Builds `packages/shared`, then compiles the API to `apps/api/dist/`. |
| `npm run start-api` | Builds the API and runs it. |

Database scripts, run from `apps/api`:

| Command | What it does |
| --- | --- |
| `npm run db:generate` | Regenerates the migrations from `src/db/schema.ts`. |
| `npm run db:migrate` | Applies pending migrations. |
| `npm run db:studio` | Opens Drizzle Studio. |

Node 22 or newer; the API scripts use `--env-file-if-exists`.

### Configuration

The API reads the environment, and `apps/api/.env.local` when it exists.

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | required | Postgres connection string. May not carry `sslmode`; use `DATABASE_SSL`. |
| `DATABASE_SSL` | optional | `disable`, `require` or `no-verify`. Defaults to `require` in production, `disable` otherwise. |
| `DATABASE_CA_CERT` | optional | PEM chain, for a certificate signed by a private CA. |
| `DATABASE_POOL_MAX` | optional | Defaults to 10. |
| `DATABASE_MIGRATE` | optional | `false` skips applying migrations at boot. Defaults to true. |
| `ZITADEL_ISSUER` | required | Issuer URL. |
| `ZITADEL_CLIENT_ID` | required | |
| `ZITADEL_CLIENT_SECRET` | required | |
| `APP_BASE_URL` | required | Base URL of the API. The OIDC redirect and post-logout URIs derive from it. |
| `PUBLIC_BASE_URL` | optional | Base URL for published links. Defaults to `APP_BASE_URL`. |
| `SESSION_SECRET` | required | At least 32 characters. |
| `PORT` | optional | Defaults to 8080. |

The database role needs `CREATE` on the schema, and rights to run
`CREATE EXTENSION pg_trgm` for the first migration.

## Layout

```
apps/web/           the SPA
apps/api/           the Fastify service
apps/api/drizzle/   generated SQL migrations
packages/shared/    domain schemas, imported not copied
docs/api-routes.md  the HTTP API
package-lock.json   one lockfile, at the root, for every workspace
```
## What's built

- **Ship cards** — identity, points, hull and shields, defense tokens, command
  values, per-arc armament dice, the speed chart, and upgrade slots.
- **Base tokens** — small/medium/large, with the ship name band, hull panel, and
  draggable firing arcs.
- **Artwork** — thumbnail, schematic, and tiny icon are read straight off your
  machine into the preview. Nothing is uploaded anywhere.
- **JSON** — the JSON tab is a live view of the same state the fields own, and
  *Copy JSON* puts that exact text on the clipboard.
- **API** — cards, collections and publishing over HTTP, backed by Postgres.
  Routes are listed in `docs/api-routes.md`.

Squadron and upgrade cards are not built yet; the topbar shows them as
in-development rather than pretending otherwise.

## Where things live

| Path | What it is |
| --- | --- |
| `packages/shared/src/` | The domain schemas both apps import. |
| `apps/web/src/cardData.ts` | The SPA’s door onto that contract: starting card, picker lists, render helpers. |
| `apps/api/src/routes/api/` | The HTTP routes. |
| `apps/api/src/db/schema.ts` | Table definitions. Migrations are generated from this file. |
| `apps/web/src/components/CardSlots.tsx` | **Card stat positions.** Every box is a percentage of the artwork, so it survives any zoom. Edit placement here. |
| `apps/web/src/components/TokenSlots.tsx` | The same, for the base token, in the token's own mm space. |
| `apps/web/src/components/CardFace.tsx` | Reads the slots above and paints the real, data-driven icons and text. |
| `apps/web/src/firingArcs.ts` | Arc geometry and the drag maths behind the token handles. |
| `apps/web/src/index.css` | Palette and type tokens. |
| `apps/web/src/assets/textures/` | The tiling SVG turbulence the rusted chrome is built from. |

`CardSlots.tsx` carries `SHOW_GUIDES` and `TokenSlots.tsx` carries `SHOW_TOKEN_GUIDES`. Either draws labelled dashed outlines
over every box — turn it on while tuning placement, off to see the real face.
