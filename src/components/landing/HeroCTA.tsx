import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function HeroCTA() {
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
