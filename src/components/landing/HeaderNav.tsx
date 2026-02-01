"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

interface HeaderNavProps {
  isSignedIn: boolean;
}

export function HeaderNav({ isSignedIn }: HeaderNavProps) {
  if (isSignedIn) {
    return (
      <div className="hidden md:flex items-center gap-4">
        <Button variant="ghost" asChild>
          <Link href="/blog">Blog</Link>
        </Button>
        <Button asChild>
          <Link href="/dashboard">Open BrickTrack</Link>
        </Button>
      </div>
    );
  }

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
