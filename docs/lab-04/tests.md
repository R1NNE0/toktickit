# Lab 4 Test DD Plan, Traceability and Evidence

Status: **Planned / Not Run. No Lab 4 application tests, builds, migrations, seed scripts or browser captures have been executed in Phase 2B.** Prepared 2026-10-27 (Asia/Bangkok), baseline `abcfbbf`.

Sources: [specification](specification.md), [API](api-spec.md), [UI](ui-spec.md), authoritative handout §10 and submission Parts 1–9. Every L4-prefixed ID is scoped to this increment; historical Lab 3 IDs are not renamed. Automated paths below are planned targets, not claims that those files exist. Manual rows explicitly identify their future evidence location.

## 1. Test-First Strategy and Isolation

Use existing Vitest/Supertest/PostgreSQL API tests, Vitest/React Testing Library/user-event components, and Playwright Chromium. Approve contract/test intent before coding; on each feature branch write and run a focused failing behavior test, record why it failed, implement the smallest change, then verify green and relevant regression. Do not weaken tests to retain an old passing count. One test ID may represent many cases; ID totals are not executed-test totals.

Existing reusable infrastructure:

- `server/tests/lab-03/safety.ts`, `setup.ts`, `global-setup.ts`: positive test DB/upload guards; global setup drops/recreates the isolated schema. Never run against development port 5433.
- `server/tests/lab-03/legacy-session.ts`: real PostgreSQL sessions and CSRF headers for retained business tests. Use real cookie-agent login for authentication/authorization integration, not only forged test headers.
- `server/tests/lab-03/auth-concurrency.api.test.ts`: event barriers and real DB operations to force races; no timing-only sleeps or mocked transaction correctness.
- `server/tests/lab-03/migration-regression.test.ts`: legacy column snapshots, isolated migration/provisioning failure/retry patterns and create-only seed checks.
- `client/tests/setup.ts`, existing API mocks/fixtures in `client/tests/lab-03/`: component state and interaction helpers. Both `client/tests/` and `client/src/tests/lab-02/` remain included.
- `e2e/lab-03/fixtures.ts`: generated role accounts, login, CSRF mutation, ticket creation, safe upload cleanup, navigation and noOverflow helpers.
- `e2e/playwright.config.ts`: current testDir is only lab-03; future implementation must include both labs. Evidence capture remains opt-in through a separate config, not counted as product E2E.

Retain the positively guarded disposable database `toktickit_lab3_test` on localhost/127.0.0.1:55433, NODE_ENV=test and isolated `uploads/lab-03-test` until an explicitly reviewed infrastructure change. Its historical name is not a reason to change production/environment configuration. Run server/browser suites sequentially against the shared disposable DB. Guard before importing app code, which may create an upload directory. No tests run in this documentation phase.

New fixture cleanup must remove dependent Action revisions/Actions before Tickets/Users where restrictive FKs apply, and only records owned by positively identified test fixtures. Never invoke production resets. Snapshot previous user IDs/credentials/statuses/timestamps, Tickets, attachments including bytes/removal metadata, Public Comments, Internal Notes and existing role mappings before migration. Include two Requesters, zero-ticket Requester, active/inactive Staff, at least two Admins, staff-to-Requester role changes, all Ticket/action statuses, all priorities, all cycles/owner/follow-up cases.

## 2. Planned Test Matrix

### 2.1 Unit

| Test ID | Type | Requirement / AC references | Scenarios | Expected result | Planned automated test file | Execution status |
|---|---|---|---|---|---|---|
| L4-UNIT-01 | Unit | FR-02, FR-06; BR-03, BR-05, BR-10, BR-42; AC-03, AC-07 | Unicode length boundaries, trimming/nulls, required follow-up, positive IDs/versions, unknown/server fields | Exact limits/types and resulting-state validation, no unchecked coercion | `server/tests/lab-04/action-validation.unit.test.ts` | Planned / Not Run |
| L4-UNIT-02 | Unit | FR-04, FR-05; BR-04, BR-07, BR-08, BR-09, BR-11; AC-05, AC-06 | All four-state source/target pairs, actor/assignee, completed correction/old-cycle/read-only predicates | Only approved transitions/edits; terminal metadata cannot be rewritten | `server/tests/lab-04/action-workflow.unit.test.ts` | Planned / Not Run |
| L4-UNIT-03 | Unit | FR-08, FR-09, FR-10, FR-11; BR-17, BR-18, BR-19, BR-20, BR-21, BR-22; AC-10, AC-11, AC-12, AC-13 | All 64 Ticket pairs and gate truth table including only-cancelled/old-cycle work | Same 15 edges; exact gate/no hidden status transitions | `server/tests/lab-04/ticket-workflow.unit.test.ts` | Planned / Not Run |
| L4-UNIT-04 | Unit | FR-13, FR-14, FR-15; BR-29, BR-30, BR-32, BR-33; AC-14, AC-15, AC-16 | Predicate builders, status groups, recent bounds, bucket order, UTC conversion, descriptor filters | Dashboard and list share equivalent normalized predicates | `server/tests/lab-04/dashboard-query.unit.test.ts` | Planned / Not Run |
| L4-UNIT-05 | Unit | FR-12; BR-24, BR-27, BR-28; AC-08, AC-09 | Canonical fingerprints, default assignee/nulls, excluded version/key, integer bounds/no-op rules | Same semantics hash identically; changed semantics differ; no version wrap | `server/tests/lab-04/idempotency.unit.test.ts` | Planned / Not Run |

