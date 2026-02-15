import { eq, and, desc, asc, sql } from "drizzle-orm";
import {
  featureRequests,
  featureVotes,
  featureComments,
  bugReports,
  users,
} from "../db/schema";
import type { FeatureRequest, NewFeatureRequest, FeatureComment, BugReport } from "../db/schema";
import { BaseRepository, type DB } from "./base";
import type {
  IFeedbackRepository,
  FeatureListFilters,
  FeatureWithUser,
  FeatureCommentWithUser,
  BugListFilters,
  BugWithUser,
} from "./interfaces/feedback.repository.interface";

export class FeedbackRepository
  extends BaseRepository
  implements IFeedbackRepository
{
  async listFeatures(filters: FeatureListFilters): Promise<FeatureWithUser[]> {
    const conditions = filters.status
      ? eq(featureRequests.status, filters.status)
      : undefined;

    const orderBy =
      filters.sortBy === "votes"
        ? desc(featureRequests.voteCount)
        : filters.sortBy === "newest"
          ? desc(featureRequests.createdAt)
          : asc(featureRequests.createdAt);

    return this.db
      .select({
        id: featureRequests.id,
        title: featureRequests.title,
        description: featureRequests.description,
        category: featureRequests.category,
        status: featureRequests.status,
        voteCount: featureRequests.voteCount,
        createdAt: featureRequests.createdAt,
        userName: users.name,
      })
      .from(featureRequests)
      .leftJoin(users, eq(featureRequests.userId, users.id))
      .where(conditions)
      .orderBy(orderBy)
      .limit(filters.limit)
      .offset(filters.offset);
  }

  async findFeatureById(
    id: string
  ): Promise<(FeatureWithUser & { comments: FeatureCommentWithUser[] }) | null> {
    const [feature] = await this.db
      .select({
        id: featureRequests.id,
        title: featureRequests.title,
        description: featureRequests.description,
        category: featureRequests.category,
        status: featureRequests.status,
        voteCount: featureRequests.voteCount,
        createdAt: featureRequests.createdAt,
        userName: users.name,
      })
      .from(featureRequests)
      .leftJoin(users, eq(featureRequests.userId, users.id))
      .where(eq(featureRequests.id, id));

    if (!feature) return null;

    const comments = await this.db
      .select({
        id: featureComments.id,
        content: featureComments.content,
        createdAt: featureComments.createdAt,
        userName: users.name,
      })
      .from(featureComments)
      .leftJoin(users, eq(featureComments.userId, users.id))
      .where(eq(featureComments.featureId, id))
      .orderBy(asc(featureComments.createdAt));

    return { ...feature, comments };
  }

  async createFeature(
    userId: string,
    data: Pick<NewFeatureRequest, "title" | "description" | "category">
  ): Promise<FeatureRequest> {
    const [feature] = await this.db
      .insert(featureRequests)
      .values({
        userId,
        title: data.title,
        description: data.description,
        category: data.category,
      })
      .returning();
    return feature;
  }

  async toggleVote(
    userId: string,
    featureId: string
  ): Promise<{ voted: boolean }> {
    const [existingVote] = await this.db
      .select()
      .from(featureVotes)
      .where(
        and(
          eq(featureVotes.userId, userId),
          eq(featureVotes.featureId, featureId)
        )
      );

    if (existingVote) {
      await this.db
        .delete(featureVotes)
        .where(eq(featureVotes.id, existingVote.id));
      await this.db
        .update(featureRequests)
        .set({ voteCount: sql`${featureRequests.voteCount} - 1` })
        .where(eq(featureRequests.id, featureId));
      return { voted: false };
    }

    await this.db.insert(featureVotes).values({ userId, featureId });
    await this.db
      .update(featureRequests)
      .set({ voteCount: sql`${featureRequests.voteCount} + 1` })
      .where(eq(featureRequests.id, featureId));
    return { voted: true };
  }

  async getUserVotes(userId: string): Promise<string[]> {
    const votes = await this.db
      .select({ featureId: featureVotes.featureId })
      .from(featureVotes)
      .where(eq(featureVotes.userId, userId));
    return votes.map((v) => v.featureId);
  }

  async addComment(
    userId: string,
    featureId: string,
    content: string
  ): Promise<FeatureComment> {
    const [comment] = await this.db
      .insert(featureComments)
      .values({ featureId, userId, content })
      .returning();
    return comment;
  }

  async listBugs(filters: BugListFilters): Promise<BugWithUser[]> {
    const conditions = [];
    if (filters.status) conditions.push(eq(bugReports.status, filters.status));
    if (filters.severity)
      conditions.push(eq(bugReports.severity, filters.severity));

    const whereClause =
      conditions.length === 0
        ? undefined
        : conditions.length === 1
          ? conditions[0]
          : and(conditions[0], conditions[1]);

    return this.db
      .select({
        id: bugReports.id,
        description: bugReports.description,
        stepsToReproduce: bugReports.stepsToReproduce,
        severity: bugReports.severity,
        browserInfo: bugReports.browserInfo,
        currentPage: bugReports.currentPage,
        status: bugReports.status,
        adminNotes: bugReports.adminNotes,
        createdAt: bugReports.createdAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(bugReports)
      .leftJoin(users, eq(bugReports.userId, users.id))
      .where(whereClause)
      .orderBy(desc(bugReports.createdAt))
      .limit(filters.limit)
      .offset(filters.offset);
  }

  async updateBugStatus(
    id: string,
    data: Partial<BugReport>,
    tx?: DB
  ): Promise<BugReport> {
    const client = this.resolve(tx);
    const [updated] = await client
      .update(bugReports)
      .set(data)
      .where(eq(bugReports.id, id))
      .returning();
    return updated;
  }

  async updateFeatureStatus(
    id: string,
    status: FeatureRequest["status"],
    tx?: DB
  ): Promise<FeatureRequest> {
    const client = this.resolve(tx);
    const [updated] = await client
      .update(featureRequests)
      .set({ status, updatedAt: new Date() })
      .where(eq(featureRequests.id, id))
      .returning();
    return updated;
  }
}
