import Anthropic from "@anthropic-ai/sdk";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { ExternalServiceError } from "@/server/errors";

// Lazy initialization to avoid issues during test imports
let anthropicClient: Anthropic | null = null;
let supabaseClient: SupabaseClient | null = null;

function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropicClient;
}

function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return supabaseClient;
}

export interface ExtractedAsset {
  assetName: string;
  category: "plant_equipment" | "capital_works";
  originalCost: number;
  effectiveLife: number;
  method: "diminishing_value" | "prime_cost";
  yearlyDeduction: number;
}

export interface ExtractionResult {
  success: boolean;
  assets: ExtractedAsset[];
  totalValue: number;
  effectiveDate: string | null;
  error?: string;
}

const EXTRACTION_PROMPT = `You are extracting depreciation schedule data from an Australian quantity surveyor report.

Extract each depreciable asset and return as a JSON object with this structure:
{
  "effectiveDate": "YYYY-MM-DD or null if not found",
  "assets": [
    {
      "assetName": "description of the item",
      "category": "plant_equipment" or "capital_works",
      "originalCost": number (dollar amount, no currency symbol),
      "effectiveLife": number (years),
      "method": "diminishing_value" or "prime_cost",
      "yearlyDeduction": number (first year deduction amount)
    }
  ]
}

Rules:
- Plant & Equipment items have effective life typically 2-20 years
- Capital Works (building structure) typically 40 years at 2.5% p.a.
- If method is not specified, assume "diminishing_value" for plant & equipment
- If yearly deduction is not shown, calculate: originalCost / effectiveLife for prime_cost, or (originalCost * 2) / effectiveLife for diminishing_value
- Extract ALL assets listed in the schedule
- Return ONLY valid JSON, no other text`;

/**
 * Download PDF from Supabase storage and get as base64
 */
async function getPdfContent(storagePath: string): Promise<string> {
  const { data, error } = await getSupabase().storage
    .from("documents")
    .download(storagePath);

  if (error || !data) {
    throw new ExternalServiceError(`Failed to download PDF: ${error?.message}`, "supabase");
  }

  const buffer = await data.arrayBuffer();
  return Buffer.from(buffer).toString("base64");
}

/**
 * Extract depreciation schedule data from a PDF using Claude
 */
export async function extractDepreciationSchedule(
  storagePath: string
): Promise<ExtractionResult> {
  try {
    const pdfBase64 = await getPdfContent(storagePath);

    const message = await getAnthropic().messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: pdfBase64,
              },
            },
            {
              type: "text",
              text: EXTRACTION_PROMPT,
            },
          ],
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      return { success: false, assets: [], totalValue: 0, effectiveDate: null, error: "Unexpected response type" };
    }

    // Parse JSON from response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { success: false, assets: [], totalValue: 0, effectiveDate: null, error: "No JSON found in response" };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const assets: ExtractedAsset[] = parsed.assets || [];

    // Validate and clean assets
    const validAssets = assets.filter(
      (a) =>
        a.assetName &&
        a.originalCost > 0 &&
        a.effectiveLife > 0 &&
        ["plant_equipment", "capital_works"].includes(a.category) &&
        ["diminishing_value", "prime_cost"].includes(a.method)
    );

    const totalValue = validAssets.reduce((sum, a) => sum + a.originalCost, 0);

    return {
      success: true,
      assets: validAssets,
      totalValue,
      effectiveDate: parsed.effectiveDate || null,
    };
  } catch (error) {
    console.error("Depreciation extraction error:", error);
    return {
      success: false,
      assets: [],
      totalValue: 0,
      effectiveDate: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Calculate remaining value after N years of depreciation
 */
export function calculateRemainingValue(
  originalCost: number,
  effectiveLife: number,
  method: "diminishing_value" | "prime_cost",
  yearsElapsed: number
): number {
  if (method === "prime_cost") {
    const annualDeduction = originalCost / effectiveLife;
    return Math.max(0, originalCost - annualDeduction * yearsElapsed);
  } else {
    // Diminishing value: rate = 2 / effective life
    const rate = 2 / effectiveLife;
    let value = originalCost;
    for (let i = 0; i < yearsElapsed; i++) {
      value = value * (1 - rate);
    }
    return Math.max(0, value);
  }
}
