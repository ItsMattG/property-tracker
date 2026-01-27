"use client";

import { useState, useEffect } from "react";
import { X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const DISMISSED_KEY = "lifetime-banner-dismissed";

export function LifetimeBanner() {
  const [dismissed, setDismissed] = useState(true); // Start hidden to avoid flash

  useEffect(() => {
    const wasDismissed = localStorage.getItem(DISMISSED_KEY);
    if (!wasDismissed) {
      setDismissed(false);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(DISMISSED_KEY, "true");
  };

  if (dismissed) return null;

  return (
    <div className="relative mb-8 rounded-xl border border-primary/20 bg-primary/5 p-6">
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
        aria-label="Dismiss banner"
      >
        <X className="w-4 h-4" />
      </button>
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <span className="font-semibold">Founding Member Deal</span>
        </div>
        <p className="text-sm text-muted-foreground text-center sm:text-left flex-1">
          Get lifetime Pro access for a one-time payment of $249.
          No subscription ever. Limited to first 100 founding members.
        </p>
        <Button size="sm" asChild>
          <Link href="/sign-up?plan=lifetime">Claim Lifetime Deal</Link>
        </Button>
      </div>
    </div>
  );
}
