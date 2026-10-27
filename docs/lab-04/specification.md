# Lab 4 Sprint Engineering Specification

Status: **Engineering contract prepared for review; implementation and application verification have not started.**
Prepared: 2026-10-27 (Asia/Bangkok). Baseline: `abcfbbf1a1863dda14e3bebb7c9ff90b7f9d730c`, the Lab 3 integration through PR #47. Documentation branch: `docs/lab4-engineering-contract`.

Sources: authoritative `SE+Lab+4.pdf` (document title: SE Lab 4, 11 pages; supplied locally), the existing implementation, [Lab 3 specification](../lab-03/specification.md), the Phase 1 design, and the user's Phase 2A/2B decisions. User-approved interpretations resolve handout ambiguities; they are not quotations from the handout. The PDF is not a repository artifact. Section references below identify its requirements without copying it.

Classification: **REQUIRED** means explicit handout scope; **EXISTING** means verified at the baseline; **ED** means an engineering decision. Phase 2A/2B approve the overall design and the listed adjustments; detailed EDs below record implementation choices and rationale for contract review. Nothing here claims implementation, peer approval, or passing application tests.

Companions: [API](api-spec.md), [UI](ui-spec.md), [tests and traceability](tests.md), [review record](reviewer.md), [AI-use record](ai-use.md). This specification owns business policy; the API owns wire formats; the UI owns presentation; tests own execution evidence. Any policy change must update all affected companions before implementation.

## 1. Sprint Goal

Complete TokTickIT's service-desk workflow by recording accountable Actions Taken, enforcing a safe resolution gate, providing role-appropriate operational dashboards, and verifying the complete Labs 1–4 application without discarding existing data or changing its architecture and Zen Green identity.

## 2. Stakeholder Request Interpretation

The Ticket Owner coordinates the whole request, while other eligible staff can plan and perform individual actions. Requesters can see the work on their own Tickets and indicate that the problem appears resolved, but IT Staff make formal status decisions. Dashboards summarize authoritative data and lead to existing detailed screens. The final increment must be usable, secure, responsive, accessible, and supported by traceable engineering evidence.

## 3. Scope and Existing Baseline

**Included — REQUIRED:** action creation/editing/assignment/lifecycle, automatic attribution, follow-up and attachment notes, complete Ticket rules, Requester and operational dashboards, migration/seed/API/UI increments, authorization/concurrency, final regression, accessibility, performance smoke, documentation and reviewed Git delivery (handout §§1–14).

**Excluded — REQUIRED:** SLA timers/escalations/on-call services; external notifications; inventory/spares/purchasing/service accounting; billing/payroll; multi-level approvals/e-signatures; advanced BI/report builders/export warehouses; multi-tenancy/production-scale cloud operations; unapproved new features (§4.2).

**Excluded — ED-01:** new routing libraries solely for this increment, generic event sourcing, action dependency graphs, action-specific file storage, hard deletion of actions, manual backdating, and automatic changes to Ticket status from action operations.

**EXISTING:** React/TypeScript/Vite/Bootstrap client, Express backend, Prisma/PostgreSQL, local attachment bytes, session authentication, three roles, eight Ticket statuses and 15 edges. Reuse `client/src/App.tsx`, `Header.tsx`, `api.ts`, `auth-client.ts`, `index.css`, `useDialogFocus.ts`; `server/src/app.ts`, `workflow.ts`, `staffTicket.ts`, `staffQueue.ts`, `commentsNotes.ts`, `adminUsers.ts`, and the migration/seed infrastructure. Component paths are under `client/src/components/` except the explicitly named root files. Preserve `User @@map("RequesterUser")` and all historical IDs. No application source is changed in the documentation phase.

## 4. Functional Requirements

| ID | Requirement | Basis |
|---|---|---|
| FR-01 | Preserve Labs 1–3 architecture, valid historical records, and unchanged permitted behavior. | REQUIRED §§1, 5, 8.5; EXISTING |
| FR-02 | Create an Action under exactly one Ticket with validated content and automatic creator attribution. | REQUIRED §§4–6; ED-02/03 |
| FR-03 | List/view all Actions on an owned Ticket for Requesters and accessible Tickets for Staff/Admin. | REQUIRED §8.3; ED-04 |
| FR-04 | Edit current Action data while appending immutable revisions with actor/time/reason. | REQUIRED edit/audit scope and Part 7; ED-05 |
| FR-05 | Assign, start, complete and cancel Actions using the defined lifecycle and eligible assignees. | REQUIRED Part 6; ED-03/06 |
| FR-06 | Validate follow-up flags/notes and retain their change history. | REQUIRED §§4.1, 8.3; ED-06 |
| FR-07 | Enforce role, ownership and child-to-parent authorization on every operation. | REQUIRED §4.3; ED-04 |
| FR-08 | Preserve the eight Ticket statuses and 15 existing transition edges with explicit Staff authority. | REQUIRED §4.5; EXISTING; ED-07 |
| FR-09 | Enforce the current-cycle resolution gate atomically, including direct API requests. | REQUIRED §§4.5, 6.1; ED-07/08 |
| FR-10 | Prevent Ticket cancellation from silently abandoning unfinished Actions. | REQUIRED workflow scope; ED-07 |
| FR-11 | Start a new work cycle on reopening and keep Requester resolution indication advisory. | REQUIRED §4.5; EXISTING indication; ED-08 |
| FR-12 | Prevent duplicate creation and stale/concurrent overwrites across related work. | REQUIRED §§6.1, 8.5; ED-09/10 |
| FR-13 | Return precise Requester-owned metrics and bounded recent Ticket summaries. | REQUIRED §§4.6, 6.2, 8.2; ED-11 |
| FR-14 | Return operational metrics and current-user action summaries for Staff/Admin. | REQUIRED §§4.6, 8.1 and Part 5; ED-04/11 |
| FR-15 | Connect every actionable dashboard metric to correctly filtered detail/list views. | REQUIRED §§4.6, 6.2; ED-12 |
| FR-16 | Upgrade existing data additively with documented, tested recovery and no invented history. | REQUIRED §5; ED-13 |
| FR-17 | Supply repeatable, non-destructive demonstration fixtures spanning the approved scenarios. | REQUIRED §5.3; ED-13 |
| FR-18 | Extend Zen Green with accessible responsive screens and consistent interaction states. | REQUIRED §§7–8; ED-14 |
| FR-19 | Preserve authentication/CSRF protections, safe failures and entered non-secret form data. | REQUIRED §§4.1, 8.5; EXISTING; ED-09/14 |
| FR-20 | Complete traceable regression, startup/build, performance-smoke and reviewed release evidence. | REQUIRED §§9–14; ED-15/16 |

