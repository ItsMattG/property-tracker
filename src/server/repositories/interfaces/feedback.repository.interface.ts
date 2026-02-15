import type { FeatureRequest, NewFeatureRequest, FeatureComment, BugReport } from "../../db/schema";
import type { DB } from "../base";

export interface FeatureListFilters {
  status?: "open" | "planned" | "in_progress" | "shipped" | "rejected";
  sortBy: "votes" | "newest" | "oldest";
  limit: number;
  offset: number;
}

export interface FeatureWithUser {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  voteCount: number;
  createdAt: Date;
  userName: string | null;
}

export interface FeatureCommentWithUser {
  id: string;
  content: string;
  createdAt: Date;
  userName: string | null;
}

export interface BugListFilters {
  status?: "new" | "investigating" | "fixed" | "wont_fix";
  severity?: "low" | "medium" | "high" | "critical";
  limit: number;
  offset: number;
}

export interface BugWithUser {
  id: string;
  description: string;
  stepsToReproduce: string | null;
  severity: string;
  browserInfo: unknown;
  currentPage: string | null;
  status: string;
  adminNotes: string | null;
  createdAt: Date;
  userName: string | null;
  userEmail: string | null;
}

export interface IFeedbackRepository {
  listFeatures(filters: FeatureListFilters): Promise<FeatureWithUser[]>;
  findFeatureById(id: string): Promise<(FeatureWithUser & { comments: FeatureCommentWithUser[] }) | null>;
  createFeature(userId: string, data: Pick<NewFeatureRequest, "title" | "description" | "category">): Promise<FeatureRequest>;
  toggleVote(userId: string, featureId: string): Promise<{ voted: boolean }>;
  getUserVotes(userId: string): Promise<string[]>;
  addComment(userId: string, featureId: string, content: string): Promise<FeatureComment>;
  listBugs(filters: BugListFilters): Promise<BugWithUser[]>;
  updateBugStatus(id: string, data: Partial<BugReport>, tx?: DB): Promise<BugReport>;
  updateFeatureStatus(id: string, status: FeatureRequest["status"], tx?: DB): Promise<FeatureRequest>;
}
