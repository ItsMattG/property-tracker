import posthog from "posthog-js";

// Temporarily disabled - PostHog detectStore() crashes in production
// TODO: Upgrade posthog-js or investigate storage detection issue
export function initPostHog() {
  // No-op: PostHog disabled due to production crash
}

export { posthog };
