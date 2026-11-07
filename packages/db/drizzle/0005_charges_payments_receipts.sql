CREATE TYPE "public"."due_status" AS ENUM('paid', 'partial', 'unpaid');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'transfer');--> statement-breakpoint
CREATE TABLE "charge_call" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"residence_id" uuid NOT NULL,
	"period_label" text NOT NULL,
	"amount_per_lot" integer NOT NULL,
	"due_date" date NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "charge_call_residence_period_unique" UNIQUE("residence_id","period_label"),
	CONSTRAINT "charge_call_id_residence_unique" UNIQUE("id","residence_id"),
	CONSTRAINT "charge_call_amount_positive" CHECK ("charge_call"."amount_per_lot" > 0)
);
--> statement-breakpoint
CREATE TABLE "charge_due" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"residence_id" uuid NOT NULL,
	"charge_call_id" uuid NOT NULL,
	"lot_id" uuid NOT NULL,
	"amount_due" integer NOT NULL,
	"amount_paid" integer DEFAULT 0 NOT NULL,
	"status" "due_status" DEFAULT 'unpaid' NOT NULL,
	CONSTRAINT "charge_due_call_lot_unique" UNIQUE("charge_call_id","lot_id"),
	CONSTRAINT "charge_due_id_residence_unique" UNIQUE("id","residence_id"),
	CONSTRAINT "charge_due_amount_due_positive" CHECK ("charge_due"."amount_due" > 0),
	CONSTRAINT "charge_due_amount_paid_range" CHECK ("charge_due"."amount_paid" >= 0 and "charge_due"."amount_paid" <= "charge_due"."amount_due"),
	CONSTRAINT "charge_due_status_consistent" CHECK (("charge_due"."status" = 'unpaid' and "charge_due"."amount_paid" = 0)
        or ("charge_due"."status" = 'partial' and "charge_due"."amount_paid" > 0 and "charge_due"."amount_paid" < "charge_due"."amount_due")
        or ("charge_due"."status" = 'paid' and "charge_due"."amount_paid" = "charge_due"."amount_due"))
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"residence_id" uuid NOT NULL,
	"charge_due_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"method" "payment_method" NOT NULL,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"recorded_by" text NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" text,
	"cancel_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_id_residence_unique" UNIQUE("id","residence_id"),
	CONSTRAINT "payment_amount_positive" CHECK ("payment"."amount" > 0),
	CONSTRAINT "payment_cancelled_by_consistent" CHECK (("payment"."cancelled_at" is null) = ("payment"."cancelled_by" is null)),
	CONSTRAINT "payment_cancel_reason_required" CHECK ("payment"."cancelled_at" is null or length(btrim(coalesce("payment"."cancel_reason", ''))) > 0)
);
--> statement-breakpoint
CREATE TABLE "receipt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"residence_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"number" text NOT NULL,
	"storage_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "receipt_payment_unique" UNIQUE("payment_id"),
	CONSTRAINT "receipt_residence_number_unique" UNIQUE("residence_id","number"),
	CONSTRAINT "receipt_number_format" CHECK ("receipt"."number" ~ '^[0-9]{4}-[0-9]{4,}$')
);
--> statement-breakpoint
CREATE TABLE "receipt_counter" (
	"residence_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "receipt_counter_pk" PRIMARY KEY("residence_id","year"),
	CONSTRAINT "receipt_counter_last_number_nonneg" CHECK ("receipt_counter"."last_number" >= 0)
);
--> statement-breakpoint
ALTER TABLE "charge_call" ADD CONSTRAINT "charge_call_residence_id_residence_id_fk" FOREIGN KEY ("residence_id") REFERENCES "public"."residence"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge_call" ADD CONSTRAINT "charge_call_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge_due" ADD CONSTRAINT "charge_due_residence_id_residence_id_fk" FOREIGN KEY ("residence_id") REFERENCES "public"."residence"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge_due" ADD CONSTRAINT "charge_due_call_same_residence_fk" FOREIGN KEY ("charge_call_id","residence_id") REFERENCES "public"."charge_call"("id","residence_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge_due" ADD CONSTRAINT "charge_due_lot_same_residence_fk" FOREIGN KEY ("lot_id","residence_id") REFERENCES "public"."lot"("id","residence_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_residence_id_residence_id_fk" FOREIGN KEY ("residence_id") REFERENCES "public"."residence"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_recorded_by_user_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_cancelled_by_user_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_due_same_residence_fk" FOREIGN KEY ("charge_due_id","residence_id") REFERENCES "public"."charge_due"("id","residence_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt" ADD CONSTRAINT "receipt_residence_id_residence_id_fk" FOREIGN KEY ("residence_id") REFERENCES "public"."residence"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt" ADD CONSTRAINT "receipt_payment_same_residence_fk" FOREIGN KEY ("payment_id","residence_id") REFERENCES "public"."payment"("id","residence_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_counter" ADD CONSTRAINT "receipt_counter_residence_id_residence_id_fk" FOREIGN KEY ("residence_id") REFERENCES "public"."residence"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "charge_due_residence_lot_idx" ON "charge_due" USING btree ("residence_id","lot_id");--> statement-breakpoint
CREATE INDEX "payment_due_idx" ON "payment" USING btree ("charge_due_id");--> statement-breakpoint
CREATE INDEX "payment_residence_paid_at_idx" ON "payment" USING btree ("residence_id","paid_at");