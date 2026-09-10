CREATE TABLE "assets" (
	"id" text NOT NULL,
	"owner_sub" text NOT NULL,
	"mime" text NOT NULL,
	"filename" text NOT NULL,
	"byte_size" integer NOT NULL,
	"bytes" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assets_owner_sub_id_pk" PRIMARY KEY("owner_sub","id"),
	CONSTRAINT "assets_byte_size_check" CHECK ("assets"."byte_size" > 0)
);
--> statement-breakpoint
CREATE INDEX "assets_owner_created_idx" ON "assets" USING btree ("owner_sub","created_at");