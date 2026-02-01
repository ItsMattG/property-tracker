"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export type UserState = "signed-out" | "free" | "paid";

interface HeroCTAProps {
  userState: UserState;
}

export function HeroCTA({ userState }: HeroCTAProps) {
  if (userState === "paid") {
    return (
      <div className="flex justify-center">
        <Button size="lg" asChild>
          <Link href="/dashboard">
            Open BrickTrack
            <ArrowRight className="ml-2 w-4 h-4" />
          </Link>
        </Button>
      </div>
    );
  }

  if (userState === "free") {
    return (
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Button size="lg" asChild>
          <Link href="/dashboard">
            Open BrickTrack
            <ArrowRight className="ml-2 w-4 h-4" />
          </Link>
        </Button>
        <Button size="lg" variant="outline" asChild>
          <Link href="#pricing">View Pricing</Link>
        </Button>
      </div>
    );
  }

  // signed-out
  return (
    <div className="flex flex-col sm:flex-row gap-4 justify-center">
      <Button size="lg" asChild>
        <Link href="/sign-up">
          Start Free Trial
          <ArrowRight className="ml-2 w-4 h-4" />
        </Link>
      </Button>
      <Button size="lg" variant="outline" asChild>
        <Link href="/sign-in">Sign In</Link>
      </Button>
    </div>
  );
}
