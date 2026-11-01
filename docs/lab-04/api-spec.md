# Lab 4 REST API Contract

Status: **Planned contract; endpoints and changes below are not implemented or executed in Phase 2B.** Date: 2026-10-27 (Asia/Bangkok). Baseline: `abcfbbf`.

Policy authority: [specification.md](specification.md), especially BR-01–BR-42 and ED-02–ED-13. Companions: [UI](ui-spec.md), [test plan](tests.md). REQUIRED capabilities come from handout §§4–6 and 8; exact routes, DTOs, bounds and conflict protocol are engineering decisions. Existing routes remain except the explicitly versioned request additions and approved operational reads below.

## 1. Common Protocol

- Existing opaque cookie session, active account and completed mandatory password change are required. Keep `server/src/auth/http.ts`/`auth-client.ts` behavior; no bearer-token or client-supplied Requester identity scheme.
- All writes use existing Origin and X-CSRF-Token checks before side effects. Existing mutation middleware covers the proposed `/api/tickets` and `/api/staff` routes. Dashboards are authenticated GETs with their own role checks.
- All new/changed private responses set `Cache-Control: no-store`. JSON is UTF-8. Dates are ISO-8601 UTC strings with millisecond precision. Null is explicit for nullable response fields.
- IDs/versions/cycles are positive integers <= 2147483647; JSON IDs must be numbers, not numeric strings. Path/query numeric values are canonical positive decimal strings. No floating point/exponents/overflow. Query aliases retain their existing documented behavior.
- Reject unknown keys, arrays/nested objects in scalar query fields, unexpected server-owned body fields, malformed JSON and invalid types. Preserve the existing 128 KB JSON body limit; excess returns 413.
- Trim text and count Unicode code points. Nullable optional text normalizes empty/whitespace-only to null; required text cannot be null. Plain text is rendered literally, never interpreted as HTML.
- Authenticate first; enforce role before resource disclosure; then validate parent/child access. A nonexistent or another Requester's Ticket/action, or action under a different path Ticket, yields the same 404 NOT_FOUND. Staff/Admin history reads are explicit; Requesters get 403 for history regardless of ownership.
- No response may expose password hashes, sessions, storage paths, request fingerprints or Internal Notes in action/dashboard projections. Actor references contain only the fields below.

## 2. Canonical DTOs

The following TypeScript notation describes the wire contract, not source files to create in this phase. All properties are required unless marked `?`.

```ts
type Role = "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";
type ActionStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
type TicketStatus = "NEW" | "OPEN" | "IN_PROGRESS" | "WAITING_FOR_REQUESTER"
  | "RESOLVED" | "CLOSED" | "REOPENED" | "CANCELLED";
type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
type Instant = string; // ISO UTC timestamp
type UserRef = { id: number; name: string; role: Role; isActive: boolean };
type Pagination = { page: number; pageSize: number; totalItems: number; totalPages: number };
type Page<T> = { data: T[]; pagination: Pagination };
type WorkflowMeta = {
  id: number; workflowVersion: number; workCycle: number; updatedAt: Instant;
};
type Action = {
  id: number; ticketId: number; cycle: number; status: ActionStatus;
  description: string; result: string | null;
  assignee: UserRef; createdBy: UserRef; performedBy: UserRef | null;
  followUpRequired: boolean; followUpNote: string | null; attachmentNotes: string | null;
  createdAt: Instant; updatedAt: Instant; completedAt: Instant | null;
  cancelledAt: Instant | null; cancellationReason: string | null; version: number;
};
type ActionMutation = { action: Action; ticket: WorkflowMeta; replayed: boolean };
type RevisionOperation = "CREATE" | "EDIT" | "REASSIGN" | "START" | "COMPLETE" | "CANCEL";
type ActionSnapshot = Omit<Action, "assignee" | "createdBy" | "performedBy"> & {
  assigneeId: number; createdById: number; performedById: number | null;
};
type Revision = {
  id: number; actionId: number; version: number; operation: RevisionOperation;
  actor: UserRef; occurredAt: Instant; changeReason: string | null; snapshot: ActionSnapshot;
};
type ResolutionBlockers = {
  eligibleOwner: boolean; completedActions: number;
  incompleteActions: number; outstandingFollowUps: number;
};
type TransitionBlocker = "OWNER_REQUIRED" | "COMPLETED_ACTION_REQUIRED"
  | "ACTIONS_INCOMPLETE" | "FOLLOW_UP_REQUIRED";
type TransitionOption = {
  to: TicketStatus; requiresConfirmation: boolean; requiresReason: boolean;
  enabled: boolean; blockers: TransitionBlocker[];
};
```

