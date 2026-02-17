import { describe, it, expect } from "vitest";

import { accountantPackEmailTemplate } from "../accountant-pack";

describe("accountantPackEmailTemplate", () => {
  const baseProps = {
    userName: "Matt Gleeson",
    userEmail: "matt@example.com",
    financialYear: 2025,
    sections: [
      "Income & Expenses",
      "Depreciation Schedule",
      "Tax Position Summary",
    ],
  };

  it("includes the user name and financial year", () => {
    const html = accountantPackEmailTemplate(baseProps);
    expect(html).toContain("Matt Gleeson");
    expect(html).toContain("FY2025");
  });

  it("lists all included sections", () => {
    const html = accountantPackEmailTemplate(baseProps);
    expect(html).toContain("Income & Expenses");
    expect(html).toContain("Depreciation Schedule");
    expect(html).toContain("Tax Position Summary");
  });

  it("includes contact info for the user", () => {
    const html = accountantPackEmailTemplate(baseProps);
    expect(html).toContain("matt@example.com");
    expect(html).toContain("mailto:matt@example.com");
  });

  it("wraps in baseTemplate with BrickTrack branding", () => {
    const html = accountantPackEmailTemplate(baseProps);
    expect(html).toContain("BrickTrack");
    expect(html).toContain("<!DOCTYPE html>");
  });

  it("mentions the PDF attachment", () => {
    const html = accountantPackEmailTemplate(baseProps);
    expect(html).toContain("attached as a PDF");
  });

  it("renders sections as list items", () => {
    const html = accountantPackEmailTemplate(baseProps);
    expect(html).toContain("<li");
    expect(html).toContain("</li>");
    // Each section should be in its own list item
    for (const section of baseProps.sections) {
      expect(html).toContain(`<li style="padding: 4px 0; color: #333;">${section}</li>`);
    }
  });
});
