import type { MetadataRoute } from "next";
import { db } from "@/server/db";
import { blogPosts } from "@/server/db/schema";
import { lte, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://propertytracker.com.au";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date().toISOString().split("T")[0];

  // Fetch published blog posts (gracefully handle missing table)
  let posts: { slug: string; publishedAt: string }[] = [];
  try {
    posts = await db
      .select({
        slug: blogPosts.slug,
        publishedAt: blogPosts.publishedAt,
      })
      .from(blogPosts)
      .where(lte(blogPosts.publishedAt, now))
      .orderBy(desc(blogPosts.publishedAt));
  } catch {
    // Table may not exist during build
  }

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/blog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/changelog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/sign-up`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/sign-in`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  // Blog post pages
  const blogPages: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${BASE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.publishedAt),
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  return [...staticPages, ...blogPages];
}
