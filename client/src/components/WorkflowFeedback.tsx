import { useEffect, useRef, useState } from 'react';
import { ApiError, type Ticket, type ResolutionBlockers } from '../api.js';

export const validWorkflowNumber = (value: number | undefined): value is number => Number.isInteger(value) && value! > 0 && value! <= 2147483647;
export const workflowLabel = (value: string) => ({ RESOLVED: 'Resolve', CLOSED: 'Close', REOPENED: 'Reopen', CANCELLED: 'Cancel', OPEN: 'Open', IN_PROGRESS: 'In Progress', WAITING_FOR_REQUESTER: 'Waiting for Requester' }[value] ?? value);

export function ResolutionSummary({ state }: { state?: Partial<ResolutionBlockers> }) {
  if (!state) return null;
  return <div className="small" aria-label="Resolution prerequisites">
    {state.eligibleOwner !== undefined && <p>Eligible primary owner: {state.eligibleOwner ? 'Yes' : 'No — assign an active IT Staff member or Administrator.'}</p>}
    {state.completedActions !== undefined && <p>Current-cycle completed Actions: {state.completedActions} (at least 1 required to resolve).</p>}
    {state.incompleteActions !== undefined && <p>Unfinished Actions: {state.incompleteActions} (must be 0 to resolve or cancel).</p>}
    {state.outstandingFollowUps !== undefined && <p>Outstanding completed-Action follow-ups: {state.outstandingFollowUps} (must be 0 to resolve).</p>}
  </div>;
}

// Explicit reload -> review -> resubmit. Reload never edits a caller's draft.
export function useWorkflowRecovery<T extends Ticket>(load: () => Promise<T>, display: (ticket: T) => void) {
  const [error, setError] = useState<Error | null>(null), [review, setReview] = useState(false);
  const [latest, setLatest] = useState<T | null>(null), [loading, setLoading] = useState(false), [pending, setPending] = useState(false);
  const busy = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const denied = error instanceof ApiError && [401,403,404].includes(error.status);
  const blocked = review || denied || loading;
  const fail = (failure: unknown) => {
    if (!alive.current) return;
    const e = failure instanceof Error ? failure : new Error('Unable to save Ticket changes.');
    setError(e); setLatest(null);
    setReview(!(e instanceof ApiError) || e.status === 409 || e.status >= 500);
  };
  return { error, latest, loading, pending, denied, review, blocked,
    begin: () => { if (busy.current || blocked) return false; busy.current = true; setPending(true); setError(null); return true; },
    end: () => { busy.current = false; if (alive.current) setPending(false); },
    fail,
    reload: async () => {
      if (busy.current || loading) return;
      busy.current = true;
      setLoading(true); setLatest(null);
      try { const fresh = await load(); if (alive.current) { setLatest(fresh); display(fresh); } }
      catch (e) { fail(e); }
      finally { busy.current = false; if (alive.current) setLoading(false); }
    },
    accept: () => { if (!latest || denied) return null; setReview(false); setError(null); setLatest(null); return latest; },
  };
}

export function WorkflowFeedback({ recovery, onReview }: {
  recovery: ReturnType<typeof useWorkflowRecovery>; onReview: () => void;
}) {
  const { error, review, latest, loading, denied } = recovery;
  if (!error && !review) return null;
  return <div className="alert alert-warning" role="alert">
    <p>{denied ? 'Access denied or Ticket unavailable. Return to a permitted Ticket list.' : error?.message}</p>
    {error instanceof ApiError && <ResolutionSummary state={error.details} />}
    {review && !denied && <>
      <p>Your inputs are retained. Reload the latest Ticket, review it, then submit explicitly. No changes have been retried automatically.</p>
      <button type="button" className="btn btn-zen-outline" disabled={loading} onClick={() => void recovery.reload()}>{loading ? 'Reloading workflow…' : 'Reload latest workflow'}</button>
      {latest && <div className="mt-2">
        <p>Latest Ticket: {latest.currentStatus}; work cycle {latest.workCycle}; IT Priority {latest.itPriority}.</p>
        {latest.resolutionSuggestedAt && <p>A Requester resolution indication is already recorded in this cycle.</p>}
        {'owner' in latest && <p>Latest owner: {(latest as Ticket & { owner?: { name: string } | null }).owner?.name ?? 'Unassigned'}.</p>}
        <ResolutionSummary state={latest.resolutionBlockers} />
        <button type="button" className="btn btn-zen-outline" onClick={onReview}>Use latest workflow after review</button>
      </div>}
    </>}
  </div>;
}
