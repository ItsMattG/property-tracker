import Anthropic from "@anthropic-ai/sdk";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Lazy initialization
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

export const EXTRACTION_PROMPT_BASE = `You are extracting data from a document uploaded by an Australian property investor.

First, identify the document type:
- receipt: Purchase receipt from a store or service provider
- rate_notice: Council rates, water rates notice
- insurance: Insurance policy, renewal, or certificate
- invoice: Contractor or service invoice
- unknown: Cannot determine document type

Then extract all relevant fields based on the document type.

Return ONLY valid JSON in this format:
{
  "documentType": "receipt|rate_notice|insurance|invoice|unknown",
  "confidence": 0.0-1.0,
  "vendor": "company or issuer name",
  "amount": 123.45,
  "date": "YYYY-MM-DD",
  "dueDate": "YYYY-MM-DD or null",
  "category": "suggested category or null",
  "propertyAddress": "extracted address or null",
  "lineItems": [
    {"description": "item", "quantity": 1, "amount": 50.00}
  ] or null,
  "rawText": "key text from document"
}

Category suggestions (for Australian property investors):
- receipts from hardware stores → repairs_and_maintenance
- council rates → council_rates
- water bills → water_charges
- insurance → insurance
- cleaning services → cleaning
- gardening/landscaping → gardening
- pest control → pest_control
- property management fees → property_agent_fees
- legal documents → legal_expenses

Rules:
- Amounts should be numbers without currency symbols
- Dates in YYYY-MM-DD format
- If a field cannot be determined, use null
- Extract property address from rate notices and insurance documents
- For invoices, extract line items if visible
- confidence should reflect how readable the document is`;

export function buildExtractionPrompt(): string {
  return EXTRACTION_PROMPT_BASE;
}
