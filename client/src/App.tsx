import { useState } from "react";
import { SessionRequesterProvider, useRequester } from "./context/RequesterContext.js";
import { Header } from "./components/Header.js";
import { AuthProvider, useAuth } from "./context/AuthContext.js";
import { Login } from "./components/Login.js";
import { ChangePassword } from "./components/ChangePassword.js";
import { CreateTicket } from "./components/CreateTicket.js";
import { MyTickets } from "./components/MyTickets.js";
import { TicketDetail } from "./components/TicketDetail.js";
import { checkSystem, Category } from "./api.js";

type UiState = "idle" | "loading" | "success" | "error";

function LogoutRetry() {
  const { logout } = useAuth();
  const [busy, setBusy] = useState(false);
  return <div className="alert alert-warning" role="alert">Logout could not be confirmed. Retry.
    <button className="btn btn-outline-secondary ms-2" disabled={busy} onClick={async () => {
      setBusy(true);
      try { await logout(); } catch { /* Keep private content hidden while retry remains available. */ }
      finally { setBusy(false); }
    }}>{busy ? "Signing out..." : "Retry sign out"}</button>
  </div>;
}

function MainContent() {
  const { currentRequester } = useRequester();
  const auth = useAuth();
  const [changingPassword, setChangingPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("my-tickets");
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [isFormDirty, setIsFormDirty] = useState<boolean>(false);

  // Safe navigation with unsaved changes guard
  const handleNavigate = (tab: string) => {
    if (isFormDirty && activeTab === "create-ticket") {
      const confirmLeave = window.confirm(
        "You have unsaved changes in your ticket form. Are you sure you want to leave?"
      );
      if (!confirmLeave) return;
    }
    setSelectedTicketId(null);
    setActiveTab(tab);
  };

  // Lab 1 System Check state for backward compatibility
  const [systemState, setSystemState] = useState<UiState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [categories, setCategories] = useState<Category[]>([]);

  async function handleCheck() {
    setSystemState("loading");
    setErrorMessage("");
    try {
      const result = await checkSystem();
      setCategories(result.categories);
      setSystemState("success");
    } catch (err: unknown) {
      setSystemState("error");
      const message =
        err instanceof Error
          ? err.message
          : "Unable to connect to TokTickIT API";
      setErrorMessage(message || "Unable to connect to TokTickIT API");
    }
  }

  return (
    <div className="min-vh-100 d-flex flex-column" style={{ backgroundColor: "var(--page-bg)" }}>
      <Header activeTab={activeTab} onNavigate={handleNavigate} onChangePassword={() => setChangingPassword(true)} />

      <main className="container py-4 flex-grow-1" style={{ maxWidth: 1100 }}>
        {/* Session gate and existing Requester screens */}
        {auth.loading ? <p role="status">Checking your session...</p>
          : auth.logoutPending ? <LogoutRetry />
          : auth.error ? <div className="alert alert-danger" role="alert">{auth.error} <button onClick={() => void auth.reload()}>Retry</button></div>
          : !auth.user ? <Login onSubmit={auth.login} />
          : auth.user.mustChangePassword || changingPassword ? <ChangePassword mandatory={auth.user.mustChangePassword}
              onSubmit={async body => { await auth.changePassword(body); setChangingPassword(false); }}
              onCancel={() => setChangingPassword(false)} />
          : auth.user.role !== "REQUESTER" ? <div className="zen-card"><h1 className="h4">Welcome, {auth.user.name}</h1>
              <p>Signed in as {auth.user.role === "IT_STAFF" ? "IT Staff" : "Administrator"}.</p></div>
          : currentRequester && (
          <div>
            {/* Active Requester Welcome Card */}
            <div className="zen-card mb-4">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h1 className="h4 fw-bold mb-1" style={{ color: "var(--text-primary)" }}>
                    Welcome, {currentRequester.name}
                  </h1>
                  <p className="text-muted small mb-0">
                    Signed in: <strong>{currentRequester.email}</strong>
                  </p>
                </div>
                <span className="badge" style={{ backgroundColor: "var(--pale-green)", color: "var(--primary-green)", padding: "8px 12px", fontSize: "0.85rem" }}>
                  Requester
                </span>
              </div>
            </div>

            {/* Tab Navigation Views */}
            {activeTab === "create-ticket" ? (
              <CreateTicket
                onSuccessNavigate={() => {
                  setSelectedTicketId(null);
                  setActiveTab("my-tickets");
                }}
                onDirtyChange={(dirty) => setIsFormDirty(dirty)}
              />
            ) : selectedTicketId ? (
              <TicketDetail
                ticketId={selectedTicketId}
                onBack={() => {
                  setSelectedTicketId(null);
                  setActiveTab("my-tickets");
                }}
              />
            ) : (
              <MyTickets
                onNavigateCreate={() => {
                  setSelectedTicketId(null);
                  setActiveTab("create-ticket");
                }}
                onSelectTicket={(ticketId) => {
                  setSelectedTicketId(ticketId);
                }}
              />
            )}
          </div>
        )}

        {/* System Diagnostics Card (Ensures Lab 1 tests & system verification pass reliably) */}
        <div className="zen-card mt-4">
          <h2 className="h6 fw-bold mb-3" style={{ color: "var(--text-primary)" }}>
            Service Desk <span style={{ color: "var(--primary-green)" }}>System Status & Diagnostics</span>
          </h2>

          <button
            className="btn btn-zen-primary mb-3"
            onClick={handleCheck}
            disabled={systemState === "loading"}
          >
            {systemState === "loading" ? "Loading…" : "Check System"}
          </button>

          {systemState === "loading" && (
            <div className="text-muted mt-2 small">⌛ Loading...</div>
          )}

          {systemState === "success" && (
            <div className="mt-3">
              <p className="fw-bold mb-2">
                System Status: <span style={{ color: "var(--success-green)" }}>Online</span>
              </p>
              <h3 className="h6 fw-semibold mb-2">Supported Request Categories:</h3>
              <ol className="list-group list-group-numbered mb-3">
                {categories.map((cat) => (
                  <li key={cat.id} className="list-group-item">
                    {cat.name}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {systemState === "error" && (
            <div className="mt-3">
              <p className="fw-bold text-danger mb-1">System Status: Offline</p>
              <div className="alert alert-danger py-2 mt-2" role="alert">
                {errorMessage}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function SessionApp() {
  const { user } = useAuth();
  return <SessionRequesterProvider user={user}><MainContent key={user ? user.id + ":" + user.mustChangePassword : "signed-out"} /></SessionRequesterProvider>;
}

export default function App() {
  return (
    <AuthProvider><SessionApp /></AuthProvider>
  );
}
