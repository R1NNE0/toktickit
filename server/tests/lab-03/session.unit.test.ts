import { describe, it, expect } from "vitest";
import { expired, opaqueToken, tokenHash, sameSecret, IDLE_MS, ABSOLUTE_MS, BOOTSTRAP_MS } from "../../src/auth/session.js";
import { LoginThrottle } from "../../src/auth/throttle.js";
describe("UNIT-02 sessions and API-04 throttle windows", () => {
  it("checks exact idle, absolute and anonymous boundaries", () => {
    const base = { userId: 1, createdAt: new Date(0), lastSeenAt: new Date(0), expiresAt: new Date(ABSOLUTE_MS) };
    expect(expired(base, new Date(IDLE_MS - 1))).toBe(false);
    expect(expired(base, new Date(IDLE_MS))).toBe(true);
    expect(expired({ ...base, lastSeenAt: new Date(ABSOLUTE_MS) }, new Date(ABSOLUTE_MS))).toBe(true);
    expect(expired({ ...base, userId: null }, new Date(BOOTSTRAP_MS))).toBe(true);
  });
  it("uses distinct opaque values and exact CSRF comparison", () => {
    const token = opaqueToken();
    expect(Buffer.from(token, "base64url").length).toBe(32);
    expect(opaqueToken()).not.toBe(token);
    expect(tokenHash(token)).toHaveLength(64);
    expect(tokenHash(token)).not.toBe(token);
    expect(sameSecret(token, token)).toBe(true);
    expect(sameSecret(token, token + "x")).toBe(false);
  });
  it("keeps a rolling failure window and bounds attempts across identities", () => {
    const throttle = new LoginThrottle();
    for (let i = 0; i < 5; i++) {
      expect(throttle.check("a", "ip", i * 60_000)).toBe(0);
      throttle.failed("a", "ip", i * 60_000);
    }
    expect(throttle.check("a", "ip", 5 * 60_000)).toBeGreaterThan(0);
    // At 15 minutes only the first failure has expired, not the other four.
    expect(throttle.check("a", "ip", 15 * 60_000)).toBe(0);
    throttle.failed("a", "ip", 15 * 60_000);
    expect(throttle.check("a", "ip", 15 * 60_000 + 1)).toBeGreaterThan(0);
    const bulk = new LoginThrottle();
    for (let i = 0; i < 100; i++) expect(bulk.check(String(i), "one-ip", 0)).toBe(0);
    expect(bulk.check("another", "one-ip", 1)).toBeGreaterThan(0);
    expect(bulk.check("another", "one-ip", 900_000)).toBe(0);
  });
});
