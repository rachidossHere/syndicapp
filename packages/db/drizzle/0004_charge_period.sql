CREATE TYPE "public"."charge_period" AS ENUM('monthly', 'quarterly');--> statement-breakpoint
ALTER TABLE "residence" ADD COLUMN "charge_period" charge_period DEFAULT 'quarterly' NOT NULL;