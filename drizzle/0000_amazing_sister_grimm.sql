CREATE TYPE "public"."account_type" AS ENUM('transaction', 'savings', 'mortgage', 'offset', 'credit_card', 'line_of_credit');--> statement-breakpoint
CREATE TYPE "public"."category" AS ENUM('rental_income', 'other_rental_income', 'advertising', 'body_corporate', 'borrowing_expenses', 'cleaning', 'council_rates', 'gardening', 'insurance', 'interest_on_loans', 'land_tax', 'legal_expenses', 'pest_control', 'property_agent_fees', 'repairs_and_maintenance', 'capital_works_deductions', 'stationery_and_postage', 'travel_expenses', 'water_charges', 'sundry_rental_expenses', 'stamp_duty', 'conveyancing', 'buyers_agent_fees', 'initial_repairs', 'transfer', 'personal', 'uncategorized');--> statement-breakpoint
CREATE TYPE "public"."loan_type" AS ENUM('principal_and_interest', 'interest_only');--> statement-breakpoint
CREATE TYPE "public"."rate_type" AS ENUM('variable', 'fixed', 'split');--> statement-breakpoint
CREATE TYPE "public"."state" AS ENUM('NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('income', 'expense', 'capital', 'transfer', 'personal');--> statement-breakpoint
CREATE TABLE "bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"basiq_connection_id" text NOT NULL,
	"basiq_account_id" text NOT NULL,
	"institution" text NOT NULL,
	"account_name" text NOT NULL,
	"account_number_masked" text,
	"account_type" "account_type" NOT NULL,
	"default_property_id" uuid,
	"is_connected" boolean DEFAULT true NOT NULL,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bank_accounts_basiq_account_id_unique" UNIQUE("basiq_account_id")
);
--> statement-breakpoint
CREATE TABLE "loans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"lender" text NOT NULL,
	"account_number_masked" text,
	"loan_type" "loan_type" NOT NULL,
	"rate_type" "rate_type" NOT NULL,
	"original_amount" numeric(12, 2) NOT NULL,
	"current_balance" numeric(12, 2) NOT NULL,
	"interest_rate" numeric(5, 2) NOT NULL,
	"fixed_rate_expiry" date,
	"repayment_amount" numeric(12, 2) NOT NULL,
	"repayment_frequency" text NOT NULL,
	"offset_account_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"address" text NOT NULL,
	"suburb" text NOT NULL,
	"state" "state" NOT NULL,
	"postcode" text NOT NULL,
	"purchase_price" numeric(12, 2) NOT NULL,
	"purchase_date" date NOT NULL,
	"entity_name" text DEFAULT 'Personal' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"bank_account_id" uuid,
	"basiq_transaction_id" text,
	"property_id" uuid,
	"date" date NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"category" "category" DEFAULT 'uncategorized' NOT NULL,
	"transaction_type" "transaction_type" DEFAULT 'expense' NOT NULL,
	"is_deductible" boolean DEFAULT false NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_basiq_transaction_id_unique" UNIQUE("basiq_transaction_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_id" text NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_id_unique" UNIQUE("clerk_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_default_property_id_properties_id_fk" FOREIGN KEY ("default_property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_offset_account_id_bank_accounts_id_fk" FOREIGN KEY ("offset_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transactions_user_id_idx" ON "transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transactions_property_id_idx" ON "transactions" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "transactions_date_idx" ON "transactions" USING btree ("date");--> statement-breakpoint
CREATE INDEX "transactions_category_idx" ON "transactions" USING btree ("category");--> statement-breakpoint
CREATE INDEX "transactions_user_date_idx" ON "transactions" USING btree ("user_id","date");