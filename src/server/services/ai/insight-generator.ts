import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { logger } from "@/lib/logger";
import type { PortfolioInsight } from "@/server/db/schema";

const HAIKU_MODEL = "claude-3-5-haiku-20241022";

// Lazy initialization — matches the pattern in document-extraction.ts
let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropicClient;
}

const insightSchema = z.object({
  propertyId: z.string().nullable(),
  category: z.enum([
    "yield",
    "expense",
    "loan",
    "concentration",
    "compliance",
    "growth",
    "general",
  ]),
  severity: z.enum(["positive", "info", "warning", "critical"]),
  title: z.string().max(100),
  body: z.string().max(300),
});

const insightsArraySchema = z.array(insightSchema).min(1).max(20);

export interface PortfolioDataForInsights {
  properties: Array<{
    id: string;
    address: string;
    suburb: string;
    state: string;
    purchasePrice: number;
    currentValue: number;
    grossYield: number | null;
    netYield: number | null;
    performanceScore: number | null;
  }>;
  loans: Array<{
    propertyId: string;
    balance: number;
    rate: number;
    repaymentAmount: number;
    repaymentFrequency: string;
  }>;
  portfolioMetrics: {
    totalValue: number;
    totalDebt: number;
    totalEquity: number;
    portfolioLVR: number;
    annualRentalIncome: number;
    annualExpenses: number;
    netSurplus: number;
  };
  suburbConcentration: Array<{
    suburb: string;
    state: string;
    count: number;
    percentage: number;
  }>;
  expenseBreakdown: Array<{
    propertyAddress: string;
    category: string;
    annualAmount: number;
  }>;
}

function buildSystemPrompt(): string {
  return `You are a property investment analyst reviewing an Australian investor's portfolio.

Analyze the portfolio data and return 8-15 actionable insights as a JSON array.

Each insight must have:
- "propertyId": string or null (null for portfolio-level insights)
- "category": one of "yield", "expense", "loan", "concentration", "compliance", "growth", "general"
- "severity": one of "positive" (good news), "info" (neutral observation), "warning" (needs attention), "critical" (urgent action needed)
- "title": short headline (max 100 chars)
- "body": 1-2 sentence explanation with specific actionable advice (max 300 chars)

Focus on:
- Yield comparisons across properties (which outperform/underperform)
- Expense anomalies (insurance, rates, maintenance above/below average)
- Loan health (LVR, interest rate comparisons, refinancing opportunities)
- Geographic concentration risk
- Cash flow trends
- Capital growth observations

Be specific with numbers. Reference actual property addresses. Give concrete advice.
Do NOT give generic advice. Every insight must reference specific data from the portfolio.

Return ONLY the JSON array, no markdown, no explanation.`;
}

function buildUserPrompt(data: PortfolioDataForInsights): string {
  return JSON.stringify(data, null, 2);
}

export interface InsightGenerationResult {
  insights: PortfolioInsight[];
  modelUsed: string;
  inputTokens: number;
  outputTokens: number;
}

export async function generatePortfolioInsights(
  data: PortfolioDataForInsights
): Promise<InsightGenerationResult> {
  const emptyResult: InsightGenerationResult = {
    insights: [],
    modelUsed: HAIKU_MODEL,
    inputTokens: 0,
    outputTokens: 0,
  };

  try {
    const client = getAnthropicClient();

    const message = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 4096,
      system: buildSystemPrompt(),
      messages: [{ role: "user", content: buildUserPrompt(data) }],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      logger.error("Unexpected response type from Anthropic", undefined, {
        type: content.type,
      });
      return emptyResult;
    }

    // Strip markdown fences if present
    let text = content.text.trim();
    text = text.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "");

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (parseError) {
      logger.error("Failed to parse insight JSON from LLM", parseError, {
        rawText: text.slice(0, 500),
      });
      return emptyResult;
    }

    const validation = insightsArraySchema.safeParse(parsed);
    if (!validation.success) {
      logger.error("Insight validation failed", validation.error, {
        rawText: text.slice(0, 500),
        issues: JSON.stringify(validation.error.issues),
      });
      return emptyResult;
    }

    return {
      insights: validation.data,
      modelUsed: HAIKU_MODEL,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    };
  } catch (error) {
    logger.error("Failed to generate portfolio insights", error, {
      propertyCount: data.properties.length,
    });
    return emptyResult;
  }
}
