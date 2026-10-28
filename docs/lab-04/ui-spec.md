# Lab 4 UI Specification

Status: **Planned UI contract; no screens or application tests implemented in Phase 2B.** Prepared 2026-10-27 (Asia/Bangkok), baseline `abcfbbf`.

Sources: handout §§7–8 and submission Parts 5–9, [business specification](specification.md), [API contract](api-spec.md). All exact screen/component choices are engineering decisions implementing the required UI. [Tests](tests.md) owns planned checks and actual execution evidence. Policy is never inferred from hidden controls alone.

## 1. Application Shell and Navigation

Reuse `client/src/App.tsx`, `client/src/components/Header.tsx`, `client/src/context/AuthContext.tsx`, `client/src/auth-client.ts`, `client/src/api.ts`, `client/src/index.css` and `client/src/useDialogFocus.ts`. Planned new components under `client/src/components/`: `RequesterDashboard.tsx`, `StaffDashboard.tsx`, `ActionsTaken.tsx`; small child forms/history views may live alongside them. Do not replace the architecture or add a router merely for this increment.

After authentication/password-change gates, Dashboard becomes the default landing view. Existing known Ticket deep links take precedence over that default. Requester navigation: Dashboard, My Tickets, Create Ticket. IT Staff: Dashboard, Ticket Queue. Administrator: Dashboard, Ticket Queue, User Management. Keep authenticated identity, Change Password, Sign out, mobile menu and clear active-page indication. Preserve existing diagnostics functionality; place it consistently without making it the primary workflow.

Preserve `#/tickets/:id` links. Dashboard links pass typed view/filter descriptors to App; no arbitrary server URL is followed. Extend existing list components with an explicit filter-entry/navigation contract; a new drill-down clears old filters, applies the descriptor, resets page to 1, and displays active filter labels. Back from detail restores the originating list/filter/page state. Preserve existing list defaults, search/filter/sort controls and pagination aliases. There is no requirement for bookmarkable list filters in this increment; retained hash detail behavior must still work.

Keep private views keyed to authenticated identity/role/password gate; clear them on logout/account change and disregard obsolete requests. Preserve the Create Ticket dirty-form guard. Add equivalent leave confirmation for unsaved Action drafts, including switching Dashboard/Ticket/detail while a form is dirty. A forced logout/session expiry clears private drafts; recoverable ordinary failures do not.

## 2. Requester Dashboard

Call GET `/api/dashboard/requester` once per load/explicit refresh; never calculate counts from My Tickets pages or accept a selectable Requester identity.

| Card | Response key | Destination |
|---|---|---|
| Active tickets | metrics.activeTickets | My Tickets, statusGroup=active |
| Waiting for you | metrics.waitingForYou | My Tickets, status=WAITING_FOR_REQUESTER |
| Resolved in last 7 days | metrics.resolvedLast7Days | My Tickets, statusGroup=resolved and returned resolvedFrom/resolvedTo |
| Updated in last 7 days | metrics.updatedLast7Days | My Tickets, returned updatedFrom/updatedTo, updatedAt descending |

Use the exact typed descriptors returned by the API; do not recompute time boundaries using the browser clock. Show up to five recentTickets ordered by backend updatedAt DESC,id DESC. Each row has Ticket number, summary, text status and last-updated time, with an accessible Open Ticket action. View all uses the updated-time descriptor. No duplicate full My Tickets table or arbitrary client-side filtering of all Tickets.

Show the last generatedAt in Asia/Bangkok with a concise seven-day-window explanation. Recent-resolution help says older Tickets without a recorded resolution date are excluded; it must not imply zero old resolved Tickets exist. On genuine empty success, display zero cards and a helpful Create Ticket action. No recent items gets its own empty text even if other counts are nonzero. A failed request displays retry feedback, not zero metrics. Requesters see no action-history controls, private notes, account statistics or staff-only work list.

## 3. IT Staff / Administrator Dashboard

Both roles call GET `/api/dashboard/staff` and use the same operational screen; “My” always means the current session user.

| Area | Data | Interaction |
|---|---|---|
| Unassigned active tickets | metrics.unassignedActiveTickets | Queue statusGroup=active, ownerId=unassigned |
| My active tickets | metrics.myActiveTickets | Queue statusGroup=active, ownerId=me |
| Tickets by status | metrics.ticketsByStatus, all eight buckets | Selected status Queue filter |
| Active tickets by IT Priority | metrics.activeTicketsByItPriority, four buckets | Queue statusGroup=active plus selected itPriority |
| My outstanding actions | metrics.myOutstandingActions and myActions preview | Paginated My Actions panel; each item opens parent Actions area |
| Recently updated tickets | recentTickets, at most five | Ticket detail; View all uses exact returned updated-time Queue filters |

Status/priority groups use compact labelled counts rather than a chart-only presentation. Include zero buckets and readable names. Zero-count drill-down remains usable and yields the filtered no-results state. Do not add user-account count cards or SLA/urgency signals.

