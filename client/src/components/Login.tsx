import { useRef, useState, type FormEvent } from "react";
export function Login({ onSubmit }: { onSubmit: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState(""), [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const submitting = useRef(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || !password || [...password].length > 128) {
      setError("Enter a valid email and password."); return;
    }
    submitting.current = true; setBusy(true); setError("");
    try { await onSubmit(email.trim(), password); setPassword(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to sign in. Please retry."); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <section className="zen-card mx-auto" style={{ maxWidth: 480 }}>
    <h1 className="h4">Sign in</h1>
    <form onSubmit={submit} noValidate>
      <label className="form-label" htmlFor="login-email">Email</label>
      <input className="form-control mb-3" id="login-email" type="email" autoComplete="username" maxLength={254}
        value={email} onChange={e => setEmail(e.target.value)} disabled={busy} />
      <label className="form-label" htmlFor="login-password">Password</label>
      <input className="form-control mb-3" id="login-password" type="password" autoComplete="current-password"
        value={password} onChange={e => setPassword(e.target.value)} disabled={busy} />
      {error && <p className="alert alert-danger" role="alert">{error}</p>}
      <button className="btn btn-zen-primary" disabled={busy}>{busy ? "Signing in..." : "Sign in"}</button>
    </form>
  </section>;
}
