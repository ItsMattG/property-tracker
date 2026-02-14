import { describe, expect, it } from "vitest";
import {
  positiveAmountSchema,
  signedAmountSchema,
  australianPostcodeSchema,
  suburbSchema,
  timeSchema,
  abnSchema,
} from "../common";

describe("positiveAmountSchema", () => {
  it("accepts valid amounts", () => {
    expect(positiveAmountSchema.parse("100")).toBe("100");
    expect(positiveAmountSchema.parse("100.50")).toBe("100.50");
    expect(positiveAmountSchema.parse("0")).toBe("0");
    expect(positiveAmountSchema.parse("999999.99")).toBe("999999.99");
  });

  it("rejects negative amounts", () => {
    expect(() => positiveAmountSchema.parse("-100")).toThrow();
  });

  it("rejects non-numeric strings", () => {
    expect(() => positiveAmountSchema.parse("abc")).toThrow();
    expect(() => positiveAmountSchema.parse("")).toThrow();
    expect(() => positiveAmountSchema.parse("$100")).toThrow();
  });
});

describe("signedAmountSchema", () => {
  it("accepts positive amounts", () => {
    expect(signedAmountSchema.parse("100")).toBe("100");
  });

  it("accepts negative amounts", () => {
    expect(signedAmountSchema.parse("-100")).toBe("-100");
    expect(signedAmountSchema.parse("-100.50")).toBe("-100.50");
  });

  it("rejects non-numeric strings", () => {
    expect(() => signedAmountSchema.parse("abc")).toThrow();
  });
});

describe("australianPostcodeSchema", () => {
  it("accepts valid 4-digit postcodes", () => {
    expect(australianPostcodeSchema.parse("2000")).toBe("2000");
    expect(australianPostcodeSchema.parse("0800")).toBe("0800");
  });

  it("rejects invalid postcodes", () => {
    expect(() => australianPostcodeSchema.parse("200")).toThrow();
    expect(() => australianPostcodeSchema.parse("20000")).toThrow();
    expect(() => australianPostcodeSchema.parse("abcd")).toThrow();
  });
});

describe("suburbSchema", () => {
  it("accepts valid suburb names", () => {
    expect(suburbSchema.parse("Sydney")).toBe("Sydney");
    expect(suburbSchema.parse("Surry Hills")).toBe("Surry Hills");
    expect(suburbSchema.parse("O'Connor")).toBe("O'Connor");
    expect(suburbSchema.parse("Woy Woy")).toBe("Woy Woy");
  });

  it("rejects suburbs with numbers", () => {
    expect(() => suburbSchema.parse("Area 51")).toThrow();
  });
});

describe("timeSchema", () => {
  it("accepts valid HH:MM times", () => {
    expect(timeSchema.parse("09:00")).toBe("09:00");
    expect(timeSchema.parse("23:59")).toBe("23:59");
  });

  it("rejects invalid time formats", () => {
    expect(() => timeSchema.parse("9:00")).toThrow();
    expect(() => timeSchema.parse("25:00")).toThrow();
  });
});