My Actions preview/list shows current assigned PLANNED/IN_PROGRESS work on active parents in their current cycle, oldest createdAt then id first. The full panel calls GET `/api/staff/actions?assigneeId=me&state=outstanding` with pagination; total is not preview length. On detail navigation, select/focus the corresponding action without implying permission to mutate unrelated Ticket fields.

Administrator queue/detail reads are new, but claim/reassign Ticket owner, formal status changes, discussion posting and attachment byte operations remain unavailable. Reuse the existing Administrator general `TicketDetail.tsx` presentation where practical, adding the shared Actions component; do not give permissions through a broad “not Requester” check. Staff `StaffTicketDetail.tsx` retains staff operations. Both use role checks and API capabilities consistently.

## 4. Actions Taken on Ticket Detail

Add a labelled Actions Taken section using the existing card/tab conventions. Requesters see every current and historical-cycle action, including cancelled items, on their owned Ticket. Staff/Admin see the same shared content plus permitted forms/history. State explicitly: **Actions Taken content is visible to the Requester. Use Internal Notes for private discussion.** This text explains privacy, not backend implementation details.

List order is cycle ASC, createdAt ASC,id ASC. Group by work cycle, marking the current one. Previous-cycle/cancelled records remain readable; no “delete” control. Each row/card exposes description, action-created time, status, assignee, performer or “Not yet performed,” result, follow-up flag/note, attachment notes and completion/cancellation metadata. Show creator separately as “Created by”; never label the creator as performer before completion. Display all timestamps in Asia/Bangkok and retain an explicit zone label/help. Assignment need not match Ticket Owner.

| Mode | Inputs / controls | Rules and feedback |
|---|---|---|
| Read | Safe text fields, status labels, cycle, identity/time metadata | Own Requester read-only; completed/old-cycle/cancelled restrictions visible |
| Create | Description required; eligible assignee defaults to self; optional draft result; follow-up checkbox/conditional note; attachment notes | Server-owned identity/status/time not editable; retain stable clientRequestId through retries |
| Edit planned/in-progress | Description/result/assignee/follow-up/attachment notes; optional change reason | Current versions required; assignee change explicit, no silent self-assignment |
| Start | Start action button | PLANNED, current eligible assignee, active current-cycle parent |
| Complete | Result required; explicit follow-up checkbox, conditional note; attachment notes | IN_PROGRESS, current eligible assignee; show authenticated completion identity read-only |
| Cancel | Confirmation dialog and required reason | PLANNED/IN_PROGRESS only; retain record, warn it is shared |
| Correct completed | Editable description/result/follow-up/attachment notes; required change reason | Parent active/current cycle only; assignment/performer/times remain read-only |
| History | Paginated revision list/detail, actor/time/operation/reason and snapshot | Staff/Admin only; version ascending, no edit/delete buttons |

Use API input lengths exactly (description/result/reason 4000, follow-up/attachment note 2000), associated hints and inline errors. Allow normal editing without an API request on every keystroke. Explicit null clears optional text; omission preserves fields during edits. A true follow-up flag requires its note. Clearing completed follow-up requires an explained correction; retain previous note/history. Content editing can recover an unavailable assignee; start/complete remain blocked until reassignment. Only permitted actors see start/complete; other Staff/Admin can explicitly reassign first.

Pending mutation disables its submit controls and announces progress. Keep one logical creation UUID while retrying the same submission. If a lost-response create is uncertain, retry the exact retained payload/key before editing it; otherwise the server correctly rejects changed semantics with the same key. After confirmed success, clear that form and generate a new key only for a new action. Do not optimistically append phantom rows. A replay can return a later current action state and should display that authoritative state.

## 5. Ticket Status and Resolution Feedback

Display the eight existing status labels and separate Requested/IT Priority. Use the detail response's permittedTransitions instead of maintaining a contradictory client transition matrix. Staff see only valid source edges; show disabled business-blocked transitions with explanations. Requesters/Admin have no formal transition control. Backend remains authoritative if data changes after rendering.

Resolve confirmation explains missing eligible owner, completed-work requirement, unfinished count and outstanding-follow-up count. Disabled Resolve gives links/focus to the Actions or owner area. Cancel Ticket explains unfinished Actions must first be completed/cancelled; completed follow-ups do not prevent cancellation. Cancel/reopen require the existing public reason and confirmation. Closing a legacy resolved Ticket does not demand invented work.

After successful mutation, replace Ticket detail/workflow versions from the response, reload relevant Actions/summary, and invalidate dashboard data for the next display. Reopen shows the new cycle, preserves historical groups, clears old resolution indication and requires new work. Requester “Problem Appears Resolved” remains advisory, uses expectedCycle, and never updates the displayed formal status optimistically. Same-cycle success/repeat keeps its recorded indication; stale-cycle conflict reloads before another request.

