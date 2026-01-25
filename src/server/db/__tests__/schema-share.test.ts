import { describe, it, expect } from "vitest";
import {
  portfolioShares,
  portfolioSharesRelations,
  privacyModeEnum,
  type PortfolioShare,
  type NewPortfolioShare,
} from "../schema";

describe("Portfolio shares schema", () => {
  it("exports portfolioShares table", () => {
    expect(portfolioShares).toBeDefined();
    expect(portfolioShares.id).toBeDefined();
    expect(portfolioShares.userId).toBeDefined();
    expect(portfolioShares.token).toBeDefined();
    expect(portfolioShares.title).toBeDefined();
    expect(portfolioShares.privacyMode).toBeDefined();
    expect(portfolioShares.snapshotData).toBeDefined();
    expect(portfolioShares.expiresAt).toBeDefined();
    expect(portfolioShares.viewCount).toBeDefined();
    expect(portfolioShares.createdAt).toBeDefined();
    expect(portfolioShares.lastViewedAt).toBeDefined();
  });

  it("exports privacyModeEnum", () => {
    expect(privacyModeEnum).toBeDefined();
    expect(privacyModeEnum.enumValues).toContain("full");
    expect(privacyModeEnum.enumValues).toContain("summary");
    expect(privacyModeEnum.enumValues).toContain("redacted");
  });

  it("exports portfolioSharesRelations", () => {
    expect(portfolioSharesRelations).toBeDefined();
  });

  it("exports PortfolioShare type", () => {
    const share: Partial<PortfolioShare> = {
      id: "test-id",
      token: "abc123",
      privacyMode: "full",
    };
    expect(share.id).toBe("test-id");
  });

  it("exports NewPortfolioShare type", () => {
    const newShare: Partial<NewPortfolioShare> = {
      userId: "user-id",
      token: "abc123",
      title: "Test Share",
      privacyMode: "full",
    };
    expect(newShare.userId).toBe("user-id");
  });
});
