-- Create brokers table
CREATE TABLE IF NOT EXISTS "brokers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"company" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Add broker_id to loan_packs
ALTER TABLE "loan_packs" ADD COLUMN "broker_id" uuid;

-- Add foreign key constraint
ALTER TABLE "brokers" ADD CONSTRAINT "brokers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "loan_packs" ADD CONSTRAINT "loan_packs_broker_id_brokers_id_fk" FOREIGN KEY ("broker_id") REFERENCES "public"."brokers"("id") ON DELETE set null ON UPDATE no action;

-- Add indexes
CREATE INDEX IF NOT EXISTS "brokers_user_id_idx" ON "brokers" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "loan_packs_broker_id_idx" ON "loan_packs" USING btree ("broker_id");
