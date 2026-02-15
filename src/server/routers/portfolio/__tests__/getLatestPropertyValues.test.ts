import { describe, expect, it } from "vitest";

import { getLatestPropertyValues } from "../portfolio-helpers";

describe("getLatestPropertyValues", () => {
  it("is exported as a function", () => {
    expect(typeof getLatestPropertyValues).toBe("function");
  });

  it("returns an empty Map when given no property IDs", async () => {
    // Pass a dummy db — the function should short-circuit before using it
    const result = await getLatestPropertyValues(
      {} as Parameters<typeof getLatestPropertyValues>[0],
      "user-123",
      []
    );
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
  });
});
