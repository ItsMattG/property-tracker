import { describe, it, expect } from "vitest";
import { shareRouter } from "../share";

describe("Share router", () => {
  it("exports shareRouter", () => {
    expect(shareRouter).toBeDefined();
  });

  it("has create procedure", () => {
    expect(shareRouter.create).toBeDefined();
  });

  it("has list procedure", () => {
    expect(shareRouter.list).toBeDefined();
  });

  it("has revoke procedure", () => {
    expect(shareRouter.revoke).toBeDefined();
  });

  it("has getByToken procedure", () => {
    expect(shareRouter.getByToken).toBeDefined();
  });
});
