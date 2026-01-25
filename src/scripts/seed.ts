import "dotenv/config";
import { seed, clean } from "@/lib/seed";
import type { SeedMode } from "@/lib/seed";

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  const mode = args.find((a) => ["demo", "dev"].includes(a)) as SeedMode | undefined;
  const clerkIdArg = args.find((a) => a.startsWith("--clerk-id="));
  const clerkId = clerkIdArg?.split("=")[1];
  const shouldClean = args.includes("--clean") || args.includes("clean");
  const forceClean = args.includes("--force");

  // Validate
  if (!clerkId) {
    console.error("Error: --clerk-id=<clerk_id> is required");
    console.log("\nUsage:");
    console.log("  npm run seed:demo -- --clerk-id=user_xxx");
    console.log("  npm run seed:dev -- --clerk-id=user_xxx");
    console.log("  npm run seed:clean -- --clerk-id=user_xxx");
    console.log("\nOptions:");
    console.log("  --clean    Remove existing data before seeding");
    console.log("  --force    Required for clean operation");
    process.exit(1);
  }

  // Handle clean command
  if (shouldClean && !mode) {
    if (!forceClean) {
      console.error("Error: --force flag required to clean data");
      console.log("Run: npm run seed:clean -- --clerk-id=xxx --force");
      process.exit(1);
    }

    console.log(`Cleaning all data for ${clerkId}...`);
    await clean(clerkId);
    console.log("Done!");
    process.exit(0);
  }

  // Handle seed command
  if (!mode) {
    console.error("Error: Mode required (demo or dev)");
    process.exit(1);
  }

  try {
    const summary = await seed({
      clerkId,
      mode,
      clean: shouldClean,
    });

    console.log("\n=== Seed Summary ===");
    console.log(`Properties:    ${summary.properties}`);
    console.log(`Bank Accounts: ${summary.bankAccounts}`);
    console.log(`Transactions:  ${summary.transactions}`);
    console.log(`Loans:         ${summary.loans}`);
    console.log(`Alerts:        ${summary.alerts}`);
    console.log(`Compliance:    ${summary.complianceRecords}`);
    console.log("====================\n");

    process.exit(0);
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  }
}

main();