User names/role/active labels reflect current profiles; snapshot identity IDs and actor IDs are immutable attribution. No email is needed in these references. `performedBy=null` means not completed, never anonymous work. A former staff member may now have another role; historical attribution must still render honestly.

General/Staff Ticket detail responses retain their existing fields and add `workflowVersion`, `workCycle`, `resolvedAt`, `permittedTransitions: TransitionOption[]`, and `resolutionBlockers: ResolutionBlockers`. Requesters/Admin have an empty permittedTransitions array because formal Ticket status is Staff-only. Staff receive only edges from the current source; disabled edges identify current business blockers. Confirmation/reason inputs are still checked on submission. These DTO fields are advisory snapshots, not authorization grants. List rows add workflowVersion/workCycle/resolvedAt but do not need transition/gate computations for every row. Mutation responses returning detail use the same projection.

## 3. Action Routes

| Method/path | Authorized roles | Request | Success |
|---|---|---|---|
| GET `/api/tickets/:ticketId/actions` | Own Requester; Staff/Admin any accessible Ticket | Pagination, optional `cycle` | 200 `Page<Action>` |
| GET `/api/tickets/:ticketId/actions/:actionId` | Same | No query/body | 200 `Action` |
| POST `/api/tickets/:ticketId/actions` | Staff/Admin | CreateAction | 201 `ActionMutation`, Location; exact replay 200 |
| PATCH `/api/tickets/:ticketId/actions/:actionId` | Staff/Admin | EditAction | 200 `ActionMutation` |
| POST `/api/tickets/:ticketId/actions/:actionId/transitions` | Staff/Admin; start/complete must be current assignee | TransitionAction | 200 `ActionMutation` |
| GET `/api/tickets/:ticketId/actions/:actionId/history` | Staff/Admin only | Pagination | 200 `Page<Revision>` |
| GET `/api/staff/actions` | Staff/Admin only | `assigneeId=me`, `state=outstanding`, pagination | 200 `Page<ActionSummary>` |

Other methods on the recognized action resource, including DELETE, return 405 METHOD_NOT_ALLOWED after normal security checks. There is no hard-delete/edit-history endpoint. Do not invent a PATCH route for revisions. Cancelling is a lifecycle operation, not soft deletion of visibility.

### 3.1 Read ordering and pagination

Action/history/outstanding lists default page=1, pageSize=20; allow 10/20/50. Reject invalid/overflowing offsets. totalPages=max(1,ceil(totalItems/pageSize)); a valid page beyond the end returns [] with accurate metadata, not a clamped page. Parent not found remains 404 even if it would have an empty child list.

Omitting `cycle` returns Ticket actions from all cycles and statuses, including cancelled. Providing a valid positive `cycle` filters Actions to that cycle, still including all statuses. If the specified cycle contains no matching Actions, return an empty paginated result (`data=[]`, `totalItems=0`, `totalPages=1`, with the requested/default page and pageSize retained). Authorization and parent-not-found checks still apply. Order `cycle ASC, createdAt ASC, id ASC`. History order `version ASC`. Outstanding list requires exactly `assigneeId=me&state=outstanding`, resolves me from the session, includes PLANNED/IN_PROGRESS assigned to that actor, and joins ACTIVE parents whose workCycle equals action.cycle. Order `createdAt ASC,id ASC`. No arbitrary other-assignee query is added. Return totals and rows from a consistent read snapshot within each paginated response.

### 3.2 CreateAction

