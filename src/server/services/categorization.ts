import Anthropic from "@anthropic-ai/sdk";
import { db } from "../db";
import { merchantCategories, categorizationExamples, transactions } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { categories } from "@/lib/categories";

function getAnthropicClient(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

const VALID_CATEGORIES = categories.map((c) => c.value);
const CONFIDENCE_THRESHOLD = 80;

export interface CategorizationResult {
  category: string;
  confidence: number;
  reasoning?: string;
}

export interface Example {
  description: string;
  category: string;
}

/**
 * Normalize merchant name for consistent lookup
 */
export function normalizeMerchantName(description: string): string {
  return description
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s*(pty|ltd|inc|limited|australia|au)\s*/gi, "")
    .replace(/\s*\([^)]*\)\s*/g, "")
    .trim();
}

/**
 * Build the categorization prompt for Claude
 */
export function buildCategorizationPrompt(
  description: string,
  amount: number,
  examples: Example[]
): string {
  const categoryList = categories
    .map((c) => `- ${c.value}: ${c.label}${c.isDeductible ? " (tax deductible)" : ""}`)
    .join("\n");

  let prompt = `You are a categorization assistant for Australian property investors. Categorize this transaction.

Transaction:
- Description: ${description}
- Amount: $${Math.abs(amount).toFixed(2)} ${amount >= 0 ? "(credit/income)" : "(debit/expense)"}

Valid categories:
${categoryList}

`;

  if (examples.length > 0) {
    prompt += `\nExamples from this user's history:\n`;
    for (const ex of examples) {
      prompt += `- "${ex.description}" → ${ex.category}\n`;
    }
  }

  prompt += `
Respond with ONLY valid JSON in this format:
{"category": "category_value", "confidence": 0-100}

Choose the most appropriate category. If uncertain, use "uncategorized" with low confidence.`;

  return prompt;
}

/**
 * Parse Claude's response into a CategorizationResult
 */
export function parseCategorizationResponse(
  response: string
): CategorizationResult | null {
  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = response.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    if (!parsed.category || typeof parsed.confidence !== "number") {
      return null;
    }

    // Validate category
    if (!VALID_CATEGORIES.includes(parsed.category)) {
      return null;
    }

    // Clamp confidence
    const confidence = Math.max(0, Math.min(100, parsed.confidence));

    return {
      category: parsed.category,
      confidence,
      reasoning: parsed.reasoning,
    };
  } catch {
    return null;
  }
}

/**
 * Check merchant memory for a known category mapping
 */
export async function getMerchantCategory(
  userId: string,
  description: string
): Promise<{ category: string; confidence: number } | null> {
  const merchantName = normalizeMerchantName(description);

  const mapping = await db.query.merchantCategories.findFirst({
    where: and(
      eq(merchantCategories.userId, userId),
      eq(merchantCategories.merchantName, merchantName)
    ),
  });

  if (mapping && parseFloat(mapping.confidence) >= CONFIDENCE_THRESHOLD) {
    return {
      category: mapping.category,
      confidence: parseFloat(mapping.confidence),
    };
  }

  return null;
}

/**
 * Get recent categorization examples for few-shot prompting
 */
export async function getRecentExamples(
  userId: string,
  limit = 10
): Promise<Example[]> {
  const examples = await db.query.categorizationExamples.findMany({
    where: eq(categorizationExamples.userId, userId),
    orderBy: [desc(categorizationExamples.createdAt)],
    limit,
  });

  return examples.map((e) => ({
    description: e.description,
    category: e.category,
  }));
}

/**
 * Call Claude API to categorize a transaction
 */
export async function categorizeWithClaude(
  description: string,
  amount: number,
  examples: Example[]
): Promise<CategorizationResult | null> {
  try {
    const prompt = buildCategorizationPrompt(description, amount, examples);

    const message = await getAnthropicClient().messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== "text") return null;

    return parseCategorizationResponse(content.text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Claude API error:", message);
    return null;
  }
}

/**
 * Categorize a single transaction
 */
export async function categorizeTransaction(
  userId: string,
  transactionId: string,
  description: string,
  amount: number
): Promise<CategorizationResult | null> {
  // Check merchant memory first
  const merchantResult = await getMerchantCategory(userId, description);
  if (merchantResult) {
    // Update transaction with suggestion
    await db
      .update(transactions)
      .set({
        suggestedCategory: merchantResult.category as typeof transactions.suggestedCategory.enumValues[number],
        suggestionConfidence: merchantResult.confidence.toString(),
        suggestionStatus: "pending",
      })
      .where(eq(transactions.id, transactionId));

    return merchantResult;
  }

  // Call Claude API
  const examples = await getRecentExamples(userId);
  const result = await categorizeWithClaude(description, amount, examples);

  if (result) {
    await db
      .update(transactions)
      .set({
        suggestedCategory: result.category as typeof transactions.suggestedCategory.enumValues[number],
        suggestionConfidence: result.confidence.toString(),
        suggestionStatus: "pending",
      })
      .where(eq(transactions.id, transactionId));
  } else {
    // Mark as failed so it's not retried endlessly
    await db
      .update(transactions)
      .set({ suggestionStatus: "failed" })
      .where(eq(transactions.id, transactionId));
  }

  return result;
}

/**
 * Update merchant memory when user accepts/rejects a suggestion
 */
export async function updateMerchantMemory(
  userId: string,
  description: string,
  category: string,
  wasCorrection: boolean
): Promise<void> {
  const merchantName = normalizeMerchantName(description);

  // Check if mapping exists
  const existing = await db.query.merchantCategories.findFirst({
    where: and(
      eq(merchantCategories.userId, userId),
      eq(merchantCategories.merchantName, merchantName)
    ),
  });

  if (existing) {
    // Update existing mapping with running average
    const currentCount = parseFloat(existing.usageCount);
    const currentConfidence = parseFloat(existing.confidence);
    const newConfidence = wasCorrection
      ? Math.max(0, currentConfidence - 10) // Reduce confidence on correction
      : (currentConfidence * currentCount + 100) / (currentCount + 1); // Increase on accept

    await db
      .update(merchantCategories)
      .set({
        category: category as typeof merchantCategories.category.enumValues[number],
        confidence: Math.min(100, newConfidence).toFixed(2),
        usageCount: (currentCount + 1).toString(),
        lastUsedAt: new Date(),
      })
      .where(eq(merchantCategories.id, existing.id));
  } else {
    // Create new mapping
    await db.insert(merchantCategories).values({
      userId,
      merchantName,
      category: category as typeof merchantCategories.category.enumValues[number],
      confidence: wasCorrection ? "70.00" : "80.00",
    });
  }

  // Store as example if it was a correction
  if (wasCorrection) {
    await db.insert(categorizationExamples).values({
      userId,
      description,
      category: category as typeof categorizationExamples.category.enumValues[number],
      wasCorrection: true,
    });
  }
}

/**
 * Batch categorize multiple transactions
 */
export async function batchCategorize(
  userId: string,
  transactionData: Array<{ id: string; description: string; amount: number }>
): Promise<Map<string, CategorizationResult | null>> {
  const results = new Map<string, CategorizationResult | null>();

  for (const txn of transactionData) {
    const result = await categorizeTransaction(
      userId,
      txn.id,
      txn.description,
      txn.amount
    );
    results.set(txn.id, result);
  }

  return results;
}
