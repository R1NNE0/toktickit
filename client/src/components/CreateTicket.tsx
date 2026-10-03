import { useAuth } from "../context/AuthContext.js";
import React, { useState, useEffect, useRef } from "react";
import {
  getTicketDetail,
  getCategories,
  getRelatedSystems,
  createTicket,
  uploadAttachment,
  Category,
  RelatedSystem,
  Priority,
  Ticket,
} from "../api.js";

interface CreateTicketProps {
  onSuccessNavigate?: () => void;
  onViewTicket?: (id: number) => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_ATTACHMENTS = 5;

export const CreateTicket: React.FC<CreateTicketProps> = ({
  onSuccessNavigate,
  onViewTicket,
  onDirtyChange,
}) => {
  const { user } = useAuth();
  const active = useRef(true);
  const uploads = useRef(new AbortController());
  useEffect(() => { active.current = true; uploads.current = new AbortController(); return () => { active.current = false; uploads.current.abort(); }; }, []);
  const [failedFiles, setFailedFiles] = useState<File[]>([]);
  // Reference data
  const [categories, setCategories] = useState<Category[]>([]);
  const [relatedSystems, setRelatedSystems] = useState<RelatedSystem[]>([]);
  const [loadingRefData, setLoadingRefData] = useState<boolean>(true);
  const [refDataError, setRefDataError] = useState<string | null>(null);

  // Form fields
  const [categoryId, setCategoryId] = useState<string>("");
  const [relatedSystemId, setRelatedSystemId] = useState<string>("");
  const [requestedPriority, setRequestedPriority] = useState<Priority>("MEDIUM");
  const [summary, setSummary] = useState<string>("");
  const [description, setDescription] = useState<string>("");

  // Attachments
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Validation & Submission states
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdTicket, setCreatedTicket] = useState<Ticket | null>(null);

