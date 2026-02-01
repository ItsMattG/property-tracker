/**
 * Verify demo user setup in production
 */

import postgres from "postgres";

const DATABASE_URL = process.argv[2] || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("Usage: npx tsx scripts/verify-prod-user.ts <DATABASE_URL>");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { max: 1 });

async function verify() {
  console.log("🔍 Verifying demo user setup...\n");

  // Check user
  console.log("1. Checking users table...");
  const users = await sql`SELECT id, clerk_id, email, name FROM users LIMIT 5`;
  console.log(`   Found ${users.length} users:`);
  users.forEach((u: any) => console.log(`   - ${u.email} (id: ${u.id}, clerk_id: ${u.clerk_id})`));

  // Check subscription
  console.log("\n2. Checking subscriptions...");
  const subs = await sql`SELECT s.*, u.email FROM subscriptions s JOIN users u ON s.user_id = u.id`;
  console.log(`   Found ${subs.length} subscriptions:`);
  subs.forEach((s: any) => console.log(`   - ${s.email}: plan=${s.plan}, status=${s.status}`));

  // Check properties
  console.log("\n3. Checking properties...");
  const props = await sql`SELECT p.*, u.email FROM properties p JOIN users u ON p.user_id = u.id LIMIT 5`;
  console.log(`   Found ${props.length} properties`);

  // Check for RLS
  console.log("\n4. Checking RLS policies...");
  const policies = await sql`
    SELECT schemaname, tablename, policyname, permissive, roles, cmd
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename
    LIMIT 20
  `;
  if (policies.length > 0) {
    console.log(`   Found ${policies.length} RLS policies:`);
    policies.forEach((p: any) => console.log(`   - ${p.tablename}: ${p.policyname} (${p.cmd})`));
  } else {
    console.log("   No RLS policies found");
  }

  // Check if RLS is enabled on tables
  console.log("\n5. Checking if RLS is enabled on key tables...");
  const rlsStatus = await sql`
    SELECT relname, relrowsecurity
    FROM pg_class
    WHERE relname IN ('users', 'properties', 'transactions', 'subscriptions')
    AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  `;
  rlsStatus.forEach((t: any) => console.log(`   - ${t.relname}: RLS ${t.relrowsecurity ? 'ENABLED' : 'disabled'}`));

  console.log("\n✅ Verification complete!");
  await sql.end();
}

verify().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
