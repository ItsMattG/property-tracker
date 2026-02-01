import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { db } from "@/server/db";
import { subscriptions } from "@/server/db/schema";
import { eq, sql } from "drizzle-orm";

const LIFETIME_LIMIT = 100;

async function getLifetimeCount(): Promise<number> {
  try {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(subscriptions)
      .where(eq(subscriptions.plan, "lifetime"));
    return result?.count ?? 0;
  } catch {
    return 0;
  }
}

export async function LifetimeBanner() {
  const count = await getLifetimeCount();
  const remaining = LIFETIME_LIMIT - count;

  // Hide if sold out
  if (remaining <= 0) return null;

  return (
    <div className="relative mb-8 rounded-xl border border-primary/20 bg-primary/5 p-6">
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <span className="font-semibold">Founding Member Deal</span>
        </div>
        <p className="text-sm text-muted-foreground text-center sm:text-left flex-1">
          Get lifetime Pro access for a one-time payment of $249.
          No subscription ever. <strong>{remaining} of {LIFETIME_LIMIT} spots remaining.</strong>
        </p>
        <Button size="sm" asChild>
          <Link href="/sign-up?plan=lifetime">Claim Lifetime Deal</Link>
        </Button>
      </div>
    </div>
  );
}
