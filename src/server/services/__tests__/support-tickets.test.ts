import { describe, expect, it } from "vitest";
import { formatTicketNumber, getUrgencyWeight, sortTicketsByPriority } from "../support-tickets";

describe("formatTicketNumber", () => {
  it("formats single digit", () => {
    expect(formatTicketNumber(1)).toBe("TICK-001");
  });

  it("formats triple digit", () => {
    expect(formatTicketNumber(123)).toBe("TICK-123");
  });

  it("formats four digit", () => {
    expect(formatTicketNumber(1234)).toBe("TICK-1234");
  });
});

describe("getUrgencyWeight", () => {
  it("returns correct weights", () => {
    expect(getUrgencyWeight("critical")).toBe(4);
    expect(getUrgencyWeight("high")).toBe(3);
    expect(getUrgencyWeight("medium")).toBe(2);
    expect(getUrgencyWeight("low")).toBe(1);
  });
});

describe("sortTicketsByPriority", () => {
  it("sorts by urgency descending then date descending", () => {
    const tickets = [
      { id: "a", urgency: "low", createdAt: new Date("2026-01-01") },
      { id: "b", urgency: "critical", createdAt: new Date("2026-01-01") },
      { id: "c", urgency: "high", createdAt: new Date("2026-01-02") },
      { id: "d", urgency: "high", createdAt: new Date("2026-01-01") },
    ];

    const sorted = sortTicketsByPriority(tickets);
    expect(sorted.map((t) => t.id)).toEqual(["b", "c", "d", "a"]);
  });
});
