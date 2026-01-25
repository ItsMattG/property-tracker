import type { RiskLevel } from "@/types/climate-risk";

interface PostcodeRisk {
  flood: RiskLevel;
  bushfire: RiskLevel;
}

// Known high-risk postcodes from Australian government flood/bushfire mapping
// Flood-prone: Brisbane river, Hawkesbury-Nepean, Melbourne west, Townsville
// Bushfire-prone: Blue Mountains, Dandenong Ranges, Adelaide Hills
export const climateRiskData: Record<string, PostcodeRisk> = {
  // QLD - Brisbane flood-prone
  "4000": { flood: "medium", bushfire: "low" },
  "4005": { flood: "high", bushfire: "low" },
  "4007": { flood: "high", bushfire: "low" },
  "4010": { flood: "medium", bushfire: "low" },
  "4059": { flood: "high", bushfire: "low" },
  "4067": { flood: "extreme", bushfire: "low" },
  "4068": { flood: "high", bushfire: "low" },
  "4101": { flood: "high", bushfire: "low" },
  "4102": { flood: "medium", bushfire: "low" },
  "4810": { flood: "high", bushfire: "low" }, // Townsville
  "4811": { flood: "high", bushfire: "low" },

  // NSW - Hawkesbury-Nepean flood-prone
  "2750": { flood: "high", bushfire: "medium" }, // Penrith
  "2753": { flood: "extreme", bushfire: "medium" }, // Richmond
  "2756": { flood: "extreme", bushfire: "low" }, // Windsor
  "2757": { flood: "high", bushfire: "medium" },
  "2758": { flood: "high", bushfire: "high" },
  "2777": { flood: "medium", bushfire: "extreme" }, // Blue Mountains
  "2778": { flood: "medium", bushfire: "extreme" },
  "2779": { flood: "low", bushfire: "extreme" },
  "2780": { flood: "low", bushfire: "extreme" }, // Katoomba
  "2782": { flood: "low", bushfire: "high" },
  "2083": { flood: "high", bushfire: "medium" }, // Hawkesbury

  // VIC - Melbourne west flood-prone
  "3011": { flood: "high", bushfire: "low" }, // Footscray
  "3012": { flood: "high", bushfire: "low" },
  "3013": { flood: "medium", bushfire: "low" },
  "3020": { flood: "medium", bushfire: "low" },
  "3029": { flood: "high", bushfire: "low" }, // Werribee
  "3030": { flood: "high", bushfire: "low" },
  "3140": { flood: "low", bushfire: "high" }, // Lilydale
  "3160": { flood: "low", bushfire: "extreme" }, // Belgrave
  "3775": { flood: "low", bushfire: "extreme" }, // Yarra Glen
  "3777": { flood: "low", bushfire: "extreme" }, // Healesville
  "3786": { flood: "low", bushfire: "extreme" }, // Ferntree Gully
  "3787": { flood: "low", bushfire: "extreme" }, // Upper Ferntree Gully
  "3788": { flood: "low", bushfire: "extreme" }, // Sassafras

  // SA - Adelaide Hills bushfire-prone
  "5062": { flood: "low", bushfire: "high" },
  "5063": { flood: "low", bushfire: "medium" },
  "5072": { flood: "low", bushfire: "high" },
  "5073": { flood: "low", bushfire: "high" },
  "5074": { flood: "low", bushfire: "medium" },
  "5131": { flood: "low", bushfire: "extreme" }, // Stirling
  "5134": { flood: "low", bushfire: "extreme" }, // Crafers
  "5152": { flood: "low", bushfire: "extreme" }, // Aldgate
  "5153": { flood: "low", bushfire: "extreme" }, // Bridgewater

  // WA - Perth hills bushfire-prone
  "6076": { flood: "low", bushfire: "high" }, // Lesmurdie
  "6077": { flood: "low", bushfire: "high" },
  "6081": { flood: "low", bushfire: "extreme" }, // Mundaring
  "6083": { flood: "low", bushfire: "extreme" },
  "6084": { flood: "low", bushfire: "extreme" },

  // TAS - bushfire areas
  "7005": { flood: "low", bushfire: "high" },
  "7050": { flood: "low", bushfire: "high" },
  "7054": { flood: "low", bushfire: "high" },
};
