// Features domain: feedback, changelog, blog, support tickets + relations + types
import {
  pgTable, uuid, text, timestamp, boolean, jsonb, integer, varchar, serial, date, index, uniqueIndex,
  relations, sql,
} from "./_common";
import {
  featureRequestStatusEnum, featureRequestCategoryEnum,
  bugReportStatusEnum, bugReportSeverityEnum,
  changelogCategoryEnum, blogCategoryEnum,
  ticketCategoryEnum, ticketStatusEnum, ticketUrgencyEnum,
} from "./enums";
import { users } from "./auth";

export const featureRequests = pgTable(
  "feature_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description").notNull(),
    category: featureRequestCategoryEnum("category").notNull(),
    status: featureRequestStatusEnum("status").default("open").notNull(),
    voteCount: integer("vote_count").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("feature_requests_user_id_idx").on(table.userId),
    index("feature_requests_status_idx").on(table.status),
    index("feature_requests_vote_count_idx").on(table.voteCount),
  ]
);

export const featureVotes = pgTable(
  "feature_votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    featureId: uuid("feature_id")
      .references(() => featureRequests.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("feature_votes_user_feature_idx").on(table.userId, table.featureId),
  ]
);

export const featureComments = pgTable(
  "feature_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    featureId: uuid("feature_id")
      .references(() => featureRequests.id, { onDelete: "cascade" })
      .notNull(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("feature_comments_feature_id_idx").on(table.featureId),
  ]
);

export const bugReports = pgTable(
  "bug_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    description: text("description").notNull(),
    stepsToReproduce: text("steps_to_reproduce"),
    severity: bugReportSeverityEnum("severity").notNull(),
    browserInfo: jsonb("browser_info"),
    currentPage: varchar("current_page", { length: 500 }),
    status: bugReportStatusEnum("status").default("new").notNull(),
    adminNotes: text("admin_notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("bug_reports_user_id_idx").on(table.userId),
    index("bug_reports_status_idx").on(table.status),
    index("bug_reports_severity_idx").on(table.severity),
  ]
);

export const changelogEntries = pgTable("changelog_entries", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  content: text("content").notNull(),
  category: changelogCategoryEnum("category").notNull(),
  publishedAt: date("published_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userChangelogViews = pgTable("user_changelog_views", {
  userId: text("user_id").primaryKey(),
  lastViewedAt: timestamp("last_viewed_at").notNull(),
});

export const blogPosts = pgTable("blog_posts", {
  id: serial("id").primaryKey(),
  slug: text("slug").unique().notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  content: text("content").notNull(),
  category: blogCategoryEnum("category").notNull(),
  tags: text("tags").array().notNull().default(sql`'{}'`),
  author: text("author").notNull(),
  publishedAt: date("published_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const supportTickets = pgTable(
  "support_tickets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    ticketNumber: serial("ticket_number").notNull(),
    category: ticketCategoryEnum("category").notNull(),
    subject: varchar("subject", { length: 200 }).notNull(),
    description: text("description").notNull(),
    urgency: ticketUrgencyEnum("urgency").notNull(),
    status: ticketStatusEnum("status").default("open").notNull(),
    browserInfo: jsonb("browser_info"),
    currentPage: varchar("current_page", { length: 500 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("support_tickets_user_id_idx").on(table.userId),
    index("support_tickets_status_idx").on(table.status),
    index("support_tickets_urgency_idx").on(table.urgency),
    index("support_tickets_category_idx").on(table.category),
  ]
);

export const ticketNotes = pgTable(
  "ticket_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ticketId: uuid("ticket_id")
      .references(() => supportTickets.id, { onDelete: "cascade" })
      .notNull(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    content: text("content").notNull(),
    isInternal: boolean("is_internal").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("ticket_notes_ticket_id_idx").on(table.ticketId),
  ]
);

// Relations
export const featureRequestsRelations = relations(featureRequests, ({ one, many }) => ({
  user: one(users, {
    fields: [featureRequests.userId],
    references: [users.id],
  }),
  votes: many(featureVotes),
  comments: many(featureComments),
}));

export const featureVotesRelations = relations(featureVotes, ({ one }) => ({
  user: one(users, {
    fields: [featureVotes.userId],
    references: [users.id],
  }),
  feature: one(featureRequests, {
    fields: [featureVotes.featureId],
    references: [featureRequests.id],
  }),
}));

export const featureCommentsRelations = relations(featureComments, ({ one }) => ({
  user: one(users, {
    fields: [featureComments.userId],
    references: [users.id],
  }),
  feature: one(featureRequests, {
    fields: [featureComments.featureId],
    references: [featureRequests.id],
  }),
}));

export const bugReportsRelations = relations(bugReports, ({ one }) => ({
  user: one(users, {
    fields: [bugReports.userId],
    references: [users.id],
  }),
}));

export const supportTicketsRelations = relations(supportTickets, ({ many }) => ({
  notes: many(ticketNotes),
}));

export const ticketNotesRelations = relations(ticketNotes, ({ one }) => ({
  ticket: one(supportTickets, {
    fields: [ticketNotes.ticketId],
    references: [supportTickets.id],
  }),
}));

// Type exports
export type FeatureRequest = typeof featureRequests.$inferSelect;
export type NewFeatureRequest = typeof featureRequests.$inferInsert;
export type FeatureVote = typeof featureVotes.$inferSelect;
export type NewFeatureVote = typeof featureVotes.$inferInsert;
export type FeatureComment = typeof featureComments.$inferSelect;
export type NewFeatureComment = typeof featureComments.$inferInsert;
export type BugReport = typeof bugReports.$inferSelect;
export type NewBugReport = typeof bugReports.$inferInsert;
export type ChangelogEntry = typeof changelogEntries.$inferSelect;
export type NewChangelogEntry = typeof changelogEntries.$inferInsert;
export type UserChangelogView = typeof userChangelogViews.$inferSelect;
export type NewUserChangelogView = typeof userChangelogViews.$inferInsert;
export type BlogPost = typeof blogPosts.$inferSelect;
export type NewBlogPost = typeof blogPosts.$inferInsert;
export type SupportTicket = typeof supportTickets.$inferSelect;
export type NewSupportTicket = typeof supportTickets.$inferInsert;
export type TicketNote = typeof ticketNotes.$inferSelect;
export type NewTicketNote = typeof ticketNotes.$inferInsert;
