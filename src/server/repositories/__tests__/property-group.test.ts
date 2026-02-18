import { describe, it, expect, vi } from "vitest";
import { createMockUow } from "../../__tests__/test-utils";

describe("PropertyGroupRepository (unit)", () => {
  it("is accessible via UoW proxy", () => {
    const uow = createMockUow();
    // Accessing propertyGroup should return a proxy repo with auto-stubbed methods
    expect(uow.propertyGroup).toBeDefined();
  });

  it("auto-stubs repository methods via proxy", async () => {
    const uow = createMockUow();
    // All methods should be callable vi.fn() stubs that resolve undefined
    const result = await uow.propertyGroup.findByOwner("user-1");
    expect(result).toBeUndefined();
    expect(uow.propertyGroup.findByOwner).toHaveBeenCalledWith("user-1");
  });

  it("respects explicit overrides", async () => {
    const mockGroups = [
      {
        id: "group-1",
        userId: "user-1",
        name: "Sydney Properties",
        colour: "#3B82F6",
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        propertyCount: 3,
      },
    ];
    const uow = createMockUow({
      propertyGroup: {
        findByOwner: vi.fn().mockResolvedValue(mockGroups),
      },
    });
    const result = await uow.propertyGroup.findByOwner("user-1");
    expect(result).toEqual(mockGroups);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Sydney Properties");
  });

  it("stubs assignment methods independently", async () => {
    const uow = createMockUow({
      propertyGroup: {
        getPropertyIds: vi.fn().mockResolvedValue(["prop-1", "prop-2"]),
      },
    });

    const ids = await uow.propertyGroup.getPropertyIds("group-1");
    expect(ids).toEqual(["prop-1", "prop-2"]);

    // Other methods remain auto-stubbed
    await uow.propertyGroup.assignProperties("group-1", ["prop-3"]);
    expect(uow.propertyGroup.assignProperties).toHaveBeenCalledWith(
      "group-1",
      ["prop-3"]
    );
  });
});