## 5. Business Rules

All bounds below count Unicode code points after trimming; nullable text normalizes empty/whitespace-only input to null. Required text cannot normalize to null.

| ID | Rule | Classification |
|---|---|---|
| BR-01 | Each Action has one immutable Ticket FK and the Ticket's current cycle at creation; Ticket Owner and Action assignee need not match. | REQUIRED §4.4; ED-02 |
| BR-02 | `createdById` is the authenticated creator and never client-selected or rewritten. | REQUIRED automatic attribution; ED-03 |
| BR-03 | Assignees are active IT Staff/Admin. Omitted create assignee defaults to the authenticated creator. A new ineligible assignment fails. | REQUIRED inactive-assignee rejection, Part 6; ED-03 |
| BR-04 | Only the current eligible assignee may start/complete; completion sets `performedById` to that actor and sets `completedAt`. Before completion performer is null. | ED-03/06 |
| BR-05 | Description is 1–4000 characters; result is nullable up to 4000, but nonblank on completion; follow-up/attachment notes are nullable up to 2000; reasons are 1–4000. | ED-02 |
| BR-06 | Action date is immutable server `createdAt`; separate completion/cancellation timestamps describe lifecycle events. No backdating or client timestamp fields. | REQUIRED date/time; ED-02/03 |
| BR-07 | Only the action transitions in §7 are permitted; self-transitions and terminal-state reversals fail. Action operations never change Ticket status. | REQUIRED Part 6; ED-06 |
| BR-08 | Action mutations require an active parent and the current cycle. Planned/in-progress fields are editable; cancelled and previous-cycle records are read-only. | ED-06/08 |
| BR-09 | Current-cycle completed Actions on active Tickets allow content/follow-up correction with a required change reason; creator/assignee/performer/completion time remain immutable. | ED-05/06 |
| BR-10 | `followUpRequired=true` requires nonblank `followUpNote`. Completed work may retain follow-up; clearing it on a completed Action requires an explained correction and revision. | REQUIRED note; ED-06 |
| BR-11 | Cancelling an Action requires confirmation and a public reason; retains all data; cannot cancel a completed Action. | REQUIRED cancellation scope; ED-06 |
| BR-12 | Create revision 1; every actual mutation adds exactly one revision and increments Action version once, atomically. Valid current-version no-ops add neither revision nor timestamp/version changes. | REQUIRED audit scope; ED-05 |
| BR-13 | Action list order is `cycle ASC, createdAt ASC, id ASC`; revisions are `version ASC`; bounded pagination is mandatory. | REQUIRED stable ordering, Part 7; ED-05 |
| BR-14 | Administrator capabilities are explicit, not role inheritance: new Action operations and operational reads are allowed, unrelated Lab 3 mutation denials remain. | Approved Phase 2A/2B; ED-04 |
| BR-15 | Requesters see every Action on their own Tickets across cycles, including cancelled items, but cannot write Actions/read revision history; no Internal Notes leak. | REQUIRED §8.3; ED-04 |
| BR-16 | There is no application hard-delete operation for Actions/revisions; user deletion is not introduced. | ED-05 |
| BR-17 | Only §8 Ticket edges are permitted, IT Staff only; cancellation/reopening save the existing public reason in the same transaction as the status change. | EXISTING; ED-07 |
| BR-18 | Entering `IN_PROGRESS` or `RESOLVED` requires an active eligible Ticket Owner; IT Priority stays independent of Requested Priority. | EXISTING; ED-07 |
| BR-19 | Resolve only with confirmation, current version, eligible owner, at least one current-cycle completed Action, zero unfinished Actions, and zero completed Actions requiring follow-up. | Approved resolution gate; ED-07 |
| BR-20 | Ticket cancellation requires confirmation/public reason and zero current-cycle planned/in-progress Actions. Completed follow-up does not prevent cancellation. | ED-07 |
| BR-21 | Historical resolved/closed zero-action Tickets remain valid and may close. Future attempts to resolve active/reopened Tickets must satisfy the gate. Unknown historical resolution dates stay null. | Approved legacy policy; ED-13 |
| BR-22 | Reopening increments `workCycle`, clears `resolvedAt` and the old advisory indication; earlier Actions remain visible/read-only and cannot satisfy the new-cycle gate. | Approved cycles; ED-08 |
| BR-23 | An owned active Ticket may receive an advisory indication for its expected cycle. Same-cycle repeats are idempotent; terminal status or wrong cycle fails; formal status never changes. | REQUIRED §4.5; EXISTING; ED-08 |
| BR-24 | Relevant writes require explicit versions and increment parent `workflowVersion` once per transaction; Action writes also increment their own version. True no-ops do not increment. | REQUIRED stale handling; ED-09 |
| BR-25 | Related action/Ticket writes lock the parent row, check current state, and commit state/revision/public reason together. No pre-read alone authorizes the write. | ED-09 |
| BR-26 | Coordinate active-role checks with account changes; deactivation unassigns owned Tickets and increments their workflow versions, but retains action assignments/authorship for recovery/history. | EXISTING account effects plus ED-09 |
| BR-27 | Unique creator/request UUID and normalized-content fingerprint deduplicate Action create; exact replay returns the existing current Action; changed semantics conflict. | REQUIRED duplicate safety; ED-10 |
| BR-28 | Stale edit/transition retries never apply twice; return conflict and require reload/review. No automatic overwrite or cross-version merge. | REQUIRED safe failure; ED-09/10 |
| BR-29 | `ACTIVE` means NEW, OPEN, IN_PROGRESS, WAITING_FOR_REQUESTER, REOPENED. `TERMINAL` means RESOLVED, CLOSED, CANCELLED. Use §10 metric scopes exactly. | ED-11 |
| BR-30 | Recent interval is `[asOf - 168 hours, asOf)` from one database instant; API UTC, display Asia/Bangkok. No calendar-day approximation or browser-clock calculation. | REQUIRED defined boundaries; ED-11 |
| BR-31 | Compute dashboard counts and bounded previews from a consistent database snapshot; zero-fill buckets; never derive global counts from a page of rows. | REQUIRED authoritative metrics; ED-11 |
| BR-32 | Drill-down reuses the same predicates/date bounds and existing lists; later live data may differ from the prior snapshot. List defaults/legacy aliases remain. | REQUIRED drill-down; ED-12 |
| BR-33 | Recent resolution includes current RESOLVED/CLOSED with known in-window `resolvedAt`; excludes cancelled/reopened and unknown historical dates. | ED-11/13 |
| BR-34 | Authenticate first; wrong role is 403; missing/cross-requester/parent-mismatched resources share safe 404; no secrets/internal storage paths in DTOs. | EXISTING; REQUIRED security |
| BR-35 | Retain mandatory-password-change gates, current active session checks, CSRF/Origin validation on writes, and safe plain-text rendering. | EXISTING; REQUIRED regression |
| BR-36 | Preserve all pre-existing rows/columns/IDs/bytes and the mapped User table; only new defaults/columns/tables/indexes are added. | REQUIRED §5; ED-13 |
| BR-37 | Seed only missing deterministic Lab 4 fixtures, without resetting credentials, user choices, ticket progress or historical records; action/history pairs are atomic. | REQUIRED seed idempotency; ED-13 |
| BR-38 | Recovery uses a tested corrective forward migration or matching database/upload backup restoration; no destructive reset or old writable application bypassing the gate. | REQUIRED recovery; ED-13 |
| BR-39 | Performance smoke starts at 300 deterministic Tickets/900 Actions; bounded queries/payloads and measured timings are required; larger fixtures need evidence of need. | Approved Phase 2A adjustment; ED-15 |
| BR-40 | Preserve non-secret drafts on recoverable failure, stable creation keys on retries, accessible focus/error semantics and responsive Zen Green conventions. | REQUIRED §§7–8; ED-14 |
| BR-41 | Evidence must identify actual revision, commands, outcomes and limitations; never label planned tests/peer approvals/reflections as completed. | REQUIRED §§9–14; ED-16 |
| BR-42 | Reject unknown fields, contradictory filters and invalid intervals; dashboard responses remain concise, private, and free of caller-controlled ownership scope. | REQUIRED API/security; ED-11/12 |

