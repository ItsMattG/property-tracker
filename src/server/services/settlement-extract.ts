import Anthropic from "@anthropic-ai/sdk";
import { getDocumentContent, getMediaType } from "./document-extraction";

export interface SettlementAdjustment {
  description: string;
  amount: number;
  type: "debit" | "credit";
}

export interface SettlementExtractedData {
  purchasePrice: number | null;
  settlementDate: string | null;
  stampDuty: number | null;
  legalFees: number | null;
  titleSearchFees: number | null;
  registrationFees: number | null;
  adjustments: SettlementAdjustment[] | null;
  propertyAddress: string | null;
  buyerName: string | null;
  confidence: number;
  error?: string;
}

export const SETTLEMENT_EXTRACTION_PROMPT = `You are extracting data from an Australian property settlement statement (also called a settlement adjustment sheet or vendor's statement of adjustments).

Extract the following fields and return ONLY valid JSON:
{
  "purchasePrice": 750000,
  "settlementDate": "YYYY-MM-DD",
  "stampDuty": 29490,
  "legalFees": 1850,
  "titleSearchFees": 150,
  "registrationFees": 350,
  "adjustments": [
    {"description": "Council rates adjustment", "amount": -432.50, "type": "credit"},
    {"description": "Water rates adjustment", "amount": -185.20, "type": "credit"}
  ],
  "propertyAddress": "123 Main St, Richmond VIC 3121",
  "buyerName": "Buyer name if visible",
  "confidence": 0.0-1.0
}

Rules:
- purchasePrice is the contract/purchase price (the big number at the top)
- stampDuty is often listed as "Transfer Duty" or "Stamp Duty" — a state government charge
- legalFees includes solicitor/conveyancer fees
- titleSearchFees and registrationFees are often listed as disbursements
- adjustments are rate apportionments (council rates, water rates, strata levies, land tax)
  - credits to buyer (seller owes buyer) should have negative amounts and type "credit"
  - debits to buyer (buyer owes seller) should have positive amounts and type "debit"
- Amounts should be numbers without currency symbols
- Dates in YYYY-MM-DD format
- If a field cannot be determined, use null
- confidence should reflect how readable and complete the extraction is`;

// Lazy initialization
let anthropicClient: Anthropic | null = null;

function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropicClient;
}

export function parseSettlementResponse(response: string): SettlementExtractedData {
  const defaults: SettlementExtractedData = {
    purchasePrice: null,
    settlementDate: null,
    stampDuty: null,
    legalFees: null,
    titleSearchFees: null,
    registrationFees: null,
    adjustments: null,
    propertyAddress: null,
    buyerName: null,
    confidence: 0,
    error: "Failed to parse settlement response",
  };

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return defaults;

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      purchasePrice: typeof parsed.purchasePrice === "number" ? parsed.purchasePrice : null,
      settlementDate: parsed.settlementDate || null,
      stampDuty: typeof parsed.stampDuty === "number" ? parsed.stampDuty : null,
      legalFees: typeof parsed.legalFees === "number" ? parsed.legalFees : null,
      titleSearchFees: typeof parsed.titleSearchFees === "number" ? parsed.titleSearchFees : null,
      registrationFees: typeof parsed.registrationFees === "number" ? parsed.registrationFees : null,
      adjustments: Array.isArray(parsed.adjustments) ? parsed.adjustments : null,
      propertyAddress: parsed.propertyAddress || null,
      buyerName: parsed.buyerName || null,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
    };
  } catch {
    return defaults;
  }
}

export async function extractSettlement(
  storagePath: string,
  fileType: string
): Promise<{ success: boolean; data: SettlementExtractedData | null; error?: string }> {
  try {
    const base64Content = await getDocumentContent(storagePath);

    const content =
      fileType === "application/pdf"
        ? [
            { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: base64Content } },
            { type: "text" as const, text: SETTLEMENT_EXTRACTION_PROMPT },
          ]
        : [
            { type: "image" as const, source: { type: "base64" as const, media_type: getMediaType(fileType), data: base64Content } },
            { type: "text" as const, text: SETTLEMENT_EXTRACTION_PROMPT },
          ];

    const message = await getAnthropic().messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 2048,
      messages: [{ role: "user", content }],
    });

    const textContent = message.content[0];
    if (textContent.type !== "text") {
      return { success: false, data: null, error: "Unexpected response type" };
    }

    const data = parseSettlementResponse(textContent.text);
    if (data.error) {
      return { success: false, data, error: data.error };
    }

    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : "Unknown extraction error",
    };
  }
}
