import Link from "next/link";
import { Button } from "@/components/ui/button";

type Plan = "free" | "pro" | "team";

interface PricingCTAProps {
  plan: Plan;
}

const labels: Record<Plan, string> = {
  free: "Start Free",
  pro: "Start Free Trial",
  team: "Start Free Trial",
};

const links: Record<Plan, string> = {
  free: "/sign-up",
  pro: "/sign-up?plan=pro",
  team: "/sign-up?plan=team",
};

export function PricingCTA({ plan }: PricingCTAProps) {
  return (
    <Button
      variant={plan === "pro" ? "default" : "outline"}
      className="w-full"
      asChild
    >
      <Link href={links[plan]}>{labels[plan]}</Link>
    </Button>
  );
}