```ts
type CreateAction = {
  clientRequestId: string; // canonical UUID; client keeps it across exact retries
  expectedWorkflowVersion: number;
  description: string;
  assigneeId?: number; // omitted -> authenticated creator
  result?: string | null; // omitted -> null
  followUpRequired?: boolean; // omitted -> false
  followUpNote?: string | null; // omitted -> null
  attachmentNotes?: string | null; // omitted -> null
};
```

Description 1–4000; result <=4000; notes <=2000. A true followUpRequired requires nonblank followUpNote. Assignee must be active Staff/Admin. Server derives Ticket/cycle, creator, PLANNED status, times and version=1. Reject `performedById`, `createdById`, `cycle`, `status`, timestamps and all unknown body fields. Parent must be ACTIVE except for authorized exact replays. Creation returns Location `/api/tickets/{ticketId}/actions/{id}`; both fresh and replay responses use the full ActionMutation shape. Fresh creates have replayed=false; exact replay has true and returns the current action/parent metadata, not a frozen initial response.

Canonical fingerprint is SHA-256 of a fixed-key-order UTF-8 JSON object containing ticketId, description, resolved assigneeId, result, followUpRequired, followUpNote and attachmentNotes after normalization. Exclude expectedWorkflowVersion/clientRequestId. `(createdById,clientRequestId)` is unique across Tickets. Authenticate/authorize, normalize/validate shape, then check an existing key before new-write state/version guards. A matching fingerprint replays even when the parent is now terminal or another cycle; a changed fingerprint gives 409 IDEMPOTENCY_KEY_REUSED. Do not require an originally eligible assignee to still be eligible merely to replay a non-write. A new create always validates current eligibility. Unique-key collision handling must perform rollback before lookup/replay; it may not continue inside an aborted transaction.

### 3.3 EditAction

```ts
type EditAction = {
  expectedVersion: number; expectedWorkflowVersion: number;
  description?: string; result?: string | null; assigneeId?: number;
  followUpRequired?: boolean; followUpNote?: string | null;
  attachmentNotes?: string | null; changeReason?: string;
};
```

Require at least one editable field (a changeReason alone is not an edit). Omitted fields preserve their current values. Explicit null clears nullable text only. Validate the resulting full state, not just submitted fields. Parent must be ACTIVE and action in its current cycle; versions must match before no-op comparison.

- PLANNED/IN_PROGRESS: edit any listed content or assignee; assignee change retains status and requires eligible new target. Existing unavailable assignee does not prevent unrelated content editing or cancellation.
- COMPLETED: only description/result/follow-up/attachmentNotes; reject assigneeId even if unchanged. Nonblank changeReason required for actual corrections; result must remain nonblank. A current-version true no-op returns current state without revision/timestamp/version changes.
- CANCELLED: read-only.
- Any actual edit with a changed assignee records REASSIGN; otherwise EDIT. Optional provided changeReason must be 1–4000; retain it on the revision. Store completed correction reason there, not as a separate Public Comment.

200 ActionMutation has replayed=false even for an edit no-op (only create uses replayed=true). No generic mutation-idempotency service is introduced.

### 3.4 TransitionAction

Every variant requires expectedVersion and expectedWorkflowVersion. Discriminated allowed bodies:

```ts
type TransitionAction =
  | { targetStatus: "IN_PROGRESS"; expectedVersion: number; expectedWorkflowVersion: number }
  | { targetStatus: "COMPLETED"; expectedVersion: number; expectedWorkflowVersion: number;
      result: string; followUpRequired: boolean; followUpNote?: string | null;
      attachmentNotes?: string | null }
  | { targetStatus: "CANCELLED"; expectedVersion: number; expectedWorkflowVersion: number;
      confirmed: true; reason: string };
```

No target PLANNED. Start: PLANNED only and actor=eligible assignee. Complete: IN_PROGRESS only and actor=eligible assignee; result 1–4000 and explicit followUpRequired; omitted optional notes preserve current values, with conditional validation on the resulting state. Set performer/complete time automatically, never from input. Cancel: PLANNED/IN_PROGRESS only, Staff/Admin, confirmed=true and reason 1–4000; set cancelledAt/reason. Cancellation preserves result/notes/assignee but leaves performer/completedAt null. No actual delete. Unknown fields for a variant are rejected.

