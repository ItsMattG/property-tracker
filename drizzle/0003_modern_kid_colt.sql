CREATE TYPE "public"."expected_status" AS ENUM('pending', 'matched', 'missed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."frequency" AS ENUM('weekly', 'fortnightly', 'monthly', 'quarterly', 'annually');--> statement-breakpoint
CREATE TABLE "expected_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recurring_transaction_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"expected_date" date NOT NULL,
	"expected_amount" numeric(12, 2) NOT NULL,
	"status" "expected_status" DEFAULT 'pending' NOT NULL,
	"matched_transaction_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"category" "category" NOT NULL,
	"transaction_type" "transaction_type" NOT NULL,
	"frequency" "frequency" NOT NULL,
	"day_of_month" numeric(2, 0),
	"day_of_week" numeric(1, 0),
	"start_date" date NOT NULL,
	"end_date" date,
	"linked_bank_account_id" uuid,
	"amount_tolerance" numeric(5, 2) DEFAULT '5.00' NOT NULL,
	"date_tolerance" numeric(2, 0) DEFAULT '3' NOT NULL,
	"alert_delay_days" numeric(2, 0) DEFAULT '3' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expected_transactions" ADD CONSTRAINT "expected_transactions_recurring_transaction_id_recurring_transactions_id_fk" FOREIGN KEY ("recurring_transaction_id") REFERENCES "public"."recurring_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expected_transactions" ADD CONSTRAINT "expected_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expected_transactions" ADD CONSTRAINT "expected_transactions_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expected_transactions" ADD CONSTRAINT "expected_transactions_matched_transaction_id_transactions_id_fk" FOREIGN KEY ("matched_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transactions" ADD CONSTRAINT "recurring_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transactions" ADD CONSTRAINT "recurring_transactions_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transactions" ADD CONSTRAINT "recurring_transactions_linked_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("linked_bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expected_transactions_user_id_idx" ON "expected_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "expected_transactions_recurring_id_idx" ON "expected_transactions" USING btree ("recurring_transaction_id");--> statement-breakpoint
CREATE INDEX "expected_transactions_status_idx" ON "expected_transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "expected_transactions_date_idx" ON "expected_transactions" USING btree ("expected_date");--> statement-breakpoint
CREATE INDEX "recurring_transactions_user_id_idx" ON "recurring_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "recurring_transactions_property_id_idx" ON "recurring_transactions" USING btree ("property_id");