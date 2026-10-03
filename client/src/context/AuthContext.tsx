import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AuthError, authRequest, bootstrapCsrf, clearCsrf, type CurrentUser, type PasswordChange } from "../auth-client.js";
interface AuthValue {
  user: CurrentUser | null; loading: boolean; error: string; logoutPending: boolean;
  reload: () => Promise<void>; login: (email: string, password: string) => Promise<void>;
  changePassword: (body: PasswordChange) => Promise<void>; logout: () => Promise<void>;
}
const Context = createContext<AuthValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const generation = useRef(0), logoutBlocked = useRef(false);
  const [logoutPending, setLogoutPending] = useState(false);
  async function reload() {
    if (logoutBlocked.current) return;
    const version = ++generation.current;
    setUser(null); setLoading(true); setError("");
    try {
      await bootstrapCsrf();
      const result = await authRequest("me");
      if (version === generation.current) setUser(result.user);
    } catch (e) {
      if (version === generation.current && !(e instanceof AuthError && e.status === 401))
        setError("Unable to check your session. Please retry.");
    } finally { if (version === generation.current) setLoading(false); }
  }
  useEffect(() => {
    try { localStorage.removeItem("toktickit_selected_requester_id"); } catch { /* Storage is not an identity source. */ }
    void reload();
    const expired = () => { clearCsrf(); void reload(); };
    window.addEventListener("toktickit:session-expired", expired);
    return () => { generation.current++; window.removeEventListener("toktickit:session-expired", expired); };
  }, []);
  async function update(path: string, body: unknown) {
    const version = ++generation.current;
    const result = await authRequest(path, body);
    if (version === generation.current) setUser(result.user);
  }
  async function logout() {
    generation.current++; logoutBlocked.current = true; setLogoutPending(true); setUser(null);
    try { await authRequest("logout", {}); }
    catch (e) { if (!(e instanceof AuthError && e.status === 401)) throw e; }
    clearCsrf(); logoutBlocked.current = false; setLogoutPending(false);
  }
  return <Context.Provider value={{ user, loading, error, logoutPending, reload, logout,
    login: (email, password) => update("login", { email, password }),
    changePassword: body => update("change-password", body) }}>{children}</Context.Provider>;
}
export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error("AuthProvider is required.");
  return value;
}
