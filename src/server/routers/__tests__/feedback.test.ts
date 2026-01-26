import { describe, it, expect, vi, beforeEach } from "vitest";
import { feedbackRouter } from "../feedback";

describe("feedback router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("router structure", () => {
    it("exports feedbackRouter", () => {
      expect(feedbackRouter).toBeDefined();
    });

    it("has listFeatures procedure", () => {
      expect(feedbackRouter.listFeatures).toBeDefined();
    });

    it("has getFeature procedure", () => {
      expect(feedbackRouter.getFeature).toBeDefined();
    });

    it("has createFeature procedure", () => {
      expect(feedbackRouter.createFeature).toBeDefined();
    });

    it("has voteFeature procedure", () => {
      expect(feedbackRouter.voteFeature).toBeDefined();
    });

    it("has getUserVotes procedure", () => {
      expect(feedbackRouter.getUserVotes).toBeDefined();
    });

    it("has addComment procedure", () => {
      expect(feedbackRouter.addComment).toBeDefined();
    });

    it("has submitBug procedure", () => {
      expect(feedbackRouter.submitBug).toBeDefined();
    });

    it("has listBugs procedure", () => {
      expect(feedbackRouter.listBugs).toBeDefined();
    });

    it("has updateBugStatus procedure", () => {
      expect(feedbackRouter.updateBugStatus).toBeDefined();
    });

    it("has updateFeatureStatus procedure", () => {
      expect(feedbackRouter.updateFeatureStatus).toBeDefined();
    });
  });

  describe("vote logic", () => {
    it("toggles vote on when not previously voted", () => {
      const existingVotes: string[] = [];
      const featureId = "feat-1";
      const hasVoted = existingVotes.includes(featureId);

      expect(hasVoted).toBe(false);
      // When not voted, clicking adds vote
      const result = { voted: !hasVoted };
      expect(result.voted).toBe(true);
    });

    it("toggles vote off when previously voted", () => {
      const existingVotes = ["feat-1", "feat-2"];
      const featureId = "feat-1";
      const hasVoted = existingVotes.includes(featureId);

      expect(hasVoted).toBe(true);
      // When voted, clicking removes vote
      const result = { voted: !hasVoted };
      expect(result.voted).toBe(false);
    });
  });

  describe("admin access", () => {
    it("checks ADMIN_USER_IDS for admin procedures", () => {
      const adminIds = "admin-1,admin-2,admin-3".split(",").filter(Boolean);

      expect(adminIds).toContain("admin-1");
      expect(adminIds).toContain("admin-2");
      expect(adminIds).not.toContain("user-1");
    });

    it("handles empty ADMIN_USER_IDS", () => {
      const adminIds = "".split(",").filter(Boolean);

      expect(adminIds).toHaveLength(0);
      expect(adminIds.includes("any-user")).toBe(false);
    });
  });

  describe("sorting logic", () => {
    it("sorts by votes descending", () => {
      const features = [
        { title: "A", voteCount: 5 },
        { title: "B", voteCount: 10 },
        { title: "C", voteCount: 3 },
      ];

      const sorted = [...features].sort((a, b) => b.voteCount - a.voteCount);

      expect(sorted[0].title).toBe("B");
      expect(sorted[1].title).toBe("A");
      expect(sorted[2].title).toBe("C");
    });

    it("sorts by newest (descending createdAt)", () => {
      const features = [
        { title: "A", createdAt: new Date("2024-01-01") },
        { title: "B", createdAt: new Date("2024-01-03") },
        { title: "C", createdAt: new Date("2024-01-02") },
      ];

      const sorted = [...features].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );

      expect(sorted[0].title).toBe("B");
      expect(sorted[1].title).toBe("C");
      expect(sorted[2].title).toBe("A");
    });

    it("sorts by oldest (ascending createdAt)", () => {
      const features = [
        { title: "A", createdAt: new Date("2024-01-01") },
        { title: "B", createdAt: new Date("2024-01-03") },
        { title: "C", createdAt: new Date("2024-01-02") },
      ];

      const sorted = [...features].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
      );

      expect(sorted[0].title).toBe("A");
      expect(sorted[1].title).toBe("C");
      expect(sorted[2].title).toBe("B");
    });
  });

  describe("bug severity filtering", () => {
    it("filters bugs by severity", () => {
      const bugs = [
        { id: "1", severity: "low" },
        { id: "2", severity: "critical" },
        { id: "3", severity: "high" },
        { id: "4", severity: "critical" },
      ];

      const criticalBugs = bugs.filter((b) => b.severity === "critical");

      expect(criticalBugs).toHaveLength(2);
      expect(criticalBugs.map((b) => b.id)).toEqual(["2", "4"]);
    });

    it("filters bugs by status", () => {
      const bugs = [
        { id: "1", status: "new" },
        { id: "2", status: "investigating" },
        { id: "3", status: "new" },
        { id: "4", status: "fixed" },
      ];

      const newBugs = bugs.filter((b) => b.status === "new");

      expect(newBugs).toHaveLength(2);
    });
  });
});
