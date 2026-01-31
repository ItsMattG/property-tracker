import { withSentryConfig } from "@sentry/nextjs";
import bundleAnalyzer from "@next/bundle-analyzer";
import type { NextConfig } from "next";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

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