## 6. Data Model and Relationships

### 6.1 Ticket additions — ED-02/08/09/13

| Field | Type/default | Meaning |
|---|---|---|
| `workflowVersion` | Prisma `Int`, SQL integer, default 1, positive | Changes relevant to ticket workflow/action decisions |
| `workCycle` | `Int`, default 1, positive | Incremented only on reopening |
| `resolvedAt` | `DateTime? @db.Timestamptz(3)`, null | Current-cycle actual resolution time; retained through closing, cleared on reopening |

Keep existing `updatedAt` and all existing column types unchanged. New timestamps are UTC instants; existing PostgreSQL timestamp-without-time-zone fields continue their established UTC interpretation. Dashboard SQL must compare those fields to UTC-normalized parameters explicitly, not rely on the connection's local timezone.

### 6.2 ActionTaken — ED-02/03/05

| Field | Type/default | Constraints |
|---|---|---|
| `id` | `Int @id @default(autoincrement())` | Server-owned |
| `ticketId` | `Int` FK to Ticket | Required, immutable, deletion restricted |
| `cycle` | `Int` | Current parent workCycle on create, positive, immutable |
| `status` | `ActionStatus`, default PLANNED | PLANNED, IN_PROGRESS, COMPLETED, CANCELLED |
| `description` | `String @db.Text` | BR-05 |
| `result` | `String? @db.Text` | Required/nonblank when completed |
| `assigneeId` | `Int` FK to User | Required, immutable after completion |
| `createdById` | `Int` FK to User | Required, immutable authenticated creator |
| `performedById` | `Int?` FK to User | Null until completion; then equals completing assignee and immutable |
| `followUpRequired` | `Boolean`, default false | Must be actual boolean in requests |
| `followUpNote` | `String? @db.Text` | Conditional nonblank rule |
| `attachmentNotes` | `String? @db.Text` | Descriptive reference to existing Ticket files; no new file subsystem |
| `createdAt` | `DateTime @db.Timestamptz(3)`, server default | Immutable action date |
| `updatedAt` | `DateTime @db.Timestamptz(3)` | Server time of last actual change |
| `completedAt` | Nullable timestamptz(3) | Set only at completion |
| `cancelledAt` | Nullable timestamptz(3) | Set only at cancellation |
| `cancellationReason` | Nullable text | Nonblank only for cancelled Action |
| `version` | `Int`, default 1, positive | Increment once per actual change |
| `clientRequestId` | `String @db.Uuid` | Required creation identity |
| `createRequestHash` | `String @db.Char(64)` | Server SHA-256 of canonical normalized create semantics; never returned |

User relations use the existing mapped User IDs with ON DELETE RESTRICT. No reassignment of an Action to another Ticket/cycle. Checks enforce trimmed lengths, conditional follow-up, positive counters and lifecycle consistency: COMPLETED has nonblank result/performer/completedAt and no cancellation fields; CANCELLED has reason/cancelledAt and no completion fields; other states have neither terminal metadata. Cross-row cycle/active-role rules remain transactional backend rules, not misleading FK claims.

