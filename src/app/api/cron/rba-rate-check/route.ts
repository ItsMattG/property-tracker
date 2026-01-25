import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { rateHistory, refinanceAlerts, loans, users } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";
import { parseRbaCashRate, shouldNotifyRateChange } from "./helpers";
import { sendEmailNotification } from "@/server/services/notification";
import {
  cashRateChangedTemplate,
  cashRateChangedSubject,
} from "@/lib/email/templates/cash-rate-changed";

const RBA_API_URL = "https://api.rba.gov.au/statistics/tables/f1/data.json";

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fetch current RBA cash rate
    const response = await fetch(RBA_API_URL);
    if (!response.ok) {
      console.error("RBA API error:", response.status);
      return NextResponse.json({ error: "RBA API unavailable" }, { status: 503 });
    }

    const data = await response.json();
    const parsed = parseRbaCashRate(data);

    if (!parsed) {
      return NextResponse.json({ error: "Could not parse RBA data" }, { status: 500 });
    }

    // Get previous rate
    const previousRate = await db.query.rateHistory.findFirst({
      orderBy: [desc(rateHistory.rateDate)],
    });

    const previousRateValue = previousRate ? parseFloat(previousRate.cashRate) : null;

    // Check if rate changed
    if (!shouldNotifyRateChange(previousRateValue, parsed.rate)) {
      return NextResponse.json({ message: "No rate change", rate: parsed.rate });
    }

    // Store new rate
    await db.insert(rateHistory).values({
      rateDate: parsed.date,
      cashRate: parsed.rate.toString(),
    });

    // Notify users who have notifyOnCashRateChange enabled
    const alertConfigs = await db
      .select({
        loanId: refinanceAlerts.loanId,
        userId: loans.userId,
      })
      .from(refinanceAlerts)
      .innerJoin(loans, eq(loans.id, refinanceAlerts.loanId))
      .where(eq(refinanceAlerts.notifyOnCashRateChange, true));

    // Get unique user IDs
    const userIds = [...new Set(alertConfigs.map((a) => a.userId))];

    let notified = 0;
    for (const userId of userIds) {
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (user?.email) {
        const changeDirection = parsed.rate < (previousRateValue || 0) ? "decreased" : "increased";

        await sendEmailNotification(
          user.email,
          cashRateChangedSubject({ changeDirection, newRate: parsed.rate }),
          cashRateChangedTemplate({
            oldRate: previousRateValue || 0,
            newRate: parsed.rate,
            changeDirection,
          })
        );
        notified++;
      }
    }

    return NextResponse.json({
      success: true,
      previousRate: previousRateValue,
      newRate: parsed.rate,
      notified,
    });
  } catch (error) {
    console.error("RBA rate check error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
