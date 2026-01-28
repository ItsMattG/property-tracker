-- Referral status enum
DO $$ BEGIN
  CREATE TYPE "referral_status" AS ENUM ('pending', 'qualified', 'rewarded', 'expired');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Referral codes table
CREATE TABLE IF NOT EXISTS "referral_codes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "code" text NOT NULL UNIQUE,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Referrals table
CREATE TABLE IF NOT EXISTS "referrals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "referrer_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "referee_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "referral_code_id" uuid NOT NULL REFERENCES "referral_codes"("id") ON DELETE CASCADE,
  "status" "referral_status" DEFAULT 'pending' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "qualified_at" timestamp,
  "rewarded_at" timestamp
);

CREATE INDEX IF NOT EXISTS "referrals_referrer_idx" ON "referrals" ("referrer_user_id");
CREATE INDEX IF NOT EXISTS "referrals_referee_idx" ON "referrals" ("referee_user_id");

-- Referral credits table
CREATE TABLE IF NOT EXISTS "referral_credits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "referral_id" uuid NOT NULL REFERENCES "referrals"("id") ON DELETE CASCADE,
  "months_free" integer DEFAULT 1 NOT NULL,
  "applied_at" timestamp,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
