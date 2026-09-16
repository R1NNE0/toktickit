import { describe, it, expect } from "vitest";
import { normalizeEmail, validEmail } from "../../src/auth/password.js";
describe("UNIT-06 Issue 2 email validation (account-edit validation belongs to P6)", () => {
  it("normalizes whitespace and case consistently", () => {
    expect(normalizeEmail("  Person@Example.COM  ")).toBe("person@example.com");
    expect(validEmail("  Person@Example.COM  ")).toBe(true);
  });
  it("rejects malformed, missing and oversized email input", () => {
    for (const value of [undefined, null, 1, {}, "", "not-email", "a b@example.com", "x".repeat(255) + "@example.com"])
      expect(validEmail(value)).toBe(false);
  });
});
