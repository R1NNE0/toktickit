import React, { useState, useEffect, useCallback } from "react";
import {
  Ticket,
  Category,
  getCategories,
  getTickets,
  PaginationMeta,
} from "../api.js";
import { useRequester } from "../context/RequesterContext.js";

interface MyTicketsProps {
  onNavigateCreate?: () => void;
  onSelectTicket?: (ticketId: number) => void;
}

export const MyTickets: React.FC<MyTicketsProps> = ({
  onNavigateCreate,
  onSelectTicket,
}) => {
  const { currentRequester } = useRequester();

  // Filter States
  const [search, setSearch] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedPriority, setSelectedPriority] = useState<string>("ALL");
  const [page, setPage] = useState<number>(1);
  const pageSize = 10;

  // Data States
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 10,
    totalItems: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset page on search change
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Load categories once
  useEffect(() => {
    let isMounted = true;
    getCategories()
      .then((cats) => {
        if (isMounted) setCategories(cats.filter((c) => c.isActive !== false));
      })
      .catch((err) => {
        console.error("Failed to load categories:", err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch tickets callback
  const fetchTickets = useCallback(async () => {
    if (!currentRequester) return;

    setLoading(true);
    setError(null);
    try {
      const categoryIdNum =
        selectedCategory !== "ALL" ? parseInt(selectedCategory, 10) : undefined;

      const res = await getTickets({
        search: debouncedSearch,
        status: selectedStatus,
        categoryId: categoryIdNum,
        priority: selectedPriority,
        page,
        pageSize,
        sortBy: "createdAt",
        sortOrder: "desc",
      });

      setTickets(res.data);
      setPagination(res.pagination);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to load support tickets";
      setError(msg);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [
    currentRequester,
    debouncedSearch,
    selectedStatus,
    selectedCategory,
    selectedPriority,
    page,
    pageSize,
  ]);

  // Refetch when filters or requester changes
  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Clear filters handler
  const handleClearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setSelectedStatus("ALL");
    setSelectedCategory("ALL");
    setSelectedPriority("ALL");
    setPage(1);
  };

  const hasActiveFilters =
    search.trim() !== "" ||
    selectedStatus !== "ALL" ||
    selectedCategory !== "ALL" ||
    selectedPriority !== "ALL";

  // Helpers for badge formatting
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

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return isoString;
    }
  };

  const activeAttachmentCount = (ticket: Ticket) => {
    if (!ticket.attachments) return 0;
    return ticket.attachments.filter((a) => !a.isRemoved).length;
  };

  return (
    <div className="my-tickets-container">
      {/* Top Banner / Actions */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <h2 className="h4 fw-bold mb-1" style={{ color: "var(--text-primary)" }}>
            My Support Tickets
          </h2>
          <p className="text-muted small mb-0">
            View, track, and monitor tickets submitted under your persona.
          </p>
        </div>
        {onNavigateCreate && (
          <div>
            <button
              type="button"
              className="btn btn-zen-primary d-inline-flex align-items-center gap-2"
              onClick={onNavigateCreate}
            >
              <span>➕</span>
              <span>Create Ticket</span>
            </button>
          </div>
        )}
      </div>

      {/* Filter and Search Bar Card */}
      <div className="zen-card mb-4">
        <div className="row g-3 align-items-end">
          {/* Search Input */}
          <div className="col-12 col-md-4">
            <label htmlFor="ticket-search-input" className="form-label small fw-semibold">
              Search
            </label>
            <input
              id="ticket-search-input"
              type="text"
              className="form-control"
              placeholder="Search by #, summary, description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search tickets"
            />
          </div>

          {/* Status Filter */}
          <div className="col-6 col-md-2">
            <label htmlFor="ticket-status-filter" className="form-label small fw-semibold">
              Status
            </label>
            <select
              id="ticket-status-filter"
              className="form-select"
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by status"
            >
              <option value="ALL">All Statuses</option>
              <option value="NEW">New</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="col-6 col-md-2">
            <label htmlFor="ticket-category-filter" className="form-label small fw-semibold">
              Category
            </label>
            <select
              id="ticket-category-filter"
              className="form-select"
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by category"
            >
              <option value="ALL">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id.toString()}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Priority Filter */}
          <div className="col-6 col-md-2">
            <label htmlFor="ticket-priority-filter" className="form-label small fw-semibold">
              Priority
            </label>
            <select
              id="ticket-priority-filter"
              className="form-select"
              value={selectedPriority}
              onChange={(e) => {
                setSelectedPriority(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by priority"
            >
              <option value="ALL">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>

          {/* Reset Filters */}
          <div className="col-6 col-md-2 d-flex justify-content-end">
            <button
              type="button"
              className="btn btn-zen-outline w-100"
              onClick={handleClearFilters}
              disabled={!hasActiveFilters}
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="alert alert-danger d-flex align-items-center justify-content-between mb-4" role="alert">
          <div>
            <strong>Error loading tickets:</strong> {error}
          </div>
          <button
            type="button"
            className="btn btn-sm btn-outline-danger"
            onClick={fetchTickets}
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Spinner State */}
      {loading ? (
        <div className="zen-card text-center py-5">
          <div
            className="spinner-border text-success mb-2"
            role="status"
            style={{ color: "var(--primary-green) !important" }}
          >
            <span className="visually-hidden">Loading tickets...</span>
          </div>
          <p className="text-muted small mb-0">Loading your tickets...</p>
        </div>
      ) : tickets.length === 0 ? (
        /* Empty States */
        <div className="zen-card text-center py-5">
          {hasActiveFilters ? (
            <div>
              <div style={{ fontSize: "2.5rem" }} className="mb-2">
                🔍
              </div>
              <h3 className="h5 fw-bold mb-2">No matching tickets found</h3>
              <p className="text-muted small mb-3">
                No tickets match your search or filter criteria. Try adjusting or clearing your filters.
              </p>
              <button
                type="button"
                className="btn btn-zen-outline"
                onClick={handleClearFilters}
              >
                Clear All Filters
              </button>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: "2.5rem" }} className="mb-2">
                📂
              </div>
              <h3 className="h5 fw-bold mb-2">No tickets submitted yet</h3>
              <p className="text-muted small mb-3">
                You haven&apos;t created any support tickets yet. Need help with hardware, software, or account access?
              </p>
              {onNavigateCreate && (
                <button
                  type="button"
                  className="btn btn-zen-primary"
                  onClick={onNavigateCreate}
                >
                  Create Your First Ticket
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Ticket Data Display */
        <div>
          {/* Desktop & Tablet Table View (>= 768px) */}
          <div className="d-none d-md-block zen-table-wrapper mb-3">
            <table className="zen-table">
              <thead>
                <tr>
                  <th style={{ width: "160px" }}>Ticket #</th>
                  <th>Summary</th>
                  <th>Category</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Files</th>
                  <th>Created</th>
                  <th style={{ width: "100px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => {
                  const attachCount = activeAttachmentCount(t);
                  return (
                    <tr key={t.id}>
                      <td>
                        <strong
                          style={{
                            fontFamily: "SFMono-Regular, Consolas, monospace",
                            color: "var(--primary-green)",
                          }}
                        >
                          {t.ticketNumber}
                        </strong>
                      </td>
                      <td>
                        <div className="fw-semibold text-truncate" style={{ maxWidth: 300 }}>
                          {t.summary}
                        </div>
                      </td>
                      <td>
                        <span className="badge bg-light text-dark border">
                          {t.category?.name || "General"}
                        </span>
                      </td>
                      <td>
                        <span className={getPriorityBadgeClass(t.requestedPriority)}>
                          {t.requestedPriority}
                        </span>
                      </td>
                      <td>
                        <span className={getStatusBadgeClass(t.currentStatus)}>
                          {t.currentStatus.replace("_", " ")}
                        </span>
                      </td>
                      <td>
                        {attachCount > 0 ? (
                          <span
                            className="badge"
                            style={{
                              backgroundColor: "var(--pale-green)",
                              color: "var(--primary-green)",
                              fontWeight: 500,
                            }}
                          >
                            📎 {attachCount}
                          </span>
                        ) : (
                          <span className="text-muted small">-</span>
                        )}
                      </td>
                      <td>
                        <span className="small text-muted">{formatDate(t.createdAt)}</span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => onSelectTicket && onSelectTicket(t.id)}
                          title="View Details"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View (< 768px) */}
          <div className="d-md-none mb-3">
            {tickets.map((t) => {
              const attachCount = activeAttachmentCount(t);
              return (
                <div key={t.id} className="ticket-card">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <strong
                      style={{
                        fontFamily: "SFMono-Regular, Consolas, monospace",
                        color: "var(--primary-green)",
                      }}
                    >
                      {t.ticketNumber}
                    </strong>
                    <span className={getStatusBadgeClass(t.currentStatus)}>
                      {t.currentStatus.replace("_", " ")}
                    </span>
                  </div>

                  <h3 className="h6 fw-bold mb-2 text-truncate">{t.summary}</h3>

                  <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
                    <span className="badge bg-light text-dark border">
                      {t.category?.name || "General"}
                    </span>
                    <span className={getPriorityBadgeClass(t.requestedPriority)}>
                      {t.requestedPriority}
                    </span>
                    {attachCount > 0 && (
                      <span
                        className="badge"
                        style={{
                          backgroundColor: "var(--pale-green)",
                          color: "var(--primary-green)",
                        }}
                      >
                        📎 {attachCount}
                      </span>
                    )}
                    <span className="small text-muted ms-auto">
                      {formatDate(t.createdAt)}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="btn btn-sm btn-zen-outline w-100"
                    onClick={() => onSelectTicket && onSelectTicket(t.id)}
                  >
                    View Details
                  </button>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          <div className="zen-pagination">
            <div className="small text-muted">
              Showing{" "}
              <strong>
                {pagination.totalItems === 0
                  ? 0
                  : (pagination.page - 1) * pagination.pageSize + 1}
              </strong>{" "}
              to{" "}
              <strong>
                {Math.min(
                  pagination.page * pagination.pageSize,
                  pagination.totalItems
                )}
              </strong>{" "}
              of <strong>{pagination.totalItems}</strong> tickets
            </div>

            <div className="d-flex gap-1 align-items-center">
              <button
                type="button"
                className="zen-page-btn"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pagination.page <= 1}
                aria-label="Previous Page"
              >
                &larr; Prev
              </button>

              {Array.from({ length: pagination.totalPages }, (_, idx) => idx + 1).map(
                (pageNum) => (
                  <button
                    key={pageNum}
                    type="button"
                    className={`zen-page-btn ${
                      pageNum === pagination.page ? "active" : ""
                    }`}
                    onClick={() => setPage(pageNum)}
                    aria-label={`Page ${pageNum}`}
                    aria-current={pageNum === pagination.page ? "page" : undefined}
                  >
                    {pageNum}
                  </button>
                )
              )}

              <button
                type="button"
                className="zen-page-btn"
                onClick={() =>
                  setPage((p) => Math.min(pagination.totalPages, p + 1))
                }
                disabled={pagination.page >= pagination.totalPages}
                aria-label="Next Page"
              >
                Next &rarr;
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
