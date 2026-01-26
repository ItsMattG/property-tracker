CREATE TABLE IF NOT EXISTS "milestone_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"lvr_thresholds" jsonb DEFAULT '[80, 60, 40, 20]' NOT NULL,
	"equity_thresholds" jsonb DEFAULT '[100000, 250000, 500000, 1000000]' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "property_milestone_overrides" (
	"property_id" uuid PRIMARY KEY NOT NULL,
	"lvr_thresholds" jsonb,
	"equity_thresholds" jsonb,
	"enabled" boolean,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "milestone_preferences" ADD CONSTRAINT "milestone_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "property_milestone_overrides" ADD CONSTRAINT "property_milestone_overrides_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
