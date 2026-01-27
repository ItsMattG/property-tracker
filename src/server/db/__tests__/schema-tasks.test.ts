import { describe, it, expect } from "vitest";
import {
  tasks,
  taskStatusEnum,
  taskPriorityEnum,
} from "../schema";

describe("tasks schema", () => {
  it("exports taskStatusEnum", () => {
    expect(taskStatusEnum).toBeDefined();
    expect(taskStatusEnum.enumValues).toEqual(["todo", "in_progress", "done"]);
  });

  it("exports taskPriorityEnum", () => {
    expect(taskPriorityEnum).toBeDefined();
    expect(taskPriorityEnum.enumValues).toEqual(["urgent", "high", "normal", "low"]);
  });

  it("exports tasks table", () => {
    expect(tasks).toBeDefined();
  });
});
