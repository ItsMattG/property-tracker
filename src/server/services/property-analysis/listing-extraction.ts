// src/server/services/listing-extraction.ts
import Anthropic from "@anthropic-ai/sdk";
import type { ExtractedListingData } from "@/types/similar-properties";

let anthropicClient: Anthropic | null = null;

function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropicClient;
}

export function detectInputType(input: string): "url" | "text" {
  const urlPatterns = [
    /domain\.com\.au/i,
    /realestate\.com\.au/i,
    /^https?:\/\//i,
  ];

  return urlPatterns.some((pattern) => pattern.test(input)) ? "url" : "text";
}

export function buildExtractionPrompt(): string {
  return `You are extracting property listing data from Australian real estate content.

Extract the following fields:

Required fields:
- suburb: The suburb name (e.g., "Richmond")
- state: Australian state abbreviation (NSW, VIC, QLD, SA, WA, TAS, NT, ACT)
- postcode: 4-digit Australian postcode
- propertyType: One of "house", "townhouse", or "unit"

Optional fields:
- address: Full street address if available
- price: Asking price as a number (no currency symbols)
- bedrooms: Number of bedrooms
- bathrooms: Number of bathrooms
- parking: Number of car spaces
- landSize: Land size in square meters
- estimatedRent: Weekly rental estimate if mentioned
- features: Array of key features

Return ONLY valid JSON in this format:
{
  "suburb": "Richmond",
  "state": "VIC",
  "postcode": "3121",
  "propertyType": "house",
  "address": "123 Main Street",
  "price": 850000,
  "bedrooms": 3,
  "bathrooms": 2,
  "parking": 1,
  "landSize": 450,
  "estimatedRent": 650,
  "features": ["renovated kitchen", "garden"]
}

Rules:
- Use null for fields that cannot be determined
- Price should be a number without currency symbols or commas
- For price ranges, use the midpoint
- propertyType "apartment" should be normalized to "unit"
- If state cannot be determined from suburb, make best guess from context`;
}

export interface ExtractionResult {
  success: boolean;
  data: ExtractedListingData | null;
  error?: string;
}

export async function extractListingData(
  content: string,
  _sourceType: "url" | "text"
): Promise<ExtractionResult> {
  try {
    const anthropic = getAnthropic();
    const prompt = buildExtractionPrompt();

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `${prompt}\n\nListing content:\n${content}`,
        },
      ],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { success: false, data: null, error: "No JSON found in response" };
    }

    const data = JSON.parse(jsonMatch[0]) as ExtractedListingData;

    // Validate required fields
    if (!data.suburb || !data.state || !data.postcode || !data.propertyType) {
      return { success: false, data: null, error: "Missing required fields" };
    }

    // Normalize property type
    if ((data.propertyType as string) === "apartment") {
      data.propertyType = "unit";
    }

    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : "Extraction failed",
    };
  }
}
