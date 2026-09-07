/* The contract both apps compile against. No build step: `main` and `types`
   point straight at this source, and Vite and tsx transpile it in place. Adding
   a build here would mean a stale `dist/` is the thing the other side imports.

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

export * from './vocabulary'
export * from './artwork'
export * from './token'
export * from './ship'
export * from './squadron'
export * from './upgrade'
export * from './card'
export * from './summary'
export * from './user'
