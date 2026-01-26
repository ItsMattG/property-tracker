-- Create enums for similar properties feature
CREATE TYPE "share_level" AS ENUM ('none', 'anonymous', 'pseudonymous', 'controlled');
CREATE TYPE "listing_source_type" AS ENUM ('url', 'text', 'manual');
CREATE TYPE "property_type" AS ENUM ('house', 'townhouse', 'unit');

-- Create external_listings table
CREATE TABLE IF NOT EXISTS "external_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source_type" "listing_source_type" NOT NULL,
	"source_url" text,
	"raw_input" text,
	"extracted_data" jsonb NOT NULL,
	"suburb" text NOT NULL,
	"state" "state" NOT NULL,
	"postcode" text NOT NULL,
	"property_type" "property_type" DEFAULT 'house' NOT NULL,
	"price" numeric(12, 2),
	"estimated_yield" numeric(5, 2),
	"estimated_growth" numeric(5, 2),
	"is_estimated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "external_listings_user_id_idx" ON "external_listings" USING btree ("user_id");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "external_listings" ADD CONSTRAINT "external_listings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Create property_vectors table
CREATE TABLE IF NOT EXISTS "property_vectors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid,
	"external_listing_id" uuid,
	"user_id" uuid NOT NULL,
	"vector" vector(5) NOT NULL,
	"is_shared" boolean DEFAULT false NOT NULL,
	"share_level" "share_level" DEFAULT 'none' NOT NULL,
	"shared_attributes" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vector_source_check" CHECK (
		(property_id IS NOT NULL AND external_listing_id IS NULL) OR
		(property_id IS NULL AND external_listing_id IS NOT NULL)
	)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "property_vectors_user_id_idx" ON "property_vectors" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "property_vectors_property_id_idx" ON "property_vectors" USING btree ("property_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "property_vectors_is_shared_idx" ON "property_vectors" USING btree ("is_shared");
--> statement-breakpoint
-- Create IVFFlat index for similarity search (optimize for ~10k vectors initially)
CREATE INDEX IF NOT EXISTS "property_vectors_vector_idx" ON "property_vectors" USING ivfflat ("vector" vector_l2_ops) WITH (lists = 100);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "property_vectors" ADD CONSTRAINT "property_vectors_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "property_vectors" ADD CONSTRAINT "property_vectors_external_listing_id_external_listings_id_fk" FOREIGN KEY ("external_listing_id") REFERENCES "public"."external_listings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "property_vectors" ADD CONSTRAINT "property_vectors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Create sharing_preferences table
CREATE TABLE IF NOT EXISTS "sharing_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL UNIQUE,
	"default_share_level" "share_level" DEFAULT 'none' NOT NULL,
	"default_shared_attributes" jsonb DEFAULT '["suburb", "state", "propertyType", "priceBracket", "yield"]' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sharing_preferences" ADD CONSTRAINT "sharing_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
