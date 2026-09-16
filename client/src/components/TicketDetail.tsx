import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Ticket,
  Attachment,
  getTicketDetail,
  downloadAttachment,
  softRemoveAttachment,
  uploadAttachment,
} from "../api.js";

interface TicketDetailProps {
  ticketId: number;
  onBack: () => void;
}

export const TicketDetail: React.FC<TicketDetailProps> = ({
  ticketId,
  onBack,
}) => {
  const generation = useRef(0);
  const transfer = useRef(new AbortController());
  const [uploading, setUploading] = useState(false);
  useEffect(() => { transfer.current = new AbortController(); return () => { transfer.current.abort(); generation.current++; }; }, [ticketId]);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Download state
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Soft Removal Modal State
  const [modalAttachment, setModalAttachment] = useState<Attachment | null>(null);
  const [removalReason, setRemovalReason] = useState<string>("");
  const [removalError, setRemovalError] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const fetchTicket = useCallback(async () => {
    const version = ++generation.current;
    setLoading(true);
    setError(null);
    try {
      const data = await getTicketDetail(ticketId);
      if (version === generation.current) setTicket(data);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to load ticket details";
      if (version === generation.current) setError(msg);
    } finally {
      if (version === generation.current) setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

  // Download handler
  const handleDownload = async (attachment: Attachment) => {
    setDownloadingId(attachment.id);
    setDownloadError(null);
    try {
      await downloadAttachment(attachment.id, attachment.fileName, transfer.current.signal);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to download attachment file";
      setDownloadError(msg);
    } finally {
      setDownloadingId(null);
    }
  };

  // Open modal
  const openRemoveModal = (attachment: Attachment) => {
    setModalAttachment(attachment);
    setRemovalReason("");
    setRemovalError(null);
  };

  // Close modal
  const closeRemoveModal = () => {
    if (isRemoving) return;
    setModalAttachment(null);
    setRemovalReason("");
    setRemovalError(null);
  };

  // Execute soft removal
  const handleConfirmRemoval = async () => {
    if (!modalAttachment) return;
    const trimmedReason = removalReason.trim();
    if (!trimmedReason || [...trimmedReason].length > 1000) {
      setRemovalError(!trimmedReason ? "A removal reason is mandatory and cannot be blank." : "Removal reason must be at most 1000 characters.");
      return;
    }

    setIsRemoving(true);
    setRemovalError(null);
    try {
      const updated = await softRemoveAttachment(
        modalAttachment.id,
        trimmedReason
      );

      // Update state in-place
      setTicket((prev) => {
        if (!prev) return null;
        const updatedAttachments = prev.attachments?.map((a) =>
          a.id === updated.id
            ? {
                ...a,
                isRemoved: true,
                removedAt: updated.removedAt,
                removalReason: updated.removalReason,
              }
            : a
        );
        return {
          ...prev,
          attachments: updatedAttachments,
        };
      });

      setActionNotice(
        `Attachment "${modalAttachment.fileName}" was soft-removed successfully.`
      );
      setModalAttachment(null);
      setRemovalReason("");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to remove attachment";
      setRemovalError(msg);
      void fetchTicket();
    } finally {
      setIsRemoving(false);
    }
  };

  // Formatting helpers
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatDate = (isoString?: string | null): string => {
    if (!isoString) return "-";
    try {
      return new Date(isoString).toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status.toUpperCase()) {
      case "NEW":
        return "badge-status badge-status-new";
      case "OPEN":
        return "badge-status badge-status-open";
      case "IN_PROGRESS":
        return "badge-status badge-status-in-progress";
      case "RESOLVED":
        return "badge-status badge-status-resolved";
      case "CLOSED":
        return "badge-status badge-status-closed";
      default:
        return "badge-status";
    }
  };

  const getPriorityBadgeClass = (priority: string) => {
    switch (priority.toUpperCase()) {
      case "CRITICAL":
        return "badge-priority badge-priority-critical";
      case "HIGH":
        return "badge-priority badge-priority-high";
      case "MEDIUM":
        return "badge-priority badge-priority-medium";
      case "LOW":
        return "badge-priority badge-priority-low";
      default:
        return "badge-priority";
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes("pdf")) return "📄";
    if (mimeType.startsWith("image/")) return "🖼️";
    return "📎";
  };

  if (loading) {
    return (
      <div className="zen-card text-center py-5">
        <div
          className="spinner-border text-success mb-2"
          role="status"
          style={{ color: "var(--primary-green) !important" }}
        >
          <span className="visually-hidden">Loading ticket details...</span>
        </div>
        <p className="text-muted small mb-0">Loading ticket details...</p>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="zen-card py-4">
        <div className="alert alert-danger d-flex align-items-center justify-content-between mb-3" role="alert">
          <div>
            <strong>Error:</strong> {error || "Ticket not found"}
          </div>
          <button
            type="button"
            className="btn btn-sm btn-outline-danger"
            onClick={fetchTicket}
          >
            Retry
          </button>
        </div>
        <button
          type="button"
          className="btn btn-zen-outline"
          onClick={onBack}
        >
          &larr; Back to My Tickets
        </button>
      </div>
    );
  }

  const activeAttachments =
    ticket.attachments?.filter((a) => !a.isRemoved) || [];
  const removedAttachments =
    ticket.attachments?.filter((a) => a.isRemoved) || [];

  return (
    <div className="ticket-detail-view">
      {/* Navigation and Actions Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <button
          type="button"
          className="btn btn-zen-outline d-inline-flex align-items-center gap-2"
          onClick={onBack}
          aria-label="Back to My Tickets"
        >
          <span>&larr;</span>
          <span>Back to My Tickets</span>
        </button>

        <div className="d-flex align-items-center gap-2">
          <span className={getPriorityBadgeClass(ticket.requestedPriority)}>
            {ticket.requestedPriority} Requested Priority
          </span>
          <span className={getStatusBadgeClass(ticket.currentStatus)}>
            {ticket.currentStatus.replace("_", " ")}
          </span>
        </div>
      </div>

      {/* Action Notification */}
      {actionNotice && (
        <div
          className="alert alert-success alert-dismissible fade show mb-4"
          role="alert"
        >
          {actionNotice}
          <button
            type="button"
            className="btn-close"
            onClick={() => setActionNotice(null)}
            aria-label="Close alert"
          ></button>
        </div>
      )}

      {/* Download Error Banner */}
      {downloadError && (
        <div
          className="alert alert-danger alert-dismissible fade show mb-4"
          role="alert"
        >
          <strong>Attachment Error:</strong> {downloadError}
          <button
            type="button"
            className="btn-close"
            onClick={() => setDownloadError(null)}
            aria-label="Close error"
          ></button>
        </div>
      )}

      {/* Ticket Main Card */}
      <div className="zen-card mb-4">
        {/* Ticket Header Title */}
        <div className="border-bottom pb-3 mb-3">
          <div className="small text-muted mb-1">Support Ticket Details</div>
          <h1
            className="h3 fw-bold mb-0"
            style={{
              fontFamily: "SFMono-Regular, Consolas, monospace",
              color: "var(--primary-green)",
            }}
          >
            {ticket.ticketNumber}
          </h1>
        </div>

        {/* Ticket Metadata Grid */}
        <div className="row g-3 mb-4">
          <div className="col-12 col-md-4"><div className="small text-muted">Requested Priority</div>
            <div className="p-2 border rounded" style={{ backgroundColor: "var(--readonly-bg)" }}>{ticket.requestedPriority}</div></div>
          <div className="col-12 col-md-4"><div className="small text-muted">IT Priority</div>
            <div className="p-2 border rounded" style={{ backgroundColor: "var(--readonly-bg)" }}>{ticket.itPriority}</div></div>
          <div className="col-12 col-md-4">
            <div className="small text-muted">Category</div>
            <div className="fw-semibold">
              {ticket.category?.name || "Uncategorized"}
            </div>
          </div>

          <div className="col-12 col-md-4">
            <div className="small text-muted">Affected System</div>
            <div className="fw-semibold">
              {ticket.relatedSystem?.name || "General"}
            </div>
          </div>

          <div className="col-12 col-md-4">
            <div className="small text-muted">Created Date</div>
            <div className="fw-semibold">{formatDate(ticket.createdAt)}</div>
          </div>

          <div className="col-12 col-md-4">
            <div className="small text-muted">Submitted By</div>
            <div className="fw-semibold">
              {ticket.requester?.name} ({ticket.requester?.email})
            </div>
          </div>

          <div className="col-12 col-md-4">
            <div className="small text-muted">Current Status</div>
            <div>
              <span className={getStatusBadgeClass(ticket.currentStatus)}>
                {ticket.currentStatus.replace("_", " ")}
              </span>
            </div>
          </div>

          <div className="col-12 col-md-4">
            <div className="small text-muted">Last Updated</div>
            <div className="fw-semibold">{formatDate(ticket.updatedAt)}</div>
          </div>
        </div>

        {/* Problem Summary & Description */}
        <div className="mb-4">
          <label className="form-label small fw-bold text-muted text-uppercase">
            Summary
          </label>
          <div
            className="p-3 border rounded bg-white fw-semibold"
            style={{ fontSize: "1.05rem" }}
          >
            {ticket.summary}
          </div>
        </div>

        <div className="mb-2">
          <label className="form-label small fw-bold text-muted text-uppercase">
            Description
          </label>
          <div
            className="p-3 border rounded"
            style={{
              backgroundColor: "var(--readonly-bg)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              lineHeight: 1.6,
            }}
          >
            {ticket.description}
          </div>
        </div>
      </div>

      {/* Attachments Section */}
      <div className="zen-card mb-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 className="h5 fw-bold mb-0" style={{ color: "var(--text-primary)" }}>
            Attached Documents & Files
          </h2>
          <span
            className="badge"
            style={{
              backgroundColor: "var(--pale-green)",
              color: "var(--primary-green)",
              fontWeight: 600,
            }}
          >
            {activeAttachments.length} Active{" "}
            {activeAttachments.length === 1 ? "File" : "Files"}
          </span>
        </div>

        <label className="form-label">Add Attachment
          <input type="file" className="form-control" accept=".jpg,.jpeg,.png,.webp,.pdf" disabled={uploading || activeAttachments.length >= 5}
            onChange={async e => {
              const file = e.target.files?.[0]; e.target.value = "";
              if (!file) return;
              setDownloadError(null);
              if (!/\.(jpe?g|png|webp|pdf)$/i.test(file.name) || file.size === 0 || file.size > 5242880) {
                setDownloadError("Choose JPG, PNG, WEBP or PDF, nonempty and at most 5 MB."); return;
              }
              setUploading(true);
              try {
                await uploadAttachment(ticketId, file, transfer.current.signal);
                if (!transfer.current.signal.aborted) { setActionNotice("Attachment uploaded."); await fetchTicket(); }
              } catch {
                if (!transfer.current.signal.aborted) { setDownloadError("Upload could not be confirmed. Inspect refreshed attachments before retrying."); await fetchTicket(); }
              } finally { setUploading(false); }
            }} />
        </label>
        <p className="small text-muted">{uploading ? "Uploading..." : "Up to five active files, 5 MB each. JPG, JPEG, PNG, WEBP or PDF."}</p>
        {/* Empty attachments notice */}
        {(!ticket.attachments || ticket.attachments.length === 0) && (
          <div className="text-muted text-center py-4 border rounded bg-light">
            No supporting attachments were uploaded with this ticket.
          </div>
        )}

        {/* Active Attachments List */}
        {activeAttachments.length > 0 && (
          <div className="list-group mb-3">
            {activeAttachments.map((att) => (
              <div
                key={att.id}
                className="list-group-item d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2 p-3"
              >
                <div className="d-flex align-items-center gap-3">
                  <span style={{ fontSize: "1.75rem" }}>
                    {getFileIcon(att.mimeType)}
                  </span>
                  <div>
                    <div className="fw-semibold text-break">{att.fileName}</div>
                    <div className="small text-muted">
                      {formatBytes(att.fileSize)} &bull; Uploaded{" "}
                      {formatDate(att.createdAt)}
                    </div>
                  </div>
                </div>

                <div className="d-flex align-items-center gap-2 mt-2 mt-md-0">
                  <button
                    type="button"
                    className="btn btn-sm btn-zen-outline d-inline-flex align-items-center gap-1"
                    onClick={() => handleDownload(att)}
                    disabled={downloadingId === att.id}
                    aria-label={`Download ${att.fileName}`}
                  >
                    {downloadingId === att.id ? "⬇ Downloading..." : "⬇ Download"}
                  </button>

                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1"
                    onClick={() => openRemoveModal(att)}
                    aria-label={`Remove ${att.fileName}`}
                  >
                    🗑 Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Soft-Removed Attachments Archive */}
        {removedAttachments.length > 0 && (
          <div className="mt-4 pt-3 border-top">
            <h3 className="h6 fw-bold text-muted text-uppercase mb-3">
              Archived / Removed Attachments ({removedAttachments.length})
            </h3>
            <div className="list-group">
              {removedAttachments.map((att) => (
                <div
                  key={att.id}
                  className="list-group-item p-3 border-start border-4 border-secondary bg-light"
                >
                  <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2">
                    <div className="d-flex align-items-center gap-3 opacity-75">
                      <span style={{ fontSize: "1.5rem" }}>
                        {getFileIcon(att.mimeType)}
                      </span>
                      <div>
                        <div className="fw-semibold text-break text-decoration-line-through text-muted">
                          {att.fileName}
                        </div>
                        <div className="small text-muted">
                          {formatBytes(att.fileSize)} &bull; Uploaded{" "}
                          {formatDate(att.createdAt)}
                        </div>
                      </div>
                    </div>

                    <div>
                      <span className="badge bg-secondary">
                        Soft Removed
                      </span>
                    </div>
                  </div>

                  {/* Removal details banner */}
                  <div className="mt-2 pt-2 border-top small text-muted">
                    <div>
                      <strong>Removal Reason:</strong>{" "}
                      <em>&ldquo;{att.removalReason}&rdquo;</em>
                    </div>
                    <div>
                      <strong>Removed on:</strong> {formatDate(att.removedAt)}
                    </div>
                    <div className="text-danger mt-1 fst-italic">
                      File download permanently blocked per data retention policy.
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Soft Removal Confirmation Modal Dialog */}
      {modalAttachment && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
          tabIndex={-1}
          role="dialog"
          aria-labelledby="remove-modal-title"
          aria-modal="true"
        >
          <div className="modal-dialog modal-dialog-centered" role="document">
            <div className="modal-content border-0 shadow">
              <div className="modal-header bg-danger text-white">
                <h5 className="modal-title h6 fw-bold" id="remove-modal-title">
                  Confirm Attachment Soft Removal
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={closeRemoveModal}
                  disabled={isRemoving}
                  aria-label="Close"
                ></button>
              </div>

              <div className="modal-body p-4">
                <p className="mb-2">
                  Are you sure you want to remove the following file?
                </p>
                <div className="p-2 border rounded bg-light mb-3 text-break fw-semibold">
                  📄 {modalAttachment.fileName} (
                  {formatBytes(modalAttachment.fileSize)})
                </div>

                <div className="alert alert-warning small mb-3">
                  <strong>Notice:</strong> This file will be marked as removed and
                  future downloads will be permanently blocked. The file record is
                  preserved for audit traceability.
                </div>

                <div className="mb-2">
                  <label
                    htmlFor="removal-reason-input"
                    className="form-label small fw-bold"
                  >
                    Reason for Removal <span className="text-danger">*</span>
                  </label>
                  <textarea
                    id="removal-reason-input"
                    className="form-control"
                    rows={3}
                    placeholder="E.g., File contained outdated info, uploaded in error, or replaced..."
                    value={removalReason}
                    onChange={(e) => setRemovalReason(e.target.value)}
                    disabled={isRemoving}
                    required
                  />
                  {removalError && (
                    <div className="text-danger small mt-1">
                      {removalError}
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer bg-light p-3">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={closeRemoveModal}
                  disabled={isRemoving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger d-inline-flex align-items-center gap-2"
                  onClick={handleConfirmRemoval}
                  disabled={isRemoving}
                >
                  {isRemoving ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm"
                        role="status"
                        aria-hidden="true"
                      ></span>
                      <span>Removing...</span>
                    </>
                  ) : (
                    <span>Confirm Soft Removal</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
