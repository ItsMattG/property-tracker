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
