import argon2 from "argon2";
const denied = new Set(["passwordpassword", "123456789012345", "qwertyuiopasdfgh", "letmeinletmeinletmein"]);
export function passwordError(value: unknown): string | null {
  if (typeof value !== "string" || [...value].length < 15 || [...value].length > 128)
    return "Use 15–128 characters.";
  return denied.has(value.toLowerCase()) ? "Choose a less common password." : null;
}
export async function hashPassword(password: string): Promise<string> {
  const error = passwordError(password);
  if (error) throw new Error(error);
  return argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
}
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try { return await argon2.verify(hash, password); } catch { return false; }
}
export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export const validEmail = (email: unknown): email is string =>
  typeof email === "string" && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