Unique `(createdById, clientRequestId)`. Indexes `(ticketId, cycle, createdAt, id)`, `(ticketId, cycle, status)`, `(assigneeId, status, ticketId)`. Do not duplicate an index already supplied by a unique constraint.

Proposed Prisma relation fields (documentation only; scalar FKs are defined above). Each named relation uses the same name on both sides; the three User relations have distinct names to distinguish creator, assignee and performer. Add the inverse fields to the existing models without replacing their current relations or changing `User @@map("RequesterUser")`.

| Field on ActionTaken | Matching inverse field on existing model |
|---|---|
| `ticket Ticket @relation("TicketActionsTaken", fields: [ticketId], references: [id], onDelete: Restrict)` | Ticket: `actionsTaken ActionTaken[] @relation("TicketActionsTaken")` |
| `createdBy User @relation("ActionTakenCreator", fields: [createdById], references: [id], onDelete: Restrict)` | User: `createdActionsTaken ActionTaken[] @relation("ActionTakenCreator")` |
| `assignee User @relation("ActionTakenAssignee", fields: [assigneeId], references: [id], onDelete: Restrict)` | User: `assignedActionsTaken ActionTaken[] @relation("ActionTakenAssignee")` |
| `performedBy User? @relation("ActionTakenPerformer", fields: [performedById], references: [id], onDelete: Restrict)` | User: `performedActionsTaken ActionTaken[] @relation("ActionTakenPerformer")` |

Ticket therefore has zero or more Actions; every Action has exactly one Ticket, creator and assignee, and an optional performer until completion. These new field/relation names do not collide with the baseline schema. Attribution timing and immutability remain governed by BR-02–BR-04 and BR-09.

### 6.3 ActionTakenRevision — ED-05

Fields: `id Int` primary key; `actionId Int` required restricted FK; `version Int` positive; `operation ActionRevisionOperation`; `actorId Int` required restricted User FK; `occurredAt timestamptz(3)`; `changeReason Text?`; `snapshot Json` (PostgreSQL JSONB). Operations: CREATE, EDIT, REASSIGN, START, COMPLETE, CANCEL. An edit changing assignee uses REASSIGN even if content changes in the same request; otherwise EDIT. Each operation adds one complete resulting-state snapshot, not separate events per field. Unique `(actionId, version)` supplies ordered history lookup.

Snapshot fields are the public Action scalar fields and identity IDs defined in the API, excluding request IDs/hashes and derived permissions. Creator/performed/assigned identities are retained by ID; display names reflect current profiles, consistent with existing discussion authors. Actor is the account committing the revision, which need not be the creator/assignee for permitted edits/cancellation. No update/delete operation for revisions is exposed. This is an application audit trail, not cryptographic tamper-proofing against database operators.

| Field on ActionTakenRevision | Matching inverse field |
|---|---|
| `action ActionTaken @relation("ActionTakenRevisions", fields: [actionId], references: [id], onDelete: Restrict)` | ActionTaken: `revisions ActionTakenRevision[] @relation("ActionTakenRevisions")` |
| `actor User @relation("ActionTakenRevisionActor", fields: [actorId], references: [id], onDelete: Restrict)` | User: `actionTakenRevisions ActionTakenRevision[] @relation("ActionTakenRevisionActor")` |

Every revision belongs to exactly one Action and one authenticated actor. The server derives actorId from the authenticated user committing that revision, never from client input. Action creation writes its first revision atomically; each actual change appends one immutable revision as specified in BR-12. Restrictive FKs preserve referenced records; they do not themselves enforce append-only writes, which remain an application transaction rule. The inverse User field above is additional to the three Action inverse fields in §6.2.

### 6.4 Database design rationale

1. **ED-05 — current record plus revisions:** bounded operational reads and normal Prisma relations coexist with immutable evidence of edits; avoids rewriting comments/notes or introducing generic event sourcing.
2. **ED-08 — integer work cycle:** a deterministic boundary after reopen prevents prior completed work from accidentally satisfying a new resolution gate; avoids timestamp-equality ambiguities.
3. **ED-09 — integer versions:** explicit stale detection does not overload `updatedAt`, which also drives presentation/metrics. Both versions and parent locks are necessary for client intent and related-record correctness.
4. **ED-13 — nullable resolvedAt:** preserving unknown historical facts is preferable to inventing times from updatedAt. Additive defaults retain all legacy rows.

Ticket query indexes planned: `(ownerId,currentStatus)`, `(currentStatus,itPriority)`, `(updatedAt,id)`, `(requesterId,updatedAt,id)`, `(requesterId,resolvedAt,id)`. Existing requester indexes remain. Verify plans before adding overlapping indexes; record any justified adjustment in the contract. The baseline Lab 3 docs mention queue indexes absent from the actual checked-in schema/migrations; do not assume they exist.

## 7. Action Lifecycle and Editing

| From | To | Actor/guard | Side effect |
|---|---|---|---|
| Create | PLANNED | Staff/Admin, active parent/current version, eligible assignee | Creator and cycle set; revision 1 |
| PLANNED | IN_PROGRESS | Current eligible assignee | START revision |
| PLANNED | CANCELLED | Staff/Admin; confirmation/reason | Cancellation time/reason, CANCEL revision |
| IN_PROGRESS | COMPLETED | Current eligible assignee; result and valid follow-up fields | Performer/time set, COMPLETE revision |
| IN_PROGRESS | CANCELLED | Staff/Admin; confirmation/reason | Cancellation time/reason, CANCEL revision |
| COMPLETED | None | State terminal | Content correction only as below |
| CANCELLED | None | Fully read-only | Correct mistakes by new Action while parent active |

