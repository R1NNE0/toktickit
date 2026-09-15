import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, passwordError } from "../../src/auth/password.js";

describe("UNIT-01 password policy and Argon2id", () => {
  it("enforces Unicode code-point boundaries without trimming", () => {
    expect(passwordError("a".repeat(14))).toBeTruthy();
    expect(passwordError("a".repeat(15))).toBeNull();
    expect(passwordError("🟢".repeat(128))).toBeNull();
    expect(passwordError("a".repeat(129))).toBeTruthy();
    expect(passwordError("passwordpassword")).toBeTruthy();
    expect(passwordError("  valid password  ")).toBeNull();
  });
  it("salts hashes, verifies exactly and never stores plaintext", async () => {
    const password = "  A real initial password  ";
    const first = await hashPassword(password);
    const second = await hashPassword(password);
    expect(first).toMatch(/^\$argon2id\$/);
    expect(first).not.toContain(password);
    expect(first).not.toBe(second);
    expect(await verifyPassword(first, password)).toBe(true);
    expect(await verifyPassword(first, password.trim())).toBe(false);
    expect(await verifyPassword("invalid hash", password)).toBe(false);
  });
});
