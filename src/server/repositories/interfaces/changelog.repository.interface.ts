import type { ChangelogEntry, UserChangelogView } from "../../db/schema";

export interface ChangelogListResult {
  entries: ChangelogEntry[];
  nextCursor: string | undefined;
}

export interface IChangelogRepository {
  findMany(opts: { category?: string; cursor?: string; limit: number }): Promise<ChangelogListResult>;
  findById(id: string): Promise<ChangelogEntry | null>;
  countNewerThan(date: Date): Promise<number>;
  countAll(): Promise<number>;
  findUserView(userId: string): Promise<UserChangelogView | null>;
  upsertUserView(userId: string): Promise<void>;
}