All operations require current parent cycle and active parent status (BR-29). Ticket may be NEW/OPEN while action work proceeds; action operations do not automatically progress it. Any Staff/Admin may edit/reassign planned/in-progress work; assignment does not require being Ticket Owner. Reassigning in-progress work retains IN_PROGRESS. Starting/completing as a different person requires explicit reassignment first. New assignment rejects inactive/Requester accounts; if an existing assignee becomes ineligible, content editing, eligible reassignment and cancellation remain available, but starting/completion fail until recovery.

Completed corrections allow description/result/follow-up/attachment notes, with nonblank changeReason; result cannot be cleared. No assignee or terminal timestamp change. A completion may leave follow-up required; staff later clear the flag with an explained correction after work is addressed, optionally recording additional Actions. Retain a supplied explanatory followUpNote when the flag is false; prior states always remain in revisions. No dependency-link feature. On terminal parent or old cycle, all Actions are read-only.

## 8. Ticket Matrix, Resolution and Cancellation

### 8.1 Existing edges retained — ED-07

All edges are IT Staff only and require `expectedWorkflowVersion`. Unlisted/self edges fail.

| Source | Target | Additional guard |
|---|---|---|
| NEW | OPEN | None |
| NEW | CANCELLED | Confirm, public reason, cancellation gate |
| OPEN | IN_PROGRESS | Eligible owner |
| OPEN | CANCELLED | Confirm, public reason, cancellation gate |
| IN_PROGRESS | WAITING_FOR_REQUESTER | None |
| IN_PROGRESS | RESOLVED | Confirm, resolution gate |
| IN_PROGRESS | CANCELLED | Confirm, public reason, cancellation gate |
| WAITING_FOR_REQUESTER | IN_PROGRESS | Eligible owner |
| WAITING_FOR_REQUESTER | RESOLVED | Confirm, resolution gate |
| WAITING_FOR_REQUESTER | CANCELLED | Confirm, public reason, cancellation gate |
| RESOLVED | CLOSED | Confirm; legacy zero-action resolved Tickets allowed |
| RESOLVED | REOPENED | Confirm, public reason; new cycle |
| CLOSED | REOPENED | Confirm, public reason; new cycle |
| REOPENED | OPEN | None |
| REOPENED | CANCELLED | Confirm, public reason, cancellation gate |
| CANCELLED | None | Terminal |

### 8.2 Resolution gate

Within the same protected transaction, validate Staff/session, expected version, permitted edge and confirmation; require an active eligible owner; count current-cycle Actions. Require completed >= 1, planned/in-progress = 0, completed-with-follow-up = 0. Completed rows must satisfy result/performer/time invariants. Cancelled Actions neither block nor count as completed. Requester indication is optional and never substitutes for these checks. Set `resolvedAt` at successful resolution. Closing preserves it.

### 8.3 Cancellation gate

Require zero current-cycle PLANNED/IN_PROGRESS Actions. Staff must explicitly finish/cancel outstanding work; no cascade cancellation or automatic loss of assignment. Completed follow-ups do not block Ticket cancellation because cancellation does not assert resolution. Keep the public cancellation reason atomically with the transition, as in Lab 3.

### 8.4 Reopening and advisory indication

Reopen increases workCycle by one, clears current resolvedAt and both resolutionSuggested fields, retains previous-cycle Actions/history, and saves the public reason. New-cycle completed work is required before another resolution. Requester indication supplies expectedCycle, checks ownership/active status/current cycle under the same parent lock, and sets existing advisory fields once. Repeating in that active cycle returns the original fields without touching timestamps/versions; wrong cycle or terminal status conflicts. Reopening does not grant Requesters formal transitions.

## 9. Authorization Matrix

Normal authenticated/active sessions and mandatory-password-change completion are prerequisites. Staff/Admin access to a Ticket does not depend on owning it. `Own` means Ticket.requesterId equals session user ID.

| Operation | Requester | IT Staff | Administrator |
|---|---|---|---|
| Requester dashboard / My Tickets / create Ticket | Own / existing | Deny | Deny |
| Operational dashboard / Queue / Staff detail / assignee directory | Deny | Allow | Allow (new operational reads) |
| General Ticket detail | Own | Allow | Existing allow |
| Read Actions, all cycles/current states | Own | Allow | Allow |
| Create/edit/reassign Actions | Deny | Allow | Allow |
| Start/complete Action | Deny | Current eligible assignee | Current eligible assignee |
| Cancel Action | Deny | Allow with reason | Allow with reason |
| Read Action revision history | Deny | Allow | Allow |
| Delete Action/revision | Deny | Deny | Deny |
| Claim / assign Ticket owner | Deny | Allow | Deny (preserved) |
| Change formal Ticket status | Deny | Allow | Deny (preserved) |
| Change IT Priority | Deny | Allow | Existing allow |
| Indicate resolution | Own active cycle | Deny | Deny |
| Read Public Comments | Own | Allow | Existing allow |
| Append Public Comments | Own | Allow | Deny (preserved) |
| Read Internal Notes | Deny | Allow | Existing allow |
| Append Internal Notes | Deny | Allow | Deny (preserved) |
| Attachment metadata | Own | Allow | Existing allow |
| Attachment upload/download/soft-remove | Own | Allow | Deny (preserved) |
| User administration | Deny | Deny | Existing allow |

Action text is shared with the Requester, including cancellation reasons, result and follow-up notes. Revision history is staff-only by ED-04; current Action data always includes every owned Action, not only completed records. Never render private notes as action content. Administrator operational reads do not grant the mutations denied above.

## 10. Dashboard Definitions

All definitions below are ED-11/12 implementing required dashboards. Let `u` be the authenticated user, `t` the single DB snapshot instant, `from=t-168h`, `to=t`. Recent windows are lower-inclusive/upper-exclusive. Requester predicates always include requesterId=u; Staff/Admin metrics cover all Tickets except explicitly personal predicates. No user-selected identity/window on dashboard endpoints.

