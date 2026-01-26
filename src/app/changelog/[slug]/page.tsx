import { db } from "@/server/db";
import { changelogEntries } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const categoryStyles = {
  feature: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  improvement: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  fix: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
};

const categoryLabels = {
  feature: "New Feature",
  improvement: "Improvement",
  fix: "Fix",
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [entry] = await db
    .select()
    .from(changelogEntries)
    .where(eq(changelogEntries.id, slug));

  if (!entry) {
    return { title: "Not Found - PropertyTracker" };
  }

  return {
    title: `${entry.title} - Changelog - PropertyTracker`,
    description: entry.summary,
  };
}

export default async function ChangelogEntryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [entry] = await db
    .select()
    .from(changelogEntries)
    .where(eq(changelogEntries.id, slug));

  if (!entry) {
    notFound();
  }

  return (
    <main className="py-12 px-4">
      <div className="container mx-auto max-w-3xl">
        <Button variant="ghost" asChild className="mb-8">
          <Link href="/changelog">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Changelog
          </Link>
        </Button>

        <article>
          <div className="flex items-center gap-2 mb-4">
            <Badge variant="secondary" className={categoryStyles[entry.category]}>
              {categoryLabels[entry.category]}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {format(new Date(entry.publishedAt), "MMMM d, yyyy")}
            </span>
          </div>

          <h1 className="text-3xl font-bold mb-4">{entry.title}</h1>
          <p className="text-lg text-muted-foreground mb-8">{entry.summary}</p>

          <div className="prose prose-neutral dark:prose-invert max-w-none">
            {entry.content.split("\n\n").map((paragraph, i) => {
              if (paragraph.startsWith("- ")) {
                const items = paragraph.split("\n").filter((line) => line.startsWith("- "));
                return (
                  <ul key={i}>
                    {items.map((item, j) => (
                      <li key={j} dangerouslySetInnerHTML={{ __html: formatMarkdown(item.slice(2)) }} />
                    ))}
                  </ul>
                );
              }
              return <p key={i} dangerouslySetInnerHTML={{ __html: formatMarkdown(paragraph) }} />;
            })}
          </div>
        </article>
      </div>
    </main>
  );
}

function formatMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}