### 2.2 API, Integration and Security

| Test ID | Type | Requirement / AC references | Scenarios | Expected result | Planned automated test file | Execution status |
|---|---|---|---|---|---|---|
| L4-API-01 | API | FR-02; BR-01, BR-02, BR-03, BR-05, BR-06; AC-03 | Create different owner/assignee, omitted defaults, invalid/inactive target, forged actor/cycle/time/status, validation limits | 201/Location, version 1, correct attribution/current cycle; invalid requests write nothing | `server/tests/lab-04/actions-taken.api.test.ts` | Planned / Not Run |
| L4-API-02 | API/ownership | FR-03, FR-07; BR-13, BR-15, BR-34; AC-04 | Two Requesters; omitted cycle returns all cycles/cancelled actions; valid cycle filters to that cycle; specified cycle with no matches; missing/parent mismatch; ties/pagination/out-of-range page | Complete own visibility and exact cycle filtering; no-match cycle returns data=[], totalItems=0, totalPages=1 with requested/default page and pageSize retained; stable order, safe identical 404s and bounded pagination remain enforced | `server/tests/lab-04/actions-taken.api.test.ts` | Planned / Not Run |
| L4-API-03 | API/audit | FR-04; BR-08, BR-09, BR-12; AC-06 | Content/reassignment/multi-field edits, completed correction reason, immutable fields, current-version no-op | Exactly one appropriate revision/increment per actual request; no-op preserves timestamps | `server/tests/lab-04/actions-taken.api.test.ts` | Planned / Not Run |
| L4-API-04 | API/lifecycle | FR-05; BR-04, BR-07, BR-11; AC-05 | Start/complete/cancel edges, self/terminal edges, non-assignee and unavailable assignee; Admin completion | Valid edges only; actual authenticated performer/time; safe 400/403/409 distinctions | `server/tests/lab-04/actions-taken.api.test.ts` | Planned / Not Run |
| L4-API-05 | API/follow-up | FR-06; BR-05, BR-09, BR-10; AC-07 | Complete with follow-up, missing note, clearing flag/reason, retain notes and prior revision | Follow-up can remain on completion; explained clearance preserves history | `server/tests/lab-04/actions-taken.api.test.ts` | Planned / Not Run |
| L4-API-06 | API/security | FR-07, FR-19; BR-14, BR-15, BR-16, BR-34; AC-04, AC-20 | Full role/route/method matrix, requester identity overrides, child mismatch and Admin old denials | Only approved operational reads/Action mutations added; delete/revision writes denied | `server/tests/lab-04/authorization.api.test.ts` | Planned / Not Run |
| L4-API-07 | API/security | FR-19; BR-34, BR-35, BR-42; AC-20 | Anonymous/expired/revoked/inactive/restricted sessions, missing/wrong CSRF/Origin, oversized JSON, literal HTML text | Existing auth gates remain; safe errors/no secrets; no mutation on denial | `server/tests/lab-04/authorization.api.test.ts` | Planned / Not Run |
| L4-API-08 | API/workflow | FR-08; BR-17, BR-18; AC-10 | All 64 Ticket pairs with independently constructed fixtures, role denials, confirmation/reason/owner checks | Exactly retained 15 edges; atomic public reasons; no Requester/Admin formal status | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned / Not Run |
| L4-API-09 | API/gate | FR-09; BR-19, BR-25; AC-11 | Zero/only-cancelled/unfinished/follow-up/owner-invalid gates, qualifying current-cycle work, direct API bypass | RESOLUTION_BLOCKED counts correct; success sets actual resolvedAt and one version increment | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned / Not Run |
| L4-API-10 | API/legacy | FR-10, FR-16; BR-20, BR-21; AC-12 | Cancel unfinished versus finished/cancelled Actions, completed follow-up on cancel, historical resolved zero-action close | No silent cascade; reason/history retained; legacy close allowed with resolvedAt still null | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned / Not Run |
| L4-API-11 | API/cycles | FR-11; BR-22, BR-23; AC-13 | Reopen resolved/closed, old-action gate exclusion, indication repeat/wrong-cycle/terminal/cross-owner | New cycle and cleared resolution fields; advisory no formal status/no duplicate touch | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned / Not Run |
| L4-API-12 | API/metrics | FR-13; BR-29, BR-30, BR-31, BR-33; AC-14 | Requester totals for all statuses; lower/upper time equality, future/null dates, reopen, ties/preview cap/zero | Match independent SQL expectations; no cross-owner data; exact 168-hour UTC window | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned / Not Run |
| L4-API-13 | API/metrics | FR-14; BR-29, BR-30, BR-31; AC-15 | Staff/Admin totals, all priority/status buckets, owner=null/me/other, assigned actions old cycles/terminal parent | Exact zero-filled groups and personal scope; bounded five-row previews and full total | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned / Not Run |
| L4-API-14 | API/drill-down | FR-15; BR-32, BR-42; AC-16 | Every metric descriptor replayed into list API; me, groups, time pairs, contradictory aliases, old page defaults/sizes | Same matching IDs/counts on stable fixtures; validation and historical list compatibility | `server/tests/lab-04/dashboard-drilldown.api.test.ts` | Planned / Not Run |
| L4-API-15 | API/audit | FR-03, FR-04; BR-12, BR-13, BR-15, BR-16; AC-04, AC-06 | Revision snapshot identity fields/sequence; denied history/delete; profile role/name change; previous-cycle reads | Honest retained IDs/current labels; no history leaks or mutable audit endpoints | `server/tests/lab-04/actions-taken.api.test.ts` | Planned / Not Run |
| L4-API-16 | API/regression | FR-01, FR-12; BR-18, BR-24, BR-28; AC-09, AC-21 | Claim/owner/priority versions, no-op timestamps, Requested Priority unchanged, updated DTO parity | Explicit stale protection and independent field preservation; all detail responses consistent | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned / Not Run |

