-- Add trial fields to users table for 14-day free Pro trials
ALTER TABLE "users" ADD COLUMN "trial_started_at" TIMESTAMP;
ALTER TABLE "users" ADD COLUMN "trial_ends_at" TIMESTAMP;
ALTER TABLE "users" ADD COLUMN "trial_plan" VARCHAR(20) DEFAULT 'pro';
