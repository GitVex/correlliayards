/* The contract both apps compile against, built once to `dist/` and imported
   from there by both. It used to point `main` at this source and let each side
   transpile it; the API ended that, because it runs as plain compiled JS under
   node and cannot import a .ts file at runtime. The staleness that arrangement
   was avoiding is handled by every entry script running `build-shared` first.

   Every shape is declared once as a Zod schema and its TypeScript type inferred
   back off it. That is the point of the package: the API needs to *validate*
   what lands in a jsonb column — which validates nothing on its own — and a
   hand-written validator sitting beside a hand-written interface drifts from it
   silently. One declaration, two uses.

   The SPA can import the types alone with `import type`, which erases, so none
   of Zod reaches the browser bundle unless a screen genuinely wants
   client-side validation.

   What lives here is what the API has to name in order to store, validate or
   return something. Rendering details — icon URL maps, slot percentages, the
   arc drag maths, the dice-string parser — stay in the SPA even though they
   read these types. */

export * from './vocabulary.js'
export * from './artwork.js'
export * from './token.js'
export * from './ship.js'
export * from './squadron.js'
export * from './upgrade.js'
export * from './card.js'
export * from './summary.js'
export * from './user.js'
export * from './collection.js'
export * from './query.js'
export * from './publishing.js'
export * from './errors.js'
