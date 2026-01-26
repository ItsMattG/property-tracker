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
import { verifyCronRequest, unauthorizedResponse } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!verifyCronRequest(request.headers)) {
    return unauthorizedResponse();
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
        logger.error("Failed to process user", error, { userId: user.userId });
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      notified,
    });
  } catch (error) {
    logger.error("Tax suggestions cron error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
