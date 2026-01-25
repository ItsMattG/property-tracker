-- Add mobile_password_hash column to users table for mobile app authentication
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mobile_password_hash" text;