### 2.3 Deterministic Concurrency

| Test ID | Type | Requirement / AC references | Scenarios | Expected result | Planned automated test file | Execution status |
|---|---|---|---|---|---|---|
| L4-CON-01 | Concurrent API | FR-12; BR-27; AC-08 | Same-key simultaneous creates, different-body/key reuse, different parents, exact retry after completion/reopen/deactivation | One Action/revision; authorized exact replay 200; changed semantics 409; no orphan writes | `server/tests/lab-04/concurrency.api.test.ts` | Planned / Not Run |
| L4-CON-02 | Concurrent API | FR-12; BR-24, BR-28; AC-09 | Two action edits/completions or Ticket transitions from same expected versions; both mismatch; lost response retry | At most one success, safe stale code/current versions, no duplicate history/reason | `server/tests/lab-04/concurrency.api.test.ts` | Planned / Not Run |
| L4-CON-03 | Concurrent API | FR-09, FR-12; BR-19, BR-25; AC-09, AC-11 | Hold action create/edit/follow-up-clear at barriers against resolution in both commit orders | Gate sees serialized state; no newly unfinished work on resolved parent or stale resolution | `server/tests/lab-04/concurrency.api.test.ts` | Planned / Not Run |
| L4-CON-04 | Concurrent API | FR-05, FR-12; BR-03, BR-18, BR-26; AC-09 | Claim/claim, assignment/start/complete/resolution versus deactivate/demote, multiple affected Tickets | No ineligible new owner/assignee/start/complete; versioned owner unassignment; historical attribution retained | `server/tests/lab-04/concurrency.api.test.ts` | Planned / Not Run |
| L4-CON-05 | Concurrent API | FR-11; BR-22, BR-23, BR-25; AC-13 | Indication versus resolution/reopen, two indications; stale prior-cycle submission | Advisory never rewrites status; one same-cycle timestamp; reopened cycle not contaminated | `server/tests/lab-04/concurrency.api.test.ts` | Planned / Not Run |
| L4-CON-06 | Transaction/failure | FR-12, FR-19; BR-12, BR-25, BR-28; AC-09, AC-20 | Fail after Action/revision/reason write before commit; bounded deadlock/serialization retry and exhaustion | Complete rollback; no retry of a committed write; safe CONCURRENT_UPDATE after limit | `server/tests/lab-04/concurrency.api.test.ts` | Planned / Not Run |

