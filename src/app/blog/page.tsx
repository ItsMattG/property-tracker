import { db } from "@/server/db";
import { blogPosts, type BlogPost } from "@/server/db/schema";
import { desc, lte } from "drizzle-orm";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const revalidate = 86400; // Revalidate daily

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://propertytracker.com.au";

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

export default async function BlogPage() {
  const now = new Date().toISOString().split("T")[0];

  // Fetch all published posts (gracefully handle missing DB during build)
  let allPosts: BlogPost[] = [];
  try {
    allPosts = await db
      .select()
      .from(blogPosts)
      .where(lte(blogPosts.publishedAt, now))
      .orderBy(desc(blogPosts.publishedAt));
  } catch {
    // DB unavailable during build
  }

  const fundamentalsPosts = allPosts.filter(
    (p) => p.category === "fundamentals"
  );
  const strategyPosts = allPosts.filter((p) => p.category === "strategy");
  const financePosts = allPosts.filter((p) => p.category === "finance");
  const taxPosts = allPosts.filter((p) => p.category === "tax");
  const advancedPosts = allPosts.filter((p) => p.category === "advanced");

  const renderPosts = (
    posts: typeof allPosts,
    emptyMessage: string
  ) => {
    if (posts.length === 0) {
      return (
        <p className="text-center text-muted-foreground py-8">
          {emptyMessage}
        </p>
      );
    }

    return (
      <div className="grid gap-6 md:grid-cols-2">
        {posts.map((post) => (
          <Link
            key={post.id}
            href={`/blog/${post.slug}`}
            className="block rounded-lg border bg-card p-6 hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-center gap-2 mb-3">
              <Badge
                variant="secondary"
                className={categoryStyles[post.category]}
              >
                {categoryLabels[post.category]}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {format(new Date(post.publishedAt), "MMM d, yyyy")}
              </span>
              <span className="text-sm text-muted-foreground">
                &middot; {estimateReadingTime(post.content)}
              </span>
            </div>
            <h3 className="font-semibold text-lg mb-2">{post.title}</h3>
            <p className="text-sm text-muted-foreground">{post.summary}</p>
          </Link>
        ))}
      </div>
    );
  };

  return (
    <main className="py-12 px-4">
      <div className="container mx-auto max-w-4xl">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Blog",
              name: "PropertyTracker Blog",
              description:
                "Property investment insights for Australian investors",
              url: `${BASE_URL}/blog`,
              publisher: {
                "@type": "Organization",
                name: "PropertyTracker",
                url: BASE_URL,
              },
            }),
          }}
        />

        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Blog</h1>
          <p className="text-xl text-muted-foreground">
            Property investment insights for Australian investors
          </p>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="flex w-full overflow-x-auto mb-8">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="fundamentals">Fundamentals</TabsTrigger>
            <TabsTrigger value="strategy">Strategy</TabsTrigger>
            <TabsTrigger value="finance">Finance</TabsTrigger>
            <TabsTrigger value="tax">Tax</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            {renderPosts(allPosts, "No blog posts yet. Check back soon!")}
          </TabsContent>

          <TabsContent value="fundamentals">
            {renderPosts(fundamentalsPosts, "No fundamentals posts yet.")}
          </TabsContent>

          <TabsContent value="strategy">
            {renderPosts(strategyPosts, "No strategy posts yet.")}
          </TabsContent>

          <TabsContent value="finance">
            {renderPosts(financePosts, "No finance posts yet.")}
          </TabsContent>

          <TabsContent value="tax">
            {renderPosts(taxPosts, "No tax posts yet.")}
          </TabsContent>

          <TabsContent value="advanced">
            {renderPosts(advancedPosts, "No advanced posts yet.")}
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
