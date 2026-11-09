CREATE TYPE "public"."expense_category" AS ENUM('maintenance', 'elevator', 'electricity', 'water', 'cleaning', 'security', 'repairs', 'other');--> statement-breakpoint
CREATE TABLE "expense" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"residence_id" uuid NOT NULL,
	"label" text NOT NULL,
	"amount" integer NOT NULL,
	"category" "expense_category" NOT NULL,
	"spent_on" date NOT NULL,
	"supplier" text,
	"invoice_key" text,
	"invoice_content_type" text,
	"invoice_size" integer,
	"recorded_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" text,
	"cancel_reason" text,
	"client_id" uuid,
	CONSTRAINT "expense_residence_client_id_unique" UNIQUE("residence_id","client_id"),
	CONSTRAINT "expense_amount_positive" CHECK ("expense"."amount" > 0),
	CONSTRAINT "expense_label_not_blank" CHECK (length(btrim("expense"."label")) > 0),
	CONSTRAINT "expense_invoice_consistent" CHECK (("expense"."invoice_key" is null) = ("expense"."invoice_content_type" is null)
        and ("expense"."invoice_key" is not null or "expense"."invoice_size" is null)
        and ("expense"."invoice_size" is null or "expense"."invoice_size" > 0)),
	CONSTRAINT "expense_cancelled_by_consistent" CHECK (("expense"."cancelled_at" is null) = ("expense"."cancelled_by" is null)),
	CONSTRAINT "expense_cancel_reason_required" CHECK ("expense"."cancelled_at" is null or length(btrim(coalesce("expense"."cancel_reason", ''))) > 0)
);
--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_residence_id_residence_id_fk" FOREIGN KEY ("residence_id") REFERENCES "public"."residence"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_recorded_by_user_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_cancelled_by_user_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expense_residence_spent_on_idx" ON "expense" USING btree ("residence_id","spent_on");