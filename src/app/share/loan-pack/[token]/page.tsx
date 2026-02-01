import { db } from "@/server/db";
import { loanPacks } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { LoanPackReport } from "@/components/loanPack/LoanPackReport";
import { DownloadLoanPackPDFButton } from "@/components/loanPack/DownloadLoanPackPDFButton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { format, differenceInDays } from "date-fns";
import Link from "next/link";
import type { LoanPackSnapshot } from "@/server/services/loanPack";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function LoanPackViewPage({ params }: PageProps) {
  const { token } = await params;

  const [pack] = await db.select().from(loanPacks).where(eq(loanPacks.token, token)).limit(1);

  if (!pack) notFound();

  const now = new Date();
  const isExpired = now > new Date(pack.expiresAt);

  if (isExpired) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="rounded-full bg-muted p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold mb-2">Report Expired</h1>
            <p className="text-muted-foreground mb-6">This loan pack report has expired and is no longer available.</p>
            <Link href="/"><Button>Go to BrickTrack</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Update access tracking
  db.update(loanPacks).set({ accessCount: pack.accessCount + 1, accessedAt: now }).where(eq(loanPacks.id, pack.id)).execute().catch(() => {});

  const snapshot = pack.snapshotData as LoanPackSnapshot;
  const daysUntilExpiry = differenceInDays(new Date(pack.expiresAt), now);
  const isExpiringSoon = daysUntilExpiry <= 3 && daysUntilExpiry > 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold">Loan Application Pack</h1>
              <p className="text-sm text-muted-foreground mt-1">Generated for {snapshot.userName} on {format(new Date(snapshot.generatedAt), "MMMM d, yyyy")}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isExpiringSoon && <Badge variant="secondary">Expires in {daysUntilExpiry} day{daysUntilExpiry !== 1 ? "s" : ""}</Badge>}
              <Badge variant="secondary">Expires {format(new Date(pack.expiresAt), "MMM d, yyyy")}</Badge>
              <DownloadLoanPackPDFButton data={snapshot} />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <LoanPackReport data={snapshot} />
      </main>

      <footer className="border-t bg-muted/30 mt-auto">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <div>
              <p className="text-sm text-muted-foreground">Powered by <Link href="/" className="font-medium text-foreground hover:underline">BrickTrack</Link></p>
              <p className="text-xs text-muted-foreground mt-1">Track, analyze, and share your property investment portfolio</p>
            </div>
            <Link href="/sign-up"><Button variant="outline" size="sm">Create Your Free Account</Button></Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
