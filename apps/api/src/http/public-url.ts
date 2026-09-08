import { config } from '../config.js'

/* The shape of a published link.
 *
 * `docs/api-routes.md` left this open between `/c/:uuid`, a slug, and
 * `/c/:uuid/:slug`. This is the third, for the reason given there: the uuid is
 * what resolves, so the slug is free to be wrong. Renaming a published card
 * does not break a link already pasted into a chat, and the link still says
 * what it points at when someone reads it.
 *
 * Nothing here parses a link back. The public routes take the id out of the
 * path and ignore the slug entirely, which is what makes the slug decorative
 * rather than a second identifier that has to stay unique. */

/** Prefixes. Short because these are links people paste by hand.
 *
 *  `k` for a collection is not a mnemonic, it is simply not `c` — worth a
 *  glance if a nicer pair suggests itself before anything is published. */
const PREFIX = { card: 'c', collection: 'k' } as const

export type PublishableKind = keyof typeof PREFIX

/** Name to url segment. Deliberately lossy: anything that is not a letter or a
 *  digit becomes a hyphen, and the result is capped, because this is decoration
 *  and a hundred-character segment is not more decorative than a short one.
 *
 *  Falls back to a fixed word rather than an empty segment, so a card named
 *  entirely in characters this strips still produces a well-formed url. */
export function slugify(name: string): string {
  const slug = name
    .normalize('NFKD')
    /* Strip combining marks, so "Tycho Celchü" slugs as "tycho-celchu" rather
       than losing the letter along with its umlaut. */
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')

  return slug || 'untitled'
}

/** The absolute url a publish route hands back.
 *
 *  Built from `publicBaseUrl`, not from the request's Host header. The header is
 *  attacker-influenced and, behind a reverse proxy, usually wrong anyway — the
 *  same reasoning the callback in routes/auth.ts already applies to rebuilding
 *  its own url. */
export function publicUrlFor(kind: PublishableKind, id: string, name: string): string {
  return new URL(`/${PREFIX[kind]}/${id}/${slugify(name)}`, config.publicBaseUrl).href
}
