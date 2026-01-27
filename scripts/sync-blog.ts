import { config } from "dotenv";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import matter from "gray-matter";
import { z } from "zod";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { blogPosts } from "../src/server/db/schema";
import { eq, notInArray } from "drizzle-orm";

config({ path: ".env.local" });

const BLOG_DIR = join(process.cwd(), "content", "blog");

const frontmatterSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  category: z.enum(["fundamentals", "strategy", "finance", "tax", "advanced"]),
  publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tags: z.array(z.string()).min(1),
  author: z.string().min(1),
});

const filenameSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}-.+\.md$/);

async function syncBlog() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL not set");
  }

  const client = postgres(connectionString, { prepare: false });
  const db = drizzle(client);

  console.log("Syncing blog posts...");

  let files: string[];
  try {
    files = await readdir(BLOG_DIR);
  } catch {
    console.log("No blog directory found, creating empty sync");
    files = [];
  }

  const validSlugs: string[] = [];
  const errors: string[] = [];

  for (const file of files) {
    const filenameResult = filenameSchema.safeParse(file);
    if (!filenameResult.success) {
      errors.push(`Invalid filename: ${file} (expected YYYY-MM-DD-slug.md)`);
      continue;
    }

    const slug = file.replace(/\.md$/, "").replace(/^\d{4}-\d{2}-\d{2}-/, "");
    const filePath = join(BLOG_DIR, file);
    const rawContent = await readFile(filePath, "utf-8");
    const { data: frontmatter, content: markdownContent } = matter(rawContent);

    const result = frontmatterSchema.safeParse(frontmatter);
    if (!result.success) {
      errors.push(`Invalid frontmatter in ${file}: ${result.error.message}`);
      continue;
    }

    const { title, summary, category, publishedAt, tags, author } = result.data;

    const fileDate = file.substring(0, 10);
    if (fileDate !== publishedAt) {
      errors.push(`Date mismatch in ${file}: filename=${fileDate}, frontmatter=${publishedAt}`);
      continue;
    }

    validSlugs.push(slug);

    // Upsert blog post
    const existing = await db
      .select()
      .from(blogPosts)
      .where(eq(blogPosts.slug, slug));

    if (existing.length > 0) {
      await db
        .update(blogPosts)
        .set({
          title,
          summary,
          content: markdownContent.trim(),
          category,
          tags,
          author,
          publishedAt,
        })
        .where(eq(blogPosts.slug, slug));
    } else {
      await db.insert(blogPosts).values({
        slug,
        title,
        summary,
        content: markdownContent.trim(),
        category,
        tags,
        author,
        publishedAt,
      });
    }

    console.log(`  ✓ ${slug}`);
  }

  // Delete posts not in filesystem
  if (validSlugs.length > 0) {
    await db
      .delete(blogPosts)
      .where(notInArray(blogPosts.slug, validSlugs));
  } else {
    await db.delete(blogPosts);
  }

  if (errors.length > 0) {
    console.log("\nWarnings:");
    errors.forEach((e) => console.log(`  ⚠ ${e}`));
  }

  console.log(`\nSync complete: ${validSlugs.length} posts`);

  await client.end();
}

syncBlog().catch((e) => {
  console.error("Sync failed:", e);
  process.exit(1);
});
