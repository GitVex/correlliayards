CREATE TABLE "cards" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_sub" text NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"faction" text,
	"points" integer NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"document" jsonb NOT NULL,
	CONSTRAINT "cards_kind_check" CHECK ("cards"."kind" in ('ship', 'squadron', 'upgrade')),
	CONSTRAINT "cards_points_check" CHECK ("cards"."points" >= 0)
);
--> statement-breakpoint
CREATE TABLE "collection_cards" (
	"collection_id" uuid NOT NULL,
	"card_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "collection_cards_collection_id_card_id_pk" PRIMARY KEY("collection_id","card_id"),
	CONSTRAINT "collection_cards_position_check" CHECK ("collection_cards"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_sub" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "collection_cards" ADD CONSTRAINT "collection_cards_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_cards" ADD CONSTRAINT "collection_cards_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cards_owner_updated_idx" ON "cards" USING btree ("owner_sub","updated_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "cards_owner_points_idx" ON "cards" USING btree ("owner_sub","points","id");--> statement-breakpoint
CREATE INDEX "cards_owner_name_idx" ON "cards" USING btree ("owner_sub","name","id");--> statement-breakpoint
CREATE INDEX "cards_owner_kind_idx" ON "cards" USING btree ("owner_sub","kind");--> statement-breakpoint
CREATE INDEX "cards_published_idx" ON "cards" USING btree ("updated_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE published;--> statement-breakpoint
CREATE INDEX "cards_upgrade_type_idx" ON "cards" USING btree ((document -> 'data' ->> 'upgradeType')) WHERE kind = 'upgrade';--> statement-breakpoint
CREATE INDEX "cards_unique_idx" ON "cards" USING btree ((document -> 'data' ->> 'unique')) WHERE kind in ('squadron', 'upgrade');--> statement-breakpoint
CREATE INDEX "cards_name_trgm_idx" ON "cards" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "collection_cards_position_key" ON "collection_cards" USING btree ("collection_id","position");--> statement-breakpoint
CREATE INDEX "collection_cards_card_idx" ON "collection_cards" USING btree ("card_id");--> statement-breakpoint
CREATE INDEX "collections_owner_updated_idx" ON "collections" USING btree ("owner_sub","updated_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "collections_published_idx" ON "collections" USING btree ("updated_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE published;