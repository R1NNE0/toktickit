import { useEffect, useState } from "react";
import { ApiError, type TicketStatus } from "../api.js";
import { getStaffDashboard, getMyActions, type StaffDashboardData, type Drilldown, type ActionSummary } from "../staff-dashboard-api.js";

const statuses: TicketStatus[] = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"];
const priorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const label = (s: string) => s.replaceAll("_", " ").toLowerCase().replace(/^./, c => c.toUpperCase());
const time = (s: string) => new Date(s).toLocaleString("en-GB", { timeZone: "Asia/Bangkok" });
function Failure({ error, retry }: { error: unknown; retry: () => void }) {
  const forbidden = error instanceof ApiError && [401, 403].includes(error.status);
  return <div role="alert" className="alert alert-danger">{forbidden ? "Access denied. Return to a permitted view or sign in again."
    : "Unable to load dashboard data. Counts are unavailable."}
    {!forbidden && <button className="btn btn-zen-outline ms-2" onClick={retry}>Retry</button>}</div>;
}
export function StaffDashboard({ role, navigationVersion = 0, onDrilldown, onOpenTicket }: {
  role: "IT_STAFF" | "ADMINISTRATOR"; navigationVersion?: number;
  onDrilldown: (entry: Extract<Drilldown, { view: "staff-queue" }>) => void; onOpenTicket: (id: number, actionId?: number) => void;
}) {
  const [data, setData] = useState<StaffDashboardData | null>(null), [error, setError] = useState<unknown>(null);
  const [refresh, setRefresh] = useState(0), [allActions, setAllActions] = useState(false), [page, setPage] = useState(1);
  const [actions, setActions] = useState<Awaited<ReturnType<typeof getMyActions>> | null>(null), [actionError, setActionError] = useState<unknown>(null);
  useEffect(() => {
    let active = true; const controller = new AbortController(); setData(null); setError(null);
    getStaffDashboard(controller.signal).then(value => { if (active) setData(value); }).catch(e => { if (active) setError(e); });
    return () => { active = false; controller.abort(); };
  }, [refresh, navigationVersion, role]);
  useEffect(() => {
    if (!allActions) return;
    let active = true; const controller = new AbortController(); setActions(null); setActionError(null);
    getMyActions(page, controller.signal).then(value => { if (active) setActions(value); }).catch(e => { if (active) setActionError(e); });
    return () => { active = false; controller.abort(); };
  }, [allActions, page, refresh, navigationVersion, role]);
  function drill(entry: Drilldown) {
    if (entry.view === "my-actions") { setPage(1); setAllActions(true); }
    else onDrilldown(entry);
  }
  const actionList = (items: ActionSummary[]) => items.length ? <ul className="list-unstyled">{items.map(a => <li key={a.id} className="border-bottom py-2">
    <button className="btn btn-zen-outline text-start" onClick={() => onOpenTicket(a.ticketId, a.id)}>Action #{a.id} / {a.ticket.ticketNumber}</button>
    <p className="mb-1" style={{ overflowWrap: "anywhere" }}>{a.descriptionExcerpt}</p><small>{label(a.status)} · Cycle {a.cycle} · {time(a.createdAt)}</small>
  </li>)}</ul> : <p>No outstanding Actions.</p>;
  const card = (title: string, count: number, entry: Drilldown) => <button key={title} className="zen-card btn text-start h-100 w-100"
    onClick={() => drill(entry)}><span className="d-block">{title}</span><strong className="h3 d-block mb-0">{count}</strong></button>;
  return <section aria-label="Operational dashboard" className="staff-dashboard">
    <div className="d-flex flex-wrap justify-content-between gap-2 mb-3"><h1 className="h4">{role === "ADMINISTRATOR" ? "Administrator" : "IT Staff"} Dashboard</h1>
      <button className="btn btn-zen-outline" onClick={() => setRefresh(v => v + 1)}>Refresh Dashboard</button></div>
    <p>Team workload and your assigned work. Times are Asia/Bangkok (UTC+7); recent means the last 168 hours.</p>
    {error ? <Failure error={error} retry={() => setRefresh(v => v + 1)} /> : !data ? <p role="status">Loading dashboard...</p> : <>
      <p className="text-muted small" role="status">Updated {time(data.generatedAt)}</p>
      <div className="row g-3 mb-4">{[["Unassigned active Tickets", data.metrics.unassignedActiveTickets, data.drilldowns.unassignedActiveTickets],
        ["My active Tickets", data.metrics.myActiveTickets, data.drilldowns.myActiveTickets], ["My outstanding Actions", data.metrics.myOutstandingActions, data.drilldowns.myOutstandingActions]]
        .map(([title, count, entry]) => <div className="col-12 col-md-4" key={String(title)}>{card(title as string, count as number, entry as Drilldown)}</div>)}</div>
      <h2 className="h5">Tickets by status</h2><div className="row g-2 mb-4">{statuses.map(s => <div className="col-6 col-lg-3" key={s}>{card(label(s), data.metrics.ticketsByStatus[s], data.drilldowns.ticketsByStatus[s])}</div>)}</div>
      <h2 className="h5">Active Tickets by IT Priority</h2><div className="row g-2 mb-4">{priorities.map(p => <div className="col-6 col-lg-3" key={p}>{card(label(p), data.metrics.activeTicketsByItPriority[p], data.drilldowns.activeTicketsByItPriority[p])}</div>)}</div>
      <section className="zen-card mb-4"><h2 className="h5">Recent Tickets</h2><p className="small">Updated from {time(data.recentWindow.from)} (inclusive) to {time(data.recentWindow.to)} (exclusive).</p>
        {!data.recentTickets.length ? <p>No recently updated Tickets.</p> : <ul className="list-unstyled">{data.recentTickets.map(t => <li className="mb-2" key={t.id}>
          <button className="btn btn-zen-outline text-start" style={{ overflowWrap: "anywhere" }} onClick={() => onOpenTicket(t.id)}>{t.ticketNumber}: {t.summary}</button>
          <div className="small">{label(t.currentStatus)} · {time(t.updatedAt)}</div></li>)}</ul>}
        <button className="btn btn-zen-outline" onClick={() => drill(data.drilldowns.recentTickets)}>View all recent Tickets</button></section>
      <section className="zen-card"><h2 className="h5">My Actions ({data.myActions.total})</h2>
        <p>Assigned to you, unfinished in the current cycle of active Tickets. Completed Actions are available in Ticket history.</p>
        {actionList(data.myActions.items)}<button className="btn btn-zen-outline" onClick={() => drill(data.drilldowns.myOutstandingActions)}>View all my outstanding Actions</button></section>
    </>}
    {allActions && <section className="zen-card mt-4" aria-label="All my outstanding Actions"><h2 className="h5">All my outstanding Actions</h2>
      <button className="btn btn-zen-outline mb-2" onClick={() => setAllActions(false)}>Close full Actions list</button>
      {actionError ? <Failure error={actionError} retry={() => setRefresh(v => v + 1)} /> : !actions ? <p role="status">Loading my Actions...</p> : <>
        <p>{actions.pagination.totalItems} outstanding Actions</p>{actionList(actions.data)}
        <nav aria-label="My Actions pagination" className="d-flex flex-wrap gap-2"><button className="btn btn-zen-outline" disabled={page === 1} onClick={() => setPage(v => v - 1)}>Previous Actions page</button>
          <span>Page {page} of {actions.pagination.totalPages}</span><button className="btn btn-zen-outline" disabled={page >= actions.pagination.totalPages} onClick={() => setPage(v => v + 1)}>Next Actions page</button></nav></>}
    </section>}
  </section>;
}