  // Idempotency key per submission session
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() =>
    crypto.randomUUID ? crypto.randomUUID() : `idemp-${Date.now()}`
  );

  // Load reference categories & systems
  const loadReferenceData = async () => {
    setLoadingRefData(true);
    setRefDataError(null);
    try {
      const [cats, systems] = await Promise.all([
        getCategories(),
        getRelatedSystems(),
      ]);
      setCategories(cats);
      setRelatedSystems(systems);
    } catch (err: unknown) {
      console.error("Failed to load reference data:", err);
      const msg =
        err instanceof Error ? err.message : "Failed to load form reference data";
      setRefDataError(msg);
    } finally {
      setLoadingRefData(false);
    }
  };

  useEffect(() => {
    loadReferenceData();
  }, []);

  // Dirty form tracking
  const isDirty = Boolean(
    summary.trim() ||
      description.trim() ||
      categoryId !== "" ||
      relatedSystemId !== "" ||
      files.length > 0
  );

  useEffect(() => {
    if (onDirtyChange) {
      onDirtyChange(isDirty && !createdTicket);
    }

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty && !createdTicket) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty, createdTicket, onDirtyChange]);

  // Format file size helper
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Handle File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    if (!e.target.files) return;

    const selectedList = Array.from(e.target.files);
    const newFiles: File[] = [];

    for (const file of selectedList) {
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        setFileError(
          `"${file.name}" has an unsupported format. Allowed: JPG, PNG, WEBP, PDF`
        );
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        setFileError(
          `"${file.name}" exceeds the 5 MB limit (${formatFileSize(file.size)})`
        );
        continue;
      }
      newFiles.push(file);
    }

    if (files.length + newFiles.length > MAX_ATTACHMENTS) {
      setFileError(
        `Maximum ${MAX_ATTACHMENTS} active attachments allowed per ticket.`
      );
      const allowedCount = Math.max(0, MAX_ATTACHMENTS - files.length);
      setFiles((prev) => [...prev, ...newFiles.slice(0, allowedCount)]);
    } else {
      setFiles((prev) => [...prev, ...newFiles]);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setFileError(null);
  };

  // Reset form to create another ticket
  const handleResetForm = () => {
    setSummary("");
    setDescription("");
    setFiles([]);
    setFailedFiles([]);
    setFieldErrors({});
    setSubmitError(null);
    setCreatedTicket(null);
    setRequestedPriority("MEDIUM");
    setCategoryId("");
    setRelatedSystemId("");
    setIdempotencyKey(
      crypto.randomUUID ? crypto.randomUUID() : `idemp-${Date.now()}`
    );
  };

  // Form Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const errors: Record<string, string> = {};

    const trimmedSummary = summary.trim();
    const trimmedDesc = description.trim();

    if ([...trimmedSummary].length > 200) errors.summary = "Summary must be at most 200 characters.";
    if ([...trimmedDesc].length > 10000) errors.description = "Description must be at most 10000 characters.";
    if (!trimmedSummary) {
      errors.summary = "Summary is required and cannot be blank.";
    }
    if (!trimmedDesc) {
      errors.description = "Description is required and cannot be blank.";
    }
    if (!categoryId) {
      errors.categoryId = "Please select a Category.";
    }
    if (!relatedSystemId) {
      errors.relatedSystemId = "Please select an Affected System.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      // 1. Create Ticket
      const ticket = await createTicket({
        summary: trimmedSummary,
        description: trimmedDesc,
        categoryId: Number(categoryId),
        relatedSystemId: Number(relatedSystemId),
        requestedPriority,
        idempotencyKey,
      });

      if (!active.current) return;
      const failed: File[] = [];
      for (const file of files) {
        if (!active.current) return;
        try { await uploadAttachment(ticket.id, file, uploads.current.signal); }
        catch { failed.push(file); }
      }
      if (!active.current) return;
      setFailedFiles(failed);
      setCreatedTicket(ticket);
    } catch (err: unknown) {
      console.error("Failed to submit ticket:", err);
      const msg =
        err instanceof Error ? err.message : "Unable to submit ticket. Please retry.";
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const retryUploads = async () => {
    if (!createdTicket || isSubmitting) return;
    setIsSubmitting(true); setSubmitError(null);
    try {
      const current = await getTicketDetail(createdTicket.id);
      if (!active.current) return;
      const remaining: File[] = [];
      for (const file of failedFiles) {
        if (!active.current) return;
        const matching = current.attachments?.some(a => !a.isRemoved && a.fileName === file.name && a.fileSize === file.size && a.mimeType === file.type);
        if (matching) {
          remaining.push(file);
          setSubmitError("A matching attachment already exists. Inspect Ticket Detail before uploading it again.");
          continue;
        }
        try { await uploadAttachment(createdTicket.id, file, uploads.current.signal); }
        catch { remaining.push(file); }
      }
      if (active.current) setFailedFiles(remaining);
    } catch { if (active.current) setSubmitError("Unable to check current attachments. Retry when connected."); }
    finally { if (active.current) setIsSubmitting(false); }
  };

  // ---------------------------------------------------------------------------
  // Success Confirmation Card
  // ---------------------------------------------------------------------------
  if (createdTicket) {
    return (
      <div className="zen-card text-center py-5 px-4 my-3" style={{ maxWidth: 720, margin: "0 auto" }}>
        <div
          className="avatar-circle mx-auto mb-3"
          style={{
            width: 64,
            height: 64,
            fontSize: "2rem",
            backgroundColor: "var(--pale-green)",
            color: "var(--primary-green)",
          }}
        >
          ✓
        </div>

        <h2 className="h4 fw-bold mb-2" style={{ color: "var(--text-primary)" }}>
          {failedFiles.length ? "Ticket created; some files were not uploaded." : "Ticket Created Successfully!"}
        </h2>
        <p className="text-muted small mb-4">
          Your support request has been logged and assigned an official tracking number.
        </p>

        {/* Ticket Details Summary Box */}
        <div
          className="p-4 mb-4 text-start rounded"
          style={{
            backgroundColor: "var(--page-bg)",
            border: "1px solid var(--border-neutral)",
          }}
        >
          <div className="d-flex justify-content-between align-items-center mb-3">
            <span className="text-muted small">Official Ticket Number:</span>
            <span
              className="fw-bold fs-5 font-monospace"
              style={{ color: "var(--primary-green)" }}
            >
              {createdTicket.ticketNumber}
            </span>
          </div>

          <div className="mb-2">
            <strong>Summary:</strong> {createdTicket.summary}
          </div>

          <div className="d-flex flex-wrap gap-4 text-muted small mt-3 pt-2 border-top">
            <div>
              <strong>Category:</strong> {createdTicket.category?.name || "General"}
            </div>
            <div>
              <strong>System:</strong> {createdTicket.relatedSystem?.name || "None"}
            </div>
            <div>
              <strong>Priority:</strong>{" "}
              <span className="badge bg-warning text-dark">
                {createdTicket.requestedPriority}
              </span>
            </div>
            <div>
              <strong>Status:</strong>{" "}
              <span className="badge bg-secondary">
                {createdTicket.currentStatus}
              </span>
            </div>
            {files.length > 0 && (
              <div>
                <strong>Attachments saved:</strong> {files.length - failedFiles.length} file(s)
              </div>
            )}
          </div>
        </div>

        {failedFiles.length > 0 && <div className="alert alert-warning" role="alert">
          <ul>{failedFiles.map((file, i) => <li key={i}>{file.name}</li>)}</ul>
          {submitError && <p>{submitError}</p>}
          <button className="btn btn-outline-secondary" disabled={isSubmitting} onClick={() => void retryUploads()}>
            {isSubmitting ? "Retrying uploads..." : "Retry Failed Uploads"}
          </button>
        </div>}
        <div className="d-flex justify-content-center gap-3 flex-wrap">
          {onViewTicket && <button type="button" className="btn btn-zen-primary" onClick={() => onViewTicket(createdTicket.id)}>View Ticket Detail</button>}
          <button
            type="button"
            className="btn btn-outline-secondary px-4"
            disabled={isSubmitting}
            onClick={handleResetForm}
          >
            ➕ Create Another Ticket
          </button>
          <button
            type="button"
            className="btn btn-zen-primary px-4"
            onClick={() => onSuccessNavigate && onSuccessNavigate()}
          >
            📋 View My Tickets
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Create Ticket Form
  // ---------------------------------------------------------------------------
  return (
    <div className="my-3" style={{ maxWidth: 840, margin: "0 auto" }}>
      {/* Form Container */}
      <div className="zen-card">
        <div className="mb-4 border-bottom pb-3">
          <h2 className="h4 fw-bold mb-1" style={{ color: "var(--text-primary)" }}>
            Create Support Ticket
          </h2>
          <p className="text-muted small mb-0">
            Submit a request to the IT Support team. All fields marked with{" "}
            <span className="text-danger fw-bold">*</span> are mandatory.
          </p>
        </div>

        {/* Global Submission / Network Error Alert */}
        {submitError && (
          <div className="alert alert-danger py-2 mb-4" role="alert">
            <div className="fw-bold">Submission Error</div>
            <div className="small">{submitError}</div>
          </div>
        )}

        {/* Reference Data Loading State */}
        {loadingRefData ? (
          <div className="text-center py-5">
            <div className="spinner-border text-success mb-2" role="status">
              <span className="visually-hidden">Loading form options...</span>
            </div>
            <div className="text-muted small">Loading categories and systems...</div>
          </div>
        ) : refDataError ? (
          <div className="alert alert-warning py-3 text-center">
            <p className="mb-2">{refDataError}</p>
            <button
              type="button"
              className="btn btn-sm btn-outline-dark"
              onClick={loadReferenceData}
            >
              Retry Loading Options
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="bg-light border rounded p-3 mb-3"><p>Requester: {user?.name} ({user?.email})</p>
              <p>Ticket Number / Date: assigned by the server after save</p><p className="mb-0">IT Priority (read-only): {requestedPriority}</p></div>
            <div className="row g-3 mb-3">
              {/* Category Dropdown */}
              <div className="col-md-6 text-start">
                <label
                  htmlFor="ticket-category"
                  className="form-label fw-semibold small mb-1"
                >
                  Category <span className="text-danger">*</span>
                </label>
                <select
                  id="ticket-category"
                  className={`form-select ${
                    fieldErrors.categoryId ? "is-invalid" : ""
                  }`}
                  value={categoryId}
                  onChange={(e) => {
                    setCategoryId(e.target.value);
                    if (fieldErrors.categoryId) {
                      setFieldErrors((prev) => ({ ...prev, categoryId: "" }));
                    }
                  }}
                  disabled={isSubmitting}
                >
                  <option value="">-- Select Category --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.categoryId && (
                  <div className="invalid-feedback d-block small" style={{ color: "var(--danger-red)" }}>
                    {fieldErrors.categoryId}
                  </div>
                )}
              </div>

              {/* Related System Dropdown */}
              <div className="col-md-6 text-start">
                <label
                  htmlFor="ticket-related-system"
                  className="form-label fw-semibold small mb-1"
                >
                  Affected System / Device <span className="text-danger">*</span>
                </label>
                <select
                  id="ticket-related-system"
                  className={`form-select ${
                    fieldErrors.relatedSystemId ? "is-invalid" : ""
                  }`}
                  value={relatedSystemId}
                  onChange={(e) => {
                    setRelatedSystemId(e.target.value);
                    if (fieldErrors.relatedSystemId) {
                      setFieldErrors((prev) => ({
                        ...prev,
                        relatedSystemId: "",
                      }));
                    }
                  }}
                  disabled={isSubmitting}
                >
                  <option value="">-- Select Affected System --</option>
                  {relatedSystems.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.relatedSystemId && (
                  <div className="invalid-feedback d-block small" style={{ color: "var(--danger-red)" }}>
                    {fieldErrors.relatedSystemId}
                  </div>
                )}
              </div>
            </div>

            {/* Requested Priority */}
            <div className="mb-3 text-start">
              <label
                htmlFor="ticket-priority"
                className="form-label fw-semibold small mb-1"
              >
                Requested Priority
              </label>
              <select
                id="ticket-priority"
                className="form-select"
                value={requestedPriority}
                onChange={(e) =>
                  setRequestedPriority(e.target.value as Priority)
                }
                disabled={isSubmitting}
                style={{ maxWidth: 280 }}
              >
                <option value="LOW">Low (Minor inconvenience)</option>
                <option value="MEDIUM">Medium (Standard request)</option>
                <option value="HIGH">High (Impairs core productivity)</option>
                <option value="CRITICAL">Critical (Total work stoppage)</option>
              </select>
            </div>

            {/* Summary */}
            <div className="mb-3 text-start">
              <label
                htmlFor="ticket-summary"
                className="form-label fw-semibold small mb-1"
              >
                Summary <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                id="ticket-summary"
                className={`form-control ${
                  fieldErrors.summary ? "is-invalid" : ""
                }`}
                placeholder="Brief summary of the issue (e.g., Cannot connect to campus Wi-Fi)"
                value={summary}
                onChange={(e) => {
                  setSummary(e.target.value);
                  if (fieldErrors.summary) {
                    setFieldErrors((prev) => ({ ...prev, summary: "" }));
                  }
                }}
                disabled={isSubmitting}
              />
              {fieldErrors.summary && (
                <div className="invalid-feedback d-block small" style={{ color: "var(--danger-red)" }}>
                  {fieldErrors.summary}
                </div>
              )}
            </div>

            {/* Description */}
            <div className="mb-4 text-start">
              <label
                htmlFor="ticket-description"
                className="form-label fw-semibold small mb-1"
              >
                Description <span className="text-danger">*</span>
              </label>
              <textarea
                id="ticket-description"
                rows={5}
                className={`form-control ${
                  fieldErrors.description ? "is-invalid" : ""
                }`}
                placeholder="Detailed description of the issue, error messages, and steps to reproduce..."
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  if (fieldErrors.description) {
                    setFieldErrors((prev) => ({ ...prev, description: "" }));
                  }
                }}
                disabled={isSubmitting}
              />
              {fieldErrors.description && (
                <div className="invalid-feedback d-block small" style={{ color: "var(--danger-red)" }}>
                  {fieldErrors.description}
                </div>
              )}
            </div>

            {/* Attachments Section */}
            <div className="mb-4 text-start p-3 rounded" style={{ backgroundColor: "var(--pale-green)", border: "1px dashed var(--primary-green)" }}>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <label className="fw-semibold small mb-0" style={{ color: "var(--text-primary)" }}>
                  📎 File Attachments (Optional)
                </label>
                <span className="small text-muted">
                  Max 5 files (JPG, PNG, WEBP, PDF up to 5 MB each)
                </span>
              </div>

              <input
                type="file"
                aria-label="File Attachments"
                ref={fileInputRef}
                className="d-none"
                multiple
                accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                onChange={handleFileChange}
                disabled={isSubmitting || files.length >= MAX_ATTACHMENTS}
              />

              <button
                type="button"
                className="btn btn-sm btn-outline-dark mb-2"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSubmitting || files.length >= MAX_ATTACHMENTS}
              >
                + Choose Files
              </button>

              {fileError && (
                <div className="alert alert-danger py-1 px-2 my-2 small" role="alert">
                  {fileError}
                </div>
              )}

              {/* Selected Files List */}
              {files.length > 0 && (
                <div className="mt-2">
                  <div className="small fw-semibold text-muted mb-1">
                    Attached Files ({files.length}/{MAX_ATTACHMENTS}):
                  </div>
                  <ul className="list-group list-group-flush rounded border">
                    {files.map((file, idx) => (
                      <li
                        key={`${file.name}-${idx}`}
                        className="list-group-item d-flex justify-content-between align-items-center py-2 bg-white"
                      >
                        <div className="d-flex align-items-center text-truncate me-2">
                          <span className="me-2">
                            {file.type.includes("pdf") ? "📄" : "🖼️"}
                          </span>
                          <span className="small fw-medium text-truncate">
                            {file.name}
                          </span>
                          <span className="text-muted small ms-2">
                            ({formatFileSize(file.size)})
                          </span>
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm text-danger border-0 p-0"
                          onClick={() => removeFile(idx)}
                          disabled={isSubmitting}
                          title="Remove file"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Submit & Action Buttons */}
            <div className="d-flex justify-content-end gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary px-3"
                onClick={handleResetForm}
                disabled={isSubmitting}
              >
                Clear Form
              </button>
              <button
                type="submit"
                className="btn btn-zen-primary px-4 d-flex align-items-center"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden="true"
                    ></span>
                    Submitting Ticket...
                  </>
                ) : (
                  "Create Ticket"
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
