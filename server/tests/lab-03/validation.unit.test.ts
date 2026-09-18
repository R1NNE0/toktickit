import { describe, it, expect } from "vitest";
import { normalizeEmail, validEmail } from "../../src/auth/password.js";
import { validateTextBody } from "../../src/workflow.js";

describe("UNIT-06 Issue 2 email validation and Issue 5 comment/note body validation", () => {
  it("normalizes whitespace and case consistently", () => {
    expect(normalizeEmail("  Person@Example.COM  ")).toBe("person@example.com");
    expect(validEmail("  Person@Example.COM  ")).toBe(true);
  });
  it("rejects malformed, missing and oversized email input", () => {
    for (const value of [undefined, null, 1, {}, "", "not-email", "a b@example.com", "x".repeat(255) + "@example.com"])
      expect(validEmail(value)).toBe(false);
  });
  it("validates comment and note bodies within 1-4000 characters and rejects non-strings, blank or oversized bodies", () => {
    expect(validateTextBody("  Valid comment text  ")).toBe("Valid comment text");
    expect(validateTextBody("Line 1\nLine 2")).toBe("Line 1\nLine 2");
    expect(() => validateTextBody("")).toThrow("between 1 and 4000 characters");
    expect(() => validateTextBody("   \t\n  ")).toThrow("between 1 and 4000 characters");
    expect(() => validateTextBody("a".repeat(4001))).toThrow("between 1 and 4000 characters");
    expect(() => validateTextBody(12345 as any)).toThrow("must be a string");
    expect(() => validateTextBody(null as any)).toThrow("must be a string");
  });
});
