import { ImageResponse } from "next/og";
import { db } from "@/server/db";
import { portfolioShares } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import type { PortfolioSnapshot, PrivacyMode } from "@/server/services/share";

export const runtime = "nodejs";

const FALLBACK_URL = "/og-image.svg";

function formatCurrency(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  return `$${(value / 1000).toFixed(0)}K`;
}

function getEquityLabel(snapshot: PortfolioSnapshot): string | null {
  const { totalValue, totalDebt } = snapshot.summary;
  if (totalValue && totalDebt) {
    const equityPercent = (((totalValue - totalDebt) / totalValue) * 100).toFixed(0);
    return `${equityPercent}% Equity`;
  }
  return null;
}

function getSuburbList(snapshot: PortfolioSnapshot): string | null {
  if (!snapshot.properties || snapshot.properties.length === 0) return null;
  return snapshot.properties
    .map((p) => p.suburb)
    .filter(Boolean)
    .slice(0, 4)
    .join(" \u00b7 ");
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const [share] = await db
      .select()
      .from(portfolioShares)
      .where(eq(portfolioShares.token, token))
      .limit(1);

    if (!share) {
      return Response.redirect(new URL(FALLBACK_URL, request.url), 302);
    }

    if (new Date() > new Date(share.expiresAt)) {
      return Response.redirect(new URL(FALLBACK_URL, request.url), 302);
    }

    const snapshot = share.snapshotData as PortfolioSnapshot;
    const privacyMode = share.privacyMode as PrivacyMode;
    const { summary } = snapshot;

    const showValue = privacyMode !== "redacted" && summary.totalValue;
    const showEquity = privacyMode !== "redacted";
    const showSuburbs = privacyMode === "full";
    const suburbs = showSuburbs ? getSuburbList(snapshot) : null;
    const equityLabel = showEquity ? getEquityLabel(snapshot) : null;

    return new ImageResponse(
      (
        <div
          style={{
            width: "1200px",
            height: "630px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "60px",
            background: "linear-gradient(135deg, #1e40af 0%, #7c3aed 100%)",
            color: "white",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: "32px", fontWeight: 700 }}>PropertyTracker</div>
            <div style={{ fontSize: "24px", opacity: 0.8 }}>Portfolio Share</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
            {showValue ? (
              <>
                <div style={{ fontSize: "72px", fontWeight: 700 }}>
                  {formatCurrency(summary.totalValue!)}
                </div>
                <div style={{ fontSize: "28px", opacity: 0.8 }}>Portfolio Value</div>
              </>
            ) : (
              <div style={{ fontSize: "56px", fontWeight: 700 }}>Portfolio Overview</div>
            )}

            <div style={{ display: "flex", gap: "48px", marginTop: "16px" }}>
              <div style={{ fontSize: "24px", opacity: 0.9 }}>
                {summary.propertyCount} {summary.propertyCount === 1 ? "Property" : "Properties"}
              </div>
              {equityLabel && (
                <div style={{ fontSize: "24px", opacity: 0.9 }}>
                  {equityLabel}
                </div>
              )}
            </div>

            {suburbs && (
              <div style={{ fontSize: "22px", opacity: 0.7, marginTop: "8px" }}>
                {suburbs}
              </div>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ fontSize: "20px", opacity: 0.6 }}>propertytracker.com.au</div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        headers: {
          "Cache-Control": "public, max-age=3600, s-maxage=3600",
        },
      }
    );
  } catch {
    return Response.redirect(new URL(FALLBACK_URL, request.url), 302);
  }
}
