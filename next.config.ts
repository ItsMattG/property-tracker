import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

// Only load bundle analyzer when ANALYZE is set (avoids type errors in CI)
const withBundleAnalyzer =
  process.env.ANALYZE === "true"
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("@next/bundle-analyzer")({ enabled: true })
    : (config: NextConfig) => config;

// Common security headers (non-CSP)
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

// Standard CSP for most pages
const standardCSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://js.stripe.com https://*.posthog.com https://challenges.cloudflare.com https://*.cloudflare.com https://maps.googleapis.com https://va.vercel-scripts.com https://vercel.live",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://vercel.live",
  "img-src 'self' data: blob: https://*.supabase.co https://img.logo.dev https://fonts.gstatic.com https://maps.gstatic.com https://maps.googleapis.com https://*.posthog.com https://vercel.live",
  "font-src 'self' https://fonts.gstatic.com https://vercel.live",
  "connect-src 'self' https://*.supabase.co https://api.stripe.com https://*.posthog.com https://*.bricktrack.au wss://*.bricktrack.au https://api.basiq.io https://sentry.io https://*.ingest.sentry.io https://img.logo.dev https://*.cloudflare.com https://maps.googleapis.com https://places.googleapis.com https://va.vercel-scripts.com https://vitals.vercel-insights.com https://vercel.live wss://ws-us3.pusher.com",
  "frame-src 'self' https://js.stripe.com https://*.bricktrack.au https://challenges.cloudflare.com https://*.cloudflare.com https://vercel.live",
  "worker-src 'self' blob:",
].join("; ");

// Restrictive CSP for auth pages (login/signup handle credentials)
const authCSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://*.cloudflare.com https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data:",
  "font-src 'self' https://fonts.gstatic.com",
  "connect-src 'self' https://*.supabase.co https://*.bricktrack.au https://sentry.io https://*.ingest.sentry.io https://va.vercel-scripts.com https://vitals.vercel-insights.com",
  "frame-src 'self' https://challenges.cloudflare.com https://*.cloudflare.com",
  "worker-src 'self'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      // Auth pages - restrictive CSP (credentials handling)
      {
        source: "/sign-in/:path*",
        headers: [
          ...securityHeaders,
          { key: "Content-Security-Policy", value: authCSP },
        ],
      },
      {
        source: "/sign-up/:path*",
        headers: [
          ...securityHeaders,
          { key: "Content-Security-Policy", value: authCSP },
        ],
      },
      // All other pages - standard CSP
      {
        source: "/((?!sign-in|sign-up).*)",
        headers: [
          ...securityHeaders,
          { key: "Content-Security-Policy", value: standardCSP },
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
