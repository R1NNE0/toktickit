import { useEffect, useState } from "react";
import { ApiError } from "../api.js";
import { getRequesterDashboard, type RequesterDashboardData, type RequesterDrilldown } from "../requester-dashboard-api.js";
const time = (s: string) => new Date(s).toLocaleString("en-GB", { timeZone: "Asia/Bangkok" });
export function RequesterDashboard({ navigationVersion = 0, onDrilldown, onOpenTicket, onCreate }: {
  navigationVersion?: number; onDrilldown: (entry: RequesterDrilldown) => void; onOpenTicket: (id: number) => void; onCreate: () => void;
}) {
  const [data, setData] = useState<RequesterDashboardData | null>(null), [error, setError] = useState<unknown>(null), [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true; const controller = new AbortController(); setData(null); setError(null);
    getRequesterDashboard(controller.signal).then(value => { if (active) setData(value); }).catch(e => { if (active) setError(e); });
    return () => { active = false; controller.abort(); };
  }, [refresh, navigationVersion]);
  const denied = error instanceof ApiError && [401,403].includes(error.status);
  return <section className="staff-dashboard" aria-label="Requester dashboard">
    <div className="d-flex flex-wrap justify-content-between gap-2 mb-3"><h1 className="h4">Requester Dashboard</h1>
      <button className="btn btn-zen-outline" onClick={() => setRefresh(v => v + 1)}>Refresh Dashboard</button></div>
    <p>Your Tickets only. Times are Asia/Bangkok (UTC+7). Recent activity covers the last 168 hours.</p>
    {error ? <div role="alert" className="alert alert-danger">{denied ? "Access denied. Sign in with a permitted Requester account." : "Unable to load dashboard. Counts are unavailable."}
      {!denied && <button className="btn btn-zen-outline ms-2" onClick={() => setRefresh(v => v + 1)}>Retry Dashboard</button>}</div>
      : !data ? <p role="status">Loading dashboard...</p> : <>
        <p role="status" className="small text-muted">Updated {time(data.generatedAt)}</p>
        <div className="row g-3 mb-4">{([
          ["activeTickets", "Active tickets"], ["waitingForYou", "Waiting for you"],
          ["resolvedLast7Days", "Resolved in last 7 days"], ["updatedLast7Days", "Updated in last 7 days"],
        ] as const).map(([key, title]) => <div className="col-12 col-sm-6 col-lg-3" key={key}>
          <button className="zen-card btn text-start h-100 w-100" onClick={() => onDrilldown(data.drilldowns[key])}>
            <span className="d-block">{title}</span><strong className="h3 d-block mb-0">{data.metrics[key]}</strong></button></div>)}</div>
        <p className="small">Recent resolution counts exclude older Tickets without a recorded resolution date. Those Tickets remain in My Tickets.</p>
        <section className="zen-card"><h2 className="h5">Recent Tickets</h2>
          <p className="small">Updated from {time(data.recentWindow.from)} (inclusive) to {time(data.recentWindow.to)} (exclusive).</p>
          {data.recentTickets.length ? <ul className="list-unstyled">{data.recentTickets.map(t => <li className="mb-3" key={t.id}>
            <p className="mb-1" style={{ overflowWrap: "anywhere" }}>{t.ticketNumber}: {t.summary}</p>
            <p className="small">{t.currentStatus.replaceAll("_", " ")} · {time(t.updatedAt)}</p>
            <button className="btn btn-zen-outline" onClick={() => onOpenTicket(t.id)} aria-label={`Open Ticket ${t.ticketNumber}`}>Open Ticket</button></li>)}</ul>
            : <p>No recently updated Tickets.</p>}
          <button className="btn btn-zen-outline" onClick={() => onDrilldown(data.drilldowns.recentTickets)}>View all recent Tickets</button>
        </section>
        <button className="btn btn-zen-primary mt-3" onClick={onCreate}>Create a Ticket</button>
      </>}
  </section>;
}
