import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

// Only load bundle analyzer when ANALYZE is set (avoids type errors in CI)
const withBundleAnalyzer =
  process.env.ANALYZE === "true"
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("@next/bundle-analyzer")({ enabled: true })
    : (config: NextConfig) => config;

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://*.posthog.com https://*.clerk.accounts.dev https://clerk.bricktrack.au https://challenges.cloudflare.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: blob: https: http:",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self' https://*.supabase.co https://api.stripe.com https://*.posthog.com https://*.clerk.accounts.dev https://*.clerk.dev wss://*.clerk.accounts.dev https://*.bricktrack.au wss://*.bricktrack.au https://api.basiq.io https://sentry.io https://*.ingest.sentry.io https://img.logo.dev",
              "frame-src 'self' https://js.stripe.com https://*.clerk.accounts.dev https://*.bricktrack.au https://challenges.cloudflare.com",
              "worker-src 'self' blob:",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(
  withSentryConfig(nextConfig, {
    // Sentry webpack plugin options
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,

    // Only upload source maps in CI
    silent: !process.env.CI,

    // Upload source maps for better stack traces
    widenClientFileUpload: true,

    // Hide source maps from client bundles
    sourcemaps: {
      deleteSourcemapsAfterUpload: true,
    },

    // Tree shake Sentry from client bundles when not needed
    bundleSizeOptimizations: {
      excludeDebugStatements: true,
      excludeReplayIframe: true,
      excludeReplayShadowDom: true,
    },
  })
);
