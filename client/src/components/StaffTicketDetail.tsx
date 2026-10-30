import { WorkflowFeedback, ResolutionSummary, useWorkflowRecovery, validWorkflowNumber, workflowLabel } from "./WorkflowFeedback.js";
import { ActionsTaken } from "./ActionsTaken.js";
import { canLeaveActions } from "../action-ui.js";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useDialogFocus } from "../useDialogFocus.js";
import {
  StaffTicketDetail as StaffTicketDetailType,
  Assignee,
  PublicComment,
  InternalNote,
  Attachment,
  Priority,
  TicketStatus,
  TicketTransition,
  getStaffTicketDetail,
  getStaffAssignees,
  claimTicket,
  updateTicketOwner,
  updateTicketPriority,
  updateTicketStatus,
  getPublicComments,
  createPublicComment,
  getInternalNotes,
  createInternalNote,
  uploadAttachment,
  downloadAttachment,
  softRemoveAttachment,
  ApiError,
} from "../api.js";
import { useAuth } from "../context/AuthContext.js";

interface StaffTicketDetailProps {
  focusActionId?: number;
  ticketId: number;
  onBack: () => void;
}

type TransitionOption = TicketTransition & { label: string };

const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : d.toLocaleString();
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "NEW": return "badge-status badge-status-new";
    case "OPEN": return "badge-status badge-status-open";
    case "IN_PROGRESS": return "badge-status badge-status-in-progress";
    case "WAITING_FOR_REQUESTER": return "badge-status badge-status-waiting-for-requester";
    case "RESOLVED": return "badge-status badge-status-resolved";
    case "CLOSED": return "badge-status badge-status-closed";
    case "REOPENED": return "badge-status badge-status-reopened";
    case "CANCELLED": return "badge-status badge-status-cancelled";
    default: return "badge-status";
  }
}

function formatStatus(val: string): string {
  return val.replace(/_/g, " ").toLowerCase().replace(/^./, (s) => s.toUpperCase());
}

