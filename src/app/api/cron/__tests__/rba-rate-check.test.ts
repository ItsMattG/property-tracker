import { describe, it, expect } from "vitest";
import { parseRbaCashRate, shouldNotifyRateChange } from "../rba-rate-check/helpers";

describe("rba-rate-check helpers", () => {
  describe("parseRbaCashRate", () => {
    it("extracts cash rate from RBA API response", () => {
      const mockResponse = {
        data: [
          { date: "2026-01-20", value: 4.35 },
          { date: "2026-01-15", value: 4.35 },
        ],
      };

      const result = parseRbaCashRate(mockResponse);
      expect(result).toEqual({ date: "2026-01-20", rate: 4.35 });
    });

    it("returns null for empty data", () => {
      const result = parseRbaCashRate({ data: [] });
      expect(result).toBeNull();
    });
  });

  describe("shouldNotifyRateChange", () => {
    it("returns true when rate changed", () => {
      expect(shouldNotifyRateChange(4.35, 4.10)).toBe(true);
    });

    it("returns false when rate unchanged", () => {
      expect(shouldNotifyRateChange(4.35, 4.35)).toBe(false);
    });

    it("returns true when no previous rate", () => {
      expect(shouldNotifyRateChange(null, 4.35)).toBe(true);
    });
  });
});
