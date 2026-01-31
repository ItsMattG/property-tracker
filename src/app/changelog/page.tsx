import { db } from "@/server/db";
import { changelogEntries } from "@/server/db/schema";
import { desc, eq } from "drizzle-orm";
import { ChangelogEntry } from "@/components/changelog/ChangelogEntry";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const revalidate = 3600; // Revalidate hourly

async function getEntries(category?: "feature" | "improvement" | "fix") {
  const conditions = category ? eq(changelogEntries.category, category) : undefined;

  try {
    return await db
      .select()
      .from(changelogEntries)
      .where(conditions)
      .orderBy(desc(changelogEntries.publishedAt));
  } catch {
    // DB unavailable during build
    return [];
  }
}

export default async function ChangelogPage() {
  const allEntries = await getEntries();
  const featureEntries = await getEntries("feature");
  const improvementEntries = await getEntries("improvement");
  const fixEntries = await getEntries("fix");

  return (
    <main className="py-12 px-4">
      <div className="container mx-auto max-w-3xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Changelog</h1>
          <p className="text-xl text-muted-foreground">
            See what&apos;s new in PropertyTracker
          </p>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="features">Features</TabsTrigger>
            <TabsTrigger value="improvements">Improvements</TabsTrigger>
            <TabsTrigger value="fixes">Fixes</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            {allEntries.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No updates yet. Check back soon!
              </p>
            ) : (
              allEntries.map((entry) => (
                <ChangelogEntry key={entry.id} entry={entry} />
              ))
            )}
          </TabsContent>

          <TabsContent value="features" className="space-y-4">
            {featureEntries.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No feature updates yet.
              </p>
            ) : (
              featureEntries.map((entry) => (
                <ChangelogEntry key={entry.id} entry={entry} />
              ))
            )}
          </TabsContent>

          <TabsContent value="improvements" className="space-y-4">
            {improvementEntries.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No improvements yet.
              </p>
            ) : (
              improvementEntries.map((entry) => (
                <ChangelogEntry key={entry.id} entry={entry} />
              ))
            )}
          </TabsContent>

          <TabsContent value="fixes" className="space-y-4">
            {fixEntries.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No fixes yet.
              </p>
            ) : (
              fixEntries.map((entry) => (
                <ChangelogEntry key={entry.id} entry={entry} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
