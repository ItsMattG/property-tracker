import { config } from "dotenv";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import matter from "gray-matter";
import { z } from "zod";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { changelogEntries } from "../src/server/db/schema";
import { notInArray } from "drizzle-orm";

config({ path: ".env.local" });

const CHANGELOG_DIR = join(process.cwd(), "content", "changelog");

const frontmatterSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  category: z.enum(["feature", "improvement", "fix"]),
  publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const filenameSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}-.+\.md$/);

async function syncChangelog() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL not set");
  }

  const client = postgres(connectionString, { prepare: false });
  const db = drizzle(client);

  console.log("Syncing changelog entries...");

  let files: string[];
  try {
    files = await readdir(CHANGELOG_DIR);
  } catch {
    console.log("No changelog directory found, creating empty sync");
    files = [];
  }

  const validSlugs: string[] = [];
  const errors: string[] = [];

  for (const file of files) {
    // Validate filename
    const filenameResult = filenameSchema.safeParse(file);
    if (!filenameResult.success) {
      errors.push(`Invalid filename: ${file} (expected YYYY-MM-DD-slug.md)`);
      continue;
    }

    const slug = file.replace(/\.md$/, "").replace(/^\d{4}-\d{2}-\d{2}-/, "");
    const filePath = join(CHANGELOG_DIR, file);
    const content = await readFile(filePath, "utf-8");
    const { data: frontmatter, content: markdownContent } = matter(content);

    // Validate frontmatter
    const result = frontmatterSchema.safeParse(frontmatter);
    if (!result.success) {
      errors.push(`Invalid frontmatter in ${file}: ${result.error.message}`);
      continue;
    }

    const { title, summary, category, publishedAt } = result.data;

    // Validate date matches filename
    const fileDate = file.substring(0, 10);
    if (fileDate !== publishedAt) {
      errors.push(`Date mismatch in ${file}: filename=${fileDate}, frontmatter=${publishedAt}`);
      continue;
    }

    validSlugs.push(slug);

    // Upsert entry
    await db
      .insert(changelogEntries)
      .values({
        id: slug,
        title,
        summary,
        content: markdownContent.trim(),
        category,
        publishedAt,
      })
      .onConflictDoUpdate({
        target: changelogEntries.id,
        set: {
          title,
          summary,
          content: markdownContent.trim(),
          category,
          publishedAt,
        },
      });

    console.log(`  ✓ ${slug}`);
  }

  // Delete entries not in filesystem
  if (validSlugs.length > 0) {
    await db
      .delete(changelogEntries)
      .where(notInArray(changelogEntries.id, validSlugs));
  } else {
    // If no valid files, delete all entries
    await db.delete(changelogEntries);
  }

  if (errors.length > 0) {
    console.log("\nWarnings:");
    errors.forEach((e) => console.log(`  ⚠ ${e}`));
  }

  console.log(`\nSync complete: ${validSlugs.length} entries`);

  await client.end();
}

syncChangelog().catch((e) => {
  console.error("Sync failed:", e);
  process.exit(1);
});