## 6. Feedback and Recovery Contract

| State | Presentation and recovery |
|---|---|
| Loading | Labelled status/skeleton; no false zeros, stale private data or enabled duplicate submit |
| Success | Polite announcement; update real response data; keep navigation context |
| Validation | Field-associated error and concise summary; focus first invalid field; retain entered values |
| Empty | Clear successful-zero state and permitted next action |
| Filtered no-results | Explain filters and provide Clear filters/return to dashboard |
| Forbidden | Distinct Access denied; navigate to permitted home, not endless Retry |
| Not found | Safe unavailable message without disclosing another Requester's Ticket; return to list |
| Stale/conflict | Explain newer work exists; retain draft, reload latest data separately, require review and explicit resubmission |
| Resolution/cancellation blocked | Show safe server blocker counts and relevant section link; preserve reason/input |
| Network/safe API failure | Retry; retain non-secret draft; distinguish uncertain mutation from confirmed rejection |
| Session expired/password required | Existing auth gate; clear private view state, sign-in/change-password recovery |

Never auto-merge a stale form onto new versions, silently create a second Action after uncertain success, or clear an important draft for an ordinary 400/409/500/network error. Reload must not overwrite a retained draft; show latest record and let the user discard or explicitly reapply reviewed changes. Returning to Dashboard refreshes invalidated counts; no background real-time infrastructure is required. Announce updated data without moving focus unnecessarily.

## 7. Zen Green, Responsive and Accessibility

Reuse `--primary-green: #006b3c`, `--secondary-green: #0b7a46`, `--pale-green: #eaf6ef`, `--page-bg: #f5f7f6`, existing surface/text/error/warning tokens, zen-card/buttons/nav pills/status/priority classes. Preserve separate status and priority meanings; always provide text, never color alone. Validate contrast on actual combinations rather than assuming a token makes every usage accessible. New action badges should reuse semantic styles with explicit text.

Reference viewports: desktop 1280×800, tablet 768×1024, mobile 375×812; also test existing queue breakpoint boundaries. Metric cards use 4/2/1-column arrangement when content fits; status/priority groups wrap. Action tables become stacked labelled cards on narrow screens. Long summaries, names and notes wrap without clipped controls, overlapping text or page-level horizontal overflow. Keep scoped table scrolling only where necessary, labelled and keyboard usable; it must not become horizontal page scrolling. Preserve logical reading/tab order.

- Real headings, labelled nav/regions, native buttons/links and semantic table headers.
- Associate labels, required markers, hints and errors via IDs; read-only values must be distinguishable from disabled editable inputs.
- Keyboard access to cards, filters, pagination, lifecycle controls and history; visible focus everywhere.
- Use existing useDialogFocus for initial focus, Tab/Shift+Tab trap, Escape and return to trigger; test disabled/busy controls and only one active dialog.
- During a pending mutation, Escape/close must not misleadingly cancel a committed request; retain the existing busy-guard pattern and announce completion/failure.
- Use polite live regions for loading/success/count changes and alerts for blocking errors, without repeated duplicate announcements.
- Aim for at least 44×44 CSS-pixel touch targets through sizing/spacing for primary interactive controls, consistent with the retained Lab 3 checklist.
- Do not persist drafts, credentials or private dashboard data in localStorage or new browser storage. Keep application-state recovery within the authenticated session.

## 8. Visual and Accessibility Evidence Checklist

All entries below are **pending**, not passing claims. Screenshots planned under `artifacts/lab-04/screenshots/staff-dashboard/`, `requester-dashboard/`, `actions-taken/`; add workflow captures as needed within Lab 4 artifacts only. Preserve the entire Lab 3 evidence tree. Each capture needs actual revision, viewport, date, state, and any injected failure label. No passwords/cookies or private real-user data.

- [ ] Requester/Staff/Admin navigation and active page at all reference viewports.
- [ ] Every metric matches the captured fixture query; zero and nonzero states distinguished.
- [ ] Actions list/create/edit/complete/cancel/history and Requester read-only views are readable.
- [ ] Creator/assignee/performer, historical cycle and unavailable assignee labels are accurate.
- [ ] Gate/validation/conflict/forbidden/not-found/network feedback is distinct and usable.
- [ ] Keyboard order, field associations, error announcements and modal focus/Escape/return work.
- [ ] Text/status/priority/private-vs-shared meanings are not color-only and have suitable contrast.
- [ ] Long content and tablet/mobile layouts have no clipped labels, overlap or horizontal page overflow.
- [ ] Draft recovery and duplicate prevention work under delayed/lost responses.
- [ ] Baseline tablet My Tickets header/select clipping and User Management heading wrapping are reassessed and fixed in authorized hardening work.
- [ ] Human visual/accessibility inspection identity, date, findings and follow-up are recorded; automated overflow assertions alone are insufficient.

No screenshots, source edits or application executions are part of this document-only phase.
