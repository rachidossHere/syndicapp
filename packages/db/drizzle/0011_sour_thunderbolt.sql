CREATE TYPE "public"."notification_job_status" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."push_locale" AS ENUM('fr', 'ar');--> statement-breakpoint
CREATE TABLE "notification_job" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"residence_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"audience" jsonb NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "notification_job_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notification_ticket" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"ticket_id" text NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_ticket_ticket_id_unique" UNIQUE("ticket_id"),
	CONSTRAINT "notification_ticket_job_token_unique" UNIQUE("job_id","token")
);
--> statement-breakpoint
ALTER TABLE "push_token" ADD COLUMN "locale" "push_locale" DEFAULT 'fr' NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_job" ADD CONSTRAINT "notification_job_residence_id_residence_id_fk" FOREIGN KEY ("residence_id") REFERENCES "public"."residence"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_ticket" ADD CONSTRAINT "notification_ticket_job_id_notification_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."notification_job"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_job_status_idx" ON "notification_job" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "notification_job_residence_idx" ON "notification_job" USING btree ("residence_id");--> statement-breakpoint
CREATE INDEX "notification_ticket_created_idx" ON "notification_ticket" USING btree ("created_at");