| Key / label | Exact predicate and aggregation | Drill-down filters/destination |
|---|---|---|
| R `activeTickets` / Active tickets | Count status in ACTIVE; exclude TERMINAL; no time bound | My Tickets `statusGroup=active` |
| R `waitingForYou` / Waiting for you | Count status=WAITING_FOR_REQUESTER; all other statuses excluded; no time bound | My Tickets `status=WAITING_FOR_REQUESTER` |
| R `resolvedLast7Days` / Resolved in last 7 days | Count status in RESOLVED,CLOSED and known resolvedAt in [from,to); exclude other statuses/null dates | My Tickets `statusGroup=resolved,resolvedFrom=from,resolvedTo=to` |
| R `updatedLast7Days` / Updated in last 7 days | Count all eight statuses with updatedAt in [from,to) | My Tickets `updatedFrom=from,updatedTo=to,sortBy=updatedAt,sortOrder=desc` |
| S/A `unassignedActiveTickets` / Unassigned active tickets | Count ACTIVE and ownerId=null; no time bound | Queue `statusGroup=active,ownerId=unassigned` |
| S/A `myActiveTickets` / My active tickets | Count ACTIVE and ownerId=u; no time bound | Queue `statusGroup=active,ownerId=me` |
| S/A `ticketsByStatus` / Tickets by status | Count/group all Tickets by all eight statuses; no time bound | Queue `status=<selected>` |
| S/A `activeTicketsByItPriority` / Active tickets by IT Priority | Count/group ACTIVE by LOW,MEDIUM,HIGH,CRITICAL using itPriority, not requestedPriority | Queue `statusGroup=active,itPriority=<selected>` |
| S/A `myOutstandingActions` / My outstanding actions | Count assigned-to-u PLANNED/IN_PROGRESS Actions joined to ACTIVE parents, action.cycle=ticket.workCycle; no time bound | My Actions panel `assigneeId=me,state=outstanding` |

Both dashboards include `recentTickets`: up to five Tickets matching their scope, all statuses, updatedAt in [from,to), sorted updatedAt DESC then id DESC. Each opens detail; View all uses the updated time filters above (Queue for Staff/Admin). R recent preview shares the updatedLast7Days count predicate. S/A also previews five matching outstanding Actions sorted createdAt ASC,id ASC; total is myOutstandingActions and View all is paginated. Action preview opens the parent detail and selects the action area.

Counts are zero, grouped maps contain every enum bucket with zero, and lists are [] on empty success. Zero-value drill-down remains valid. Failure is not zero. Dashboard query has one repeatable-read snapshot; later drill-down is live, so counts can change without predicate disagreement. Capture metrics and matching SQL at the same fixture snapshot for verification.

Use Ticket.updatedAt for recent updates: new Action mutations and existing Ticket field mutations touch it; comments/notes/attachments do not acquire new timestamp behavior. WorkflowVersion excludes comments/notes/files/session touches. Unknown old resolution dates are excluded only from recent-resolution metrics, never from My Tickets or total status counts. Administrator reuses the operational screen; no user-account count cards are added.

## 11. Migration, Backfill, Seed and Recovery

1. Inspect actual migration history and normalized-identity prerequisites. Use the existing forward authentication migration/provisioning sequence where needed; never apply required credential constraints before provisioning legacy users.
2. Add Action enums/tables/revisions, FK/check/index constraints and three Ticket fields. Existing Ticket rows receive workflowVersion=1, workCycle=1, resolvedAt=null. Do not update existing updatedAt, status, ownership, user credentials, discussion timestamps or attachment paths/bytes.
3. Preserve completed historical Tickets without fabricated Actions. New active legacy resolutions follow §8. Reopen gives them a new cycle like every other Ticket.
4. Create only missing fixtures under deterministic Lab 4 ticket numbers and action request UUIDs. Include every Ticket status/priority, eligible/inactive users, assigned/unassigned, zero/one/multiple Actions, different owner/assignee, terminal/follow-up/old-cycle cases, and Requesters with zero metrics. Create each new Ticket fixture graph (Ticket, Actions and coherent lifecycle revisions) in one transaction: terminal Actions must have valid CREATE/START/COMPLETE or CREATE/CANCEL history, not a fabricated completed revision 1. Skip existing Ticket graphs rather than adding new unfinished children to a terminal or user-modified fixture. Do not modify existing fixtures to force demo counts. If retained fixtures have changed, report this rather than reset them.
5. Use safe initial credential provisioning/handover from `server/scripts/initial-credentials.ts`; no hardcoded application passwords or secrets in logs/evidence. Base seed data is distinct from disposable performance fixtures.
6. Verify old-column and attachment-byte snapshots before/after upgrade, repeated seed, and fresh installation. Any failed statement must not leave an Action without its revision. Destructive cleanup is confined to explicitly guarded disposable fixtures.
7. Before real migration, establish a recoverable database backup with its matching upload tree. Rehearse failure and restoration in isolation. Prefer a corrective forward migration; never erase new action history with a casual down migration. Restore only after coordinating downtime and reconciling any newer writes. An old application cannot safely write the upgraded database because it bypasses the gate.

No migration, seed or database inspection is executed by this documentation increment.

## 12. Security, Concurrency and Safe Failure

### 12.1 Transaction protocol — ED-09

All action mutations and claim/owner/priority/status/first-indication writes acquire the parent Ticket row FOR UPDATE, then validate current state and submitted intent. For operations involving active roles/ownership, first acquire a shared transaction advisory lock on the same `admin_user_protection` key used by existing account edits; relevant account changes acquire its exclusive form. This permits independent Tickets to proceed concurrently but coordinates eligibility changes. Lock ordering: eligibility advisory lock, Ticket IDs ascending, then child writes. Recheck actor role/active state and live session in the protected transaction. Last-admin rules remain intact; do not introduce a second incompatible lock namespace.

A changed action increments its version once and the parent workflowVersion once, with parent updatedAt; creation starts action version 1. Actual claim/owner/priority/status changes and first indication increment the parent once. Administrator owner unassignment increments each affected Ticket once. Every new relevant writer participates. No-op and idempotent replays do not touch either timestamp/version. Resolution evaluates all current-cycle Actions while holding the same lock used by action writers, preventing phantom work after a gate check.

