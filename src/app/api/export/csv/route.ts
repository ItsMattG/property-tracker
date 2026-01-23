import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import {
  generateTransactionsCSV,
  generateAnnualSummaryCSV,
} from "@/server/services/export";

export async function GET(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user from database
    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, clerkId),
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type") || "transactions";
    const propertyId = searchParams.get("propertyId") || undefined;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const includePersonal = searchParams.get("includePersonal") === "true";

    const options = {
      userId: user.id,
      propertyId,
      startDate,
      endDate,
      includePersonal,
    };

    let csvContent: string;
    let filename: string;

    if (type === "summary") {
      csvContent = await generateAnnualSummaryCSV(options);
      filename = `property-tracker-summary-${startDate}-${endDate}.csv`;
    } else {
      csvContent = await generateTransactionsCSV(options);
      filename = `property-tracker-transactions-${startDate}-${endDate}.csv`;
    }

    // Return CSV as downloadable file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: "Export failed" },
      { status: 500 }
    );
  }
}
