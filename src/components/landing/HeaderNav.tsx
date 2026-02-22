import Link from "next/link";
import { Button } from "@/components/ui/button";

export function HeaderNav() {
  return (
    <div className="hidden md:flex items-center gap-4">
      <Link href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
        Features
      </Link>
      <Link href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
        Pricing
      </Link>
      <Link href="#faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
        FAQ
      </Link>
      <Button variant="ghost" asChild>
        <Link href="/sign-in">Sign In</Link>
      </Button>
      <Button asChild>
        <Link href="/sign-up">Get Started</Link>
      </Button>
    </div>
  );
}
