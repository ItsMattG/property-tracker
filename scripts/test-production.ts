/**
 * Quick production health check
 */

import { chromium } from "playwright";

const BASE_URL = "https://www.bricktrack.au";

async function testHealth() {
  console.log("🔍 Testing production health...\n");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Test health endpoint
  console.log("1. Testing /api/health...");
  await page.goto(`${BASE_URL}/api/health`);
  const healthText = await page.textContent("body");
  console.log(`   Response: ${healthText}\n`);

  // Parse and check
  try {
    const health = JSON.parse(healthText || "{}");
    if (health.status === "healthy") {
      console.log("   ✅ Database connection is HEALTHY");
      console.log(`   Response time: ${health.responseTimeMs}ms`);
    } else {
      console.log("   ❌ Database connection is UNHEALTHY");
      console.log(`   Details: ${JSON.stringify(health)}`);
    }
  } catch (e) {
    console.log("   ❌ Could not parse health response");
  }

  await browser.close();
}

testHealth();
