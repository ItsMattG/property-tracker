import { describe, it, expect } from "vitest";
import { taskRouter } from "../task";

describe("Task router", () => {
  it("exports taskRouter", () => {
    expect(taskRouter).toBeDefined();
  });

  it("has list procedure", () => {
    expect(taskRouter.list).toBeDefined();
  });

  it("has getById procedure", () => {
    expect(taskRouter.getById).toBeDefined();
  });

  it("has counts procedure", () => {
    expect(taskRouter.counts).toBeDefined();
  });

  it("has create procedure", () => {
    expect(taskRouter.create).toBeDefined();
  });

  it("has update procedure", () => {
    expect(taskRouter.update).toBeDefined();
  });

  it("has updateStatus procedure", () => {
    expect(taskRouter.updateStatus).toBeDefined();
  });

  it("has delete procedure", () => {
    expect(taskRouter.delete).toBeDefined();
  });
});
