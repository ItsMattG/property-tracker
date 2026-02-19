import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

import * as SecureStore from "expo-secure-store";
import { getToken, setToken, getUser, setUser, clearAuth } from "../auth";

const mockGetItem = vi.mocked(SecureStore.getItemAsync);
const mockSetItem = vi.mocked(SecureStore.setItemAsync);
const mockDeleteItem = vi.mocked(SecureStore.deleteItemAsync);

describe("auth token storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getToken retrieves token from SecureStore", async () => {
    mockGetItem.mockResolvedValue("test-jwt-token");
    const token = await getToken();
    expect(token).toBe("test-jwt-token");
    expect(mockGetItem).toHaveBeenCalledWith("bricktrack_token");
  });

  it("setToken stores token in SecureStore", async () => {
    await setToken("new-token");
    expect(mockSetItem).toHaveBeenCalledWith("bricktrack_token", "new-token");
  });

  it("getUser retrieves and parses user from SecureStore", async () => {
    const mockUser = { id: "1", email: "test@example.com", name: "Test" };
    mockGetItem.mockResolvedValue(JSON.stringify(mockUser));
    const user = await getUser();
    expect(user).toEqual(mockUser);
  });

  it("getUser returns null when no user stored", async () => {
    mockGetItem.mockResolvedValue(null);
    const user = await getUser();
    expect(user).toBeNull();
  });

  it("setUser stores serialized user", async () => {
    const mockUser = { id: "1", email: "test@example.com", name: "Test" };
    await setUser(mockUser);
    expect(mockSetItem).toHaveBeenCalledWith("bricktrack_user", JSON.stringify(mockUser));
  });

  it("clearAuth removes both token and user", async () => {
    await clearAuth();
    expect(mockDeleteItem).toHaveBeenCalledWith("bricktrack_token");
    expect(mockDeleteItem).toHaveBeenCalledWith("bricktrack_user");
  });
});
