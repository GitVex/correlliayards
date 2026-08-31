# Corellia Yards

A layout tool for custom *Star Wars: Armada* components. You fill in a ship's
stats on the left, and the right-hand stage renders the printable ship card and
its matching base token live, at true physical size (69 × 89 mm card, base
tokens per size class). The same definition can be read back out as JSON.

## Decisions

The four choices the auth/persistence work rests on, written down so it's clear
later what past-me was thinking.

**Token handling — public client + PKCE.** Tokens live in browser memory and the
SPA calls the API directly. A BFF would be stricter, but this is card layouts,
not data where a leaked ten-minute access token is an incident. Migrating to a
BFF later is mostly an Authentik provider change, so the door stays open.

**API — FastAPI.** The SPA is TypeScript, so a TS API would share types
directly; Python wins anyway on familiarity here. The cost is that
`packages/shared` can only be the contract for one side, so the Python models
have to be kept in step with it deliberately rather than by the compiler.

**Database — Postgres.** One saveable resource per user, stored as a versioned
`jsonb` blob. Nothing about the shape needs more than that, and `jsonb` leaves
room to query inside the blob later without a migration.

**Environments — `local` and `prod`, with a separate Authentik provider and
client ID for each.** Sharing one provider means a single redirect-URI list
covering both and a production token that authenticates against a dev API. The
SPA reads its per-environment settings from a fetched `config.json` rather than
build-time variables, so one built image can be promoted between them.

## Running it

This is an npm workspaces monorepo; install from the repo root, not from inside
`apps/web`.

```
npm install
npm run dev
```

`npm run build` type-checks and produces a static bundle in `apps/web/dist/`.
Both scripts are root-level shortcuts into the `apps/web` workspace. Local
Postgres, for when the API exists, is `npm run db:up`.

## Layout

```
apps/web/          the SPA
apps/api/          FastAPI service (empty; a later phase)
packages/shared/   domain types and version constants, imported not copied
package-lock.json  one lockfile, at the root, for every workspace
```

`packages/shared` has no build step — `main` and `types` point at the `.ts`
source so Vite transpiles it in place and a stale `dist/` can never be what the
other side imports.

## What's built

- **Ship cards** — identity, points, hull and shields, defense tokens, command
  values, per-arc armament dice, the speed chart, and upgrade slots.
- **Base tokens** — small/medium/large, with the ship name band, hull panel, and
  draggable firing arcs.
- **Artwork** — thumbnail, schematic, and tiny icon are read straight off your
  machine into the preview. Nothing is uploaded anywhere.
- **JSON** — the JSON tab is a live view of the same state the fields own, and
  *Copy JSON* puts that exact text on the clipboard.

Squadron and upgrade cards are not built yet; the topbar shows them as
in-development rather than pretending otherwise.

## Where things live

| Path | What it is |
| --- | --- |
| `apps/web/src/cardData.ts` | The one shared shape of everything printed on a card. |
| `apps/web/src/components/CardSlots.tsx` | **Card stat positions.** Every box is a percentage of the artwork, so it survives any zoom. Edit placement here. |
| `apps/web/src/components/TokenSlots.tsx` | The same, for the base token, in the token's own mm space. |
| `apps/web/src/components/CardFace.tsx` | Reads the slots above and paints the real, data-driven icons and text. |
| `apps/web/src/firingArcs.ts` | Arc geometry and the drag maths behind the token handles. |
| `apps/web/src/index.css` | Palette and type tokens. |
| `apps/web/src/assets/textures/` | The tiling SVG turbulence the rusted chrome is built from. |

`CardSlots.tsx` carries `SHOW_GUIDES` and `TokenSlots.tsx` carries `SHOW_TOKEN_GUIDES`. Either draws labelled dashed outlines
over every box — turn it on while tuning placement, off to see the real face.
