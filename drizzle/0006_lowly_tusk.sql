CREATE TYPE "public"."anomaly_alert_type" AS ENUM('missed_rent', 'unusual_amount', 'unexpected_expense', 'duplicate_transaction');--> statement-breakpoint
CREATE TYPE "public"."anomaly_severity" AS ENUM('info', 'warning', 'critical');--> statement-breakpoint
CREATE TABLE "anomaly_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"property_id" uuid,
	"alert_type" "anomaly_alert_type" NOT NULL,
	"severity" "anomaly_severity" NOT NULL,
	"transaction_id" uuid,
	"recurring_id" uuid,
	"expected_transaction_id" uuid,
	"description" text NOT NULL,
	"suggested_action" text,
	"metadata" text,
	"status" "alert_status" DEFAULT 'active' NOT NULL,
	"dismissal_count" numeric(3, 0) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"dismissed_at" timestamp,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "user_onboarding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"wizard_dismissed_at" timestamp,
	"checklist_dismissed_at" timestamp,
	"completed_steps" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_onboarding_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "anomaly_alerts" ADD CONSTRAINT "anomaly_alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anomaly_alerts" ADD CONSTRAINT "anomaly_alerts_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anomaly_alerts" ADD CONSTRAINT "anomaly_alerts_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anomaly_alerts" ADD CONSTRAINT "anomaly_alerts_recurring_id_recurring_transactions_id_fk" FOREIGN KEY ("recurring_id") REFERENCES "public"."recurring_transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anomaly_alerts" ADD CONSTRAINT "anomaly_alerts_expected_transaction_id_expected_transactions_id_fk" FOREIGN KEY ("expected_transaction_id") REFERENCES "public"."expected_transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_onboarding" ADD CONSTRAINT "user_onboarding_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "anomaly_alerts_user_id_idx" ON "anomaly_alerts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "anomaly_alerts_property_id_idx" ON "anomaly_alerts" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "anomaly_alerts_status_idx" ON "anomaly_alerts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "anomaly_alerts_created_at_idx" ON "anomaly_alerts" USING btree ("created_at");