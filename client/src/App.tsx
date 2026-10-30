import { StaffDashboard } from "./components/StaffDashboard.js";
import type { ListFilters } from "./staff-dashboard-api.js";
import { canLeaveActions } from "./action-ui.js";
import { useState, useEffect } from "react";
import { Header } from "./components/Header.js";
import { AuthProvider, useAuth } from "./context/AuthContext.js";
import { Login } from "./components/Login.js";
import { ChangePassword } from "./components/ChangePassword.js";
import { CreateTicket } from "./components/CreateTicket.js";
import { MyTickets } from "./components/MyTickets.js";
import { TicketDetail } from "./components/TicketDetail.js";
import { StaffTicketQueue } from "./components/StaffTicketQueue.js";
import { StaffTicketDetail } from "./components/StaffTicketDetail.js";
import { UserManagement } from "./components/UserManagement.js";
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
  const auth = useAuth();
  const currentRequester = auth.user;
  const [changingPassword, setChangingPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(auth.user?.role === "REQUESTER" ? "my-tickets" : "dashboard");
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [isFormDirty, setIsFormDirty] = useState<boolean>(false);
  const [queueNavigation, setQueueNavigation] = useState(0);

  const [queueEntry, setQueueEntry] = useState<{ version: number; filters: ListFilters } | null>(null);
  const [selectedActionId, setSelectedActionId] = useState<number>();

  // Hash deep link support (e.g. #/tickets/123)
  useEffect(() => {
    let acceptedHash = window.location.hash;
    const handleHash = () => {
      if (window.location.hash !== acceptedHash && !canLeaveActions()) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search + acceptedHash);
        return;
      }
      const previousHash = acceptedHash;
      acceptedHash = window.location.hash;
      const match = window.location.hash.match(/^#\/tickets\/(\d+)$/);
      if (match) {
        setSelectedActionId(undefined); setSelectedTicketId(Number(match[1]));
      } else if (!acceptedHash && /^#\/tickets\/\d+$/.test(previousHash)) {
        setSelectedTicketId(null); setSelectedActionId(undefined);
        setQueueNavigation(value => value + 1);
      }
    };
    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  // Safe navigation with unsaved changes guard
  const handleNavigate = (tab: string) => {
    if (!canLeaveActions()) return;
    if (isFormDirty && activeTab === "create-ticket") {
      const confirmLeave = window.confirm(
        "You have unsaved changes in your ticket form. Are you sure you want to leave?"
      );
      if (!confirmLeave) return;
    }
    setSelectedTicketId(null); setSelectedActionId(undefined);
    if (tab === "staff-queue") setQueueEntry(value => value ?? { version: 0, filters: {} });
    setQueueNavigation(value => value + 1);
    if (window.location.hash.startsWith("#/tickets/")) {
      window.location.hash = "";
    }
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
      <Header activeTab={activeTab} onNavigate={handleNavigate} onChangePassword={() => { if (canLeaveActions()) setChangingPassword(true); }} />

      <main className="container py-4 flex-grow-1" style={{ maxWidth: 1100 }}>
        {/* Session gate and existing Requester screens */}
        {auth.loading ? <p role="status">Checking your session...</p>
          : auth.logoutPending ? <LogoutRetry />
          : auth.error ? <div className="alert alert-danger" role="alert">{auth.error} <button onClick={() => void auth.reload()}>Retry</button></div>
          : !auth.user ? <Login onSubmit={auth.login} />
          : auth.user.mustChangePassword || changingPassword ? <ChangePassword mandatory={auth.user.mustChangePassword}
              onSubmit={async body => { await auth.changePassword(body); setChangingPassword(false); }}
              onCancel={() => setChangingPassword(false)} />
          : auth.user.role !== "REQUESTER" ? (
            <>
              <div hidden={selectedTicketId !== null || activeTab !== "dashboard"}>
                <StaffDashboard role={auth.user.role} navigationVersion={queueNavigation}
                  onDrilldown={entry => { if (!canLeaveActions()) return; setQueueEntry(old => ({ version: (old?.version ?? 0) + 1, filters: entry.filters })); setActiveTab("staff-queue"); }}
                  onOpenTicket={(id, actionId) => { if (!canLeaveActions()) return; setSelectedActionId(actionId); setSelectedTicketId(id); }} />
              </div>
              {queueEntry && <div hidden={selectedTicketId !== null || activeTab !== "staff-queue"}>
                <StaffTicketQueue key={queueEntry.version} entry={queueEntry.filters} role={auth.user.role} navigationVersion={queueNavigation}
                  onOpenDetail={id => { setSelectedActionId(undefined); setSelectedTicketId(id); }} />
              </div>}
              {!selectedTicketId && activeTab === "user-management" && auth.user.role === "ADMINISTRATOR" && <UserManagement />}
              {selectedTicketId && (() => {
                const Detail = auth.user.role === "IT_STAFF" ? StaffTicketDetail : TicketDetail;
                return <Detail key={selectedTicketId} ticketId={selectedTicketId} focusActionId={selectedActionId} onBack={() => {
                  setSelectedTicketId(null); setSelectedActionId(undefined); setQueueNavigation(v => v + 1);
                  if (window.location.hash.startsWith("#/tickets/")) window.location.hash = "";
                }} />;
              })()}
            </>
          )
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
                onViewTicket={id => { setSelectedTicketId(id); setActiveTab("my-tickets"); setIsFormDirty(false); }}
                onSuccessNavigate={() => {
                  setSelectedTicketId(null);
                  setActiveTab("my-tickets");
                }}
                onDirtyChange={(dirty) => setIsFormDirty(dirty)}
              />
            ) : selectedTicketId ? (
              <TicketDetail
                key={selectedTicketId}
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
  return <MainContent key={user ? user.id + ":" + user.role + ":" + user.mustChangePassword : "signed-out"} />;
}

export default function App() {
  return (
    <AuthProvider><SessionApp /></AuthProvider>
  );
}
