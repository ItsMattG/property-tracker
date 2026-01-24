CREATE TYPE "public"."alert_status" AS ENUM('active', 'dismissed', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."alert_type" AS ENUM('disconnected', 'requires_reauth', 'sync_failed');--> statement-breakpoint
CREATE TYPE "public"."connection_status" AS ENUM('connected', 'disconnected', 'error');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('success', 'failed', 'pending');--> statement-breakpoint
CREATE TABLE "connection_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"bank_account_id" uuid NOT NULL,
	"alert_type" "alert_type" NOT NULL,
	"status" "alert_status" DEFAULT 'active' NOT NULL,
	"error_message" text,
	"email_sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"dismissed_at" timestamp,
	"resolved_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD COLUMN "connection_status" "connection_status" DEFAULT 'connected' NOT NULL;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD COLUMN "last_sync_status" "sync_status";--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD COLUMN "last_sync_error" text;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD COLUMN "last_manual_sync_at" timestamp;--> statement-breakpoint
ALTER TABLE "connection_alerts" ADD CONSTRAINT "connection_alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connection_alerts" ADD CONSTRAINT "connection_alerts_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "connection_alerts_user_id_idx" ON "connection_alerts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "connection_alerts_bank_account_id_idx" ON "connection_alerts" USING btree ("bank_account_id");--> statement-breakpoint
CREATE INDEX "connection_alerts_status_idx" ON "connection_alerts" USING btree ("status");