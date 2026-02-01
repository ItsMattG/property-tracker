"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { initPostHog, posthog } from "@/lib/posthog";
import { useUser } from "@clerk/nextjs";

function PostHogPageTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Track page views on route change
  useEffect(() => {
    if (!pathname) return;
    try {
      posthog.capture("$pageview", {
        $current_url: window.location.href,
      });
    } catch (error) {
      console.warn("PostHog pageview capture failed:", error);
    }
  }, [pathname, searchParams]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();

  useEffect(() => {
    initPostHog();
  }, []);

  // Identify user
  useEffect(() => {
    if (user?.id) {
      try {
        posthog.identify(user.id, {
          email: user.primaryEmailAddress?.emailAddress,
          name: user.fullName,
        });
      } catch (error) {
        console.warn("PostHog identify failed:", error);
      }
    }
  }, [user]);

  return (
    <>
      <Suspense fallback={null}>
        <PostHogPageTracker />
      </Suspense>
      {children}
    </>
  );
}
