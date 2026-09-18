import { useState } from "react";
import { useAuth } from "../context/AuthContext.js";
export function Header({ activeTab = "my-tickets", onNavigate, onChangePassword }: {
  activeTab?: string; onNavigate?: (tab: string) => void; onChangePassword?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function signOut() {
    if (busy) return;
    setBusy(true); setError("");
    try { await logout(); } catch { setError("Sign out failed. Please retry."); }
    finally { setBusy(false); }
  }
  return <header className="zen-header d-flex flex-wrap justify-content-between align-items-center gap-3">
    <span className="h4 mb-0">TokTickIT</span>
    {user?.role === "REQUESTER" && !user.mustChangePassword && <><button className="btn btn-light requester-menu-toggle" aria-expanded={menuOpen} aria-controls="requester-navigation" onClick={() => setMenuOpen(!menuOpen)}>Menu</button>
    <nav id="requester-navigation" className={"d-flex gap-2 requester-navigation " + (menuOpen ? "is-open" : "")} aria-label="Requester">
      {[["my-tickets", "My Tickets"], ["create-ticket", "Create Ticket"]].map(([tab, label]) =>
        <button type="button" key={tab} className={"zen-nav-pill border-0 " + (activeTab === tab ? "active" : "bg-transparent")}
          aria-current={activeTab === tab ? "page" : undefined} onClick={() => { onNavigate?.(tab); setMenuOpen(false); }}>{label}</button>)}
    </nav></>}
    {user?.role === "IT_STAFF" && !user.mustChangePassword && <><button className="btn btn-light requester-menu-toggle" aria-expanded={menuOpen} aria-controls="staff-navigation" onClick={() => setMenuOpen(!menuOpen)}>Menu</button>
      <nav id="staff-navigation" className={"d-flex gap-2 requester-navigation " + (menuOpen ? "is-open" : "")} aria-label="IT Staff">
        <button type="button" className="zen-nav-pill border-0 active" aria-current="page"
          onClick={() => { onNavigate?.("staff-queue"); setMenuOpen(false); }}>Ticket Queue</button>
      </nav></>}
    {user?.role === "ADMINISTRATOR" && !user.mustChangePassword && <><button className="btn btn-light requester-menu-toggle" aria-expanded={menuOpen} aria-controls="admin-navigation" onClick={() => setMenuOpen(!menuOpen)}>Menu</button>
      <nav id="admin-navigation" className={"d-flex gap-2 requester-navigation " + (menuOpen ? "is-open" : "")} aria-label="Administrator">
        <button type="button" className="zen-nav-pill border-0 active" aria-current="page"
          onClick={() => { onNavigate?.("user-management"); setMenuOpen(false); }}>User Management</button>
      </nav></>}
    {user && <div className="d-flex flex-wrap align-items-center gap-2">
      <span>{user.name} · {user.role === "IT_STAFF" ? "IT Staff" : user.role === "ADMINISTRATOR" ? "Administrator" : "Requester"}</span>
      {!user.mustChangePassword && <button type="button" className="btn btn-sm btn-light" onClick={onChangePassword}>Change password</button>}
      <button type="button" className="btn btn-sm btn-light" disabled={busy} onClick={() => void signOut()}>{busy ? "Signing out..." : "Sign out"}</button>
      {error && <span role="alert">{error}</span>}
    </div>}
  </header>;
}