### 3.5 History

Revision snapshots have all Action scalar fields and identity IDs, no resolved user objects, request key/hash or derived permissions. CREATE revision version=1. For CANCEL, revision.changeReason equals cancellation reason; START/COMPLETE/CREATE use null; EDIT/REASSIGN use the supplied reason or null when permitted. Multiple field changes in one request yield one revision. Failed writes append none. History response authorizes Staff/Admin explicitly; it is not embedded in Requester detail/dashboard responses.

## 4. Existing Ticket APIs: Deliberate Increments

| Method/path | Roles | Exact body increment | Success |
|---|---|---|---|
| POST `/api/staff/tickets/:id/claim` | Staff | `{expectedWorkflowVersion}` | 200 existing detail plus additive workflow fields |
| PATCH `/api/staff/tickets/:id/owner` | Staff | `{ownerId: number \| null, expectedWorkflowVersion}` | 200 detail |
| PATCH `/api/staff/tickets/:id/priority` | Staff/Admin | `{itPriority: Priority, expectedWorkflowVersion}` | 200 detail |
| PATCH `/api/staff/tickets/:id/status` | Staff | `{currentStatus: TicketStatus, expectedWorkflowVersion, confirmed?: boolean, reason?: string}` | 200 detail |
| POST `/api/tickets/:id/resolution-indication` | Own Requester | `{expectedCycle}` | 200 ResolutionIndication |

All shown fields are required except `?`. Reject additional keys. Missing versions/cycle are 400, not silently last-writer-wins. Confirm must equal true on required edges; reason required only on Ticket cancel/reopen and, if supplied, must be valid 1–4000 text. A reason on an edge not requiring one is rejected to avoid implying an unsaved audit note. A boolean confirmation on other edges has no effect on policy. Owner null unassigns; eligible owner remains active Staff/Admin. No-op owner/priority preserves metadata after current-version checks. Claim on an already assigned Ticket with current version returns 409 ALREADY_ASSIGNED; stale version takes precedence after resource authorization. Requested Priority cannot be changed through IT Priority.

```ts
type ResolutionIndication = {
  ticketId: number; currentStatus: TicketStatus;
  resolutionSuggestedAt: Instant; resolutionSuggestedById: number;
  workflowVersion: number; workCycle: number;
};
```

Indication locks parent; mismatched expectedCycle -> TICKET_CYCLE_CONFLICT; terminal state -> TICKET_NOT_ACTIVE; same active cycle already indicated -> 200 unchanged; otherwise set advisory fields and parent timestamp/version. Does not mutate status. General detail retains nullable advisory fields.

Ticket status follows the complete matrix in specification §8. Staff-only authority remains even for assigned Administrators. Resolution checks owner and current-cycle completed/unfinished/follow-up work atomically; violation -> RESOLUTION_BLOCKED with the full ResolutionBlockers object. Entering progress with no eligible owner -> OWNER_REQUIRED. Cancellation with unfinished work -> ACTIONS_INCOMPLETE with count. Reopen increments cycle, clears current resolvedAt and both advisory fields. Successful cancel/reopen appends exactly one existing Public Comment carrying reason in the same transaction. Closing historical resolved zero-action Tickets remains permitted.

GET `/api/staff/tickets`, GET `/api/staff/tickets/:id`, and GET `/api/staff/assignees` now admit Staff/Admin. Assignee response retains existing active Staff/Admin references; default behavior is not a new public user directory. General detail reads/IT Priority were already permitted for Admin. Claim/owner/status, Public Comment/Internal Note posting and attachment byte operations remain denied to Admin.

## 5. Dashboard DTOs and Routes

| Method/path | Roles | Query/body | Success |
|---|---|---|---|
| GET `/api/dashboard/requester` | Requester only | None; reject any query/body ownership override | 200 RequesterDashboard |
| GET `/api/dashboard/staff` | Staff/Admin | None; reject arbitrary identity/window input | 200 StaffDashboard |

