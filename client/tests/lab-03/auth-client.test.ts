import { describe, it, expect, vi, afterEach } from "vitest";
import { sessionFetch, clearCsrf, bootstrapCsrf } from "../../src/auth-client.js";
describe("Session transport", () => {
  afterEach(() => { vi.unstubAllGlobals(); clearCsrf(); });
  it("sends cookies and CSRF while dropping client-controlled identity headers", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken: "test-csrf" })))
      .mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetcher);
    localStorage.setItem("toktickit_selected_requester_id", "999");
    await sessionFetch("/api/tickets", { method: "POST", headers: { "x-requester-id": "999" }, body: "{}" });
    const options = fetcher.mock.calls[1][1];
    expect(options.credentials).toBe("include");
    expect(options.headers.get("X-CSRF-Token")).toBe("test-csrf");
    expect(options.headers.has("x-requester-id")).toBe(false);
    await expect(sessionFetch("https://other.example/api/tickets", { method: "POST" })).rejects.toThrow("Invalid API destination");
  });
  it("coalesces simultaneous bootstrap calls", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ csrfToken: "token" })));
    vi.stubGlobal("fetch", fetcher);
    await Promise.all([bootstrapCsrf(), bootstrapCsrf()]);
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
