CREATE TYPE "public"."announcement_category" AS ENUM('works', 'meeting', 'info', 'urgent');--> statement-breakpoint
CREATE TABLE "announcement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"residence_id" uuid NOT NULL,
	"author_id" text NOT NULL,
	"category" "announcement_category" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"pinned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "announcement_title_length" CHECK (length(btrim("announcement"."title")) between 1 and 80),
	CONSTRAINT "announcement_body_length" CHECK (length(btrim("announcement"."body")) between 1 and 1000),
	CONSTRAINT "announcement_pinned_at_consistent" CHECK (("announcement"."pinned") = ("announcement"."pinned_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "announcement" ADD CONSTRAINT "announcement_residence_id_residence_id_fk" FOREIGN KEY ("residence_id") REFERENCES "public"."residence"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement" ADD CONSTRAINT "announcement_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "announcement_residence_list_idx" ON "announcement" USING btree ("residence_id","pinned","created_at");