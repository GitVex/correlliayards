// ---------------------------------------------------------------------------
// The persistent shape, as Drizzle table definitions.
//
// This file is the single source of truth for the database: drizzle-kit diffs
// it to generate the migrations in ../../drizzle, and every query in the routes
// is built from these objects, so a renamed column is a compile error in each
// place that reads it rather than a runtime error in one.
//
// The column/document split follows the rule stated in packages/shared/card.ts:
// if a query filters or sorts on it, it is a column. Everything else goes into
// one jsonb document, which is what lets a card gain a printed field without a
// migration.
// ---------------------------------------------------------------------------

import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import type {
  AssetMime,
  CardKind,
  Faction,
  ShipCardData,
  ShipToken,
  SquadronCardData,
  UpgradeCardData,
} from '@correlliayards/shared'

/** What actually sits in `cards.document`: the per-kind payload and, for a
 *  ship, its token. Everything else a card has is a column.
 *
 *  Declared as a union rather than a loose Record so that `$type` gives the
 *  routes something worth having — reading a row back hands you a value the
 *  compiler makes you narrow on `kind` before touching, which is the same
 *  discipline the Zod union imposes at the boundary. */
export type CardDocument =
  | { data: ShipCardData; token: ShipToken }
  | { data: SquadronCardData }
  | { data: UpgradeCardData }

/** The people who have logged in, and nothing more about them than that.
 *
 *  It exists for one fact that OIDC cannot supply: when someone joined. There
 *  is no claim for account creation — `auth_time` says when *this* login
 *  happened — so the only honest source for "member since" is the first time we
 *  saw the subject ourselves. Everything else about a person stays in Zitadel,
 *  where it can be edited, rather than being copied here to go stale.
 *
 *  Deliberately not referenced by `cards.owner_sub`. A foreign key would be the
 *  better integrity story, but it would also make this migration fail on any
 *  database that already holds cards owned by a subject with no row here — and
 *  the row is written at login, so those exist. Ownership is enforced by the
 *  scoped WHERE on every query, which is where it has to hold anyway. */
export const users = pgTable('users', {
  /** The Zitadel subject claim, and the same value `cards.owner_sub` carries. */
  sub: text('sub').primaryKey(),
  /** Set once, by the insert, and never updated — the upsert at login touches
   *  only `last_seen_at`, which is what keeps this meaning "first seen". */
  registeredAt: timestamp('registered_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Raw bytes. Drizzle's pg-core has no bytea column, so it is declared here —
 *  the driver hands `pg` a Buffer and gets one back, which is what the routes
 *  want to write to a reply anyway. */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => 'bytea',
})

/** The pictures on a card, stored rather than merely named.
 *
 *  Identity is the SHA-256 of the content. That makes a row immutable — the
 *  bytes cannot change under an id that is derived from them — which is what
 *  lets the id serve as an ETag and the response be cached forever.
 *
 *  **Ownership is in the primary key, not a column beside it.** Keying on the
 *  digest alone would dedup across the whole instance, and a shared row is an
 *  oracle: uploading a picture and being told it already existed reveals that
 *  somebody else holds that exact file. Keyed this way you dedup within your own
 *  library and learn nothing about anyone else's, at the cost of storing a
 *  popular picture once per owner. That is the right trade for a table holding
 *  what people have not chosen to publish.
 *
 *  Nothing references this table. A card names its artwork inside a jsonb
 *  document, which no foreign key can reach into, so rows here are not deleted
 *  when the card that used them is. That is what db/sweep-assets.ts collects,
 *  on a schedule rather than on delete. */
export const assets = pgTable(
  'assets',
  {
    /** Lowercase hex SHA-256 of `bytes`. */
    id: text('id').notNull(),
    ownerSub: text('owner_sub').notNull(),
    /** Determined by sniffing the content, never copied from the request's
     *  Content-Type — see routes/api/assets.ts. */
    mime: text('mime').$type<AssetMime>().notNull(),
    /** What the file was called when it was picked. Shown beside the editor's
     *  picker so you can tell which picture is loaded; nothing resolves it. */
    filename: text('filename').notNull(),
    byteSize: integer('byte_size').notNull(),
    bytes: bytea('bytes').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.ownerSub, t.id] }),
    check('assets_byte_size_check', sql`${t.byteSize} > 0`),
    /* "What has this owner uploaded, oldest first" — which is the order
       db/sweep-assets.ts judges rows in, oldest being the eligible end. */
    index('assets_owner_created_idx').on(t.ownerSub, t.createdAt),
  ],
)

