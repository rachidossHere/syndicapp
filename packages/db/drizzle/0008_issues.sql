CREATE TYPE "public"."issue_event_type" AS ENUM('created', 'status_changed', 'comment', 'reopened');--> statement-breakpoint
CREATE TYPE "public"."issue_location" AS ENUM('elevator', 'stairs', 'parking', 'hall', 'roof', 'other');--> statement-breakpoint
CREATE TYPE "public"."issue_status" AS ENUM('open', 'in_progress', 'resolved');--> statement-breakpoint
CREATE TABLE "issue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"residence_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"location" "issue_location" NOT NULL,
	"urgent" boolean DEFAULT false NOT NULL,
	"status" "issue_status" DEFAULT 'open' NOT NULL,
	"photo_key" text,
	"photo_content_type" text,
	"photo_size" integer,
	"author_id" text NOT NULL,
	"author_lot_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "issue_id_residence_unique" UNIQUE("id","residence_id"),
	CONSTRAINT "issue_title_not_blank" CHECK (length(btrim("issue"."title")) > 0),
	CONSTRAINT "issue_photo_consistent" CHECK (("issue"."photo_key" is null) = ("issue"."photo_content_type" is null)
        and ("issue"."photo_key" is not null or "issue"."photo_size" is null)
        and ("issue"."photo_size" is null or "issue"."photo_size" > 0)),
	CONSTRAINT "issue_resolved_at_consistent" CHECK (("issue"."status" = 'resolved') = ("issue"."resolved_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "issue_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"residence_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"type" "issue_event_type" NOT NULL,
	"from_status" "issue_status",
	"to_status" "issue_status",
	"message" text,
	"author_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "issue_event_message_not_blank" CHECK ("issue_event"."message" is null or length(btrim("issue_event"."message")) > 0),
	CONSTRAINT "issue_event_comment_has_message" CHECK ("issue_event"."type" <> 'comment' or "issue_event"."message" is not null),
	CONSTRAINT "issue_event_status_has_to_status" CHECK ("issue_event"."type" not in ('status_changed', 'reopened', 'created') or "issue_event"."to_status" is not null)
);
--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_residence_id_residence_id_fk" FOREIGN KEY ("residence_id") REFERENCES "public"."residence"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_author_lot_same_residence_fk" FOREIGN KEY ("author_lot_id","residence_id") REFERENCES "public"."lot"("id","residence_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_event" ADD CONSTRAINT "issue_event_residence_id_residence_id_fk" FOREIGN KEY ("residence_id") REFERENCES "public"."residence"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_event" ADD CONSTRAINT "issue_event_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_event" ADD CONSTRAINT "issue_event_issue_same_residence_fk" FOREIGN KEY ("issue_id","residence_id") REFERENCES "public"."issue"("id","residence_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "issue_residence_status_urgent_idx" ON "issue" USING btree ("residence_id","status","urgent");--> statement-breakpoint
CREATE INDEX "issue_event_issue_created_at_idx" ON "issue_event" USING btree ("issue_id","created_at");