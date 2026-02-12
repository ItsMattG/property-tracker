"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";
import Link from "next/link";

interface UpgradePromptProps {
  feature: string;
  description: string;
  plan?: "pro" | "team";
}

export function UpgradePrompt({
  feature,
  description,
  plan = "pro",
}: UpgradePromptProps) {
  const planName = plan === "team" ? "Team" : "Pro";
  const price = plan === "team" ? "$39/mo" : "$19/mo";

  return (
    <Card className="border-dashed">
      <CardContent className="pt-6 text-center">
        <Zap className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
        <h3 className="font-semibold mb-1">{feature}</h3>
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
        <Link href="/settings/billing" prefetch={false}>
          <Button size="sm">
            Upgrade to {planName} — {price}
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
