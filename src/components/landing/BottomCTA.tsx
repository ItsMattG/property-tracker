import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function BottomCTA() {
  return (
    <Button size="lg" variant="secondary" asChild>
      <Link href="/sign-up">
        Get Started Free
        <ArrowRight className="ml-2 w-4 h-4" />
      </Link>
    </Button>
  );
}
