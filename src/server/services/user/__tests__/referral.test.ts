import { describe, it, expect } from "vitest";
import { generateReferralCode } from "../referral";

describe("referral service", () => {
  it("generates a code with REF- prefix", () => {
    const code = generateReferralCode();
    expect(code).toMatch(/^REF-[A-Za-z0-9_-]+$/);
    expect(code.length).toBeGreaterThan(6);
  });

  it("generates unique codes", () => {
    const codes = new Set(Array.from({ length: 100 }, () => generateReferralCode()));
    expect(codes.size).toBe(100);
  });
});