### 2.4 Migration and Seed

| Test ID | Type | Requirement / AC references | Scenarios | Expected result | Planned automated test file | Execution status |
|---|---|---|---|---|---|---|
| L4-MIG-01 | Migration/regression | FR-01, FR-16; BR-21, BR-36; AC-01 | Fresh schema and real Lab 3 snapshot upgrade, all old entities/IDs/timestamps/bytes, constraints/defaults | Historical snapshots identical; version/cycle=1, unknown resolvedAt=null, no invented Actions | `server/tests/lab-04/migration-regression.test.ts` | Planned / Not Run |
| L4-MIG-02 | Seed/integration | FR-17; BR-12, BR-37; AC-02 | Two runs, modified retained fixture/account/progress, zero/one/multiple actions, all statuses/priorities/roles | No overwrite/duplicates/credential reset; coherent action lifecycle/revision fixtures | `server/tests/lab-04/seed.test.ts` | Planned / Not Run |
| L4-MIG-03 | Recovery | FR-16; BR-38; AC-01 | Inject migration/seed failure, retry; restore backup plus matching uploads in disposable environment | No stranded partial data; recovery reproducible; old unsafe writable app is not fallback | `server/tests/lab-04/migration-regression.test.ts` | Planned / Not Run |
| L4-MIG-04 | DB integration | FR-13, FR-16; BR-30, BR-33, BR-36; AC-01, AC-14 | Existing UTC naive timestamps versus new timestamptz under alternate session timezones; constraints/index presence | Same window results, no historical timestamp reinterpretation; documented constraints/indexes present | `server/tests/lab-04/migration-regression.test.ts` | Planned / Not Run |

### 2.5 Components, Style, Responsive and Accessibility

| Test ID | Type | Requirement / AC references | Scenarios | Expected result | Planned automated test file | Execution status |
|---|---|---|---|---|---|---|
| L4-UI-01 | Component | FR-02, FR-04, FR-05, FR-06; BR-04, BR-09, BR-10, BR-15; AC-17 | Create/list/edit/reassign/start/complete/cancel/history, Requester read-only, unavailable assignee/old cycles | Correct inputs/identity timing, role controls and immutable-field display | `client/tests/lab-04/ActionsTaken.test.tsx` | Planned / Not Run |
| L4-UI-02 | Component | FR-08, FR-09, FR-10, FR-11; BR-17, BR-19, BR-20, BR-23; AC-18 | Server transition options, gate counts, reason confirmation, reopen/advisory, successful refresh | Only Staff formal controls; real summary/versions refreshed; no client bypass policy | `client/tests/lab-04/TicketWorkflow.test.tsx` | Planned / Not Run |
| L4-UI-03 | Component | FR-13, FR-19; BR-31, BR-33, BR-40; AC-14, AC-18 | Requester metric/recent rendering; loading/zero/partial-no-recent/forbidden/error/retry | Exact keys/labels/timezone; failure never shown as zero; no foreign data | `client/tests/lab-04/RequesterDashboard.test.tsx` | Planned / Not Run |
| L4-UI-04 | Component | FR-14, FR-19; BR-14, BR-31, BR-40; AC-15, AC-18 | Staff/Admin maps/myActions/full panel, zero buckets, errors and personal identity changes | Approved operational views with no inherited forbidden mutations | `client/tests/lab-04/StaffDashboard.test.tsx` | Planned / Not Run |
| L4-UI-05 | Component/navigation | FR-15; BR-32, BR-40; AC-16 | All descriptors, reset page/old filters, return state, existing hash links, default role landing and dirty guard | Correct existing destinations/filter scope; no routing regression | `client/tests/lab-04/DashboardNavigation.test.tsx` | Planned / Not Run |
| L4-UI-06 | Component/failure | FR-12, FR-18, FR-19; BR-27, BR-28, BR-35, BR-40; AC-17, AC-18 | Delayed clicks/lost create reply/replay mismatch, stale reload with retained draft, 400/409/500/offline/401 | One logical key/submission; manual review before resubmit; private state cleared only at auth boundary | `client/tests/lab-04/ActionsTaken.test.tsx` | Planned / Not Run |
| L4-STYLE-01 | UI style | FR-18; BR-40; AC-19 | Raw tokens/classes, action/status/priority labels, required/read-only/invalid/busy field semantics | Zen Green preserved; meaning not color-only; labels/error associations valid | `client/tests/lab-04/ZenGreen.test.tsx` | Planned / Not Run |
| L4-RESP-01 | Browser responsive | FR-18; BR-40; AC-19 | 1280×800,768×1024,375×812, queue boundary widths; long names/text and dialogs; old tablet findings | No page overflow/clipping/overlap; readable stacked layouts; regression findings closed or explicit | `e2e/lab-04/responsive.spec.ts` | Planned / Not Run |
| L4-RESP-02 | Browser accessibility | FR-18; BR-40; AC-19 | Keyboard cards/menu/filter/forms, Tab/Shift+Tab, Escape/busy modal, focus return, field errors/live announcements | All interactions operable; meaningful labels/focus and retained context | `e2e/lab-04/responsive.spec.ts` | Planned / Not Run |

