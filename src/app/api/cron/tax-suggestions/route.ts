import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { users, notificationPreferences } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import {
  generateAllSuggestions,
  isEofySeason,
  getCurrentFinancialYear,
} from "@/server/services/tax-optimization";
import { sendEmailNotification } from "@/server/services/notification";
import { eofySuggestionsTemplate, eofySuggestionsSubject } from "@/lib/email/templates/eofy-suggestions";

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only run during EOFY season (May-June)
  if (!isEofySeason()) {
    return NextResponse.json({ message: "Not EOFY season, skipping" });
  }

  try {
    // Get all users with email notifications enabled
    const usersToNotify = await db
      .select({
        userId: users.id,
        email: users.email,
      })
      .from(users)
      .innerJoin(
        notificationPreferences,
        eq(notificationPreferences.userId, users.id)
      )
      .where(eq(notificationPreferences.emailEnabled, true));

    let processed = 0;
    let notified = 0;

    for (const user of usersToNotify) {
      try {
        // Generate suggestions for user
        const count = await generateAllSuggestions(user.userId);
        processed++;

        // Send email if they have suggestions
        if (count > 0) {
          const fy = getCurrentFinancialYear();
          const html = eofySuggestionsTemplate({
            suggestionCount: count,
            financialYear: `FY${fy - 1}-${String(fy).slice(-2)}`,
          });

          await sendEmailNotification(user.email, eofySuggestionsSubject(), html);
          notified++;
        }
      } catch (error) {
        console.error(`Failed to process user ${user.userId}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      notified,
    });
  } catch (error) {
    console.error("Tax suggestions cron error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
