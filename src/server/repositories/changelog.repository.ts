import { eq, and, gt, desc, sql } from "drizzle-orm";

import { changelogEntries, userChangelogViews } from "../db/schema";
import type { ChangelogEntry, UserChangelogView } from "../db/schema";
import { BaseRepository } from "./base";
import type {
  IChangelogRepository,
  ChangelogListResult,
} from "./interfaces/changelog.repository.interface";

export class ChangelogRepository
  extends BaseRepository
  implements IChangelogRepository
{
  async findMany(opts: {
    category?: string;
    cursor?: string;
    limit: number;
  }): Promise<ChangelogListResult> {
    const conditions = [];

    if (opts.category) {
      conditions.push(
        eq(changelogEntries.category, opts.category as "feature" | "improvement" | "fix")
      );
    }

    if (opts.cursor) {
      conditions.push(gt(changelogEntries.id, opts.cursor));
    }

    const entries = await this.db
      .select()
      .from(changelogEntries)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(changelogEntries.publishedAt))
      .limit(opts.limit + 1);

    let nextCursor: string | undefined;
    if (entries.length > opts.limit) {
      const nextItem = entries.pop();
      nextCursor = nextItem?.id;
    }

    return { entries, nextCursor };
  }

  async findById(id: string): Promise<ChangelogEntry | null> {
    const [entry] = await this.db
      .select()
      .from(changelogEntries)
      .where(eq(changelogEntries.id, id));
    return entry ?? null;
  }

  async countNewerThan(date: Date): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(changelogEntries)
      .where(gt(changelogEntries.createdAt, date));
    return result?.count ?? 0;
  }

  async countAll(): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(changelogEntries);
    return result?.count ?? 0;
  }

  async findUserView(userId: string): Promise<UserChangelogView | null> {
    const [view] = await this.db
      .select()
      .from(userChangelogViews)
      .where(eq(userChangelogViews.userId, userId));
    return view ?? null;
  }

  async upsertUserView(userId: string): Promise<void> {
    await this.db
      .insert(userChangelogViews)
      .values({ userId, lastViewedAt: new Date() })
      .onConflictDoUpdate({
        target: userChangelogViews.userId,
        set: { lastViewedAt: new Date() },
      });
  }
}
