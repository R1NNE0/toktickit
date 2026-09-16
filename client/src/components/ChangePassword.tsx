import { useRef, useState, type FormEvent } from "react";
import type { PasswordChange } from "../auth-client.js";
const empty = { currentPassword: "", newPassword: "", confirmPassword: "" };
const denied = new Set(["passwordpassword", "123456789012345", "qwertyuiopasdfgh", "letmeinletmeinletmein"]);
export function ChangePassword({ mandatory, onSubmit, onCancel }: {
  mandatory: boolean; onSubmit: (body: PasswordChange) => Promise<void>; onCancel?: () => void;
}) {
  const [values, setValues] = useState(empty), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const submitting = useRef(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); if (submitting.current) return;
    const length = [...values.newPassword].length;
    if (!values.currentPassword || length < 15 || length > 128 || denied.has(values.newPassword.toLowerCase())
      || values.currentPassword === values.newPassword) { setError("Use 15–128 characters and a new, less common password."); return; }
    if (values.newPassword !== values.confirmPassword) { setError("The new passwords must match."); return; }
    submitting.current = true; setBusy(true); setError("");
    try { await onSubmit(values); setValues(empty); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to change password. Please retry."); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <section className="zen-card mx-auto" style={{ maxWidth: 480 }}>
    <h1 className="h4">Change password</h1>
    {mandatory && <p>Change your initial password before using the application.</p>}
    <p id="password-rules">Use 15–128 characters. Spaces are allowed. Do not reuse your current password.</p>
    <form onSubmit={submit} noValidate>
      {([["currentPassword", "Current password"], ["newPassword", "New password"], ["confirmPassword", "Confirm new password"]] as const).map(([key, label]) =>
        <div className="mb-3" key={key}><label className="form-label" htmlFor={key}>{label}</label>
          <input id={key} className="form-control" type="password" aria-describedby="password-rules"
            autoComplete={key === "currentPassword" ? "current-password" : "new-password"}
            value={values[key]} disabled={busy} onChange={e => setValues({ ...values, [key]: e.target.value })} />
        </div>)}
      {error && <p className="alert alert-danger" role="alert">{error}</p>}
      <button className="btn btn-zen-primary" disabled={busy}>{busy ? "Saving..." : "Save password"}</button>
      {!mandatory && <button className="btn btn-outline-secondary ms-2" type="button" disabled={busy} onClick={onCancel}>Cancel</button>}
    </form>
  </section>;
}
