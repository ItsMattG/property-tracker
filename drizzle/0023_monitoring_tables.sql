CREATE TABLE IF NOT EXISTS "cron_heartbeats" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "cron_name" text NOT NULL UNIQUE,
  "last_run_at" timestamp NOT NULL,
  "status" text NOT NULL,
  "duration_ms" integer NOT NULL,
  "metadata" jsonb,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "monitor_state" (
  "id" text PRIMARY KEY NOT NULL,
  "last_status" text NOT NULL,
  "last_checked_at" timestamp NOT NULL,
  "failing_since" timestamp,
  "consecutive_failures" integer DEFAULT 0 NOT NULL
);
