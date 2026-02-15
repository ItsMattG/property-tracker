interface PropertyMatch {
  id: string;
  address: string;
  suburb: string;
  state: string;
  postcode: string;
}

interface MatchResult {
  propertyId: string | null;
  confidence: number;
}

const STREET_ABBREVIATIONS: Record<string, string> = {
  st: "street",
  rd: "road",
  ave: "avenue",
  dr: "drive",
  cres: "crescent",
  ct: "court",
  pl: "place",
  ln: "lane",
  hwy: "highway",
  blvd: "boulevard",
  tce: "terrace",
  pde: "parade",
};

export function normalizeAddress(address: string): string {
  let normalized = address.toLowerCase().trim();

  // Remove unit/suite prefixes
  normalized = normalized.replace(/^(unit|suite|apt|apartment)\s*/i, "");
  normalized = normalized.replace(/,\s*/g, " ");

  // Expand abbreviations
  for (const [abbr, full] of Object.entries(STREET_ABBREVIATIONS)) {
    const regex = new RegExp(`\\b${abbr}\\b`, "gi");
    normalized = normalized.replace(regex, full);
  }

  // Clean up whitespace
  normalized = normalized.replace(/\s+/g, " ").trim();

  return normalized;
}

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = normalizeAddress(str1);
  const s2 = normalizeAddress(str2);

  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) return 0.9;

  // Token-based Jaccard similarity
  const tokens1 = new Set(s1.split(" "));
  const tokens2 = new Set(s2.split(" "));
  const intersection = new Set([...tokens1].filter((x) => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);

  return intersection.size / union.size;
}

export function matchPropertyByAddress(
  extractedAddress: string,
  properties: PropertyMatch[]
): MatchResult {
  if (!extractedAddress || properties.length === 0) {
    return { propertyId: null, confidence: 0 };
  }

  let bestMatch: MatchResult = { propertyId: null, confidence: 0 };

  for (const property of properties) {
    const fullAddress = `${property.address}, ${property.suburb} ${property.state} ${property.postcode}`;
    const similarity = calculateSimilarity(extractedAddress, fullAddress);

    if (similarity > bestMatch.confidence) {
      bestMatch = { propertyId: property.id, confidence: similarity };
    }
  }

  if (bestMatch.confidence < 0.5) {
    return { propertyId: null, confidence: bestMatch.confidence };
  }

  return bestMatch;
}
