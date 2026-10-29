import { useEffect, useRef, useState } from "react";
import { ApiError, type Ticket } from "../api.js";
import type { CurrentUser } from "../auth-client.js";
import { getTicketActions, getActionTicket, type ActionPage, type ActionRecord, type ActionTicket, type ActionMutation } from "../actions-api.js";
import { actionAllowed, type ActionMode } from "../action-ui.js";
import { ActionDetails } from "./ActionDetails.js";
import { ActionDialog } from "./ActionDialog.js";
type Props = { ticket: Ticket; user: CurrentUser; onTicketChange: (ticket: Ticket) => void };

export function ActionsTaken(props: Props) {
  if (!props.user.isActive || props.user.mustChangePassword) return null;
  return <ActionsTakenView key={`${props.ticket.id}:${props.user.id}:${props.user.role}`} {...props} />;
}
function ActionsTakenView({ ticket, user, onTicketChange }: Props) {
  const [context, setContext] = useState(ticket);
  const [data, setData] = useState<ActionPage<ActionRecord> | null>(null), [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true), [notice, setNotice] = useState("");
  const [page, setPage] = useState(1), [pageSize, setPageSize] = useState(20);
  const [dialog, setDialog] = useState<{ mode: ActionMode; action?: ActionRecord } | null>(null);
  const [saved, setSaved] = useState<ActionRecord | null>(null), [expired, setExpired] = useState(false);
  const controller = useRef<AbortController>(), alive = useRef(true);
  const heading = useRef<HTMLHeadingElement>(null), focusSaved = useRef(false);
  const dialogTrigger = useRef<HTMLButtonElement | null>(null);
  const onChange = useRef(onTicketChange); onChange.current = onTicketChange;
  const validMeta = Number.isInteger(context.workflowVersion) && context.workflowVersion! > 0 && Number.isInteger(context.workCycle) && context.workCycle! > 0;
  const operational = user.role === "IT_STAFF" || user.role === "ADMINISTRATOR";
  const allowed = (mode: ActionMode, action?: ActionRecord) => (mode === "history" || validMeta) && actionAllowed(mode, user, context as ActionTicket, action);
  useEffect(() => { setContext(ticket); }, [ticket]);
  useEffect(() => {
    if (focusSaved.current && !loading && !dialog) { focusSaved.current = false; heading.current?.focus(); }
  }, [loading, dialog]);
  useEffect(() => {
    if (!dialog && dialogTrigger.current) {
      // Capture before disabling background controls: browsers otherwise blur the trigger.
      if (dialogTrigger.current.isConnected) dialogTrigger.current.focus();
      dialogTrigger.current = null;
    }
  }, [dialog]);
  function openDialog(trigger: HTMLButtonElement, mode: ActionMode, action?: ActionRecord) {
    dialogTrigger.current = trigger; setDialog({ mode, action });
  }
  useEffect(() => {
    alive.current = true;
    const clear = () => { setExpired(true); setDialog(null); setData(null); setSaved(null); controller.current?.abort(); };
    window.addEventListener("toktickit:session-expired", clear);
    return () => { alive.current = false; controller.current?.abort(); window.removeEventListener("toktickit:session-expired", clear); };
  }, []);
  async function reload(withTicket = false) {
    controller.current?.abort(); const request = new AbortController(); controller.current = request;
    setLoading(true); setError(null);
    try {
      const [actions, fresh] = await Promise.all([getTicketActions(ticket.id, page, pageSize, request.signal), withTicket ? getActionTicket(ticket.id, request.signal) : undefined]);
      if (request.signal.aborted || !alive.current) return;
      setData(actions); if (fresh) { setContext(fresh); onChange.current(fresh); }
    } catch (e) { if (!request.signal.aborted && alive.current) { setError(e instanceof Error ? e : new Error("Unable to load Actions.")); setData(null); } }
    finally { if (!request.signal.aborted && alive.current) setLoading(false); }
  }
  useEffect(() => { void reload(true); return () => controller.current?.abort(); }, [page, pageSize, ticket.workflowVersion, ticket.workCycle]);
  function onSaved(result: ActionMutation) {
    focusSaved.current = true;
    dialogTrigger.current = null;
    setDialog(null); setSaved(result.action);
    const next = { ...context, ...result.ticket }; setContext(next); onChange.current(next);
    setNotice(result.replayed ? `Action #${result.action.id} recovered from your previous submission. Showing the saved state.` : `Action #${result.action.id} saved.`);
    void reload(true);
  }
  if (expired) return <p role="status">Session changed. Please sign in again to view Actions.</p>;
  const blockedRead = error instanceof ApiError && [401,403,404].includes(error.status);
  // A confirmed write/replay is authoritative even if a concurrent list read is older.
  const visibleActions = data?.data.map(a => saved?.id === a.id && saved.version > a.version ? saved : a) ?? [];
  return <section className="zen-card mb-4 actions-taken" aria-labelledby="actions-title">
    <div className="d-flex justify-content-between align-items-center gap-2 flex-wrap mb-3"><h2 ref={heading} tabIndex={-1} className="h5 mb-0" id="actions-title">Actions Taken</h2>
      <div className="d-flex gap-2 flex-wrap">
        {!blockedRead && <button type="button" className="btn btn-zen-outline" disabled={loading || !!dialog} onClick={() => void reload(true)}>Refresh Actions</button>}
        {!error && !loading && allowed("create") && <button type="button" className="btn btn-zen-primary" disabled={!!dialog} onClick={event => openDialog(event.currentTarget, "create")}>Create Action</button>}
      </div>
    </div>
    {operational && <p>Actions Taken content is visible to the Requester. Use Internal Notes for private discussion.</p>}
    <p className="small text-muted">All times shown in Asia/Bangkok (UTC+7). Previous work cycles remain available below.</p>
    {notice && <p role="status" className="alert alert-success">{notice}</p>}
    {operational && !validMeta && <p role="alert">Reload Ticket data using Refresh Actions before making changes.</p>}
    {!allowed("create") && validMeta && operational && <p>This Ticket is terminal. Actions are read-only.</p>}
    {loading ? <p role="status">Loading Actions Taken…</p> : error ? <div role="alert" className="alert alert-danger">
      {error instanceof ApiError && error.status === 403 ? "Access denied to Actions Taken. Return to a permitted view."
        : error instanceof ApiError && error.status === 404 ? "This Ticket is unavailable. Return to your Ticket list."
        : error instanceof ApiError && error.status === 401 ? "Please sign in again." : "Unable to load Actions Taken. Your data has not been replaced with an empty result."}
      {!blockedRead && <button type="button" className="btn btn-zen-outline ms-2" onClick={() => void reload(true)}>Retry Actions</button>}
    </div> : data && <>
      {!data.data.length && <p>{data.pagination.totalItems ? "No Actions on this page. Use the page controls." : "No Actions Taken have been recorded for this Ticket."}</p>}
      {visibleActions.map((action, index) => <div key={action.id}>
        {(index === 0 || visibleActions[index - 1].cycle !== action.cycle) && <h3 className="h6 mt-4">Work cycle {action.cycle}{action.cycle === context.workCycle ? " — Current" : " — Historical"}</h3>}
        <article className="action-card" aria-labelledby={`action-title-${action.id}`}>
          <h4 id={`action-title-${action.id}`} className="h6">Action #{action.id}</h4><ActionDetails action={action} />
          {(action.cycle !== context.workCycle || action.status === "CANCELLED") && <p className="small">Read-only {action.cycle !== context.workCycle ? "previous-cycle" : "cancelled"} Action.</p>}
          <div className="d-flex flex-wrap gap-2">
            {(["edit", "start", "complete", "cancel", "history"] as const).filter(mode => allowed(mode, action)).map(mode =>
              <button key={mode} type="button" className="btn btn-zen-outline" disabled={!!dialog} onClick={event => openDialog(event.currentTarget, mode, action)}>
                {mode === "edit" ? action.status === "COMPLETED" ? "Correct Action" : "Edit Action" : mode === "history" ? "View history" : mode === "start" ? "Start Action" : mode === "complete" ? "Complete Action" : "Cancel Action"}
              </button>)}
          </div>
        </article>
      </div>)}
      <nav className="action-pagination mt-3" aria-label="Actions pages">
        <button type="button" className="btn btn-zen-outline" disabled={page <= 1 || !!dialog} onClick={() => setPage(p => p - 1)}>Previous Actions</button>
        <span>Page {page} of {data.pagination.totalPages} · {data.pagination.totalItems} Actions</span>
        <button type="button" className="btn btn-zen-outline" disabled={page >= data.pagination.totalPages || !!dialog} onClick={() => setPage(p => p + 1)}>Next Actions</button>
        <label>Actions per page <select className="form-select" value={pageSize} disabled={!!dialog} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}>{[10,20,50].map(n => <option key={n}>{n}</option>)}</select></label>
      </nav>
    </>}
    {!loading && !blockedRead && saved && !visibleActions.some(a => a.id === saved.id) && <aside className="action-card" aria-label="Last saved Action"><h3 className="h6">Last saved Action #{saved.id}</h3><ActionDetails action={saved} /></aside>}
    {dialog && <ActionDialog {...dialog} ticket={context as ActionTicket} user={user} onClose={() => setDialog(null)} onSaved={onSaved}
      onReload={fresh => { setContext(fresh); onChange.current(fresh); }} />}
  </section>;
}
