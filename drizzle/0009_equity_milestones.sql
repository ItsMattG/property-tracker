-- Custom migration for equity_milestones
DO $$ BEGIN
    CREATE TYPE "public"."milestone_type" AS ENUM('lvr', 'equity_amount');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "equity_milestones" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "property_id" uuid NOT NULL,
    "user_id" uuid NOT NULL,
    "milestone_type" "milestone_type" NOT NULL,
    "milestone_value" numeric(12, 2) NOT NULL,
    "equity_at_achievement" numeric(12, 2) NOT NULL,
    "lvr_at_achievement" numeric(5, 2) NOT NULL,
    "achieved_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
    ALTER TABLE "equity_milestones" ADD CONSTRAINT "equity_milestones_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "equity_milestones" ADD CONSTRAINT "equity_milestones_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "equity_milestones_property_id_idx" ON "equity_milestones" USING btree ("property_id");
CREATE INDEX IF NOT EXISTS "equity_milestones_user_id_idx" ON "equity_milestones" USING btree ("user_id");
