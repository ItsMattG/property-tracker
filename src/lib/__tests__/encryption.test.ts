import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { encrypt, decrypt } from "../encryption";

describe("encryption", () => {
  const originalEnv = process.env.ENCRYPTION_KEY;

  beforeEach(() => {
    // Set a valid 64-character hex key for testing
    process.env.ENCRYPTION_KEY =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  });

  afterEach(() => {
    process.env.ENCRYPTION_KEY = originalEnv;
  });

  it("should encrypt and decrypt a string", () => {
    const plaintext = "my-secret-token";
    const encrypted = encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("should produce different ciphertexts for same plaintext", () => {
    const plaintext = "my-secret-token";
    const encrypted1 = encrypt(plaintext);
    const encrypted2 = encrypt(plaintext);
    expect(encrypted1).not.toBe(encrypted2);
  });

  it("should handle long strings", () => {
    const plaintext = "a".repeat(10000);
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("should handle special characters", () => {
    const plaintext = "token with émojis 🔐 and spëcial chars!@#$%";
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("should throw on invalid encryption key", () => {
    process.env.ENCRYPTION_KEY = "tooshort";
    expect(() => encrypt("test")).toThrow(
      "ENCRYPTION_KEY must be 64 hex characters"
    );
  });

  it("should throw on missing encryption key", () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => encrypt("test")).toThrow(
      "ENCRYPTION_KEY must be 64 hex characters"
    );
  });

  it("should throw on invalid encrypted data format", () => {
    expect(() => decrypt("invalid")).toThrow("Invalid encrypted data format");
    expect(() => decrypt("only:two")).toThrow("Invalid encrypted data format");
  });
});
