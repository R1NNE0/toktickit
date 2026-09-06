import React from "react";
import { useRequester } from "../context/RequesterContext.js";

interface HeaderProps {
  activeTab?: string;
  onNavigate?: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab = "my-tickets",
  onNavigate,
}) => {
  const { currentRequester, setIsSwitching } = useRequester();

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <header className="zen-header d-flex justify-content-between align-items-center">
      <div className="d-flex align-items-center gap-4">
        <div
          className="d-flex align-items-center gap-2"
          style={{ cursor: "pointer" }}
          onClick={() => onNavigate && onNavigate("my-tickets")}
        >
          <span style={{ fontSize: "1.35rem", fontWeight: 700, letterSpacing: "-0.5px" }}>
            TokTickIT
          </span>
        </div>

        <nav className="d-none d-md-flex gap-2">
          <button
            type="button"
            className={`zen-nav-pill border-0 ${
              activeTab === "my-tickets" ? "active" : "bg-transparent"
            }`}
            onClick={() => onNavigate && onNavigate("my-tickets")}
          >
            📋 My Tickets
          </button>
          <button
            type="button"
            className={`zen-nav-pill border-0 ${
              activeTab === "create-ticket" ? "active" : "bg-transparent"
            }`}
            onClick={() => onNavigate && onNavigate("create-ticket")}
          >
            ➕ Create Ticket
          </button>
        </nav>
      </div>

      <div className="d-flex align-items-center gap-3">
        {currentRequester ? (
          <div className="user-persona-badge">
            <div className="avatar-circle">
              {getInitials(currentRequester.name)}
            </div>
            <div className="d-none d-sm-block text-start">
              <div style={{ fontWeight: 600, lineHeight: 1.2 }}>
                {currentRequester.name}
              </div>
              <div style={{ fontSize: "0.7rem", opacity: 0.85 }}>
                Requester
              </div>
            </div>
            <button
              type="button"
              className="btn-switch-requester ms-2"
              onClick={() => setIsSwitching(true)}
              title="Switch development testing persona"
            >
              Switch
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-sm btn-light fw-bold"
            onClick={() => setIsSwitching(true)}
          >
            Select Persona
          </button>
        )}
      </div>
    </header>
  );
};
