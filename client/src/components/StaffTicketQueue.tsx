import { useEffect, useState } from "react";
import { Category, getCategories, getStaffTickets, StaffQueueParams, StaffQueueResponse, StaffTicketRow } from "../api.js";

const priorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const statuses = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"];
const label = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/^./, value => value.toUpperCase());
const statusClass = (status: string) => {
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
};
const initial = { search: "", status: "", categoryId: "", priority: "", itPriority: "", ownerMode: "", ownerId: "",
  sortBy: "createdAt", sortOrder: "desc", pageSize: "10" };
const ownerLabel = (row: StaffTicketRow) => row.owner ? `${row.owner.name} (${row.owner.role === "IT_STAFF" ? "IT Staff" : "Administrator"})${row.owner.isActive ? "" : " — inactive"}` : "Unassigned";
const updated = (row: StaffTicketRow) => new Date(row.updatedAt).toLocaleString();

export function StaffTicketQueue({ navigationVersion = 0, onOpenDetail }: { navigationVersion?: number; onOpenDetail?: (ticketId: number) => void }) {
  const [filters, setFilters] = useState(initial), [page, setPage] = useState(1), [refresh, setRefresh] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]), [categoryError, setCategoryError] = useState(false);
  const [result, setResult] = useState<StaffQueueResponse | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false), [selected, setSelected] = useState<StaffTicketRow | null>(null);
  useEffect(() => { setSelected(null); }, [navigationVersion]);
  useEffect(() => {
    let active = true;
    setCategoryError(false);
    getCategories().then(values => { if (active) setCategories(values); }).catch(() => { if (active) setCategoryError(true); });
    return () => { active = false; };
  }, [refresh]);
  const validation = filters.ownerMode === "id" && (!/^[1-9]\d*$/.test(filters.ownerId) || Number(filters.ownerId) > 2147483647)
    ? "Enter a valid Owner ID between 1 and 2147483647." : [...filters.search.trim()].length > 200 ? "Search must be 200 characters or fewer." : "";
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setResult(null); setError(""); setLoading(!validation);
    if (validation) return () => { active = false; controller.abort(); };
    // A short delay batches typing; cleanup invalidates in-flight results immediately.
    const timer = setTimeout(() => {
      const params: StaffQueueParams = { search: filters.search.trim(), status: filters.status, categoryId: filters.categoryId ? Number(filters.categoryId) : undefined,
        priority: filters.priority, itPriority: filters.itPriority, ownerId: filters.ownerMode === "unassigned" ? "unassigned" : filters.ownerMode === "id" ? Number(filters.ownerId) : undefined,
        sortBy: filters.sortBy, sortOrder: filters.sortOrder as "asc" | "desc", page, pageSize: Number(filters.pageSize) };
      getStaffTickets(params, controller.signal).then(value => { if (active) setResult(value); })
        .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Unable to load the Ticket Queue. Please try again."); })
        .finally(() => { if (active) setLoading(false); });
    }, 250);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [filters, page, refresh, validation, navigationVersion]);
  function change(key: keyof typeof initial, value: string) { setFilters(previous => ({ ...previous, [key]: value })); setPage(1); }
  const hasFilters = Boolean(filters.search.trim() || filters.status || filters.categoryId || filters.priority || filters.itPriority || filters.ownerMode);
  function select(key: keyof typeof initial, title: string, options: [string, string][], all = true) {
    return <label className="form-label mb-0" key={key}>{title}<select className="form-select mt-1" value={filters[key]} onChange={event => change(key, event.target.value)}>
      {all && <option value="">All</option>}{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>;
  }
  function open(row: StaffTicketRow) {
    if (onOpenDetail) onOpenDetail(row.id);
    else setSelected(row);
  }
  const openButton = (row: StaffTicketRow) => <button className="btn btn-outline-success" aria-label={`Open Detail ${row.ticketNumber}`} onClick={() => open(row)}>Open Detail</button>;

  if (selected) return <section className="zen-card staff-queue" aria-label="Ticket overview">
    <button className="btn btn-outline-secondary mb-3" onClick={() => setSelected(null)}>Back to Ticket Queue</button>
    <h1 className="h4">{selected.ticketNumber}</h1><h2 className="h5">{selected.summary}</h2>
    <p className="text-muted">Ticket overview from the queue. Return to the queue and refresh for the latest information.</p>
    <p style={{ whiteSpace: "pre-wrap" }}>{selected.description}</p>
    <dl className="row">
      {[["Requester", `${selected.requester.name} (${selected.requester.email})`], ["Category", selected.category.name],
        ["Related System", selected.relatedSystem.name], ["Requested Priority", label(selected.requestedPriority)],
        ["IT Priority", label(selected.itPriority)], ["Status", label(selected.currentStatus)], ["Owner", ownerLabel(selected)],
        ["Created", new Date(selected.createdAt).toLocaleString()], ["Last Updated", updated(selected)]].map(([key, value]) =>
        <div className="col-12 col-md-6" key={key}><dt>{key}</dt><dd>{key === "Status" ? <span className={statusClass(selected.currentStatus)}>{value}</span> : value}</dd></div>)}
    </dl>
  </section>;
  return <section className="staff-queue" aria-label="Staff Ticket Queue">
    <div className="zen-card mb-3"><h1 className="h4">IT Staff Ticket Queue</h1><p className="text-muted">Signed in as IT Staff.</p>
      <label className="form-label w-100">Search tickets<input className="form-control mt-1" type="search" value={filters.search}
        placeholder="Ticket number, summary or description" onChange={event => change("search", event.target.value)} /></label>
      <button className="btn btn-outline-secondary queue-filter-toggle mb-2" aria-expanded={expanded} aria-controls="queue-filters" onClick={() => setExpanded(!expanded)}>Filters and sorting</button>
      <div id="queue-filters" className={"queue-filters " + (expanded ? "is-open" : "")}>
        {select("status", "Status", statuses.map(value => [value, label(value)]))}
        {select("categoryId", "Category", categories.map(value => [String(value.id), value.name]))}
        {select("priority", "Requested Priority", priorities.map(value => [value, label(value)]))}
        {select("itPriority", "IT Priority", priorities.map(value => [value, label(value)]))}
        {select("ownerMode", "Owner", [["unassigned", "Unassigned"], ["id", "Owner ID"]])}
        {filters.ownerMode === "id" && <label className="form-label mb-0">Owner ID<input className="form-control mt-1" inputMode="numeric"
          value={filters.ownerId} aria-invalid={Boolean(validation)} onChange={event => change("ownerId", event.target.value)} /></label>}
        {select("sortBy", "Sort By", [["createdAt", "Created"], ["updatedAt", "Last Updated"], ["ticketNumber", "Ticket Number"],
          ["requestedPriority", "Requested Priority"], ["itPriority", "IT Priority"], ["currentStatus", "Status"]], false)}
        {select("sortOrder", "Direction", [["desc", "Descending"], ["asc", "Ascending"]], false)}
        {select("pageSize", "Page size", [["10", "10"], ["20", "20"], ["50", "50"]], false)}
      </div>
      <div className="d-flex flex-wrap gap-2 mt-3"><button className="btn btn-outline-secondary" onClick={() => { setFilters(initial); setPage(1); }}>Clear Filters</button>
        <button className="btn btn-outline-success" onClick={() => setRefresh(value => value + 1)}>Refresh Queue</button></div>
      {categoryError && <p role="alert" className="text-danger mt-2">Categories could not be loaded. Refresh Queue to retry.</p>}
    </div>
    {validation && <div className="alert alert-danger" role="alert">{validation}</div>}
    {loading && <p role="status">Loading Ticket Queue...</p>}
    {error && <div className="alert alert-danger" role="alert">{error}</div>}
    {result && !loading && !error && !validation && <>
      <p role="status">{result.pagination.totalItems} matching tickets</p>
      {result.data.length === 0 ? <div className="zen-card">{page > result.pagination.totalPages ? "No tickets on this page. Return to an earlier page."
        : hasFilters ? "No matching tickets. Try changing or clearing the filters." : "The shared Ticket Queue is empty."}</div>
        : <><div className="zen-card p-0 d-none d-lg-block"><table className="zen-table w-100 queue-table"><caption className="visually-hidden">Shared Ticket Queue</caption>
          <thead><tr>{["Ticket / Requester", "Category", "Priorities", "Status", "Owner", "Last Updated / Detail"].map(value => <th scope="col" key={value}>{value}</th>)}</tr></thead>
          <tbody>{result.data.map(row => <tr key={row.id}><td><strong>{row.ticketNumber}</strong><div>{row.summary}</div><small>{row.requester.name}</small></td>
            <td>{row.category.name}</td><td>Requested: {label(row.requestedPriority)}<br />IT: {label(row.itPriority)}</td>
            <td><span className={statusClass(row.currentStatus)}>{label(row.currentStatus)}</span></td><td>{ownerLabel(row)}</td>
            <td><time dateTime={row.updatedAt}>{updated(row)}</time><div className="mt-2">{openButton(row)}</div></td></tr>)}</tbody></table></div>
          <div className="d-lg-none queue-cards">{result.data.map(row => <article className="ticket-card" key={row.id}>
            <h2 className="h6">{row.ticketNumber}</h2><p className="fw-semibold">{row.summary}</p>
            <dl className="queue-card-metadata">{[["Requester", row.requester.name], ["Category", row.category.name], ["Requested Priority", label(row.requestedPriority)],
              ["IT Priority", label(row.itPriority)], ["Status", label(row.currentStatus)], ["Owner", ownerLabel(row)], ["Last Updated", updated(row)]].map(([key, value]) =>
              <div key={key}><dt>{key}</dt><dd>{key === "Status" ? <span className={statusClass(row.currentStatus)}>{value}</span> : value}</dd></div>)}</dl>{openButton(row)}</article>)}</div></>}
      <nav className="zen-pagination" aria-label="Queue pagination"><button className="zen-page-btn" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Previous Page</button>
        <span>Page {result.pagination.page} of {result.pagination.totalPages}</span>
        <button className="zen-page-btn" disabled={page >= result.pagination.totalPages} onClick={() => setPage(value => value + 1)}>Next Page</button></nav>
    </>}
  </section>;
}
