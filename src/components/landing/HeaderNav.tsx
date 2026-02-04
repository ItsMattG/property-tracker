import Link from "next/link";
import { Button } from "@/components/ui/button";

export function HeaderNav() {
  return (
    <div className="hidden md:flex items-center gap-4">
      <Button variant="ghost" asChild>
        <Link href="/blog">Blog</Link>
      </Button>
      <Button variant="ghost" asChild>
        <Link href="/sign-in">Sign In</Link>
      </Button>
      <Button asChild>
        <Link href="/sign-up">Get Started</Link>
      </Button>
    </div>
  );
}
