import type { ActionRecord, ActionSnapshot } from "../actions-api.js";
import { actionDate, actionLabel, eligible } from "../action-ui.js";

export function ActionDetails({ action }: { action: ActionRecord | ActionSnapshot }) {
  const live = "assignee" in action;
  return <div className="action-details">
    <p className="action-text">{action.description}</p>
    <dl className="action-facts">
      <div><dt>Status</dt><dd><span className={`badge-status action-status-${action.status.toLowerCase()}`}>{actionLabel(action.status)}</span></dd></div>
      <div><dt>Assignee</dt><dd>{live ? action.assignee.name : `User #${action.assigneeId}`}{live && !eligible(action.assignee) && " — Unavailable; reassignment needed"}</dd></div>
      <div><dt>Created by</dt><dd>{live ? action.createdBy.name : `User #${action.createdById}`}</dd></div>
      <div><dt>Performed by</dt><dd>{live ? action.performedBy?.name ?? "Not yet performed" : action.performedById ? `User #${action.performedById}` : "Not yet performed"}</dd></div>
      <div><dt>Created</dt><dd>{actionDate(action.createdAt)}</dd></div>
      <div><dt>Last updated</dt><dd>{actionDate(action.updatedAt)}</dd></div>
      <div><dt>Completed</dt><dd>{actionDate(action.completedAt)}</dd></div>
      <div><dt>Cancelled</dt><dd>{actionDate(action.cancelledAt)}</dd></div>
      <div><dt>Result</dt><dd className="action-text">{action.result ?? "No result recorded"}</dd></div>
      <div><dt>Follow-up required</dt><dd>{action.followUpRequired ? "Yes" : "No"}</dd></div>
      <div><dt>Follow-up note</dt><dd className="action-text">{action.followUpNote ?? "None"}</dd></div>
      <div><dt>Attachment notes</dt><dd className="action-text">{action.attachmentNotes ?? "None"}</dd></div>
      {action.cancellationReason && <div><dt>Cancellation reason</dt><dd className="action-text">{action.cancellationReason}</dd></div>}
    </dl>
  </div>;
}
