"use client";

// PostHog temporarily disabled - detectStore() crashes in production
// TODO: Re-enable after upgrading posthog-js or investigating storage detection issue

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
