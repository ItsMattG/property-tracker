CREATE TABLE IF NOT EXISTS "loan_packs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "token" text NOT NULL UNIQUE,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "accessed_at" timestamp with time zone,
  "access_count" integer DEFAULT 0 NOT NULL,
  "snapshot_data" jsonb NOT NULL
);

ALTER TABLE "loan_packs" ADD CONSTRAINT "loan_packs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "loan_packs_user_id_idx" ON "loan_packs" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "loan_packs_token_idx" ON "loan_packs" USING btree ("token");
CREATE INDEX IF NOT EXISTS "loan_packs_expires_at_idx" ON "loan_packs" USING btree ("expires_at");
