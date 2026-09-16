import { describe, expect, it } from "vitest";
import { PassThrough, Writable } from "node:stream";
import { terminalHandover } from "../../scripts/initial-credentials.js";

const credentials = [{ email: "operator-test@example.com", initialPassword: "Synthetic terminal fixture only!" }];

describe("private initial-credential handover", () => {
  it("waits for explicit retention confirmation after displaying the credential", async () => {
    const input = Object.assign(new PassThrough(), { isTTY: true });
    let prompt!: () => void;
    const prompted = new Promise<void>(resolve => { prompt = resolve; });
    let displayed = false, completed = false;
    const output = Object.assign(new Writable({ write(chunk, _encoding, callback) {
      displayed ||= chunk.toString().includes(credentials[0].initialPassword);
      if (chunk.toString().includes("Type SAVED")) prompt();
      callback();
    } }), { isTTY: true });
    const handover = terminalHandover(credentials, input, output).then(() => { completed = true; });
    await prompted;
    expect(displayed).toBe(true);
    expect(completed).toBe(false);
    input.write("SAVED\n");
    await handover;
    expect(completed).toBe(true);
    input.destroy(); output.destroy();
  });

  it.each(["refusal", "end", "write-error", "prompt-error"])("rejects %s instead of confirming delivery", async failure => {
    const input = Object.assign(new PassThrough(), { isTTY: true });
    const output = Object.assign(new Writable({ write(chunk, _encoding, callback) {
      const isPrompt = chunk.toString().includes("Type SAVED");
      if (failure === "write-error" || (failure === "prompt-error" && isPrompt)) {
        callback(new Error("Simulated private-terminal failure"));
        return;
      }
      callback();
      if (isPrompt) queueMicrotask(() => {
        if (failure === "end") input.end();
        else input.write("CANCEL\n");
      });
    } }), { isTTY: true });
    await expect(terminalHandover(credentials, input, output)).rejects.toThrow("Credential handover failed or was not confirmed");
    input.destroy(); output.destroy();
  });

  it("rejects redirected input or output before writing any credential", async () => {
    for (const [inputTTY, outputTTY] of [[false, true], [true, false]]) {
      const input = Object.assign(new PassThrough(), { isTTY: inputTTY });
      let wrote = false;
      const output = Object.assign(new Writable({ write(_chunk, _encoding, callback) { wrote = true; callback(); } }), { isTTY: outputTTY });
      await expect(terminalHandover(credentials, input, output)).rejects.toThrow("redirected input/output is forbidden");
      expect(wrote).toBe(false);
      input.destroy(); output.destroy();
    }
  });
});
