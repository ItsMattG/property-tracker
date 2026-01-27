-- drizzle/0018_onboarding_tours.sql
ALTER TABLE "user_onboarding" ADD COLUMN "completed_tours" text[] DEFAULT '{}' NOT NULL;
ALTER TABLE "user_onboarding" ADD COLUMN "tours_disabled" boolean DEFAULT false NOT NULL;
