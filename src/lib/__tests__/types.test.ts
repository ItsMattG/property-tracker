import { describe, expectTypeOf, it } from "vitest";
import type { Serialized } from "../types";

describe("Serialized type", () => {
  it("converts Date fields to string", () => {
    type Input = { id: string; createdAt: Date; updatedAt: Date; name: string };
    type Result = Serialized<Input>;

    expectTypeOf<Result>().toEqualTypeOf<{
      id: string;
      createdAt: string;
      updatedAt: string;
      name: string;
    }>();
  });

  it("handles optional Date fields", () => {
    type Input = { id: string; deletedAt: Date | null };
    type Result = Serialized<Input>;

    expectTypeOf<Result>().toEqualTypeOf<{
      id: string;
      deletedAt: string | null;
    }>();
  });

  it("passes through non-Date fields unchanged", () => {
    type Input = { id: string; count: number; tags: string[] };
    type Result = Serialized<Input>;

    expectTypeOf<Result>().toEqualTypeOf<{
      id: string;
      count: number;
      tags: string[];
    }>();
  });
});
