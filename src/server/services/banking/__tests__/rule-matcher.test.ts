import { describe, it, expect } from "vitest";
import { matchTransaction } from "../rule-matcher";
import type { CategorizationRule } from "@/server/db/schema/categorization-rules";

const mockRule = (overrides: Partial<CategorizationRule> = {}): CategorizationRule => ({
  id: "rule-1",
  userId: "user-1",
  name: "Body Corp Rule",
  merchantPattern: "Body Corporate",
  descriptionPattern: null,
  matchType: "contains",
  amountMin: null,
  amountMax: null,
  targetCategory: "body_corporate",
  targetPropertyId: "prop-1",
  priority: 0,
  isActive: true,
  matchCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("matchTransaction", () => {
  it("matches merchant name with contains", () => {
    const rules = [mockRule()];
    const result = matchTransaction(rules, {
      merchant: "Body Corporate ABC Pty Ltd",
      description: "Monthly levy",
      amount: -450,
    });
    expect(result).not.toBeNull();
    expect(result!.targetCategory).toBe("body_corporate");
  });

  it("returns null when no rules match", () => {
    const rules = [mockRule()];
    const result = matchTransaction(rules, {
      merchant: "Bunnings Warehouse",
      description: "Paint supplies",
      amount: -89,
    });
    expect(result).toBeNull();
  });

  it("respects priority ordering (higher priority first)", () => {
    const rules = [
      mockRule({ id: "low", priority: 0, targetCategory: "sundry_rental_expenses" }),
      mockRule({ id: "high", priority: 10, targetCategory: "body_corporate" }),
    ];
    const result = matchTransaction(rules, {
      merchant: "Body Corporate ABC",
      description: "",
      amount: -450,
    });
    expect(result!.id).toBe("high");
  });

  it("matches description pattern", () => {
    const rules = [
      mockRule({
        merchantPattern: null,
        descriptionPattern: "levy",
      }),
    ];
    const result = matchTransaction(rules, {
      merchant: "Unknown Corp",
      description: "Quarterly levy payment",
      amount: -450,
    });
    expect(result).not.toBeNull();
  });

  it("matches amount range when specified", () => {
    const rules = [
      mockRule({
        amountMin: -500,
        amountMax: -100,
        merchantPattern: null,
        descriptionPattern: "levy",
      }),
    ];
    const result = matchTransaction(rules, {
      merchant: "Unknown",
      description: "Quarterly levy payment",
      amount: -450,
    });
    expect(result).not.toBeNull();
  });

  it("rejects amount outside range", () => {
    const rules = [
      mockRule({
        amountMin: -500,
        amountMax: -100,
        merchantPattern: null,
        descriptionPattern: "levy",
      }),
    ];
    const result = matchTransaction(rules, {
      merchant: "Unknown",
      description: "Quarterly levy payment",
      amount: -50,
    });
    expect(result).toBeNull();
  });

  it("skips inactive rules", () => {
    const rules = [mockRule({ isActive: false })];
    const result = matchTransaction(rules, {
      merchant: "Body Corporate ABC",
      description: "",
      amount: -450,
    });
    expect(result).toBeNull();
  });

  it("matches with equals match type", () => {
    const rules = [mockRule({ matchType: "equals", merchantPattern: "bunnings" })];
    const result = matchTransaction(rules, {
      merchant: "Bunnings",
      description: "",
      amount: -100,
    });
    expect(result).not.toBeNull();
  });

  it("does not match partial with equals match type", () => {
    const rules = [mockRule({ matchType: "equals", merchantPattern: "bunnings" })];
    const result = matchTransaction(rules, {
      merchant: "Bunnings Warehouse",
      description: "",
      amount: -100,
    });
    expect(result).toBeNull();
  });

  it("matches with starts_with match type", () => {
    const rules = [mockRule({ matchType: "starts_with", merchantPattern: "Bunnings" })];
    const result = matchTransaction(rules, {
      merchant: "Bunnings Warehouse",
      description: "",
      amount: -100,
    });
    expect(result).not.toBeNull();
  });

  it("matches with regex match type", () => {
    const rules = [mockRule({ matchType: "regex", merchantPattern: "^(body|strata)\\s+corp" })];
    const result = matchTransaction(rules, {
      merchant: "Body Corporate Services",
      description: "",
      amount: -450,
    });
    expect(result).not.toBeNull();
  });

  it("handles invalid regex gracefully", () => {
    const rules = [mockRule({ matchType: "regex", merchantPattern: "[invalid(" })];
    const result = matchTransaction(rules, {
      merchant: "Body Corporate",
      description: "",
      amount: -450,
    });
    expect(result).toBeNull();
  });

  it("requires at least one pattern to match (no pattern-less rules)", () => {
    const rules = [mockRule({ merchantPattern: null, descriptionPattern: null })];
    const result = matchTransaction(rules, {
      merchant: "Anything",
      description: "Anything",
      amount: -100,
    });
    expect(result).toBeNull();
  });

  it("requires all specified conditions to match (AND logic)", () => {
    const rules = [
      mockRule({
        merchantPattern: "Real Estate",
        descriptionPattern: "rent",
      }),
    ];
    // Merchant matches but description does not
    const result = matchTransaction(rules, {
      merchant: "Real Estate Agency",
      description: "management fee",
      amount: -200,
    });
    expect(result).toBeNull();
  });

  it("matches when all specified conditions match", () => {
    const rules = [
      mockRule({
        merchantPattern: "Real Estate",
        descriptionPattern: "rent",
      }),
    ];
    const result = matchTransaction(rules, {
      merchant: "Real Estate Agency",
      description: "Rent payment received",
      amount: 1500,
    });
    expect(result).not.toBeNull();
  });

  it("matching is case-insensitive", () => {
    const rules = [mockRule({ merchantPattern: "body corporate" })];
    const result = matchTransaction(rules, {
      merchant: "BODY CORPORATE SERVICES",
      description: "",
      amount: -300,
    });
    expect(result).not.toBeNull();
  });
});