Ticket operations supply expectedWorkflowVersion; action edit/transition supply both expectedVersion and expectedWorkflowVersion; create supplies expectedWorkflowVersion. Indication uses expectedCycle to preserve same-cycle idempotency. Versions are positive 32-bit integers and must not wrap; overflow safely fails rather than resetting them. Current-version equality is checked before no-op detection; stale intent cannot masquerade as a no-op. Server deadlock/serialization retries are bounded (at most two retries of wholly rolled-back transactions); exhausted contention returns a safe retryable conflict. Never retry a committed operation automatically as a new command.

### 12.2 Duplicate creation — ED-10

Canonical create semantics include ticketId, normalized description/result/follow-up/attachment notes and resolved assigneeId. Exclude expected version and request UUID from the fingerprint. Use the unique creator/request UUID as the atomic arbiter, scoped across Tickets. After authorization, exact replay is checked before stale-version/active-parent guards because it does not write; even after parent completion/reopen, return the existing current Action with replayed=true. Different semantics return IDEMPOTENCY_KEY_REUSED; no details about another actor's records. Concurrent different-parent attempts must handle the unique constraint after rollback, not create two actions. No generic replay store for edits: stale retry conflicts, UI refreshes/reviews.

### 12.3 Safe responses

Retain HttpOnly/SameSite sessions, password gates, revocation, CSRF and safe exception mapping. All private responses use no-store. Cross-requester resources are indistinguishable from missing ones. Strict DTO projection excludes hashes, sessions, storage paths, request fingerprints and private discussion content. Form errors identify approved fields without reflecting arbitrary HTML. Safe conflict details contain only authorized current versions/blocker counts. All failed writes roll back state/revisions/reasons together. Exact response mapping is in [api-spec.md](api-spec.md).

## 13. Acceptance Criteria

| ID | Observable criterion |
|---|---|
| AC-01 | Upgrading a representative Lab 3 database preserves every historical value/ID and attachment byte while adding the specified defaults, relations and constraints; failed upgrade recovery is demonstrated in isolation. |
| AC-02 | Running the seed twice creates no duplicate fixtures/revisions and does not overwrite credentials, roles, ownership, progress or history; all demonstration categories are available. |
| AC-03 | Valid Action creation records the correct Ticket/current cycle, authenticated creator and eligible assignee, returns version 1, and rejects forged server fields and validation boundaries without writes. |
| AC-04 | Owned Requesters can read all current/historical Actions but no revisions/private notes; cross-owner and mismatched-parent reads are safe 404, and all role denials are enforced by direct API tests. |
| AC-05 | Every permitted action edge succeeds with its guards; all other/self edges fail; only current eligible assignees start/complete and completion captures actual actor/time/result. |
| AC-06 | Permitted edits/reassignment/completed corrections preserve immutable identities and append exactly one correctly ordered revision; no-op edits do not append; terminal/old-cycle edits fail. |
| AC-07 | Required follow-up notes and completion/cancellation fields are validated; outstanding completed follow-up can be cleared with an explained correction without losing earlier history. |
| AC-08 | Simultaneous identical Action creates produce one Action/revision; exact replay is safe after later changes; changed semantics with the same key conflict. |
| AC-09 | Competing action/status/owner/priority changes cannot silently overwrite; action-versus-resolution and assignment-versus-deactivation interleavings preserve the gate and eligibility invariants. |
| AC-10 | All 64 Ticket source/target pairs conform to the retained matrix, owner/confirmation/reason requirements and Staff-only formal-status authority. |
| AC-11 | Resolution fails for zero completed, unfinished, outstanding-follow-up or owner-ineligible work and succeeds only with the complete current-cycle predicate, setting actual resolvedAt atomically. |
| AC-12 | Ticket cancellation rejects unfinished Actions and otherwise preserves public reason/history; legacy resolved zero-action Tickets can close without invented work. |
| AC-13 | Reopen advances the cycle, clears current resolution data and preserves old Actions; old work cannot satisfy the new gate; advisory indication stays owned, cycle-safe and idempotent. |
| AC-14 | Requester dashboard counts/previews match §10 for all statuses, time boundaries, unknown legacy dates and zero states, with no other Requester's data. |
| AC-15 | Staff/Admin dashboard counts/groups and current-user outstanding actions match §10, including zero buckets, former cycles and terminal-parent exclusions. |
| AC-16 | Each metric/preview navigates to the intended view with equivalent predicates, stable ordering and page reset; old list defaults/aliases/deep links continue to work. |
| AC-17 | Actions UI supports permitted list/create/edit/start/complete/cancel/history modes, immutable identity display, duplicate prevention and draft-preserving conflict/failure recovery. |
| AC-18 | Dashboards and Ticket controls distinguish loading, success, empty/no-results, invalid, forbidden, missing, conflict and network failure; successful mutations refresh relevant data. |
| AC-19 | Major Lab 4 screens meet the Zen Green, keyboard, labelled-error, focus, desktop/tablet/mobile and no-page-overflow checklist with actual visual evidence. |
| AC-20 | New routes retain authentication/password/CSRF/session protections, strict validation and safe projections; Administrator gains only approved Action operations/operational reads. |
| AC-21 | Retained Lab 1–3 suites pass with only documented requirement-driven expectation changes; prior discussion/file/user/account behavior remains correct and known coverage gaps are addressed. |
| AC-22 | Reproducible performance smoke verifies bounded dashboard queries/payloads and the documented local latency target using 300 Tickets/900 Actions; scaling is evidence-driven. |
| AC-23 | Both builds and built-server startup/health/authenticated smoke succeed on the verified revision; runner discovery includes Lab 4 and retained regressions without importing screenshot capture as product tests. |
| AC-24 | Contract predates completed implementation PRs; actual feature reviews/staging/main history, final-main output, student reflection and complete Answer Part 1–9 submission evidence are recorded without fabricated claims. |