```ts
type TicketSummary = {
  id: number; ticketNumber: string; summary: string; currentStatus: TicketStatus;
  requestedPriority: Priority; itPriority: Priority; owner: UserRef | null;
  updatedAt: Instant; resolvedAt: Instant | null;
};
type ActionSummary = {
  id: number; ticketId: number; cycle: number; status: "PLANNED" | "IN_PROGRESS";
  descriptionExcerpt: string; createdAt: Instant;
  ticket: { id: number; ticketNumber: string; summary: string; currentStatus: TicketStatus };
};
type ListFilters = {
  status?: TicketStatus; statusGroup?: "active" | "resolved";
  ownerId?: "unassigned" | "me"; itPriority?: Priority;
  updatedFrom?: Instant; updatedTo?: Instant; resolvedFrom?: Instant; resolvedTo?: Instant;
  sortBy?: "createdAt" | "updatedAt"; sortOrder?: "asc" | "desc";
};
type Drilldown =
  | { view: "my-tickets" | "staff-queue"; filters: ListFilters }
  | { view: "my-actions"; filters: { assigneeId: "me"; state: "outstanding" } };
type DashboardBase = {
  generatedAt: Instant; timezone: "Asia/Bangkok";
  recentWindow: { from: Instant; to: Instant }; recentTickets: TicketSummary[];
};
type RequesterDashboard = DashboardBase & {
  metrics: { activeTickets: number; waitingForYou: number;
    resolvedLast7Days: number; updatedLast7Days: number };
  drilldowns: { activeTickets: Drilldown; waitingForYou: Drilldown;
    resolvedLast7Days: Drilldown; updatedLast7Days: Drilldown; recentTickets: Drilldown };
};
type StaffDashboard = DashboardBase & {
  metrics: { unassignedActiveTickets: number; myActiveTickets: number;
    ticketsByStatus: Record<TicketStatus, number>;
    activeTicketsByItPriority: Record<Priority, number>; myOutstandingActions: number };
  myActions: { total: number; items: ActionSummary[] };
  drilldowns: { unassignedActiveTickets: Drilldown; myActiveTickets: Drilldown;
    ticketsByStatus: Record<TicketStatus, Drilldown>;
    activeTicketsByItPriority: Record<Priority, Drilldown>;
    myOutstandingActions: Drilldown; recentTickets: Drilldown };
};
```

All counts are nonnegative JSON integers. `myActions.total` equals metrics.myOutstandingActions, not preview length. Both previews are at most five rows. Action excerpt is the first 200 Unicode code points of description, without raw HTML; full text is on detail. Each recent row opens existing Ticket Detail by id; each action row additionally selects the Actions area/action ID. No arbitrary URL in a drilldown object. Requester responses never contain other Requesters' data, notes, user counts or myActions. Staff and Admin receive the same shape, with personal predicates evaluated using their own session ID.

### 5.1 Exact metric-to-filter mapping

Use definitions/predicates in specification §10. `from`/`to` below are the exact recentWindow strings returned, not recomputed in the client. Keys identify the matching descriptor:

| Key | View | Filters |
|---|---|---|
| R activeTickets | my-tickets | statusGroup=active |
| R waitingForYou | my-tickets | status=WAITING_FOR_REQUESTER |
| R resolvedLast7Days | my-tickets | statusGroup=resolved, resolvedFrom=from, resolvedTo=to |
| R updatedLast7Days / recentTickets | my-tickets | updatedFrom=from, updatedTo=to, sortBy=updatedAt, sortOrder=desc |
| S/A unassignedActiveTickets | staff-queue | statusGroup=active, ownerId=unassigned |
| S/A myActiveTickets | staff-queue | statusGroup=active, ownerId=me |
| S/A ticketsByStatus[status] | staff-queue | status=selected bucket |
| S/A activeTicketsByItPriority[priority] | staff-queue | statusGroup=active, itPriority=selected bucket |
| S/A myOutstandingActions | my-actions | assigneeId=me, state=outstanding |
| S/A recentTickets | staff-queue | updatedFrom=from, updatedTo=to, sortBy=updatedAt, sortOrder=desc |

