CREATE TABLE "charge_reminder" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"residence_id" uuid NOT NULL,
	"lot_id" uuid NOT NULL,
	"sent_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "client_id" uuid;--> statement-breakpoint
ALTER TABLE "charge_reminder" ADD CONSTRAINT "charge_reminder_residence_id_residence_id_fk" FOREIGN KEY ("residence_id") REFERENCES "public"."residence"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge_reminder" ADD CONSTRAINT "charge_reminder_sent_by_user_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge_reminder" ADD CONSTRAINT "charge_reminder_lot_same_residence_fk" FOREIGN KEY ("lot_id","residence_id") REFERENCES "public"."lot"("id","residence_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "charge_reminder_lot_idx" ON "charge_reminder" USING btree ("residence_id","lot_id","created_at");--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_residence_client_id_unique" UNIQUE("residence_id","client_id");