Every AC maps to tests in [tests.md](tests.md). Planned coverage is not executed evidence.

## 14. Product Definition of Done

- [ ] Reviewed FR/BR/AC, API and UI contracts agree; no unresolved implementation-blocking policy ambiguity.
- [ ] Actions, revisions, gates, dashboards and navigation meet all 24 ACs.
- [ ] Migration/seed/recovery preserve old data and demonstrate fresh/upgrade paths.
- [ ] Role/ownership, concurrency, duplicates and safe error behavior pass real API tests.
- [ ] Required unit/API/UI/style/responsive/E2E and all retained regression suites pass with full output and explicit skipped/partial accounting.
- [ ] Performance smoke and bounded query/payload checks pass on documented hardware/environment.
- [ ] Server/client builds, corrected built-server startup and final health/authenticated smoke pass.
- [ ] Desktop/tablet/mobile visual and keyboard checklists have actual inspection evidence; no known blocking clipping, broken controls or unsafe draft loss.
- [ ] README migration/seed/setup/test/demo guidance is current (future authorized implementation/release work).
- [ ] Feature PRs are peer reviewed into lab4-staging; reviewed release reaches main; final main is independently verified and recorded.
- [ ] Actual reviewer evidence, 6–10 real selected prompts and student-authored reflection are complete.
- [ ] One readable submission PDF contains Answer Part 1 through Answer Part 9 in order, working links and truthful provenance.

## 15. Decisions, Rationale and Source Ambiguities

| ED | Decision and rationale | Status/source |
|---|---|---|
| ED-01 | Extend current architecture and omit unrelated features/libraries. | Approved direction; REQUIRED exclusions |
| ED-02 | Bounded typed Action fields, creation-date display, no action-specific files. | Detail of approved action model; §8.3 says create date/time |
| ED-03 | Creator on create, assignee on create/reassign, actual performer on completion; null performer before work completes. | Explicit Phase 2B approval; resolves ambiguous automatic performer timing |
| ED-04 | Explicit authorization matrix; narrow Admin expansion and Requester current-action visibility, staff-only revisions. | Approved Phase 2A/2B; action-role table interpreted in its Actions Taken context |
| ED-05 | Editable current records plus append-only revisions; comments/notes stay append-only. | Approved; reconciles handout edit requirement with Part 7 append-only wording |
| ED-06 | Four action states, assignee-only start/complete, guarded completed corrections and explicit cancellation. | States approved; detailed lifecycle from Phase 1 retained |
| ED-07 | Keep 15 Ticket edges; add transactional resolution/cancellation gates; Staff-only formal status. | Approved direction; concrete gate interpretation of unspecified handout predicate |
| ED-08 | Integer work cycles and cycle-aware advisory indication. | Explicit Phase 2B approval; avoids reuse of old completed work |
| ED-09 | Parent version plus action version, per-Ticket row locks, shared/exclusive account eligibility lock. | Approved safe concurrency direction; detailed protocol documented for review |
| ED-10 | Creator/UUID/fingerprint on create; version conflicts for other repeated commands. | Duplicate safety required; avoids a generic command receipt subsystem |
| ED-11 | Exact metrics, rolling 168-hour UTC interval, Bangkok display, snapshot consistency and bounded previews. | Required calculations made concrete; no additional BI |
| ED-12 | Add compatible list filters and typed in-app navigation without a router dependency. | Preserves existing screens/defaults and supplies meaningful drill-down |
| ED-13 | Additive migration, nullable historical resolution time, create-only fixtures and tested recovery. | Explicit legacy/data preservation approval |
| ED-14 | Reuse Zen Green/auth/focus helpers; backend remains policy authority; drafts survive recoverable failures. | Required UI/security behavior |
| ED-15 | 300 Tickets/900 Actions initially; six dashboard data SELECTs maximum; 20 measured requests after five warm-ups, local p95 <= 1000 ms. | Phase 2A rejects mandatory 10,000 fixture; thresholds are course smoke targets, not SLA |
| ED-16 | Contract/test planning before coding, test-first feature work, peer-reviewed staging/main and actual final-main evidence. | Required Git/evidence workflow and user scope |

The handout's example action-creation AC mentions an authenticated creator/approved assignee, while its field list emphasizes automatic performer. ED-03 explicitly supports all three. Part 6 adds assignment/completion/cancellation absent from the short field list; ED-06 covers them. Part 7 append-only behavior is interpreted as preserved discussion semantics plus action revisions, not a new Ticket event-sourcing subsystem. Full Administrator inheritance is intentionally not inferred. These interpretations are recorded for peer/instructor review; a different required interpretation must amend this contract and tests before dependent code.

No unanswered choice is hidden behind a claim of completed implementation. Performance/index choices remain measurable engineering decisions: record findings and amend tests/contract together if evidence warrants a change, never lower a failing threshold silently.

## 16. Delivery Sequence and Evidence Boundary

Planned work packages: engineering contract; action schema/API/concurrency/seed; Actions UI; final Ticket workflow; Staff/Admin dashboard; Requester dashboard; integrated regression/hardening; release evidence. Create Issues only when authorized. Tests means test design before code and executable failing tests first on each feature branch, never direct edits to main.

Required flow: **Engineering Contract → Test Planning → Feature Branch (executable tests first) → PR → Peer Review → lab4-staging → reviewed release PR → main**. Planned branch scopes: `feat/lab4-actions-foundation`, `feat/lab4-actions-ui`, `feat/lab4-ticket-workflow`, `feat/lab4-staff-dashboard`, `feat/lab4-requester-dashboard`, `test/lab4-regression-hardening`, `docs/lab4-release-evidence`. No Issue/PR/commit is asserted to exist for this increment.

Preserve historical Lab 1–3 documentation/evidence. Baseline records report 252 backend, 87 client and 11 browser cases plus builds, but those are historical workspace results, not Lab 4 or freshly verified final-main results. The untracked `artifacts/lab-03/submission-evidence/` is protected and excluded from this increment.
