CREATE TYPE "public"."lot_type" AS ENUM('apartment', 'commercial', 'other');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('manager', 'treasurer', 'deputy', 'owner', 'tenant', 'caretaker');--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"residence_id" uuid NOT NULL,
	"lot_id" uuid,
	"role" "member_role" NOT NULL,
	"code" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"used_by" text,
	"revoked_at" timestamp with time zone,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitation_code_unique" UNIQUE("code"),
	CONSTRAINT "invitation_role_not_manager" CHECK ("invitation"."role" <> 'manager'),
	CONSTRAINT "invitation_used_consistent" CHECK (("invitation"."used_at" is null) = ("invitation"."used_by" is null))
);
--> statement-breakpoint
CREATE TABLE "lot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"residence_id" uuid NOT NULL,
	"reference" text NOT NULL,
	"building" text,
	"floor" integer,
	"type" "lot_type" DEFAULT 'apartment' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lot_residence_reference_unique" UNIQUE("residence_id","reference"),
	CONSTRAINT "lot_id_residence_unique" UNIQUE("id","residence_id")
);
--> statement-breakpoint
CREATE TABLE "membership" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"residence_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "member_role" NOT NULL,
	"lot_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	CONSTRAINT "membership_ended_inactive" CHECK ("membership"."ended_at" is null or not "membership"."active")
);
--> statement-breakpoint
CREATE TABLE "residence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"city" text NOT NULL,
	"address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_residence_id_residence_id_fk" FOREIGN KEY ("residence_id") REFERENCES "public"."residence"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_used_by_user_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_lot_same_residence_fk" FOREIGN KEY ("lot_id","residence_id") REFERENCES "public"."lot"("id","residence_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lot" ADD CONSTRAINT "lot_residence_id_residence_id_fk" FOREIGN KEY ("residence_id") REFERENCES "public"."residence"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership" ADD CONSTRAINT "membership_residence_id_residence_id_fk" FOREIGN KEY ("residence_id") REFERENCES "public"."residence"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership" ADD CONSTRAINT "membership_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership" ADD CONSTRAINT "membership_lot_same_residence_fk" FOREIGN KEY ("lot_id","residence_id") REFERENCES "public"."lot"("id","residence_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invitation_residence_idx" ON "invitation" USING btree ("residence_id","created_at");--> statement-breakpoint
CREATE INDEX "invitation_lot_idx" ON "invitation" USING btree ("lot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "membership_one_active_manager_idx" ON "membership" USING btree ("residence_id") WHERE "membership"."role" = 'manager' and "membership"."active";--> statement-breakpoint
CREATE INDEX "membership_user_active_idx" ON "membership" USING btree ("user_id","active");--> statement-breakpoint
CREATE INDEX "membership_residence_active_idx" ON "membership" USING btree ("residence_id","active");--> statement-breakpoint
CREATE INDEX "membership_lot_idx" ON "membership" USING btree ("lot_id");