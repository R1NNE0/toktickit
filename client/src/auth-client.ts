const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
export interface CurrentUser {
  id: number; name: string; email: string; role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";
  isActive: boolean; mustChangePassword: boolean;
}
export interface PasswordChange { currentPassword: string; newPassword: string; confirmPassword: string; }
let csrfToken = "";
let bootstrap: Promise<void> | undefined;
export class AuthError extends Error {
  constructor(message: string, public status: number, public code: string) { super(message); }
}
export function clearCsrf() { csrfToken = ""; }
export async function bootstrapCsrf() {
  bootstrap ??= (async () => {
    const res = await fetch(API_URL + "/api/auth/csrf", { credentials: "include" });
    if (!res.ok) throw new Error("Unable to connect. Please retry.");
    csrfToken = (await res.json()).csrfToken;
  })().finally(() => { bootstrap = undefined; });
  return bootstrap;
}
export async function sessionFetch(endpoint: string, options: RequestInit = {}, notify = true) {
  const url = new URL(endpoint, API_URL);
  if (url.origin !== new URL(API_URL).origin) throw new Error("Invalid API destination.");
  const headers = new Headers(options.headers);
  headers.delete("x-requester-id");
  if (!["GET", "HEAD", "OPTIONS"].includes((options.method ?? "GET").toUpperCase())) {
    if (!csrfToken) await bootstrapCsrf();
    headers.set("X-CSRF-Token", csrfToken);
  }
  const res = await fetch(url.toString(), { ...options, headers, credentials: "include" });
  if (notify && res.status === 401) window.dispatchEvent(new Event("toktickit:session-expired"));
  if (notify && res.status === 403) {
    const body = await res.clone().json().catch(() => ({}));
    if (body.code === "PASSWORD_CHANGE_REQUIRED") window.dispatchEvent(new Event("toktickit:session-expired"));
  }
  return res;
}
export async function authRequest(path: string, body?: unknown): Promise<{ user: CurrentUser }> {
  let res: Response;
  try {
    res = await sessionFetch("/api/auth/" + path, body === undefined ? {} : {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
    }, false);
  } catch { throw new Error("Unable to connect. Please retry."); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && path === "change-password") window.dispatchEvent(new Event("toktickit:session-expired"));
    const messages: Record<number, string> = {
      400: "Check the entered values and password rules.",
      401: path === "login" ? "Unable to sign in. Check your credentials or contact your administrator." : "Please sign in again.",
      403: data.code === "PASSWORD_CHANGE_REQUIRED" ? "Change your initial password first." : "Refresh the page and try again.",
      429: "Too many attempts. Try again in " + (res.headers.get("Retry-After") ?? "a few") + " seconds."
    };
    if (data.code === "CSRF_INVALID") clearCsrf();
    throw new AuthError(messages[res.status] ?? "Unable to complete the request. Please retry.", res.status, data.code);
  }
  if (data.csrfToken) csrfToken = data.csrfToken;
  return data;
}
