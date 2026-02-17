"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { authClient } from "@/lib/auth-client";
import { initPostHog, posthog } from "@/lib/posthog";

function PostHogPageTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    try {
      posthog.capture("$pageview", { $current_url: window.location.href });
    } catch {
      // silently ignore if PostHog not initialized
    }
  }, [pathname, searchParams]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = authClient.useSession();

  useEffect(() => {
    initPostHog();
  }, []);

  useEffect(() => {
    if (session?.user?.id) {
      try {
        posthog.identify(session.user.id, {
          email: session.user.email,
          name: session.user.name,
        });
      } catch {
        // silently ignore if PostHog not initialized
      }
    }
  }, [session?.user?.id, session?.user?.email, session?.user?.name]);

  return (
    <>
      <Suspense fallback={null}>
        <PostHogPageTracker />
      </Suspense>
      {children}
    </>
  );
}
