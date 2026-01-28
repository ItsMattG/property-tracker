import { db } from "@/server/db";
import { blogPosts } from "@/server/db/schema";
import { eq, and, lte, desc, ne } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

const categoryStyles: Record<string, string> = {
  fundamentals:
    "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  strategy:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  finance:
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  tax: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  advanced: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const categoryLabels: Record<string, string> = {
  fundamentals: "Fundamentals",
  strategy: "Strategy",
  finance: "Finance",
  tax: "Tax",
  advanced: "Advanced",
};

function estimateReadingTime(content: string): string {
  const words = content.split(/\s+/).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} min read`;
}

function formatMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://propertytracker.com.au";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const now = new Date().toISOString().split("T")[0];
  const [post] = await db
    .select()
    .from(blogPosts)
    .where(and(eq(blogPosts.slug, slug), lte(blogPosts.publishedAt, now)));

  if (!post) {
    return { title: "Not Found - PropertyTracker" };
  }

  const url = `${BASE_URL}/blog/${post.slug}`;

  return {
    title: `${post.title} - Blog - PropertyTracker`,
    description: post.summary,
    openGraph: {
      title: post.title,
      description: post.summary,
      type: "article",
      url,
      publishedTime: post.publishedAt,
      authors: [post.author],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.summary,
    },
    alternates: {
      canonical: url,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const now = new Date().toISOString().split("T")[0];

  const [post] = await db
    .select()
    .from(blogPosts)
    .where(and(eq(blogPosts.slug, slug), lte(blogPosts.publishedAt, now)));

  if (!post) {
    notFound();
  }

  // Get related articles (same category, max 3, excluding current)
  const relatedPosts = await db
    .select({
      slug: blogPosts.slug,
      title: blogPosts.title,
      summary: blogPosts.summary,
      category: blogPosts.category,
      publishedAt: blogPosts.publishedAt,
    })
    .from(blogPosts)
    .where(
      and(
        eq(blogPosts.category, post.category),
        ne(blogPosts.slug, post.slug),
        lte(blogPosts.publishedAt, now)
      )
    )
    .orderBy(desc(blogPosts.publishedAt))
    .limit(3);

  // JSON-LD structured data
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.summary,
    datePublished: post.publishedAt,
    author: {
      "@type": "Organization",
      name: post.author,
    },
    publisher: {
      "@type": "Organization",
      name: "PropertyTracker",
      url: BASE_URL,
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${BASE_URL}/blog/${post.slug}`,
    },
  };

  return (
    <main className="py-12 px-4">
      <div className="container mx-auto max-w-3xl">
        <Button variant="ghost" asChild className="mb-8">
          <Link href="/blog">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Blog
          </Link>
        </Button>

        {/* JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        <article>
          <div className="flex items-center gap-2 mb-4">
            <Badge
              variant="secondary"
              className={categoryStyles[post.category]}
            >
              {categoryLabels[post.category]}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {format(new Date(post.publishedAt), "MMMM d, yyyy")}
            </span>
            <span className="text-sm text-muted-foreground">
              &middot; {estimateReadingTime(post.content)}
            </span>
          </div>

          <h1 className="text-3xl font-bold mb-2">{post.title}</h1>
          <p className="text-lg text-muted-foreground mb-8">{post.summary}</p>

          <div className="prose prose-neutral dark:prose-invert max-w-none">
            {post.content.split("\n\n").map((paragraph, i) => {
              // Headings
              if (paragraph.startsWith("## ")) {
                return (
                  <h2 key={i} className="text-xl font-semibold mt-8 mb-4">
                    {paragraph.slice(3)}
                  </h2>
                );
              }
              // Lists
              if (paragraph.startsWith("- ")) {
                const items = paragraph
                  .split("\n")
                  .filter((line) => line.startsWith("- "));
                return (
                  <ul key={i}>
                    {items.map((item, j) => (
                      <li
                        key={j}
                        dangerouslySetInnerHTML={{
                          __html: formatMarkdown(item.slice(2)),
                        }}
                      />
                    ))}
                  </ul>
                );
              }
              // Regular paragraphs
              return (
                <p
                  key={i}
                  dangerouslySetInnerHTML={{
                    __html: formatMarkdown(paragraph),
                  }}
                />
              );
            })}
          </div>
        </article>

        {/* Related articles */}
        {relatedPosts.length > 0 && (
          <section className="mt-16 pt-8 border-t">
            <h2 className="text-xl font-semibold mb-6">Related articles</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {relatedPosts.map((related) => (
                <Link
                  key={related.slug}
                  href={`/blog/${related.slug}`}
                  className="block rounded-lg border bg-card p-4 hover:bg-accent/50 transition-colors"
                >
                  <Badge
                    variant="secondary"
                    className={`${categoryStyles[related.category]} mb-2`}
                  >
                    {categoryLabels[related.category]}
                  </Badge>
                  <h3 className="font-semibold mb-1">{related.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {related.summary}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="mt-16 rounded-xl bg-primary text-primary-foreground p-8 text-center">
          <h2 className="text-2xl font-bold mb-2">
            Track your property portfolio
          </h2>
          <p className="mb-6 opacity-90">
            Automated bank feeds, tax reports, and portfolio analytics for
            Australian investors.
          </p>
          <Button size="lg" variant="secondary" asChild>
            <Link href="/sign-up">
              Start Free
              <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
          </Button>
        </section>
      </div>
    </main>
  );
}
