import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://propertytracker.com.au";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/blog", "/blog/*", "/changelog", "/changelog/*", "/sign-up", "/sign-in"],
        disallow: [
          "/dashboard",
          "/dashboard/*",
          "/properties",
          "/properties/*",
          "/transactions",
          "/transactions/*",
          "/settings",
          "/settings/*",
          "/api",
          "/api/*",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
