# Corellia Yards

A layout tool for custom *Star Wars: Armada* components. You fill in a ship's
stats on the left, and the right-hand stage renders the printable ship card and
its matching base token live, at true physical size (69 × 89 mm card, base
tokens per size class). The same definition can be read back out as JSON.

## Running it

```
npm install
npm run dev
```

`npm run build` type-checks and produces a static bundle in `dist/`.

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
| `src/cardData.ts` | The one shared shape of everything printed on a card. |
| `src/components/CardSlots.tsx` | **Card stat positions.** Every box is a percentage of the artwork, so it survives any zoom. Edit placement here. |
| `src/components/TokenSlots.tsx` | The same, for the base token, in the token's own mm space. |
| `src/components/CardFace.tsx` | Reads the slots above and paints the real, data-driven icons and text. |
| `src/firingArcs.ts` | Arc geometry and the drag maths behind the token handles. |
| `src/index.css` | Palette and type tokens. |
| `src/assets/textures/` | The tiling SVG turbulence the rusted chrome is built from. |

`CardSlots.tsx` carries `SHOW_GUIDES` and `TokenSlots.tsx` carries `SHOW_TOKEN_GUIDES`. Either draws labelled dashed outlines
over every box — turn it on while tuning placement, off to see the real face.