### 2.6 End-to-End, Regression, Performance and Delivery

| Test ID | Type | Requirement / AC references | Scenarios | Expected result | Planned automated test file / evidence | Execution status |
|---|---|---|---|---|---|---|
| L4-E2E-01 | Browser E2E | FR-02, FR-04, FR-05; BR-01, BR-04, BR-12; AC-03, AC-05, AC-06, AC-17 | Staff creates for different assignee; other Staff/Admin starts/completes; edit/cancel/history; Requester sees shared work | Real server identities/lifecycle/history/UI agree; no private data leakage | `e2e/lab-04/actions-taken-flow.spec.ts` | Planned / Not Run |
| L4-E2E-02 | Browser E2E | FR-09, FR-10, FR-11; BR-19, BR-20, BR-21, BR-22, BR-23; AC-11, AC-12, AC-13 | Fail gate, finish/clear follow-up, resolve/close/reopen/new work; cancel unfinished; Requester indication | Full current-cycle workflow and clear recoverable feedback, including legacy close | `e2e/lab-04/ticket-resolution.spec.ts` | Planned / Not Run |
| L4-E2E-03 | Browser E2E | FR-13, FR-14, FR-15; BR-29, BR-31, BR-32; AC-14, AC-15, AC-16 | All three role dashboards, fixture-query comparisons, card/list/action drill-down and refresh after mutations | Correct counts/filters, ownership and navigation on real data | `e2e/lab-04/dashboards.spec.ts` | Planned / Not Run |
| L4-E2E-04 | Browser regression | FR-01, FR-07, FR-19; BR-14, BR-15, BR-34, BR-35; AC-04, AC-20, AC-21 | Migrated Requester login/change, create/list/detail/files/comments; Staff notes; Admin users; direct new endpoint denials | Complete retained journeys plus new ownership/role security | `e2e/lab-04/regression.spec.ts` | Planned / Not Run |
| L4-REG-01 | Full regression | FR-01, FR-20; BR-35, BR-41; AC-21 | Execute all retained backend/client/browser suites with requirement-linked caller updates | No unexplained lost/skipped/disabled tests; historical behavior maintained | Existing `server/tests/lab-01/`, `server/tests/lab-02/`, `server/tests/lab-03/`, `client/tests/`, `client/src/tests/lab-02/`, `e2e/lab-03/` | Planned / Not Run |
| L4-REG-02 | API/UI regression | FR-01, FR-20; BR-18, BR-26, BR-40; AC-21 | Prior sort ties, Staff file bytes/Unicode/missing files, priority no-op, self-reset, discussion pagination/save-error, owner metadata/queue indications | Previously partial scenarios gain actual assertions; unchanged denials/history remain | `server/tests/lab-04/regression.api.test.ts`, `client/tests/lab-04/Regression.test.tsx` | Planned / Not Run |
| L4-PERF-01 | Performance smoke | FR-14, FR-20; BR-31, BR-39; AC-22 | Deterministic 300-Ticket/900-Action fixture, six data SELECT cap, five-row previews, 20 timed requests after five warm-ups | Bounded work/payload independent of page totals; local p95 <=1000 ms with recorded environment | `server/tests/lab-04/dashboard-performance.test.ts` | Planned / Not Run |
| L4-BUILD-01 | Build/startup | FR-01, FR-20; BR-41; AC-23 | Both production builds; package start points to actual built entry; health/authenticated read then shutdown | Build/start exit successfully and read real DB; no development data reset | Future command output in `artifacts/lab-04/verification/`; manual command verification, no invented test file | Planned / Not Run |
| L4-BUILD-02 | Runner discovery | FR-20; BR-41; AC-23 | List configured suites after safe setup; Lab 4 and retained suites selected, captures excluded | No missing new files or accidental evidence-test inclusion; report actual counts | Future test-list/configuration review output in `artifacts/lab-04/verification/` | Planned / Not Run |
| L4-EVID-01 | Contract review/manual | FR-20; BR-41; AC-24 | FR/BR/AC links, exact API/UI agreements, handout decisions, spec before implementation history | Real reviewed contract/chronology; all ACs traceable, no fictional approval | `docs/lab-04/reviewer.md` plus actual future PR history | Planned / Not Run |
| L4-EVID-02 | Visual/manual | FR-18; BR-40, BR-41; AC-19 | Human contrast/readability/focus/touch-target review of all viewports and important states | Actual findings, sign-off and remaining limitations, not geometry-only claims | Future `artifacts/lab-04/screenshots/` index and `docs/lab-04/ui-spec.md` checklist | Planned / Not Run |
| L4-EVID-03 | Release/manual | FR-20; BR-41; AC-24 | Actual Issues/board/feature reviews/staging/main, final SHA/output, reviewer/AI reflection, Answer Parts 1–9 | Complete truthful submission evidence with working links and actual peer approvals | `docs/lab-04/reviewer.md`, `docs/lab-04/ai-use.md`, future final verification/submission records | Planned / Not Run |

