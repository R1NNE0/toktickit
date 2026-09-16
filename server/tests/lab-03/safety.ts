import path from "node:path";
export const TEST_DATABASE_URL = "postgresql://lab3_test:lab3_test_local@127.0.0.1:55433/toktickit_lab3_test?schema=public";
export function assertTestEnvironment() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.port !== "55433"
    || url.pathname !== "/toktickit_lab3_test" || process.env.NODE_ENV !== "test")
    throw new Error("Tests require the isolated toktickit_lab3_test database on port 55433.");
  const uploads = path.resolve(process.env.TEST_UPLOAD_ROOT ?? "");
  if (uploads !== path.resolve("uploads/lab-03-test")) throw new Error("Tests require the isolated Lab 3 upload root.");
}