export const StaffTicketDetail: React.FC<StaffTicketDetailProps> = ({ ticketId, onBack, focusActionId }) => {
  const { user } = useAuth();
  const guardedBack = () => { if (canLeaveActions()) onBack(); };
  const [ticket, setTicket] = useState<StaffTicketDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const recovery = useWorkflowRecovery(() => getStaffTicketDetail(ticketId), setTicket);
  const [ownerVersion, setOwnerVersion] = useState<number>();
  const [priorityVersion, setPriorityVersion] = useState<number>();
  const [statusVersion, setStatusVersion] = useState<number>();
  const isStaff = user?.role === "IT_STAFF" && user.isActive && !user.mustChangePassword;
  const workflowDisabled = recovery.blocked || recovery.pending || !validWorkflowNumber(ticket?.workflowVersion);
  const acceptWorkflow = () => {
    const fresh = recovery.accept(); if (!fresh) return;
    setOwnerVersion(v => v === undefined ? undefined : fresh.workflowVersion); setPriorityVersion(v => v === undefined ? undefined : fresh.workflowVersion); setStatusVersion(v => v === undefined ? undefined : fresh.workflowVersion);
  };

  // Assignees state
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>("");
  const [savingOwner, setSavingOwner] = useState(false);

  // Priority state
  const [selectedPriority, setSelectedPriority] = useState<Priority>("MEDIUM");
  const [savingPriority, setSavingPriority] = useState(false);
  useEffect(() => { if (ticket && ownerVersion === undefined) setSelectedOwnerId(String(ticket.ownerId ?? "")); }, [ticket?.ownerId, ownerVersion]);
  useEffect(() => { if (ticket && priorityVersion === undefined) setSelectedPriority(ticket.itPriority); }, [ticket?.itPriority, priorityVersion]);

  // Status transition state
  const [targetStatus, setTargetStatus] = useState<TicketStatus | "">("");
  const [statusError, setStatusError] = useState<string | null>(null);
  const [transitionModal, setTransitionModal] = useState<TransitionOption | null>(null);
  const [transitionReason, setTransitionReason] = useState("");
  const [transitionReasonError, setTransitionReasonError] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);

  // Public comments state
  const [comments, setComments] = useState<PublicComment[]>([]);
  const [commentPage, setCommentPage] = useState(1);
  const [commentTotalPages, setCommentTotalPages] = useState(1);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentLoadError, setCommentLoadError] = useState(false);
  const [newCommentBody, setNewCommentBody] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  // Internal notes state
  const [notes, setNotes] = useState<InternalNote[]>([]);
  const [notePage, setNotePage] = useState(1);
  const [noteTotalPages, setNoteTotalPages] = useState(1);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [noteLoadError, setNoteLoadError] = useState(false);
  const [newNoteBody, setNewNoteBody] = useState("");
  const [postingNote, setPostingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  // Attachment state
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [modalAttachment, setModalAttachment] = useState<Attachment | null>(null);
  const [removalReason, setRemovalReason] = useState("");
  const [removalError, setRemovalError] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  useDialogFocus(transitionModal ? "status" : modalAttachment ? "remove" : null, () => {
    if (!savingStatus && !isRemoving) { setTransitionModal(null); setModalAttachment(null); }
  });

  const fetchTicketData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getStaffTicketDetail(ticketId);
      setTicket(data);
      setSelectedOwnerId(data.ownerId !== null ? String(data.ownerId) : "");
      setSelectedPriority(data.itPriority);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load staff ticket detail.");
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  const loadAssignees = useCallback(async () => {
    try {
      const list = await getStaffAssignees();
      setAssignees(list);
    } catch {
      // Ignored non-blocking
    }
  }, []);

  const loadComments = useCallback(async (page: number, append = false) => {
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
  }, [ticketId]);

  const loadNotes = useCallback(async (page: number, append = false) => {
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
  }, [ticketId]);

  useEffect(() => {
    fetchTicketData();
    loadAssignees();
    loadComments(1);
    loadNotes(1);
  }, [fetchTicketData, loadAssignees, loadComments, loadNotes]);

  const handleClaim = async () => {
    if (!isStaff || !validWorkflowNumber(ticket?.workflowVersion) || !recovery.begin()) return;
    try {
      const updated = await claimTicket(ticketId, ticket.workflowVersion);
      setTicket(updated); setSelectedOwnerId(String(updated.ownerId ?? "")); setOwnerVersion(undefined);
      setActionNotice("You have successfully claimed this ticket.");
    } catch (err) { recovery.fail(err); } finally { recovery.end(); }
  };
  const handleSaveOwner = async () => {
    const version = ownerVersion ?? ticket?.workflowVersion;
    if (!isStaff || !validWorkflowNumber(version) || !recovery.begin()) return;
    setSavingOwner(true);
    try {
      const updated = await updateTicketOwner(ticketId, selectedOwnerId === "" ? null : Number(selectedOwnerId), version);
      setTicket(updated); setSelectedOwnerId(String(updated.ownerId ?? "")); setOwnerVersion(undefined);
      setActionNotice("Ticket owner updated successfully.");
    } catch (err) { recovery.fail(err); } finally { setSavingOwner(false); recovery.end(); }
  };
  const handleSavePriority = async () => {
    const version = priorityVersion ?? ticket?.workflowVersion;
    if (!isStaff || !validWorkflowNumber(version) || !recovery.begin()) return;
    setSavingPriority(true);
    try {
      const updated = await updateTicketPriority(ticketId, selectedPriority, version);
      setTicket(prev => prev ? { ...prev, ...updated } : null); setPriorityVersion(undefined);
      setActionNotice(`IT Priority updated to ${updated.itPriority}.`);
    } catch (err) { recovery.fail(err); } finally { setSavingPriority(false); recovery.end(); }
  };
  const handleInitiateStatusChange = () => {
    setStatusError(null);
    if (!isStaff || workflowDisabled || !targetStatus || !ticket) return;
    const rule = ticket.permittedTransitions?.find(opt => opt.to === targetStatus);
    if (!rule?.enabled) { setStatusError("This transition is unavailable. Review the current owner and Actions Taken prerequisites."); return; }
    if (rule.requiresConfirmation) {
      setStatusVersion(statusVersion ?? ticket.workflowVersion);
      setTransitionModal({ ...rule, label: workflowLabel(rule.to) }); setTransitionReason(""); setTransitionReasonError(null);
    } else { void executeStatusChange(rule.to, false); }
  };
  const executeStatusChange = async (newStatus: TicketStatus, confirmed: boolean, reasonText?: string) => {
    const version = statusVersion ?? ticket?.workflowVersion;
    if (!isStaff || !validWorkflowNumber(version) || !ticket?.permittedTransitions?.some(o => o.to === newStatus && o.enabled) || !recovery.begin()) return;
    setSavingStatus(true);
    try {
      const updated = await updateTicketStatus(ticketId, { currentStatus: newStatus, expectedWorkflowVersion: version,
        ...(confirmed ? { confirmed: true } : {}), ...(reasonText ? { reason: reasonText } : {}) });
      setTicket(updated); setTargetStatus(""); setStatusVersion(undefined); setTransitionModal(null);
      setActionNotice(newStatus === "REOPENED" ? `Ticket reopened in work cycle ${updated.workCycle}. Previous Actions remain historical; new work is required.` : `Ticket status updated to ${formatStatus(newStatus)}.`);
      if (reasonText) void loadComments(1);
    } catch (err) { recovery.fail(err); } finally { setSavingStatus(false); recovery.end(); }
  };
  const handleConfirmModalTransition = () => {
    if (!transitionModal) return;
    const reason = transitionReason.trim();
    if (transitionModal.requiresReason && (!reason || [...reason].length > 4000)) {
      setTransitionReasonError("Enter a public reason of 1–4000 characters.");
      document.getElementById("transition-reason-input")?.focus(); return;
    }
    void executeStatusChange(transitionModal.to, true, transitionModal.requiresReason ? reason : undefined);
  };

  // Public comment submit
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

  // Internal note submit
  const handlePostNote = async (e: React.FormEvent) => {
    e.preventDefault();
    setNoteError(null);
    const trimmed = newNoteBody.trim();
    if (!trimmed) {
      setNoteError("Internal note cannot be empty.");
      return;
    }
    if ([...trimmed].length > 4000) {
      setNoteError("Internal note must be 4000 characters or fewer.");
      return;
    }

    setPostingNote(true);
    try {
      const created = await createInternalNote(ticketId, trimmed);
      setNotes((prev) => [...prev, created]);
      setNewNoteBody("");
      setActionNotice("Internal note posted.");
    } catch (err: any) {
      setNoteError(err.message || "Failed to post internal note.");
    } finally {
      setPostingNote(false);
    }
  };

  // Attachment upload
  const handleUploadAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setUploadingAttachment(true);
    setAttachmentError(null);
    try {
      const newAtt = await uploadAttachment(ticketId, file);
      setTicket((prev) => prev ? {
        ...prev,
        attachments: [...(prev.attachments || []), newAtt],
        attachmentCount: prev.attachmentCount + 1,
      } : null);
      setActionNotice(`Attachment "${file.name}" uploaded successfully.`);
      e.target.value = "";
    } catch (err: any) {
      setAttachmentError(err.message || "Failed to upload attachment.");
    } finally {
      setUploadingAttachment(false);
    }
  };

  // Attachment download
  const handleDownloadAttachment = async (att: Attachment) => {
    try {
      await downloadAttachment(att.id, att.fileName);
    } catch (err: any) {
      setAttachmentError(err.message || "Failed to download attachment.");
    }
  };

  // Attachment soft-remove
  const handleConfirmRemoval = async () => {
    if (!modalAttachment) return;
    const trimmed = removalReason.trim();
    if (!trimmed || [...trimmed].length > 1000) {
      setRemovalError(!trimmed ? "Removal reason is required." : "Reason must be 1000 characters or fewer.");
      return;
    }

    setIsRemoving(true);
    try {
      const updated = await softRemoveAttachment(modalAttachment.id, trimmed);
      setTicket((prev) => prev ? {
        ...prev,
        attachments: (prev.attachments || []).map((a) => a.id === updated.id ? { ...a, isRemoved: true, removedAt: updated.removedAt, removalReason: updated.removalReason } : a),
        attachmentCount: Math.max(0, prev.attachmentCount - 1),
      } : null);
      setModalAttachment(null);
      setActionNotice("Attachment removed successfully.");
    } catch (err: any) {
      setRemovalError(err.message || "Failed to remove attachment.");
    } finally {
      setIsRemoving(false);
    }
  };

  if (loading) {
    return (
      <div className="zen-card text-center py-5">
        <p role="status" className="text-muted">Loading Staff Ticket Detail...</p>
      </div>
    );
  }

  if (error && !ticket) {
    return (
      <div className="zen-card py-4">
        <div className="alert alert-danger" role="alert">{error}</div>
        <button type="button" className="btn btn-outline-secondary" onClick={guardedBack}>
          &larr; Back to Ticket Queue
        </button>
      </div>
    );
  }

  if (!ticket) return null;

  const currentAvailableTransitions = isStaff ? (ticket.permittedTransitions ?? []).map(opt => ({ ...opt, label: workflowLabel(opt.to) })) : [];
  const activeAttachments = ticket.attachments?.filter((a) => !a.isRemoved) || [];
  const removedAttachments = ticket.attachments?.filter((a) => a.isRemoved) || [];

  return (
    <div className="staff-ticket-detail" aria-label="Staff Ticket Detail">
      {/* Header & Back Action */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <button
          type="button"
          className="btn btn-outline-secondary d-inline-flex align-items-center gap-2"
          onClick={guardedBack}
          aria-label="Back to Ticket Queue"
        >
          <span>&larr;</span>
          <span>Back to Ticket Queue</span>
        </button>
        <div className="d-flex align-items-center gap-2">
          <span className={statusBadgeClass(ticket.currentStatus)}>
            {formatStatus(ticket.currentStatus)}
          </span>
          <span className="badge bg-light text-dark border">
            IT Priority: {ticket.itPriority}
          </span>
        </div>
      </div>

      {/* Notifications */}
      {actionNotice && (
        <div className="alert alert-success alert-dismissible fade show mb-3" role="alert">
          {actionNotice}
          <button type="button" className="btn-close" onClick={() => setActionNotice(null)} aria-label="Close"></button>
        </div>
      )}

      {!transitionModal && <WorkflowFeedback recovery={recovery} onReview={acceptWorkflow} />}

      {error && (
        <div className="alert alert-danger alert-dismissible fade show mb-3" role="alert">
          {error}
          <button type="button" className="btn-close" onClick={() => setError(null)} aria-label="Close"></button>
        </div>
      )}

      {/* Resolution Indication Banner */}
      {ticket.resolutionSuggestedAt && (
        <div className="alert alert-info d-flex align-items-center gap-3 mb-4" role="status">
          <span style={{ fontSize: "1.5rem" }}>💡</span>
          <div>
            <strong>Requester Resolution Notice:</strong> The requester indicated that this problem appears resolved on{" "}
            <time dateTime={ticket.resolutionSuggestedAt}>{formatDate(ticket.resolutionSuggestedAt)}</time>.
            <div className="small text-muted">
              Note: This notice does not formally resolve or close the ticket. Review the status controls below.
            </div>
          </div>
        </div>
      )}

      {/* Ticket Identity & Read-Only Information */}
      <div className="zen-card mb-4">
        <div className="border-bottom pb-3 mb-3">
          <div className="small text-muted mb-1">Support Ticket #{ticket.id}</div>
          <h1 className="h3 fw-bold mb-1" style={{ color: "var(--primary-green)", fontFamily: "monospace" }}>
            {ticket.ticketNumber}
          </h1>
          <h2 className="h5 fw-semibold text-secondary mb-0">{ticket.summary}</h2>
        </div>

        <div className="row g-3 mb-3">
          <div className="col-12 col-md-4">
            <div className="small text-muted">Requester (Submitter)</div>
            <div className="fw-semibold">{ticket.requester?.name} ({ticket.requester?.email})</div>
          </div>
          <div className="col-12 col-md-4">
            <div className="small text-muted">Category</div>
            <div className="fw-semibold">{ticket.category?.name || "Uncategorized"}</div>
          </div>
          <div className="col-12 col-md-4">
            <div className="small text-muted">Affected System</div>
            <div className="fw-semibold">{ticket.relatedSystem?.name || "General"}</div>
          </div>

          <div className="col-12 col-md-4">
            <div className="small text-muted">Requested Priority (by Requester)</div>
            <div className="p-2 border rounded" style={{ backgroundColor: "var(--readonly-bg)" }}>
              {ticket.requestedPriority}
            </div>
          </div>
          <div className="col-12 col-md-4">
            <div className="small text-muted">Created Date</div>
            <div className="fw-semibold">{formatDate(ticket.createdAt)}</div>
          </div>
          <div className="col-12 col-md-4">
            <div className="small text-muted">Last Updated</div>
            <div className="fw-semibold">{formatDate(ticket.updatedAt)}</div>
          </div>
        </div>

        <div className="mb-2">
          <div className="small text-muted mb-1">Problem Description</div>
          <div className="p-3 border rounded bg-light" style={{ whiteSpace: "pre-wrap" }}>
            {ticket.description}
          </div>
        </div>
      </div>

      {/* Operational Controls Section */}
      <div className="zen-card mb-4">
        <h2 className="h5 fw-bold border-bottom pb-2 mb-3">Operational Management</h2>

        <div className="row g-4">
          {/* Owner Assignment */}
          <div className="col-12 col-md-6 border-end-md">
            <h3 className="h6 fw-bold mb-2">Primary Ticket Owner</h3>
            <div className="mb-2">
              <span className="text-muted small">Current Owner: </span>
              <strong>
                {ticket.owner ? `${ticket.owner.name} (${ticket.owner.role === "IT_STAFF" ? "IT Staff" : "Administrator"})${ticket.owner.isActive ? "" : " — Inactive"}` : "Unassigned"}
              </strong>
            </div>

            {ticket.ownerId === null && (
              <div className="mb-3">
                <button
                  type="button"
                  className="btn btn-outline-success btn-sm d-inline-flex align-items-center gap-1"
                  onClick={handleClaim}
                  aria-label="Claim Ticket"
                  disabled={workflowDisabled || !isStaff}
                >
                  <span>🙋‍♂️</span>
                  <span>Claim Ticket (Assign to Me)</span>
                </button>
              </div>
            )}

            <div className="d-flex flex-wrap gap-2 align-items-center">
              <select
                className="form-select form-select-sm"
                style={{ maxWidth: 260 }}
                aria-label="Assign Owner"
                id="ticket-owner"
                disabled={workflowDisabled || !isStaff}
                value={selectedOwnerId}
                onChange={(e) => { setOwnerVersion(ownerVersion ?? ticket.workflowVersion); setSelectedOwnerId(e.target.value); }}
              >
                <option value="">Unassigned</option>
                {assignees.map((a) => (
                  <option key={a.id} value={String(a.id)}>
                    {a.name} ({a.role === "IT_STAFF" ? "IT Staff" : "Admin"})
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={handleSaveOwner}
                disabled={workflowDisabled || !isStaff}
              >
                {savingOwner ? "Saving..." : "Save Owner"}
              </button>
            </div>
          </div>

          {/* IT Priority Management */}
          <div className="col-12 col-md-6">
            <h3 className="h6 fw-bold mb-2">IT Operational Priority</h3>
            <p className="text-muted small mb-2">
              IT Staff and Administrators may calibrate the operational priority independently of the requester&apos;s requested priority.
            </p>
            <div className="d-flex flex-wrap gap-2 align-items-center">
              <select
                className="form-select form-select-sm"
                style={{ maxWidth: 200 }}
                aria-label="IT Priority"
                disabled={workflowDisabled || !isStaff}
                value={selectedPriority}
                onChange={(e) => { setPriorityVersion(priorityVersion ?? ticket.workflowVersion); setSelectedPriority(e.target.value as Priority); }}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={handleSavePriority}
                disabled={workflowDisabled || !isStaff}
              >
                {savingPriority ? "Saving..." : "Save Priority"}
              </button>
            </div>
          </div>

          {/* Status Workflow Transition */}
          <div className="col-12 border-top pt-3">
            <h3 className="h6 fw-bold mb-2">Status Workflow</h3>
            <p>Work cycle {ticket.workCycle}. Actions from earlier cycles cannot satisfy resolution requirements.</p>
            {!validWorkflowNumber(ticket.workflowVersion) && <p role="alert">Workflow metadata unavailable. Reload this Ticket before making changes.</p>}
            <ResolutionSummary state={ticket.resolutionBlockers} />
            {currentAvailableTransitions.filter(o => !o.enabled).map(o => <p key={o.to}>{o.label} unavailable: {o.blockers.map(b => ({ OWNER_REQUIRED: "requires an active eligible assigned owner", COMPLETED_ACTION_REQUIRED: "complete at least one current-cycle Action", ACTIONS_INCOMPLETE: "complete or cancel unfinished Actions", FOLLOW_UP_REQUIRED: "clear outstanding follow-ups with an explained correction" }[b])).join("; ")}.</p>)}
            <div className="d-flex gap-2 flex-wrap mb-3">
              <button type="button" className="btn btn-zen-outline" onClick={() => document.getElementById("ticket-owner")?.focus()}>Review primary owner</button>
              <button type="button" className="btn btn-zen-outline" onClick={() => document.getElementById("actions-title")?.focus()}>Review Actions Taken</button>
            </div>
            <div className="d-flex flex-wrap align-items-center gap-3 mb-2">
              <div>
                <span className="text-muted small">Current Status: </span>
                <span className={statusBadgeClass(ticket.currentStatus)}>{formatStatus(ticket.currentStatus)}</span>
              </div>

              {currentAvailableTransitions.length > 0 ? (
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <label htmlFor="next-status-select" className="visually-hidden">Next Status</label>
                  <select
                    id="next-status-select"
                    className="form-select form-select-sm"
                    style={{ minWidth: 180 }}
                    aria-label="Next Status"
                    disabled={workflowDisabled}
                    value={targetStatus}
                    onChange={(e) => { setStatusVersion(statusVersion ?? ticket.workflowVersion); setTargetStatus(e.target.value as TicketStatus); }}
                  >
                    <option value="">Select next status...</option>
                    {currentAvailableTransitions.map((opt) => (
                      <option key={opt.to} value={opt.to} disabled={!opt.enabled}>
                        {opt.label} ({opt.to})
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    className="btn btn-zen-primary btn-sm"
                    disabled={workflowDisabled || !currentAvailableTransitions.some(o => o.to === targetStatus && o.enabled)}
                    onClick={handleInitiateStatusChange}
                  >
                    {savingStatus ? "Updating..." : "Update Status"}
                  </button>
                </div>
              ) : (
                <span className="text-muted small">No further transitions available from this state.</span>
              )}
            </div>

            {statusError && (
              <div className="alert alert-danger py-2 mt-2 mb-0" role="alert">
                {statusError}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Attachments Section */}
      <div className="zen-card mb-4">
        <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
          <h2 className="h5 fw-bold mb-0">
            Attachments ({ticket.attachmentCount} / 5)
          </h2>
          {ticket.attachmentCount < 5 && (
            <label className="btn btn-outline-success btn-sm mb-0 cursor-pointer">
              {uploadingAttachment ? "Uploading..." : "+ Add Attachment"}
              <input
                type="file"
                className="visually-hidden"
                aria-label="Add Attachment"
                onChange={handleUploadAttachment}
                disabled={uploadingAttachment}
                accept=".jpg,.jpeg,.png,.webp,.pdf"
              />
            </label>
          )}
        </div>

        {attachmentError && (
          <div className="alert alert-danger py-2 mb-3" role="alert">{attachmentError}</div>
        )}

        {activeAttachments.length === 0 && (
          <p className="text-muted small mb-0">No active attachments on this ticket.</p>
        )}

        {activeAttachments.length > 0 && (
          <div className="list-group mb-3">
            {activeAttachments.map((att) => (
              <div key={att.id} className="list-group-item d-flex justify-content-between align-items-center py-2">
                <div>
                  <span className="me-2">📎</span>
                  <span className="fw-semibold">{att.fileName}</span>
                  <span className="text-muted small ms-2">({formatBytes(att.fileSize)})</span>
                </div>
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => handleDownloadAttachment(att)}
                  >
                    Download
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-danger btn-sm"
                    onClick={() => { setModalAttachment(att); setRemovalReason(""); setRemovalError(null); }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {removedAttachments.length > 0 && (
          <div className="mt-3">
            <h3 className="h6 text-muted">Soft-Removed Attachments ({removedAttachments.length})</h3>
            <div className="list-group">
              {removedAttachments.map((att) => (
                <div key={att.id} className="list-group-item bg-light text-muted py-2 small">
                  <div className="d-flex justify-content-between">
                    <span className="text-decoration-line-through">{att.fileName}</span>
                    <span className="badge bg-secondary">Removed</span>
                  </div>
                  <div>Reason: &ldquo;{att.removalReason}&rdquo; &bull; {formatDate(att.removedAt)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {user && <ActionsTaken focusActionId={focusActionId} ticket={ticket} user={user} onTicketChange={fresh => setTicket(old => old ? { ...old, ...fresh } : old)} />}

      {/* Discussion Threads: Public Comments & Internal Notes */}
      <div className="row g-4">
        {/* Public Comments */}
        <div className="col-12 col-lg-6">
          <div className="zen-card h-100 d-flex flex-column">
            <div className="border-bottom pb-2 mb-3">
              <h2 className="h5 fw-bold mb-0">Public Comments</h2>
              <p className="text-muted small mb-0">Public &mdash; visible to the Requester</p>
            </div>

            {commentError && <div className="alert alert-danger py-2 mb-2" role="alert">{commentError}</div>}

            <div className="flex-grow-1 overflow-auto mb-3 pe-1" style={{ maxHeight: 400 }}>
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

            <form onSubmit={handlePostComment} className="mt-auto">
              <label htmlFor="public-comment-input" className="form-label small fw-bold">
                Add Public Comment
              </label>
              <textarea
                id="public-comment-input"
                aria-label="Public comment"
                className="form-control mb-1"
                rows={3}
                placeholder="Message the requester..."
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
          </div>
        </div>

        {/* Internal Notes */}
        <div className="col-12 col-lg-6">
          <div className="zen-card h-100 d-flex flex-column" style={{ backgroundColor: "#fdfbf7", borderColor: "#f3e8d2" }}>
            <div className="border-bottom pb-2 mb-3 d-flex justify-content-between align-items-center">
              <div>
                <h2 className="h5 fw-bold mb-0 text-dark">
                  🔒 Internal Notes
                </h2>
                <p className="text-muted small mb-0">Internal &mdash; IT Staff and Administrator only</p>
              </div>
              <span className="badge bg-warning text-dark">Private</span>
            </div>

            {noteError && <div className="alert alert-danger py-2 mb-2" role="alert">{noteError}</div>}

            <div className="flex-grow-1 overflow-auto mb-3 pe-1" style={{ maxHeight: 400 }}>
              {loadingNotes && <p role="status">Loading internal notes...</p>}
              {noteLoadError && <div role="alert">Unable to load internal notes. <button className="btn btn-outline-secondary" onClick={() => loadNotes(1)}>Retry notes</button></div>}
              {notes.length === 0 && !loadingNotes && !noteLoadError && (
                <p className="text-muted small">No internal notes yet.</p>
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

            <form onSubmit={handlePostNote} className="mt-auto">
              <label htmlFor="internal-note-input" className="form-label small fw-bold">
                Add Internal Note
              </label>
              <textarea
                id="internal-note-input"
                aria-label="Internal note"
                className="form-control mb-1"
                rows={3}
                placeholder="Private note for IT Staff and Admins..."
                value={newNoteBody}
                onChange={(e) => setNewNoteBody(e.target.value)}
                maxLength={4000}
                required
              />
              <div className="d-flex justify-content-between align-items-center">
                <span className="small text-muted">{newNoteBody.length} / 4000</span>
                <button
                  type="submit"
                  className="btn btn-warning btn-sm fw-semibold"
                  disabled={postingNote || !newNoteBody.trim()}
                >
                  {postingNote ? "Saving Note..." : "Post Internal Note"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Status Transition Confirmation Modal */}
      {transitionModal && (
        <div className="modal fade show d-block action-modal" style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="status-dialog-title">
          <div className="modal-dialog modal-dialog-centered" role="document">
            <div className="modal-content border-0 shadow">
              <div className="modal-header bg-success text-white" style={{ backgroundColor: "var(--primary-green)" }}>
                <h5 className="modal-title h6 fw-bold" id="status-dialog-title">
                  Confirm Status Change: {formatStatus(ticket.currentStatus)} &rarr; {transitionModal.label}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setTransitionModal(null)}
                  disabled={savingStatus}
                  aria-label="Close"
                ></button>
              </div>
              <div className="modal-body p-4">
                <p className="mb-3">
                  Are you sure you want to transition this ticket to <strong>{transitionModal.to}</strong>?
                </p>

                <WorkflowFeedback recovery={recovery} onReview={acceptWorkflow} />
                {transitionModal.to === "RESOLVED" && <ResolutionSummary state={ticket.resolutionBlockers} />}
                {transitionModal.to === "CANCELLED" && <p>Complete or cancel all unfinished current-cycle Actions first. Completed follow-ups do not prevent Ticket cancellation.</p>}
                {transitionModal.to === "REOPENED" && <p>Reopening starts a new work cycle and clears the previous resolution indication. Earlier Actions remain historical.</p>}
                {!ticket.permittedTransitions?.some(o => o.to === transitionModal.to && o.enabled) && <p role="alert">This transition is no longer available. Review the latest Ticket before choosing another transition.</p>}
                {transitionModal.requiresReason && (
                  <div className="mb-2">
                    <label htmlFor="transition-reason-input" className="form-label small fw-bold">
                      Reason for {transitionModal.label} <span className="text-danger">*</span>
                    </label>
                    <p className="text-muted small mb-1">
                      This reason will be recorded atomically as a public comment for the requester to see.
                    </p>
                    <textarea
                      id="transition-reason-input"
                      aria-label="Transition reason"
                      className="form-control"
                      rows={3}
                      placeholder="Explain why this ticket is being cancelled or reopened..."
                      value={transitionReason}
                      onChange={(e) => setTransitionReason(e.target.value)}
                      disabled={savingStatus}
                      aria-invalid={!!transitionReasonError}
                      aria-describedby={transitionReasonError ? "transition-reason-error" : undefined}
                      required
                    />
                    <div className="d-flex justify-content-between small text-muted mt-1">
                      <span>{[...transitionReason.trim()].length} / 4000</span>
                    </div>
                    {transitionReasonError && (
                      <div id="transition-reason-error" role="alert" className="text-danger small mt-1">{transitionReasonError}</div>
                    )}
                  </div>
                )}
              </div>
              <div className="modal-footer bg-light p-3">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setTransitionModal(null)}
                  disabled={savingStatus}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-zen-primary"
                  onClick={handleConfirmModalTransition}
                  disabled={workflowDisabled || !ticket.permittedTransitions?.some(o => o.to === transitionModal.to && o.enabled)}
                >
                  {savingStatus ? "Updating..." : "Confirm Status Change"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Attachment Soft Removal Modal */}
      {modalAttachment && (
        <div className="modal fade show d-block" style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="staff-remove-title">
          <div className="modal-dialog modal-dialog-centered" role="document">
            <div className="modal-content border-0 shadow">
              <div className="modal-header bg-danger text-white">
                <h5 className="modal-title h6 fw-bold" id="staff-remove-title">Confirm Attachment Removal</h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setModalAttachment(null)}
                  disabled={isRemoving}
                  aria-label="Close"
                ></button>
              </div>
              <div className="modal-body p-4">
                <p>Are you sure you want to remove <strong>{modalAttachment.fileName}</strong>?</p>
                <div className="mb-2">
                  <label htmlFor="staff-removal-reason-input" className="form-label small fw-bold">
                    Reason for Removal <span className="text-danger">*</span>
                  </label>
                  <textarea
                    id="staff-removal-reason-input"
                    className="form-control"
                    rows={3}
                    placeholder="Reason for removal..."
                    value={removalReason}
                    onChange={(e) => setRemovalReason(e.target.value)}
                    maxLength={1000}
                    required
                  />
                  {removalError && <div className="text-danger small mt-1">{removalError}</div>}
                </div>
              </div>
              <div className="modal-footer bg-light p-3">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setModalAttachment(null)}
                  disabled={isRemoving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleConfirmRemoval}
                  disabled={isRemoving}
                >
                  {isRemoving ? "Removing..." : "Confirm Removal"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