## 3. Acceptance-Criterion Traceability

| Acceptance criterion | Planned tests |
|---|---|
| AC-01 | L4-MIG-01, L4-MIG-03, L4-MIG-04 |
| AC-02 | L4-MIG-02 |
| AC-03 | L4-UNIT-01, L4-API-01, L4-E2E-01 |
| AC-04 | L4-API-02, L4-API-06, L4-API-15, L4-E2E-04 |
| AC-05 | L4-UNIT-02, L4-API-04, L4-E2E-01 |
| AC-06 | L4-UNIT-02, L4-API-03, L4-API-15, L4-E2E-01 |
| AC-07 | L4-UNIT-01, L4-API-05 |
| AC-08 | L4-UNIT-05, L4-CON-01 |
| AC-09 | L4-UNIT-05, L4-API-16, L4-CON-02, L4-CON-03, L4-CON-04, L4-CON-06 |
| AC-10 | L4-UNIT-03, L4-API-08 |
| AC-11 | L4-UNIT-03, L4-API-09, L4-CON-03, L4-E2E-02 |
| AC-12 | L4-UNIT-03, L4-API-10, L4-E2E-02 |
| AC-13 | L4-UNIT-03, L4-API-11, L4-CON-05, L4-E2E-02 |
| AC-14 | L4-UNIT-04, L4-API-12, L4-MIG-04, L4-UI-03, L4-E2E-03 |
| AC-15 | L4-UNIT-04, L4-API-13, L4-UI-04, L4-E2E-03 |
| AC-16 | L4-UNIT-04, L4-API-14, L4-UI-05, L4-E2E-03 |
| AC-17 | L4-UI-01, L4-UI-06, L4-E2E-01 |
| AC-18 | L4-UI-02, L4-UI-03, L4-UI-04, L4-UI-06 |
| AC-19 | L4-STYLE-01, L4-RESP-01, L4-RESP-02, L4-EVID-02 |
| AC-20 | L4-API-06, L4-API-07, L4-CON-06, L4-E2E-04 |
| AC-21 | L4-API-16, L4-E2E-04, L4-REG-01, L4-REG-02 |
| AC-22 | L4-PERF-01 |
| AC-23 | L4-BUILD-01, L4-BUILD-02 |
| AC-24 | L4-EVID-01, L4-EVID-03 |

## 4. Performance-Smoke Fixture and Measurement

ED-15 uses **300 synthetic Ticket fixtures and 900 Action fixtures**, not a mandatory 10,000-Ticket load. Base reference/seed rows may already exist in the guarded disposable database; record actual total row counts and include them in independent expected aggregates. Use a dedicated fixture marker, deterministic request UUIDs, no real-user data, and clean up only that marker. Test fixture creation is not the normal development seed.

