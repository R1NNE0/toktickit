import { useEffect, useRef, useState } from "react";
import { ApiError, getStaffAssignees, type Assignee } from "../api.js";
import type { CurrentUser } from "../auth-client.js";
import { createAction, editAction, transitionAction, getAction, getActionTicket, getActionHistory,
  type ActionRecord, type ActionTicket, type CreateAction, type ActionMutation, type ActionRevision, type ActionPage } from "../actions-api.js";
import { actionAllowed, initialActionFields, validateActionFields, actionDate, actionLabel, eligible, type ActionMode, type ActionFields } from "../action-ui.js";
import { useDialogFocus } from "../useDialogFocus.js";
import { ActionDetails } from "./ActionDetails.js";

type Props = { mode: ActionMode; action?: ActionRecord; ticket: ActionTicket; user: CurrentUser;
  onClose: () => void; onSaved: (result: ActionMutation) => void; onReload: (ticket: ActionTicket) => void };
export function ActionDialog({ mode, action, ticket, user, onClose, onSaved, onReload }: Props) {
  const [fields, setFields] = useState(() => initialActionFields(user.id, action));
  const initial = useRef(JSON.stringify(fields));
  const [base, setBase] = useState<{ ticket: ActionTicket; action?: ActionRecord }>({ ticket, action });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [denied, setDenied] = useState(false);
  const [pending, setPending] = useState(false), busy = useRef(false);
  const [conflict, setConflict] = useState(false);
  const [latest, setLatest] = useState<{ ticket: ActionTicket; action?: ActionRecord } | null>(null);
  const [reloading, setReloading] = useState(false);
  const [uncertain, setUncertain] = useState<CreateAction | null>(null);
  const key = useRef<string>();
  const [assignees, setAssignees] = useState<Assignee[]>([]), [directoryError, setDirectoryError] = useState("");
  const [directoryLoading, setDirectoryLoading] = useState(false), [directoryAttempt, setDirectoryAttempt] = useState(0);
  const [history, setHistory] = useState<ActionPage<ActionRevision> | null>(null), [historyPage, setHistoryPage] = useState(1);
  const [historyError, setHistoryError] = useState<ApiError | Error | null>(null), [historyAttempt, setHistoryAttempt] = useState(0);
  const alive = useRef(true), form = useRef<HTMLFormElement>(null), request = useRef<AbortController>();
  const completed = base.action?.status === "COMPLETED";
  const dirty = JSON.stringify(fields) !== initial.current;
  useEffect(() => {
    if (pending) return;
    const name = Object.keys(errors)[0];
    const control = Array.from(form.current?.elements ?? []).find(e => e.getAttribute("name") === name) as HTMLElement | undefined;
    control?.focus();
  }, [errors, pending]);
  const close = () => {
    if (busy.current || reloading) return;
    if ((dirty || uncertain) && !window.confirm(uncertain ? "This Action may already have been saved. Discard this draft? Reload Actions before creating another." : "Discard unsaved Action changes?")) return;
    onClose();
  };
  useDialogFocus("action-" + mode, close);
  useEffect(() => { alive.current = true; return () => { alive.current = false; request.current?.abort(); }; }, []);
  useEffect(() => {
    const leave = (event: Event) => {
      if (busy.current || reloading) { event.preventDefault(); return; }
      if ((dirty || uncertain) && !window.confirm("You have unsaved Action changes. Leave this Ticket?")) event.preventDefault();
    };
    const unload = (event: BeforeUnloadEvent) => { if (dirty || busy.current || uncertain) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("toktickit:leave-actions", leave); window.addEventListener("beforeunload", unload);
    return () => { window.removeEventListener("toktickit:leave-actions", leave); window.removeEventListener("beforeunload", unload); };
  }, [dirty, pending, uncertain, reloading]);
  useEffect(() => {
    if (mode !== "create" && (mode !== "edit" || completed)) return;
    const controller = new AbortController(); setDirectoryLoading(true); setDirectoryError("");
    getStaffAssignees(controller.signal).then(values => { if (!controller.signal.aborted) setAssignees(values.filter(eligible)); })
      .catch(e => { if (!controller.signal.aborted) setDirectoryError(e instanceof ApiError && e.status === 403 ? "Access denied to the assignee directory." : "Unable to load assignees. Retry the directory."); })
      .finally(() => { if (!controller.signal.aborted) setDirectoryLoading(false); });
    return () => controller.abort();
  }, [mode, completed, directoryAttempt]);
  useEffect(() => {
    if (mode !== "history" || !action) return;
    const controller = new AbortController(); setHistory(null); setHistoryError(null);
    getActionHistory(ticket.id, action.id, historyPage, controller.signal).then(page => { if (!controller.signal.aborted) setHistory(page); })
      .catch(e => { if (!controller.signal.aborted) setHistoryError(e); });
    return () => controller.abort();
  }, [mode, action, ticket.id, historyPage, historyAttempt]);

  const change = (name: keyof ActionFields, value: string | boolean) => setFields(old => ({ ...old, [name]: value }));
  const focusError = (values: Record<string, string>) => {
    setErrors(values);
    const name = Object.keys(values)[0];
    // Server field names are untrusted; compare DOM names rather than building a selector.
    const control = Array.from(form.current?.elements ?? []).find(e => e.getAttribute("name") === name) as HTMLElement | undefined;
    control?.focus();
  };
  async function reloadLatest() {
    if (busy.current || reloading) return;
    setReloading(true); setLatest(null); setError(""); request.current?.abort(); request.current = new AbortController();
    try {
      const [t, a] = await Promise.all([getActionTicket(ticket.id, request.current.signal), action ? getAction(ticket.id, action.id, request.current.signal) : undefined]);
      if (!alive.current) return;
      setLatest({ ticket: t, action: a }); onReload(t);
    } catch (e) { if (alive.current) setError(e instanceof ApiError && [403,404].includes(e.status) ? "This Action is unavailable or access was denied. Close this form." : "Unable to reload. Your draft is retained; try again."); }
    finally { if (alive.current) setReloading(false); }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy.current || reloading || conflict || denied) return;
    if (!uncertain) {
      const invalid = validateActionFields(mode, fields, !!completed);
      if ((mode === "create" || (mode === "edit" && !completed && fields.assigneeId !== String(base.action?.assignee.id)))
        && !assignees.some(a => a.id === Number(fields.assigneeId))) invalid.assigneeId = "Select an active IT Staff member or Administrator.";
      if (Object.keys(invalid).length) { setError("Check the highlighted fields."); focusError(invalid); return; }
      if (!actionAllowed(mode, user, base.ticket, base.action)) { setError("This operation is no longer available. Close and reload Actions."); return; }
    }
    busy.current = true; setPending(true); setErrors({}); setError("");
    const optional = (value: string) => value.trim() || null;
    let createPayload: CreateAction | undefined;
    try {
      let result: ActionMutation;
      if (mode === "create") {
        key.current ??= crypto.randomUUID();
        createPayload = uncertain ?? { clientRequestId: key.current, expectedWorkflowVersion: base.ticket.workflowVersion,
          description: fields.description.trim(), assigneeId: Number(fields.assigneeId), result: optional(fields.result),
          followUpRequired: fields.followUpRequired, followUpNote: optional(fields.followUpNote), attachmentNotes: optional(fields.attachmentNotes) };
        result = await createAction(ticket.id, createPayload);
      } else {
        const a = base.action!;
        const versions = { expectedWorkflowVersion: base.ticket.workflowVersion, expectedVersion: a.version };
        if (mode === "edit") result = await editAction(ticket.id, a.id, { ...versions,
          description: fields.description.trim(), result: optional(fields.result), followUpRequired: fields.followUpRequired,
          followUpNote: optional(fields.followUpNote), attachmentNotes: optional(fields.attachmentNotes),
          ...(!completed && fields.assigneeId !== String(a.assignee.id) ? { assigneeId: Number(fields.assigneeId) } : {}),
          ...(fields.reason.trim() ? { changeReason: fields.reason.trim() } : {}) });
        else result = await transitionAction(ticket.id, a.id, mode === "start" ? { ...versions, targetStatus: "IN_PROGRESS" }
          : mode === "cancel" ? { ...versions, targetStatus: "CANCELLED", confirmed: true, reason: fields.reason.trim() }
          : { ...versions, targetStatus: "COMPLETED", result: fields.result.trim(), followUpRequired: fields.followUpRequired,
            followUpNote: optional(fields.followUpNote), attachmentNotes: optional(fields.attachmentNotes) });
      }
      if (alive.current) onSaved(result);
    } catch (e) {
      if (!alive.current) return;
      if (mode === "create" && createPayload && (!(e instanceof ApiError) || e.status >= 500)) {
        setUncertain(createPayload); setError("The creation result is uncertain. Your submission is locked; retry the exact submission to avoid creating a duplicate.");
      } else {
        setUncertain(null);
        if (e instanceof ApiError && e.status === 409) { setConflict(true); setLatest(null); setError("The Ticket or Action changed, or the workflow now blocks this request. Your draft is retained. Reload the latest data and review it before resubmitting."); }
        else if (e instanceof ApiError && [401,403,404].includes(e.status)) { setDenied(true); setError(e.status === 404 ? "This Action is unavailable." : "Access denied. Close this form and return to a permitted view."); }
        else {
          setError(e instanceof ApiError && e.status === 400 ? e.message : "Unable to save. Your draft is retained. Reload the latest data before retrying an uncertain update.");
          if (!(e instanceof ApiError) || e.status >= 500) setConflict(true);
          if (e instanceof ApiError && e.details?.fields) focusError(Object.fromEntries(Object.entries(e.details.fields).map(([k,v]) => [k === "changeReason" ? "reason" : k, v])));
        }
      }
    } finally { busy.current = false; if (alive.current) setPending(false); }
  }
  const text = (name: keyof ActionFields, label: string, max: number, required = false) => <div className="mb-3">
    <label className="form-label" htmlFor={`action-${name}`}>{label}{required ? " (required)" : ""}</label>
    <textarea className={`form-control${errors[name] ? " is-invalid" : ""}`} id={`action-${name}`} name={name} rows={3}
      value={String(fields[name])} onChange={e => change(name, e.target.value)} aria-required={required}
      aria-invalid={!!errors[name]} aria-describedby={`action-${name}-hint${errors[name] ? ` action-${name}-error` : ""}`} />
    <small id={`action-${name}-hint`}>Up to {max} characters.</small>
    {errors[name] && <div id={`action-${name}-error`} className="invalid-feedback">{errors[name]}</div>}
  </div>;
  const title = mode === "history" ? `Action #${action!.id} history` : mode === "create" ? "Create Action" : `${mode === "edit" && completed ? "Correct completed" : actionLabel(mode)} Action #${action!.id}`;
  return <div className="modal d-block action-modal" role="dialog" aria-modal="true" aria-labelledby="action-dialog-title">
    <div className="modal-dialog modal-lg modal-dialog-centered"><div className="modal-content">
      <div className="modal-header"><h3 className="modal-title h5" id="action-dialog-title">{title}</h3>
        <button type="button" className="btn btn-zen-outline" onClick={close} disabled={pending || reloading}>Close</button></div>
      <div className="modal-body">
        <p>Actions Taken content is visible to the Requester. Use Internal Notes for private discussion.</p>
        <p className="small text-muted">All times shown in Asia/Bangkok (UTC+7).</p>
        {mode === "history" ? <>
          {historyError ? <div role="alert">{historyError instanceof ApiError && [403,404].includes(historyError.status) ? "History unavailable or access denied." : "Unable to load history."}
            {!(historyError instanceof ApiError && [401,403,404].includes(historyError.status)) && <button className="btn btn-zen-outline" onClick={() => setHistoryAttempt(n => n + 1)}>Retry history</button>}</div>
            : !history ? <p role="status">Loading Action history…</p> : <>
              {!history.data.length && <p>No revisions on this page.</p>}
              {history.data.map(r => <details className="action-history mb-3" key={r.id}><summary tabIndex={0}>Version {r.version} · {actionLabel(r.operation)} · {r.actor.name} · {actionDate(r.occurredAt)}</summary>
                <p className="action-text">Change reason: {r.changeReason ?? "None"}</p><ActionDetails action={r.snapshot} /></details>)}
              <nav aria-label="Action history pages" className="d-flex align-items-center flex-wrap gap-3">
                <button className="btn btn-zen-outline" disabled={historyPage <= 1} onClick={() => setHistoryPage(p => p - 1)}>Previous revisions</button>
                <span>Page {historyPage} of {history.pagination.totalPages}</span>
                <button className="btn btn-zen-outline" disabled={historyPage >= history.pagination.totalPages} onClick={() => setHistoryPage(p => p + 1)}>Next revisions</button>
              </nav>
            </>}
        </> : <form onSubmit={submit} noValidate ref={form}>
          {error && <div className="alert alert-danger" role="alert">{error}</div>}
          {conflict && <div className="alert alert-warning">
            <button type="button" className="btn btn-zen-outline" disabled={reloading} onClick={() => void reloadLatest()}>{reloading ? "Reloading…" : "Reload latest data"}</button>
            {latest && <div><h4 className="h6 mt-3">Latest saved data — compare with your retained draft below</h4>
              <p>Ticket: {actionLabel(latest.ticket.currentStatus)}, cycle {latest.ticket.workCycle}.</p>
              {latest.action && <ActionDetails action={latest.action} />}
              {actionAllowed(mode, user, latest.ticket, latest.action) ? <button type="button" className="btn btn-zen-outline" onClick={() => { setBase(latest); setConflict(false); setLatest(null); setError("Latest versions selected. Review your draft, then submit explicitly."); }}>Use latest versions after review</button>
                : <p>This operation is no longer permitted. Close this draft; historical and terminal Actions remain readable.</p>}
            </div>}
          </div>}
          <fieldset disabled={pending || !!uncertain || denied || reloading}>
            <legend className="visually-hidden">Action fields</legend>
            {action && <p>Assignee: {base.action?.assignee.name}. Created by: {action.createdBy.name}. {completed && `Performed by: ${action.performedBy?.name}. Assignment, performer and completion time are read-only.`}</p>}
            {mode === "complete" && <p>Completing as {user.name}. Your identity and completion time will be recorded automatically.</p>}
            {mode === "start" && <p>Start this assigned Action as {user.name}?</p>}
            {mode === "cancel" && <p>Cancel this Action? The record and this reason remain visible to the Requester.</p>}
            {["create", "edit"].includes(mode) && text("description", "Description", 4000, true)}
            {(mode === "create" || (mode === "edit" && !completed)) && <div className="mb-3">
              <label className="form-label" htmlFor="action-assigneeId">Assignee (required)</label>
              <select id="action-assigneeId" name="assigneeId" className="form-select" value={fields.assigneeId} disabled={directoryLoading || !!directoryError}
                onChange={e => change("assigneeId", e.target.value)} aria-invalid={!!errors.assigneeId} aria-describedby={errors.assigneeId ? "action-assignee-error" : undefined}>
                {!assignees.some(a => String(a.id) === fields.assigneeId) && <option value={fields.assigneeId}>{base.action?.assignee.name ?? user.name} (current selection)</option>}
                {assignees.map(a => <option key={a.id} value={a.id}>{a.name} ({actionLabel(a.role)})</option>)}
              </select>
              {directoryLoading && <p role="status">Loading eligible assignees…</p>}
              {directoryError && <p role="alert">{directoryError} {!directoryError.startsWith("Access denied") && <button type="button" className="btn btn-zen-outline" onClick={() => setDirectoryAttempt(n => n + 1)}>Retry assignees</button>}</p>}
              {errors.assigneeId && <p id="action-assignee-error" className="text-danger">{errors.assigneeId}</p>}
            </div>}
            {["create", "edit", "complete"].includes(mode) && <>
              {text("result", "Result", 4000, mode === "complete" || !!completed)}
              <div className="form-check mb-3"><input className="form-check-input" type="checkbox" id="action-followUpRequired" checked={fields.followUpRequired} onChange={e => change("followUpRequired", e.target.checked)} />
                <label className="form-check-label" htmlFor="action-followUpRequired">Follow-up required</label></div>
              {text("followUpNote", "Follow-up note", 2000, fields.followUpRequired)}
              {text("attachmentNotes", "Attachment notes", 2000)}
            </>}
            {(mode === "edit" || mode === "cancel") && text("reason", mode === "cancel" ? "Cancellation reason" : "Change reason", 4000, mode === "cancel" || !!completed)}
          </fieldset>
          <div className="d-flex gap-2 flex-wrap">
            <button className="btn btn-zen-primary" type="submit" disabled={pending || conflict || reloading || denied || (mode === "create" && !uncertain && (directoryLoading || !!directoryError))}>
              {pending ? "Saving Action…" : uncertain ? "Retry exact submission" : mode === "create" ? "Create Action" : mode === "cancel" ? "Confirm cancellation" : mode === "start" ? "Start Action" : mode === "complete" ? "Complete Action" : "Save Action"}
            </button>
            <button className="btn btn-zen-outline" type="button" disabled={pending || reloading} onClick={close}>Discard / close</button>
          </div>
          {pending && <p role="status">Saving. Please wait; closing will not cancel the request.</p>}
        </form>}
      </div>
    </div></div>
  </div>;
}
