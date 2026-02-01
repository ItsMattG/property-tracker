/**
 * Sync schema to production database
 * Run with: npx tsx scripts/sync-prod-schema.ts
 */

import postgres from "postgres";

const DATABASE_URL = process.argv[2] || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("Usage: npx tsx scripts/sync-prod-schema.ts <DATABASE_URL>");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, {
  max: 1,
  idle_timeout: 0,
  connect_timeout: 30,
});

async function runMigrations() {
  console.log("🚀 Starting schema sync...\n");

  const migrations = [
    // Enums
    {
      name: "Create enums",
      sql: `
        DO $$ BEGIN CREATE TYPE "subscription_plan" AS ENUM ('free', 'pro', 'team'); EXCEPTION WHEN duplicate_object THEN null; END $$;
        DO $$ BEGIN CREATE TYPE "subscription_status" AS ENUM ('active', 'past_due', 'canceled', 'trialing', 'incomplete'); EXCEPTION WHEN duplicate_object THEN null; END $$;
      `,
    },
    // Subscriptions table
    {
      name: "Create subscriptions table",
      sql: `
        CREATE TABLE IF NOT EXISTS "subscriptions" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "stripe_customer_id" text NOT NULL,
          "stripe_subscription_id" text,
          "plan" "subscription_plan" DEFAULT 'free' NOT NULL,
          "status" "subscription_status" DEFAULT 'active' NOT NULL,
          "current_period_end" timestamp,
          "cancel_at_period_end" boolean DEFAULT false NOT NULL,
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL,
          CONSTRAINT "subscriptions_user_id_unique" UNIQUE("user_id"),
          CONSTRAINT "subscriptions_stripe_customer_id_unique" UNIQUE("stripe_customer_id")
        );
      `,
    },
    // Check existing tables
    {
      name: "Check tables",
      sql: `
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name;
      `,
      isQuery: true,
    },
  ];

  for (const migration of migrations) {
    try {
      console.log(`📦 ${migration.name}...`);
      if (migration.isQuery) {
        const result = await sql.unsafe(migration.sql);
        console.log(`   Tables in database: ${result.map((r: any) => r.table_name).join(", ")}`);
      } else {
        await sql.unsafe(migration.sql);
      }
      console.log(`   ✅ Done\n`);
    } catch (error: any) {
      console.log(`   ⚠️ ${error.message}\n`);
    }
  }

  // Insert demo subscription if it doesn't exist
  console.log("📦 Creating demo user subscription...");
  try {
    await sql`
      INSERT INTO subscriptions (user_id, stripe_customer_id, plan, status)
      SELECT
        '590a1169-aae6-4cf6-b0d6-b3b92cb667cc',
        'cus_demo_user',
        'pro',
        'active'
      WHERE NOT EXISTS (
        SELECT 1 FROM subscriptions WHERE user_id = '590a1169-aae6-4cf6-b0d6-b3b92cb667cc'
      );
    `;
    console.log("   ✅ Done\n");
  } catch (error: any) {
    console.log(`   ⚠️ ${error.message}\n`);
  }

  // Verify subscription exists
  console.log("📦 Verifying demo subscription...");
  const subs = await sql`SELECT * FROM subscriptions WHERE user_id = '590a1169-aae6-4cf6-b0d6-b3b92cb667cc'`;
  if (subs.length > 0) {
    console.log(`   ✅ Demo subscription exists: plan=${subs[0].plan}, status=${subs[0].status}\n`);
  } else {
    console.log("   ❌ Demo subscription not found\n");
  }

  console.log("✅ Schema sync complete!");
  await sql.end();
}

runMigrations().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
