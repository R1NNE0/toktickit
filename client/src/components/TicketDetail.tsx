import React, { useState, useEffect, useCallback, useRef } from "react";
import { useDialogFocus } from "../useDialogFocus.js";
import {
  Ticket,
  Attachment,
  PublicComment,
  InternalNote,
  Priority,
  getTicketDetail,
  downloadAttachment,
  softRemoveAttachment,
  uploadAttachment,
  indicateResolution,
  getPublicComments,
  createPublicComment,
  getInternalNotes,
  updateTicketPriority,
} from "../api.js";
import { useAuth } from "../context/AuthContext.js";

interface TicketDetailProps {
  ticketId: number;
  onBack: () => void;
}

const ACTIVE_RESOLUTION_STATUSES = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "REOPENED",
];

const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

function useOptionalAuth() {
  try {
    return useAuth();
  } catch {
    return { user: null };
  }
}

export const TicketDetail: React.FC<TicketDetailProps> = ({
  ticketId,
  onBack,
}) => {
  const { user } = useOptionalAuth();
  const isAdmin = user?.role === "ADMINISTRATOR";
  const isRequester = user?.role === "REQUESTER" || !user;

  const generation = useRef(0);
  const transfer = useRef(new AbortController());
  const [uploading, setUploading] = useState(false);
  useEffect(() => {
    transfer.current = new AbortController();
    return () => {
      transfer.current.abort();
      generation.current++;
    };
  }, [ticketId]);

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

  // Resolution indication state
  const [showResolutionModal, setShowResolutionModal] = useState(false);
  const [indicatingResolution, setIndicatingResolution] = useState(false);
  useDialogFocus(showResolutionModal ? "resolution" : modalAttachment ? "remove" : null, () => {
    if (!indicatingResolution && !isRemoving) { setShowResolutionModal(false); setModalAttachment(null); }
  });
  const [resolutionError, setResolutionError] = useState<string | null>(null);

  // Administrator IT Priority state
  const [adminPriority, setAdminPriority] = useState<Priority>("MEDIUM");
  const [savingAdminPriority, setSavingAdminPriority] = useState(false);

  // Public Comments state
  const [comments, setComments] = useState<PublicComment[]>([]);
  const [commentPage, setCommentPage] = useState(1);
  const [commentTotalPages, setCommentTotalPages] = useState(1);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentLoadError, setCommentLoadError] = useState(false);
  const [newCommentBody, setNewCommentBody] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  // Internal Notes state (only for Administrator)
  const [notes, setNotes] = useState<InternalNote[]>([]);
  const [notePage, setNotePage] = useState(1);
  const [noteTotalPages, setNoteTotalPages] = useState(1);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [noteLoadError, setNoteLoadError] = useState(false);

  const fetchTicket = useCallback(async () => {
    const version = ++generation.current;
    setLoading(true);
    setError(null);
    try {
      const data = await getTicketDetail(ticketId);
      if (version === generation.current) {
        setTicket(data);
        setAdminPriority(data.itPriority);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to load ticket details";
      if (version === generation.current) setError(msg);
    } finally {
      if (version === generation.current) setLoading(false);
    }
  }, [ticketId]);

  const loadComments = useCallback(
    async (page: number, append = false) => {
      setLoadingComments(true);
      setCommentLoadError(false);
      try {
        const res = await getPublicComments(ticketId, { page, pageSize: 10 });
        setComments((prev) => (append ? [...prev, ...res.data] : res.data));
        setCommentPage(res.pagination.page);
        setCommentTotalPages(res.pagination.totalPages);
      } catch {
        setCommentLoadError(true);
      } finally {
        setLoadingComments(false);
      }
    },
    [ticketId]
  );

  const loadNotes = useCallback(
    async (page: number, append = false) => {
      if (!isAdmin) return;
      setLoadingNotes(true);
      setNoteLoadError(false);
      try {
        const res = await getInternalNotes(ticketId, { page, pageSize: 10 });
        setNotes((prev) => (append ? [...prev, ...res.data] : res.data));
        setNotePage(res.pagination.page);
        setNoteTotalPages(res.pagination.totalPages);
      } catch {
        setNoteLoadError(true);
      } finally {
        setLoadingNotes(false);
      }
    },
    [ticketId, isAdmin]
  );

  useEffect(() => {
    fetchTicket();
    loadComments(1);
    if (isAdmin) {
      loadNotes(1);
    }
  }, [fetchTicket, loadComments, loadNotes, isAdmin]);

  // Download handler
  const handleDownload = async (attachment: Attachment) => {
    setDownloadingId(attachment.id);
    setDownloadError(null);
    try {
      await downloadAttachment(attachment.id, attachment.fileName, transfer.current.signal);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to download attachment file";
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
      setRemovalError(
        !trimmedReason
          ? "A removal reason is mandatory and cannot be blank."
          : "Removal reason must be at most 1000 characters."
      );
      return;
    }

    setIsRemoving(true);
    setRemovalError(null);
    try {
      const updated = await softRemoveAttachment(modalAttachment.id, trimmedReason);

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
          attachmentCount: Math.max(0, (prev.attachmentCount ?? 1) - 1),
        };
      });

      setActionNotice(`Attachment "${modalAttachment.fileName}" was soft-removed successfully.`);
      setModalAttachment(null);
      setRemovalReason("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to remove attachment";
      setRemovalError(msg);
      void fetchTicket();
    } finally {
      setIsRemoving(false);
    }
  };

  // Handle file upload from detail
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setDownloadError(null);
    try {
      const newAtt = await uploadAttachment(ticketId, file, transfer.current.signal);
      setTicket((prev) =>
        prev
          ? {
              ...prev,
              attachments: [...(prev.attachments || []), newAtt],
              attachmentCount: (prev.attachmentCount || 0) + 1,
            }
          : null
      );
      setActionNotice(`Attachment "${file.name}" uploaded successfully.`);
      event.target.value = "";
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to upload attachment";
      setDownloadError(msg);
    } finally {
      setUploading(false);
    }
  };

  // Handle Resolution Indication
  const handleConfirmResolution = async () => {
    setIndicatingResolution(true);
    setResolutionError(null);
    try {
      const res = await indicateResolution(ticketId);
      setTicket((prev) =>
        prev
          ? {
              ...prev,
              resolutionSuggestedAt: res.resolutionSuggestedAt,
              resolutionSuggestedById: res.resolutionSuggestedById,
            }
          : null
      );
      setShowResolutionModal(false);
      setActionNotice("You have indicated that this problem appears resolved.");
    } catch (err: any) {
      setResolutionError(err.message || "Failed to indicate resolution.");
    } finally {
      setIndicatingResolution(false);
    }
  };

  // Handle Save Priority (Administrator)
  const handleSaveAdminPriority = async () => {
    setSavingAdminPriority(true);
    try {
      const updated = await updateTicketPriority(ticketId, adminPriority);
      setTicket((prev) =>
        prev
          ? {
              ...prev,
              itPriority: updated.itPriority,
              updatedAt: updated.updatedAt,
            }
          : null
      );
      setActionNotice(`IT Priority updated to ${adminPriority}.`);
    } catch (err: any) {
      setDownloadError(err.message || "Failed to update IT Priority.");
    } finally {
      setSavingAdminPriority(false);
    }
  };

  // Handle Post Public Comment
  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    setCommentError(null);
    const trimmed = newCommentBody.trim();
    if (!trimmed) {
      setCommentError("Comment cannot be empty.");
      return;
    }
    if ([...trimmed].length > 4000) {
      setCommentError("Comment must be 4000 characters or fewer.");
      return;
    }

    setPostingComment(true);
    try {
      const created = await createPublicComment(ticketId, trimmed);
      setComments((prev) => [...prev, created]);
      setNewCommentBody("");
      setActionNotice("Public comment posted.");
    } catch (err: any) {
      setCommentError(err.message || "Failed to post comment.");
    } finally {
      setPostingComment(false);
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

  const formatDate = (dateString?: string | null): string => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? dateString : date.toLocaleString();
  };

  const getPriorityBadgeClass = (priority: string) => {
    switch (priority) {
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

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "NEW":
        return "badge-status badge-status-new";
      case "OPEN":
        return "badge-status badge-status-open";
      case "IN_PROGRESS":
        return "badge-status badge-status-in-progress";
      case "WAITING_FOR_REQUESTER":
        return "badge-status badge-status-waiting-for-requester";
      case "RESOLVED":
        return "badge-status badge-status-resolved";
      case "CLOSED":
        return "badge-status badge-status-closed";
      case "REOPENED":
        return "badge-status badge-status-reopened";
      case "CANCELLED":
        return "badge-status badge-status-cancelled";
      default:
        return "badge-status";
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
          &larr; Back
        </button>
      </div>
    );
  }

  const isOwnTicket = user ? ticket.requesterId === user.id : false;
  const canIndicateResolution = isRequester && isOwnTicket && ACTIVE_RESOLUTION_STATUSES.includes(ticket.currentStatus);

  const activeAttachments = ticket.attachments?.filter((a) => !a.isRemoved) || [];
  const removedAttachments = ticket.attachments?.filter((a) => a.isRemoved) || [];

  return (
    <div className="ticket-detail-view" aria-label="Ticket Detail View">
      {/* Navigation and Actions Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <button
          type="button"
          className="btn btn-zen-outline d-inline-flex align-items-center gap-2"
          onClick={onBack}
          aria-label={isAdmin ? "Back" : "Back to My Tickets"}
        >
          <span>&larr;</span>
          <span>{isAdmin ? "Back" : "Back to My Tickets"}</span>
        </button>

        <div className="d-flex flex-wrap align-items-center gap-2">
          {/* Problem Appears Resolved action button */}
          {canIndicateResolution && (
            <button
              type="button"
              className="btn btn-outline-success btn-sm"
              disabled={Boolean((ticket as any).resolutionSuggestedAt) || indicatingResolution}
              onClick={() => {
                setResolutionError(null);
                setShowResolutionModal(true);
              }}
            >
              {(ticket as any).resolutionSuggestedAt ? "Resolution Indicated" : "Problem Appears Resolved"}
            </button>
          )}

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

      {/* Requester Resolution Notice Banner */}
      {(ticket as any).resolutionSuggestedAt && (
        <div className="alert alert-info d-flex align-items-center gap-2 mb-4" role="status">
          <span>💡</span>
          <div>
            <strong>Resolution Notice:</strong>{" "}
            {isRequester ? "You" : "The requester"}{" "}
            indicated this problem appears resolved on{" "}
            <time dateTime={(ticket as any).resolutionSuggestedAt}>
              {formatDate((ticket as any).resolutionSuggestedAt)}
            </time>.
          </div>
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
          <div className="col-12 col-md-4">
            <div className="small text-muted">Requested Priority</div>
            <div className="p-2 border rounded" style={{ backgroundColor: "var(--readonly-bg)" }}>
              {ticket.requestedPriority}
            </div>
          </div>

          <div className="col-12 col-md-4">
            <div className="small text-muted">IT Priority</div>
            {isAdmin ? (
              <div className="d-flex gap-2 align-items-center mt-1">
                <select
                  aria-label="IT Priority"
                  className="form-select form-select-sm"
                  style={{ maxWidth: 160 }}
                  value={adminPriority}
                  onChange={(e) => setAdminPriority(e.target.value as Priority)}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  disabled={savingAdminPriority}
                  onClick={handleSaveAdminPriority}
                >
                  {savingAdminPriority ? "Saving..." : "Save Priority"}
                </button>
              </div>
            ) : (
              <div className="p-2 border rounded" style={{ backgroundColor: "var(--readonly-bg)" }}>
                {ticket.itPriority}
              </div>
            )}
          </div>

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
              {ticket.requester?.name ? `${ticket.requester.name} (${ticket.requester.email})` : `Requester #${ticket.requesterId}`}
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="mb-4">
          <div className="small text-muted mb-1">Issue Summary</div>
          <h2 className="h5 fw-bold text-dark mb-0">{ticket.summary}</h2>
        </div>

        {/* Description */}
        <div className="mb-2">
          <div className="small text-muted mb-1">Detailed Description</div>
          <div
            className="p-3 border rounded bg-light"
            style={{
              whiteSpace: "pre-wrap",
              minHeight: "100px",
              color: "var(--text-primary)",
              lineHeight: 1.6,
            }}
          >
            {ticket.description}
          </div>
        </div>
      </div>

      {/* Attachments Section */}
      <div className="zen-card mb-4">
        <div className="d-flex justify-content-between align-items-center border-bottom pb-3 mb-3">
          <div>
            <h3 className="h6 fw-bold mb-0 text-dark">
              Attachments ({ticket.attachmentCount || 0} / 5)
            </h3>
            <div className="small text-muted">
              Files uploaded to support this ticket
            </div>
          </div>

          {/* Add Attachment action for non-admin */}
          {!isAdmin && (
            <div>
              <label
                htmlFor="detail-file-upload"
                className={`btn btn-zen-outline btn-sm mb-0 ${
                  uploading || (ticket.attachmentCount || 0) >= 5 ? "disabled" : ""
                }`}
                style={{ cursor: "pointer" }}
              >
                {uploading ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-1"
                      role="status"
                      aria-hidden="true"
                    ></span>
                    Uploading...
                  </>
                ) : (
                  "+ Add Attachment"
                )}
              </label>
              <input
                id="detail-file-upload"
                type="file"
                className="d-none"
                aria-label="Add Attachment"
                onChange={handleFileUpload}
                disabled={uploading || (ticket.attachmentCount || 0) >= 5}
                accept=".jpg,.jpeg,.png,.webp,.pdf"
              />
            </div>
          )}
        </div>

        {/* Active Attachments List */}
        {activeAttachments.length === 0 ? (
          <div className="p-3 text-center text-muted small bg-light rounded border border-dashed">
            No active attachments associated with this ticket.
          </div>
        ) : (
          <div className="list-group mb-3">
            {activeAttachments.map((att) => (
              <div
                key={att.id}
                className="list-group-item list-group-item-action d-flex flex-column flex-md-row justify-content-between align-items-md-center p-3 gap-2"
              >
                <div className="d-flex align-items-center gap-3">
                  <span style={{ fontSize: "1.5rem" }}>
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

                {!isAdmin && (
                  <div className="d-flex align-items-center gap-2 align-self-end align-self-md-center">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
                      onClick={() => handleDownload(att)}
                      disabled={downloadingId === att.id}
                      aria-label={`Download ${att.fileName}`}
                    >
                      {downloadingId === att.id ? (
                        <span
                          className="spinner-border spinner-border-sm"
                          role="status"
                          aria-hidden="true"
                        ></span>
                      ) : (
                        <span>⬇️</span>
                      )}
                      <span>Download</span>
                    </button>

                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1"
                      onClick={() => openRemoveModal(att)}
                      aria-label={`Remove ${att.fileName}`}
                    >
                      <span>🗑️</span>
                      <span>Remove</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Soft-Removed Attachments Audit View */}
        {removedAttachments.length > 0 && (
          <div className="mt-4 pt-3 border-top">
            <h4 className="h6 text-muted mb-2">Removed Attachments Audit Log</h4>
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

      {/* Public Comments Section */}
      <div className="zen-card mb-4">
        <div className="border-bottom pb-2 mb-3">
          <h3 className="h5 fw-bold mb-0">Public Comments</h3>
          <p className="text-muted small mb-0">Public &mdash; visible to the Requester</p>
        </div>

        {commentError && (
          <div className="alert alert-danger py-2 mb-2" role="alert">
            {commentError}
          </div>
        )}

        <div className="mb-3 pe-1">
          {loadingComments && <p role="status">Loading public comments...</p>}
          {commentLoadError && <div role="alert">Unable to load public comments. <button className="btn btn-outline-secondary" onClick={() => loadComments(1)}>Retry comments</button></div>}
          {comments.length === 0 && !loadingComments && !commentLoadError && (
            <p className="text-muted small">No public comments yet.</p>
          )}
          {comments.map((c) => (
            <div key={c.id} className="p-3 mb-2 rounded border bg-white">
              <div className="d-flex justify-content-between small text-muted mb-1">
                <strong>{c.author.name}</strong>
                <time dateTime={c.createdAt}>{formatDate(c.createdAt)}</time>
              </div>
              <div style={{ whiteSpace: "pre-wrap" }}>{c.body}</div>
            </div>
          ))}

          {commentPage < commentTotalPages && (
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm w-100 mt-2"
              onClick={() => loadComments(commentPage + 1, true)}
              disabled={loadingComments}
            >
              {loadingComments ? "Loading..." : "Load More Comments"}
            </button>
          )}
        </div>

        {/* Composer for non-admin */}
        {!isAdmin && (
          <form onSubmit={handlePostComment} className="mt-3 border-top pt-3">
            <label htmlFor="public-comment-body" className="form-label small fw-bold">
              Add Public Comment
            </label>
            <textarea
              id="public-comment-body"
              aria-label="Public comment"
              className="form-control mb-1"
              rows={3}
              placeholder="Type your comment or update here..."
              value={newCommentBody}
              onChange={(e) => setNewCommentBody(e.target.value)}
              maxLength={4000}
              required
            />
            <div className="d-flex justify-content-between align-items-center">
              <span className="small text-muted">{newCommentBody.length} / 4000</span>
              <button
                type="submit"
                className="btn btn-zen-primary btn-sm"
                disabled={postingComment || !newCommentBody.trim()}
              >
                {postingComment ? "Posting..." : "Post Comment"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Internal Notes Section (Administrator Read-Only) */}
      {isAdmin && (
        <div className="zen-card mb-4" style={{ backgroundColor: "#fdfbf7", borderColor: "#f3e8d2" }}>
          <div className="border-bottom pb-2 mb-3 d-flex justify-content-between align-items-center">
            <div>
              <h3 className="h5 fw-bold mb-0 text-dark">
                🔒 Internal Notes
              </h3>
              <p className="text-muted small mb-0">Internal &mdash; IT Staff and Administrator only (Read-Only)</p>
            </div>
            <span className="badge bg-warning text-dark">Private</span>
          </div>

          <div className="mb-2 pe-1">
            {loadingNotes && <p role="status">Loading internal notes...</p>}
            {noteLoadError && <div role="alert">Unable to load internal notes. <button className="btn btn-outline-secondary" onClick={() => loadNotes(1)}>Retry notes</button></div>}
            {notes.length === 0 && !loadingNotes && !noteLoadError && (
              <p className="text-muted small">No internal notes recorded.</p>
            )}
            {notes.map((n) => (
              <div key={n.id} className="p-3 mb-2 rounded border bg-white" style={{ borderColor: "#ecdcc3" }}>
                <div className="d-flex justify-content-between small text-muted mb-1">
                  <strong className="text-dark">{n.author.name}</strong>
                  <time dateTime={n.createdAt}>{formatDate(n.createdAt)}</time>
                </div>
                <div style={{ whiteSpace: "pre-wrap" }}>{n.body}</div>
              </div>
            ))}

            {notePage < noteTotalPages && (
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm w-100 mt-2"
                onClick={() => loadNotes(notePage + 1, true)}
                disabled={loadingNotes}
              >
                {loadingNotes ? "Loading..." : "Load More Notes"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Problem Appears Resolved Confirmation Modal */}
      {showResolutionModal && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="resolution-dialog-title"
        >
          <div className="modal-dialog modal-dialog-centered" role="document">
            <div className="modal-content border-0 shadow">
              <div
                className="modal-header text-white"
                style={{ backgroundColor: "var(--primary-green)" }}
              >
                <h5 className="modal-title h6 fw-bold" id="resolution-dialog-title">
                  Confirm Problem Appears Resolved
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowResolutionModal(false)}
                  aria-label="Close"
                ></button>
              </div>

              <div className="modal-body p-4">
                <p className="mb-2">
                  This informs IT Staff; it does not close your ticket.
                </p>
                <p className="small text-muted mb-0">
                  IT Staff will review your confirmation and formally resolve the ticket.
                </p>
                {resolutionError && (
                  <div className="alert alert-danger py-2 mt-2">{resolutionError}</div>
                )}
              </div>

              <div className="modal-footer bg-light p-3">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setShowResolutionModal(false)}
                  disabled={indicatingResolution}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-zen-primary"
                  onClick={handleConfirmResolution}
                  disabled={indicatingResolution}
                >
                  {indicatingResolution ? "Submitting..." : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                  📄 {modalAttachment.fileName} ({formatBytes(modalAttachment.fileSize)})
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
