import { db } from "@/server/db";
import { properties } from "@/server/db/schema";
import { getClimateRisk } from "@/server/services/property-analysis";
import { isNull, eq } from "drizzle-orm";

async function backfillClimateRisk() {
  console.log("Starting climate risk backfill...");

  const propertiesWithoutRisk = await db
    .select()
    .from(properties)
    .where(isNull(properties.climateRisk));

  console.log(`Found ${propertiesWithoutRisk.length} properties to update`);

  for (const property of propertiesWithoutRisk) {
    const climateRisk = getClimateRisk(property.postcode);

    await db
      .update(properties)
      .set({ climateRisk })
      .where(eq(properties.id, property.id));

    console.log(`Updated ${property.address} (${property.postcode}): ${climateRisk.overallRisk} risk`);
  }

  console.log("Backfill complete!");
}

backfillClimateRisk()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exit(1);
  });
