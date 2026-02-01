"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

type Plan = "free" | "pro" | "team";

interface PricingCTAProps {
  isSignedIn: boolean;
  plan: Plan;
}

const signedOutLabels: Record<Plan, string> = {
  free: "Start Free",
  pro: "Start Free Trial",
  team: "Start Free Trial",
};

const signedOutLinks: Record<Plan, string> = {
  free: "/sign-up",
  pro: "/sign-up?plan=pro",
  team: "/sign-up?plan=team",
};

export function PricingCTA({ isSignedIn, plan }: PricingCTAProps) {
  if (isSignedIn) {
    return (
      <Button
        variant={plan === "pro" ? "default" : "outline"}
        className="w-full"
        asChild
      >
        <Link href="/dashboard">Open BrickTrack</Link>
      </Button>
    );
  }

  return (
    <Button
      variant={plan === "pro" ? "default" : "outline"}
      className="w-full"
      asChild
    >
      <Link href={signedOutLinks[plan]}>{signedOutLabels[plan]}</Link>
    </Button>
  );
}
