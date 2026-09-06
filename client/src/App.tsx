import { useState } from "react";
import { RequesterProvider, useRequester } from "./context/RequesterContext.js";
import { Header } from "./components/Header.js";
import { RequesterSelector } from "./components/RequesterSelector.js";
import { CreateTicket } from "./components/CreateTicket.js";
import { MyTickets } from "./components/MyTickets.js";
import { TicketDetail } from "./components/TicketDetail.js";
import { checkSystem, Category } from "./api.js";

type UiState = "idle" | "loading" | "success" | "error";

function MainContent() {
  const { currentRequester, isSwitching, setIsSwitching } = useRequester();
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
      <Header activeTab={activeTab} onNavigate={handleNavigate} />

      <main className="container py-4 flex-grow-1" style={{ maxWidth: 1100 }}>
        {/* Main interactive area: Persona selector or active persona dashboard */}
        {!currentRequester || isSwitching ? (
          <RequesterSelector />
        ) : (
          <div>
            {/* Active Requester Welcome Card */}
            <div className="zen-card mb-4">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h1 className="h4 fw-bold mb-1" style={{ color: "var(--text-primary)" }}>
                    Welcome, {currentRequester.name}
                  </h1>
                  <p className="text-muted small mb-0">
                    Active Development Persona: <strong>{currentRequester.email}</strong>
                  </p>
                </div>
                <span className="badge" style={{ backgroundColor: "var(--pale-green)", color: "var(--primary-green)", padding: "8px 12px", fontSize: "0.85rem" }}>
                  Active Persona
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

export default function App() {
  return (
    <RequesterProvider>
      <MainContent />
    </RequesterProvider>
  );
}
