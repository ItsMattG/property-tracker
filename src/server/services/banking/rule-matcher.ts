import type { CategorizationRule } from "@/server/db/schema/categorization-rules";

export interface TransactionInput {
  merchant: string;
  description: string;
  amount: number;
}

/**
 * Match a transaction against user-defined categorization rules.
 * Rules are sorted by priority (highest first), and the first match wins.
 * Returns the matching rule or null if no rule matches.
 */
export function matchTransaction(
  rules: CategorizationRule[],
  txn: TransactionInput,
): CategorizationRule | null {
  const sorted = [...rules]
    .filter((r) => r.isActive)
    .sort((a, b) => b.priority - a.priority);

  for (const rule of sorted) {
    if (matchesRule(rule, txn)) return rule;
  }
  return null;
}

function matchesRule(rule: CategorizationRule, txn: TransactionInput): boolean {
  // Must have at least one pattern defined
  if (!rule.merchantPattern && !rule.descriptionPattern) return false;

  // All specified conditions must match (AND logic)
  if (rule.merchantPattern) {
    if (!matchesPattern(rule.matchType, rule.merchantPattern, txn.merchant)) return false;
  }
  if (rule.descriptionPattern) {
    if (!matchesPattern(rule.matchType, rule.descriptionPattern, txn.description)) return false;
  }

  // Amount range checks (inclusive)
  if (rule.amountMin !== null && txn.amount < rule.amountMin) return false;
  if (rule.amountMax !== null && txn.amount > rule.amountMax) return false;

  return true;
}

function matchesPattern(matchType: string, pattern: string, value: string): boolean {
  const lower = value.toLowerCase();
  const patternLower = pattern.toLowerCase();

  switch (matchType) {
    case "contains":
      return lower.includes(patternLower);
    case "equals":
      return lower === patternLower;
    case "starts_with":
      return lower.startsWith(patternLower);
    case "regex":
      try {
        return new RegExp(pattern, "i").test(value);
      } catch {
        return false;
      }
    default:
      return false;
  }
}
