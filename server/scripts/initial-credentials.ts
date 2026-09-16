import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";
import type { Readable, Writable } from "node:stream";
import { hashPassword } from "../src/auth/password.js";

type Identity = { id?: number; email: string };
export type Handover = (credentials: (Identity & { initialPassword: string })[]) => Promise<void>;

// A handover must resolve only after the operator has received and retained the
// credential. Callers may persist the returned hash only after this completes.
// A failed database write leaves a handed-over candidate inactive; retrying may
// generate a fresh candidate. Existing hashes must always be left unchanged.
export async function prepareInitialPassword(identity: Identity, handover: Handover): Promise<string> {
  const initialPassword = randomBytes(24).toString("base64url");
  const passwordHash = await hashPassword(initialPassword);
  await handover([{ ...identity, initialPassword }]);
  return passwordHash;
}

export async function terminalHandover(
  credentials: Parameters<Handover>[0],
  input: Readable & { isTTY?: boolean } = process.stdin,
  output: Writable & { isTTY?: boolean } = process.stdout,
): Promise<void> {
  if (!input.isTTY || !output.isTTY)
    throw new Error("Initial passwords require a private interactive terminal; redirected input/output is forbidden.");
  const controller = new AbortController();
  const terminal = createInterface({ input, output, terminal: false });
  const abort = () => controller.abort();
  input.on("error", abort); output.on("error", abort);
  terminal.on("close", abort); terminal.on("SIGINT", abort);
  try {
    // Write completion alone cannot confirm operator receipt. Explicit retention
    // acknowledgement is required before any account credential is persisted.
    const message = "Private initial credentials: retain securely; do not log or save in the repository.\n"
      + "These candidates become active only if the following database write succeeds.\n"
      + credentials.map(value => JSON.stringify(value)).join("\n") + "\n";
    await new Promise<void>((resolve, reject) => {
      output.write(message, error => error ? reject(error) : resolve());
    });
    controller.signal.throwIfAborted();
    const answer = await terminal.question("Type SAVED after retaining these credentials securely: ", { signal: controller.signal });
    if (answer !== "SAVED") throw new Error("Handover not confirmed");
    controller.signal.throwIfAborted();
  } catch {
    throw new Error("Credential handover failed or was not confirmed; this account was not provisioned. Retry the command.");
  } finally {
    terminal.off("close", abort); terminal.off("SIGINT", abort);
    terminal.close();
    input.off("error", abort); output.off("error", abort);
  }
}
