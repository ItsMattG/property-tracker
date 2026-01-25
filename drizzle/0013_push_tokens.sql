-- Create push_tokens table for mobile push notifications
CREATE TABLE IF NOT EXISTS "push_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL UNIQUE,
	"platform" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "push_tokens_platform_check" CHECK ("platform" IN ('ios', 'android'))
);

-- Add foreign key constraint
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

-- Add index for efficient user lookup
CREATE INDEX IF NOT EXISTS "push_tokens_user_id_idx" ON "push_tokens" USING btree ("user_id");