RecentTicket sort is updatedAt DESC,id DESC. Outstanding preview/list is createdAt ASC,id ASC. Counts and bucket maps have no inherent chronological ordering; render status buckets in the existing eight-status order and priority buckets LOW,MEDIUM,HIGH,CRITICAL. Default drill-down lists without explicit sorting keep existing createdAt DESC,id DESC. Empty responses use zeros/complete maps/[]; failures use error responses, never synthetic zeros.

### 5.2 Compatible Ticket list filters

Existing GET `/api/tickets` remains Requester-only, scoped by session. GET `/api/staff/tickets` gains Admin reads, retaining search/category/status/requested-priority/IT-priority/owner/sort/page behavior and legacy pagination response aliases.

Add `statusGroup=active|resolved`; cannot combine it with either status/currentStatus, even if they would be compatible. Active expands to the five ACTIVE statuses; resolved expands to RESOLVED,CLOSED. Add paired `updatedFrom`/`updatedTo` and paired `resolvedFrom`/`resolvedTo`. Both values must be valid ISO timestamps with explicit timezone, normalized to UTC, from<to; each supplied lower/upper pair is mandatory together. Use [from,to). Resolved bounds additionally require statusGroup=resolved or a single status of RESOLVED/CLOSED. Updated and resolved ranges may combine using AND. Existing APIs continue accepting their valid legacy aliases; contradicting aliases fail as before.

Staff ownerId now additionally accepts `me` -> authenticated user ID, besides numeric ID/unassigned. Requester endpoint rejects ownerId/itPriority and identity overrides as before. Existing page sizes remain Requester 5/8/10/20/50 and Queue 10/20/50; omitted size 10, omitted page 1. All lists retain deterministic ID tie-breaks and safe invalid-query rejection. Dashboard typed ListFilters is a limited descriptor subset, not a replacement for the broader existing search/sort contract.

### 5.3 Aggregation boundaries

Use one repeatable-read transaction and one captured database asOf/generatedAt/recentWindow.to. Compare existing timestamp-without-time-zone Ticket.updatedAt using explicit UTC parameters. Aggregate authoritative rows using parameterized SQL or equivalent Prisma predicates; no full Ticket collection transfer. Query count is bounded independently of matching row count. Personal predicates always derive from session; implement current-cycle outstanding comparison in the database. Later drill-down is live, not a retained database snapshot.

## 6. Transaction and Conflict Contract

BR-24–BR-28 are mandatory across every new relevant writer. Shared eligibility advisory lock first, then parent Ticket FOR UPDATE; relevant account changes use the same key exclusively and ascending Ticket ID lock order. After locks, recheck actor/role/session/owner/assignee as needed; verify parent/child identity and expected versions, validate resulting state/gate, apply field changes/revision/reason and increments atomically. Parent lock is held through action insert/edit so resolution cannot miss concurrent Actions. True no-ops do not change metadata; stale requests conflict before no-op handling.

Exceptions: exact authorized create replay is checked before new-write version/terminal checks; advisory indication uses cycle rather than expectedWorkflowVersion. Action current-cycle and parent-state failures remain conflicts even when the operation is superficially a no-op. Account deactivation preserves current action assignment but unassigns owned Tickets and increments versions; start/complete require recovery if the assignee is no longer eligible. Comments/notes/attachments retain their own established concurrency behavior and do not bump workflowVersion.

Check stale Ticket version before stale action version when both disagree; response may include both current versions, enabling one reload. New ineligible assignee input -> 400 INELIGIBLE_ASSIGNEE; unchanged unavailable assignee on start/complete -> 409 ACTION_ASSIGNEE_UNAVAILABLE; eligible non-assignee attempting start/complete -> 403 ACTION_ASSIGNEE_REQUIRED. Completion must not silently reassign to the actor.

## 7. Error Mapping

```ts
type ApiFailure = {
  code: string; error: string;
  details?: { fields?: Record<string, string>;
    eligibleOwner?: boolean; completedActions?: number;
    incompleteActions?: number; outstandingFollowUps?: number };
  currentWorkflowVersion?: number; currentActionVersion?: number; currentCycle?: number;
};
```

