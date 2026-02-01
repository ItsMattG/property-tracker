import { db } from "@/server/db";
import { portfolioShares } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { transformForPrivacy, type PortfolioSnapshot, type PrivacyMode } from "@/server/services/share";
import { PortfolioReport } from "@/components/share/PortfolioReport";
import { DownloadPDFButton } from "@/components/share/DownloadPDFButton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, differenceInDays } from "date-fns";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ token: string }>;
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.propertytracker.com.au";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;

  const [share] = await db
    .select()
    .from(portfolioShares)
    .where(eq(portfolioShares.token, token))
    .limit(1);

  if (!share || new Date() > new Date(share.expiresAt)) {
    return {
      title: "Portfolio — BrickTrack",
      description: "Track your investment properties with BrickTrack.",
    };
  }

  const ogImageUrl = `${BASE_URL}/api/og/share/${token}`;

  return {
    title: `${share.title} — BrickTrack`,
    description: "Portfolio snapshot shared via BrickTrack.",
    openGraph: {
      title: `${share.title} — BrickTrack`,
      description: "Portfolio snapshot shared via BrickTrack.",
      type: "website",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: share.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${share.title} — BrickTrack`,
      description: "Portfolio snapshot shared via BrickTrack.",
      images: [ogImageUrl],
    },
  };
}

function getPrivacyLabel(privacyMode: string): string {
  switch (privacyMode) {
    case "full":
      return "Full Details";
    case "summary":
      return "Summary Only";
    case "redacted":
      return "Redacted Values";
    default:
      return privacyMode;
  }
}

export default async function ShareViewPage({ params }: PageProps) {
  const { token } = await params;

  // Query the share by token
  const [share] = await db
    .select()
    .from(portfolioShares)
    .where(eq(portfolioShares.token, token))
    .limit(1);

  // Return 404 if not found
  if (!share) {
    notFound();
  }

  // Check if expired
  const now = new Date();
  const isExpired = now > new Date(share.expiresAt);

  if (isExpired) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="rounded-full bg-muted p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h1 className="text-xl font-semibold mb-2">Link Expired</h1>
            <p className="text-muted-foreground mb-6">
              This portfolio share link has expired and is no longer available.
            </p>
            <Link href="/">
              <Button>Go to BrickTrack</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Update view count (fire and forget)
  db.update(portfolioShares)
    .set({
      viewCount: share.viewCount + 1,
      lastViewedAt: now,
    })
    .where(eq(portfolioShares.id, share.id))
    .execute()
    .catch(() => {
      // Silently ignore errors - don't block page render
    });

  // Parse and transform snapshot data
  const rawSnapshot = share.snapshotData as PortfolioSnapshot;
  const snapshot = transformForPrivacy(rawSnapshot, share.privacyMode as PrivacyMode);

  // Calculate days until expiry
  const daysUntilExpiry = differenceInDays(new Date(share.expiresAt), now);
  const isExpiringSoon = daysUntilExpiry <= 7 && daysUntilExpiry > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold">{share.title}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Snapshot from {format(new Date(share.createdAt), "MMMM d, yyyy")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isExpiringSoon && (
                <Badge variant="warning">
                  Expires in {daysUntilExpiry} day{daysUntilExpiry !== 1 ? "s" : ""}
                </Badge>
              )}
              <Badge variant="secondary">{getPrivacyLabel(share.privacyMode)}</Badge>
              <DownloadPDFButton
                data={snapshot}
                privacyMode={share.privacyMode}
                title={share.title}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <PortfolioReport data={snapshot} privacyMode={share.privacyMode} />
      </main>

      {/* Footer */}
      <footer className="border-t bg-muted/30 mt-auto">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <div>
              <p className="text-sm text-muted-foreground">
                Powered by{" "}
                <Link href="/" className="font-medium text-foreground hover:underline">
                  BrickTrack
                </Link>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Track, analyze, and share your property investment portfolio
              </p>
            </div>
            <Link href="/sign-up">
              <Button variant="outline" size="sm">
                Create Your Free Account
              </Button>
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
