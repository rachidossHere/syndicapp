CREATE TABLE "opening_balance_change" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"residence_id" uuid NOT NULL,
	"old_amount" integer,
	"new_amount" integer NOT NULL,
	"as_of_date" date NOT NULL,
	"reason" text,
	"changed_by" text NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "opening_balance_change_reason_required" CHECK ("opening_balance_change"."old_amount" is null or length(btrim(coalesce("opening_balance_change"."reason", ''))) > 0)
);
--> statement-breakpoint
ALTER TABLE "residence" ADD COLUMN "opening_balance" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "residence" ADD COLUMN "opening_balance_date" date;--> statement-breakpoint
ALTER TABLE "opening_balance_change" ADD CONSTRAINT "opening_balance_change_residence_id_residence_id_fk" FOREIGN KEY ("residence_id") REFERENCES "public"."residence"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opening_balance_change" ADD CONSTRAINT "opening_balance_change_changed_by_user_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "opening_balance_change_residence_idx" ON "opening_balance_change" USING btree ("residence_id","changed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "opening_balance_change_one_first_idx" ON "opening_balance_change" USING btree ("residence_id") WHERE "opening_balance_change"."old_amount" is null;