For Ticket ordinal i=0..299, rotate all eight statuses and four priorities deterministically, assign Requesters among six fixture accounts plus a seventh zero-ticket Requester, and rotate null/Staff A/Staff B/Admin owners. Use action-count groups 0,1,8 repeated 100 times, totaling 900. Select action states consistent with parent terminal/active rules, include current/old-cycle records and eligible follow-up cases, and create coherent lifecycle revisions rather than fabricating an impossible completion snapshot. Keep current terminal fixtures free of unfinished work except explicitly labelled historical preservation cases in separate tests. Expose different owner/assignee/performance identities.

Freeze the query clock in the test harness at a documented UTC instant (example fixture anchor `2026-10-27T05:00:00.000Z`); production clock defaults to the database instant, never a caller-provided HTTP parameter. Include t-168h, just-before/from, just-before/to, t itself, future timestamps and null resolvedAt. Separate deterministic calculation assertions from wall-clock timing.

Measure each role dashboard after five warm-ups, then 20 sequential authenticated requests; p95 is the 19th sorted sample. Include normal endpoint authentication overhead in latency, but count only dashboard data SELECTs for the <=6 query budget (exclude session middleware/transaction setup). Previews remain <=5 each; response JSON UTF-8 <=64 KiB with 200-code-point action excerpts and bounded Ticket summaries. Record hardware, Node/PostgreSQL versions, dataset/total counts, queries, timings, response bytes and revision. Local p95 target <=1000 ms is a smoke threshold, not a production SLA or measured result.

If the target fails, investigate query plans/indexes/N+1 work before changing the target. Expand fixture sizes only to reproduce a demonstrated issue or justify a query/index decision; document why. Do not add mandatory infrastructure or silently weaken thresholds. Timing noise must be reported, not hidden by repeated runs chosen for a passing number.

## 5. Required Changes to Existing Tests

These are future changes, not modifications made by this documentation increment:

- `server/tests/lab-03/workflow.unit.test.ts`: retain independent 15-edge assertions; new gate cases supplement, not replace, them.
- `server/tests/lab-03/staff-ticket-detail.api.test.ts`: supply expected versions and qualifying current-cycle Actions in successful resolution fixtures; add independent gate-negative cases rather than disabling failures.
- `server/tests/lab-03/comments-notes.api.test.ts`: expectedCycle for indication; retain same-cycle idempotency/advisory/no-status-change expectations.
- `server/tests/lab-03/authorization.api.test.ts`, `integration.api.test.ts`, `staff-queue.api.test.ts`: change only Admin operational-read expectations; keep claim/owner/status/posting/file-byte denials. Extend real-session route matrices with new endpoints.
- `server/tests/lab-03/users-admin.api.test.ts`: version increment on owner unassignment; retain self/last-admin, revocation and history safeguards.
- Existing detail/queue/client API tests: additive response fields and required mutation versions; preserve owner-role labels, existing filters/aliases and Requested Priority independence.
- `e2e/lab-03/staff-ticket-flow.spec.ts`: record qualifying work before resolution; preserve the rest of the role journey. Update fixture cleanup for restricted child FKs without broadening cleanup outside test ownership.
- `e2e/playwright.config.ts`: discover lab-03 and lab-04 while retaining safe listeners/DB/upload guards and opt-in evidence separation.
- Existing migration assertions compare all old columns unchanged and new defaults separately; no snapshot rewrite hiding lost data.

Known baseline gaps to close: Requester exhaustive sorting/ties; Staff byte operations and Unicode/missing files; priority no-op/concurrent operations; assignment/deactivation and indication/status races; self-reset; discussion pagination/save-error retention; complete field/focus/touch-target checks; migrated-user-to-browser journey. Reassess tablet My Tickets clipping and User Management wrapping recorded in `artifacts/lab-03/screenshots/README.md`. Baseline Staff Queue hardcodes advisory fields to null; assert actual persisted indications after the fix.

## 6. Future Execution Commands and Evidence

**Not run in Phase 2B.** Execute only after implementation authorization, safe database setup and runner updates. The existing `server/tests/lab-03/safety.ts`/README define explicit isolated environment values; do not copy the development DATABASE_URL into test commands. Do not run server/browser suites concurrently against their shared reset database.

