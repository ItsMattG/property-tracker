import { describe, it, expect } from "vitest";
import {
  getPlanFromSubscription,
  isPlanSufficient,
  PLAN_LIMITS,
} from "../subscription";

describe("subscription service", () => {
  describe("getPlanFromSubscription", () => {
    it("returns free when no subscription", () => {
      expect(getPlanFromSubscription(null)).toBe("free");
    });

    it("returns plan from active subscription", () => {
      expect(
        getPlanFromSubscription({
          plan: "pro",
          status: "active",
          currentPeriodEnd: new Date(Date.now() + 86400000),
        })
      ).toBe("pro");
    });

    it("returns free when subscription is canceled and expired", () => {
      expect(
        getPlanFromSubscription({
          plan: "pro",
          status: "canceled",
          currentPeriodEnd: new Date(Date.now() - 86400000),
        })
      ).toBe("free");
    });

    it("returns plan when canceled but not yet expired", () => {
      expect(
        getPlanFromSubscription({
          plan: "pro",
          status: "canceled",
          currentPeriodEnd: new Date(Date.now() + 86400000),
        })
      ).toBe("pro");
    });

    it("returns free for past_due status", () => {
      expect(
        getPlanFromSubscription({
          plan: "pro",
          status: "past_due",
          currentPeriodEnd: new Date(Date.now() + 86400000),
        })
      ).toBe("free");
    });

    it("returns plan from trialing subscription", () => {
      expect(
        getPlanFromSubscription({
          plan: "team",
          status: "trialing",
          currentPeriodEnd: new Date(Date.now() + 86400000),
        })
      ).toBe("team");
    });
  });

  describe("isPlanSufficient", () => {
    it("free is sufficient for free features", () => {
      expect(isPlanSufficient("free", "free")).toBe(true);
    });

    it("free is not sufficient for pro features", () => {
      expect(isPlanSufficient("free", "pro")).toBe(false);
    });

    it("pro is sufficient for pro features", () => {
      expect(isPlanSufficient("pro", "pro")).toBe(true);
    });

    it("team is sufficient for pro features", () => {
      expect(isPlanSufficient("team", "pro")).toBe(true);
    });

    it("pro is not sufficient for team features", () => {
      expect(isPlanSufficient("pro", "team")).toBe(false);
    });

    it("team is sufficient for team features", () => {
      expect(isPlanSufficient("team", "team")).toBe(true);
    });
  });

  describe("PLAN_LIMITS", () => {
    it("free allows 1 property", () => {
      expect(PLAN_LIMITS.free.maxProperties).toBe(1);
    });

    it("pro allows unlimited properties", () => {
      expect(PLAN_LIMITS.pro.maxProperties).toBe(Infinity);
    });

    it("team allows unlimited properties", () => {
      expect(PLAN_LIMITS.team.maxProperties).toBe(Infinity);
    });

    it("free does not allow bank feeds", () => {
      expect(PLAN_LIMITS.free.bankFeeds).toBe(false);
    });

    it("pro allows bank feeds", () => {
      expect(PLAN_LIMITS.pro.bankFeeds).toBe(true);
    });

    it("free allows 3 property groups", () => {
      expect(PLAN_LIMITS.free.maxPropertyGroups).toBe(3);
    });

    it("pro allows unlimited property groups", () => {
      expect(PLAN_LIMITS.pro.maxPropertyGroups).toBe(Infinity);
    });

    it("team allows unlimited property groups", () => {
      expect(PLAN_LIMITS.team.maxPropertyGroups).toBe(Infinity);
    });

    it("lifetime allows unlimited property groups", () => {
      expect(PLAN_LIMITS.lifetime.maxPropertyGroups).toBe(Infinity);
    });
  });
});
