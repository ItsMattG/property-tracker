CREATE TYPE "public"."property_status" AS ENUM('active', 'sold');--> statement-breakpoint
CREATE TABLE "property_sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"sale_price" numeric(12, 2) NOT NULL,
	"settlement_date" date NOT NULL,
	"contract_date" date,
	"agent_commission" numeric(12, 2) DEFAULT '0' NOT NULL,
	"legal_fees" numeric(12, 2) DEFAULT '0' NOT NULL,
	"marketing_costs" numeric(12, 2) DEFAULT '0' NOT NULL,
	"other_selling_costs" numeric(12, 2) DEFAULT '0' NOT NULL,
	"cost_base" numeric(12, 2) NOT NULL,
	"capital_gain" numeric(12, 2) NOT NULL,
	"discounted_gain" numeric(12, 2),
	"held_over_twelve_months" boolean NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "status" "property_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "sold_at" date;--> statement-breakpoint
ALTER TABLE "property_sales" ADD CONSTRAINT "property_sales_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_sales" ADD CONSTRAINT "property_sales_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;