| Directory | Future command / action | Purpose |
|---|---|---|
| server | `npm.cmd test -- tests/lab-04/actions-taken.api.test.ts` (then appropriate focused files) | Test-first red/green evidence after implementation starts |
| server | `npm.cmd test` | All backend Lab 1–4 suites after new files exist |
| client | `npm.cmd test` | All retained and Lab 4 component/unit/style suites |
| e2e | `npx.cmd playwright test --list`, then `npm.cmd test` | Confirm configured discovery, then full retained/Lab 4 browser execution |
| server | `npm.cmd test -- tests/lab-04/dashboard-performance.test.ts` | Isolated measured smoke; avoid concurrent suite load |
| server / client | `npm.cmd run build` separately | Both production builds |
| server | Correct `npm start` to actual built entry during authorized hardening, then `npm.cmd start` with isolated smoke configuration | Verify packaged startup, health and authenticated read; shut down owned process afterward |
| e2e | Future opt-in Lab 4 evidence configuration, exact command recorded when implemented | Sanitized screenshots, separate from regression counts |

Current mismatch: server package start is `node dist/index.js`, while the documented actual output is `dist/src/index.js`. This phase does not fix it; L4-BUILD-01 requires future correction/verification. Do not report the old command as already working. `npm run test:lab3` selects Lab 3 plus Lab 1 and excludes Lab 2; it is not the full regression command.

For each actual run record date/timezone, full SHA/branch/dirty-state description, environment, exact command, exit code, files/cases passed/failed/skipped, complete sanitized output, and limitations. Record an expected red TDD failure separately from final verification. Do not capture generated initial credentials/cookies. Future artifacts belong under `artifacts/lab-04/verification/` or screenshots, never the protected Lab 3 evidence tree. Do not claim earlier workspace/staging output is output from future final main.

## 7. Execution and Submission Register

| Evidence | Current state |
|---|---|
| Lab 4 automated tests | Planned / Not Run; files not created in Phase 2B |
| Migration/seed/recovery | Planned / Not Run |
| UI/browser/performance/build/startup | Planned / Not Run |
| Lab 4 visual/keyboard human sign-off | Planned / Not Run |
| Peer review / Issues / feature PRs | Pending real events; see reviewer.md |
| Final-main SHA and full output | Pending actual release and execution |
| Student reflection | Pending student authorship; see ai-use.md |

Historical Lab 3 documents report 252 server / 87 client / 11 browser cases and both builds passing in their recorded workspace run. No Lab 4 pass count can be inferred from them. Documentation-only consistency checks are separate from this application execution register and will be reported as such.

Submission mapping: Answer Part 1 Git/board/reviews/README/.gitignore/structure; Part 2 specification and chronological evidence; Part 3 traceability and full final-main output; Part 4 actual AI prompts/reflection; Part 5 Staff dashboard metrics/current-user Actions/drill-down; Part 6 Actions lifecycle/assignment/validation/roles; Part 7 Ticket workflow, stable order and append-only evidence; Part 8 Requester dashboard and retained regression; Part 9 Zen Green/responsive/accessibility/visual checklist. One concise readable PDF, exact heading order, working links. No fictional approvals or passing states.

## 8. Phase 2B Documentation-Only Validation

On 2026-10-27, Codex ran inline read-only Python checks (without writing helper files or bytecode) and Git whitespace checks against these six documents. Results: 20 declared FRs, 42 BRs, 24 ACs, 16 EDs, 52 distinct planned test IDs; every AC mapped to declared tests whose rows reference that AC; every FR/BR/AC referenced in the test matrix; no undefined IDs; all 26 relative Markdown links resolved. All test rows remain Planned / Not Run. All 11 minimum handout test filenames are included as planned paths.

Additional static checks matched the 15 Ticket edges to baseline `server/src/workflow.ts`, checked four action transition edges, API Ticket/Action/Priority enums and nine metric keys across specification/API/UI. The documents were also reviewed for the narrow Admin role expansion, matching metric/filter scopes, expected-version/cycle names, legacy null resolution dates, transactional seed graphs and recovery policy. These are document inspections, not executed authorization/migration/query tests.

`git diff --check` reported no whitespace errors. Because the six new files are untracked, each was also checked with `git -c core.autocrlf=false diff --no-index --check -- /dev/null <file>` plus explicit trailing-whitespace/EOF/code-fence checks. No-index exit 1 denotes the expected added-file difference; there were no whitespace diagnostics. The temporary per-command Git setting changes no repository configuration. No application test/build/migration/seed was run; no application pass result or peer approval is implied by these checks.
