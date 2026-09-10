CREATE TABLE "users" (
	"sub" text PRIMARY KEY NOT NULL,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