| HTTP | Code | Meaning |
|---|---|---|
| 400 | VALIDATION_ERROR / INVALID_ID / INVALID_QUERY | Invalid body/field/path/filter/version type; conditional inputs absent |
| 400 | INELIGIBLE_ASSIGNEE | New assignment target nonexistent, inactive or not Staff/Admin; no personal directory details |
| 401 | UNAUTHENTICATED | Missing/expired/revoked session |
| 403 | FORBIDDEN / PASSWORD_CHANGE_REQUIRED / CSRF_INVALID | Existing access/password/Origin-CSRF protections |
| 403 | ACTION_ASSIGNEE_REQUIRED | Eligible actor is not current action assignee for start/complete |
| 404 | NOT_FOUND | Safe missing/ownership/parent-child mismatch |
| 405 | METHOD_NOT_ALLOWED | Unsupported recognized action-resource operation |
| 409 | TICKET_VERSION_CONFLICT / ACTION_VERSION_CONFLICT | Stale expected version; return authorized current versions |
| 409 | TICKET_CYCLE_CONFLICT | Old-cycle mutation/indication; include currentCycle |
| 409 | TICKET_NOT_ACTIVE / ACTION_READ_ONLY | Terminal parent or forbidden terminal-action edit |
| 409 | INVALID_TRANSITION | Disallowed/self action or Ticket transition |
| 409 | RESOLUTION_BLOCKED | Full resolution predicate failed; details has all four ResolutionBlockers fields |
| 409 | ACTIONS_INCOMPLETE | Ticket cancellation has unfinished work; details.incompleteActions |
| 409 | OWNER_REQUIRED / ALREADY_ASSIGNED | Progress owner guard / current-version claim conflict |
| 409 | ACTION_ASSIGNEE_UNAVAILABLE | Existing assignee cannot start/complete while ineligible |
| 409 | IDEMPOTENCY_KEY_REUSED | Create key reused with changed semantics |
| 409 | CONCURRENT_UPDATE | Contention persists after at most two rolled-back transaction retries; reload/retry |
| 413 | PAYLOAD_TOO_LARGE | Existing JSON/file size limits |
| 500 | INTERNAL_ERROR | Safe unexpected failure; no SQL/stack/secret leakage |

Existing authentication throttling 429 and attachment/user-specific errors remain documented in [Lab 3 API](../lab-03/api-spec.md). New body validation includes approved field associations; unknown input is not echoed. Error examples are contract examples, not executed evidence.

Example failed resolution:

```json
{
  "code": "RESOLUTION_BLOCKED",
  "error": "Complete the remaining work before resolving this ticket.",
  "details": {
    "eligibleOwner": true,
    "completedActions": 1,
    "incompleteActions": 2,
    "outstandingFollowUps": 1
  },
  "currentWorkflowVersion": 14
}
```

## 8. Compatibility and Implementation Boundaries

- Preserve all approved authentication/reference/Requester creation/general detail/discussion/attachment/user-management endpoints and response fields unless listed here. No public requester directory restoration.
- Required expected versions/cycle are deliberate incompatible mutation-input changes within this coordinated course release. Update client, API examples and all relevant test callers together; do not accept omitted versions as an undocumented fallback. Old open tabs get a safe validation/conflict response and refresh guidance.
- Preserve comment/note append-only semantics, attachment metadata/bytes/soft removal, Requester isolation, user safety/revocation and Requested Priority.
- Staff Queue must return real resolution-indication fields rather than its baseline hardcoded nulls. Additive workflow fields must appear consistently on general/staff detail and all relevant mutation responses.
- The frontend currently duplicates transitions; move UI decisions to the detail contract's permittedTransitions instead of leaving divergent matrices. Tests still verify backend policy independently.
- Preserve retained list pagination aliases and existing hash detail links; new dashboard navigation supplies filters into those screens.
- Candidate modules: `server/src/actionsTaken.ts`, `ticketConcurrency.ts`, `dashboards.ts`; extend existing route/query modules without rebuilding architecture. Their exact decomposition may be refined without changing this wire/policy contract.
- No API/application tests, route implementation, schema edits or migrations are performed in Phase 2B. Planned verification is in [tests.md](tests.md).
