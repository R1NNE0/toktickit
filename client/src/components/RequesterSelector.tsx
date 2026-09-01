import React, { useState, useEffect } from "react";
import { useRequester } from "../context/RequesterContext.js";
import { RequesterUser } from "../api.js";

interface RequesterSelectorProps {
  onSuccess?: () => void;
}

export const RequesterSelector: React.FC<RequesterSelectorProps> = ({
  onSuccess,
}) => {
  const {
    currentRequester,
    requesters,
    loading,
    error,
    selectRequester,
    setIsSwitching,
    refreshRequesters,
  } = useRequester();

  const [selectedId, setSelectedId] = useState<number | string>(
    currentRequester?.id || ""
  );

  useEffect(() => {
    if (currentRequester) {
      setSelectedId(currentRequester.id);
    } else if (requesters.length > 0) {
      setSelectedId(requesters[0].id);
    }
  }, [currentRequester, requesters]);

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    const chosen = requesters.find((r) => r.id === Number(selectedId));
    if (chosen) {
      selectRequester(chosen);
      if (onSuccess) onSuccess();
    }
  };

  return (
    <div
      className="d-flex align-items-center justify-content-center py-5 px-3"
      style={{ minHeight: "80vh" }}
    >
      <div
        className="zen-card w-100"
        style={{ maxWidth: 520, borderRadius: 12 }}
      >
        <div className="text-center mb-4">
          <div
            className="avatar-circle mx-auto mb-3"
            style={{
              width: 56,
              height: 56,
              fontSize: "1.5rem",
              backgroundColor: "var(--pale-green)",
              color: "var(--primary-green)",
            }}
          >
            👤
          </div>
          <h2 className="h4 fw-bold mb-1" style={{ color: "var(--text-primary)" }}>
            Select Development Requester
          </h2>
          <p className="text-muted small mb-0">
            Choose a development requester to simulate user context for Lab 2.
            This is for testing only and is not a login screen.
          </p>
        </div>

        {/* Informational Callout */}
        <div className="zen-info-banner mb-4">
          <strong>Authentication coming in Lab 3:</strong> In Lab 3, this
          selection will be replaced with secure authentication so you can access
          the system with your own account.
        </div>

        {/* Error State */}
        {error && (
          <div className="alert alert-danger py-2 mb-4" role="alert">
            <div className="d-flex justify-content-between align-items-center">
              <span>{error}</span>
              <button
                type="button"
                className="btn btn-sm btn-outline-danger ms-2"
                onClick={refreshRequesters}
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="text-center py-4">
            <div
              className="spinner-border text-success mb-2"
              role="status"
              style={{ color: "var(--primary-green) !important" }}
            >
              <span className="visually-hidden">Loading...</span>
            </div>
            <div className="text-muted small">Loading active requesters...</div>
          </div>
        ) : requesters.length === 0 && !error ? (
          /* Empty State */
          <div className="text-center py-4 text-muted">
            <p className="mb-2">No active development requesters found.</p>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={refreshRequesters}
            >
              Reload
            </button>
          </div>
        ) : (
          /* Form Controls */
          <form onSubmit={handleContinue}>
            <div className="mb-4 text-start">
              <label
                htmlFor="requester-select"
                className="form-label fw-semibold small mb-1"
                style={{ color: "var(--text-primary)" }}
              >
                Development Requester <span className="text-danger">*</span>
              </label>
              <select
                id="requester-select"
                className="form-select"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                style={{
                  height: 44,
                  borderColor: "var(--border-neutral)",
                  borderRadius: 6,
                }}
              >
                {requesters.map((r: RequesterUser) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.email})
                  </option>
                ))}
              </select>
              <div className="form-text small mt-1 text-muted">
                ℹ️ Only active development requesters are shown.
              </div>
            </div>

            <div className="d-flex justify-content-end gap-2">
              {currentRequester && (
                <button
                  type="button"
                  className="btn btn-outline-secondary px-3"
                  onClick={() => setIsSwitching(false)}
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                className="btn btn-zen-primary px-4"
                disabled={!selectedId || loading}
              >
                Continue →
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