export const cards = pgTable(
  'cards',
  {
    /** Minted by the client, so this is a plain primary key and not a generated
     *  one: the editor knows the id before the first save exists. */
    id: uuid('id').primaryKey(),
    /** The Zitadel subject claim. Every authenticated query is scoped by it,
     *  which is what makes it the leading column of the list indexes below. */
    ownerSub: text('owner_sub').notNull(),
    kind: text('kind').$type<CardKind>().notNull(),
    name: text('name').notNull(),
    /** NULL means "no faction restriction", which is a real value and not
     *  missing data — see the faction=none convention in shared/query.ts.
     *
     *  Deliberately unconstrained at the database level, unlike `kind`: the
     *  faction list is the one piece of vocabulary here that plausibly grows,
     *  and Zod already rejects anything outside it at the boundary. */
    faction: text('faction').$type<Faction>(),
    points: integer('points').notNull(),
    published: boolean('published').notNull().default(false),
    /** NULL exactly when `published` is false. The publish routes keep the two
     *  consistent; a constraint could not, because it would have no way to say
     *  which of the pair to believe when they disagreed. */
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    /** Doubles as the row's version: the ETag is built from it and If-Match is
     *  checked against it, so nothing but a content write may move it. That is
     *  why publishing deliberately does not touch it. */
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    document: jsonb('document').$type<CardDocument>().notNull(),
  },
  (t) => [
    /* `kind` is constrained here and not merely in Zod because two of the
       partial indexes below are defined in terms of it. An unexpected value
       would not be rejected, it would be invisible. */
    check('cards_kind_check', sql`${t.kind} in ('ship', 'squadron', 'upgrade')`),
    check('cards_points_check', sql`${t.points} >= 0`),

    /* The default list: one user's cards, newest first. Ordered exactly as the
       keyset cursor orders, so paging never sorts. */
    index('cards_owner_updated_idx').on(t.ownerSub, t.updatedAt.desc(), t.id.desc()),
    /* The other two orderings the API offers. Without these, sorting a large
       library by cost or name sorts the owner's whole set once per page. */
    index('cards_owner_points_idx').on(t.ownerSub, t.points, t.id),
    index('cards_owner_name_idx').on(t.ownerSub, t.name, t.id),
    index('cards_owner_kind_idx').on(t.ownerSub, t.kind),

    /* The public browse. Partial, because published rows are a small minority
       and an index over the rest would never be read. */
    index('cards_published_idx')
      .on(t.updatedAt.desc(), t.id.desc())
      .where(sql`published`),

    /* The partial expression index documented in shared/upgrade.ts — what lets
       upgradeType stay in the document instead of becoming a column that is
       NULL on two kinds out of three. */
    index('cards_upgrade_type_idx')
      .on(sql`(document -> 'data' ->> 'upgradeType')`)
      .where(sql`kind = 'upgrade'`),
    /* The same trick for the bullet flag, which ships do not have. */
    index('cards_unique_idx')
      .on(sql`(document -> 'data' ->> 'unique')`)
      .where(sql`kind in ('squadron', 'upgrade')`),

    /* Name search is ILIKE '%...%', which no btree index can serve. pg_trgm
       can; the extension it needs is enabled by the first migration. */
    index('cards_name_trgm_idx').using('gin', t.name.op('gin_trgm_ops')),
  ],
)

export const collections = pgTable(
  'collections',
  {
    /** Client-minted, exactly like a card's, so the same idempotent PUT works. */
    id: uuid('id').primaryKey(),
    ownerSub: text('owner_sub').notNull(),
    name: text('name').notNull(),
    /** Empty rather than absent when there is none, so no consumer has to
     *  handle two kinds of nothing. */
    description: text('description').notNull().default(''),
    published: boolean('published').notNull().default(false),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('collections_owner_updated_idx').on(t.ownerSub, t.updatedAt.desc(), t.id.desc()),
    index('collections_published_idx')
      .on(t.updatedAt.desc(), t.id.desc())
      .where(sql`published`),
  ],
)

/** Ordered membership.
 *
 *  A join table rather than an array column on `collections`, because deleting
 *  a card has to remove it from every collection that holds it, and a foreign
 *  key does that for free. */
export const collectionCards = pgTable(
  'collection_cards',
  {
    collectionId: uuid('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    /** Deleting a card removes it from its collections. Deleting a collection
     *  does not touch its cards, which is why the cascade is only on this
     *  side — `DELETE /api/collections/:id` is documented as leaving the cards
     *  alone, and this is where that promise is actually kept. */
    cardId: uuid('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.collectionId, t.cardId] }),
    check('collection_cards_position_check', sql`${t.position} >= 0`),
    /* One card per slot. Safe as a non-deferrable constraint only because
       membership is replaced wholesale — the write deletes every row for the
       collection before inserting any, so two rows never share a position even
       momentarily. A per-item reorder endpoint would need this deferred. */
    uniqueIndex('collection_cards_position_key').on(t.collectionId, t.position),
    /* "Which collections hold this card", which the card-delete cascade walks. */
    index('collection_cards_card_idx').on(t.cardId),
  ],
)
