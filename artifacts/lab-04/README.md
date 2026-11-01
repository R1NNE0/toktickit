# Lab 4 release evidence and submission index

This index supplements the approved planning documents without rewriting their historical status registers. Product behavior is governed by `docs/lab-04/`; executed workspace verification is recorded in [Issue #54 results](verification/issue-54-results.json). The [release guide](../../docs/lab-04/release.md) explains setup, migration, startup, recovery and commands.

## Provenance and current state

- **Reused actual verification:** Issue #54 recorded 154 frontend passes; 467 backend passes in the broad run; focused recovery, performance and startup passes; 11 retained browser passes; eight existing real-backend Lab 4 passes plus three new responsive passes; seven mocked-API browser passes; both builds passing. These are separate runs, not one invented combined final-main run.
- **Recovery:** actual uniquely owned schema dump/restore with matching upload bytes, failure injection and successful upgrade retry. Seed/migration preservation and failure retry also passed.
- **Performance:** final recorded local p95 Staff 19.79 ms, Administrator 19.16 ms, Requester 12.87 ms, empty Requester 18.19 ms; five/five/three/three dashboard data queries; payloads at most 5,938 bytes. Dataset: 300 fixture Tickets/900 Actions plus base data; five warm-ups then 20 samples per role. See the JSON for environment and limitations.
- **Screenshots:** 46 actual Chromium PNGs from six passing capture scenarios at the three required viewports. See the [gallery](screenshots/README.md) and [provenance/check manifest](screenshots/manifest.json). All PNG hashes/dimensions/inventory were verified. Human visual sign-off remains pending.
- **Revision:** capture HEAD metadata is `7ab7c86f232a37c47f28d1ee5796b3cea5082386` on `docs/lab4-release-evidence`; direct file reads used no Git command. Selected product hashes identify the captured workspace; dirty state was not inspected. Issue #54 results remain earlier workspace evidence. Final-main SHA/output and clean-state confirmation remain student tasks.
- **Raw output:** the existing JSON is a summarized execution record, not complete console output. Complete sanitized final-main logs required by the handout are still pending; do not reconstruct or fabricate them from counts.

## Actual screenshots and capture command

After database identity/storage is reverified, from `e2e`:

```powershell
npx.cmd playwright test --config playwright.lab4-evidence.config.ts
```

The configuration selects **only** `evidence/lab-04.capture.spec.ts`. Do not run the historical evidence configuration for this task: it selects the Lab 3 capture that writes historical screenshots. Actual outputs are under `screenshots/staff-dashboard/`, `screenshots/requester-dashboard/`, `screenshots/actions-taken/` and `screenshots/workflow/`, plus `screenshots/manifest.json`.

| State | Capture method | Actual status |
|---|---|---|
| Staff/Admin/Requester dashboards at 1280×800, 768×1024, 375×812 | Existing real backend and synthetic role accounts | Captured; human review pending |
| Staff and Requester metric/database comparison | Actual dashboard responses compared with independent Prisma counts | Recorded in manifest; equivalent checks also passed in Issue #54 tests |
| Multiple Actions, creator/assignee/performer, assignment/edit | Existing Ticket Detail and real versioned mutations | Captured; human review pending |
| Follow-up validation/completion/correction and immutable history | Actual forms/history modal; scrollable dialogs get a bottom image | Captured; human review pending |
| No-work/follow-up gate, resolution confirmation, terminal/reopened historical cycle | Actual workflow UI | Captured; human review pending |
| Requester read-only work, foreign-Ticket safe error, actual empty dashboard | Existing role/ownership enforcement | Captured; human review pending |
| Inactive assignee rejection and Requester operational-read denial | Actual API checks recorded without credentials in manifest | Actual API status checks recorded in manifest |
| Safe dashboard failure | One explicitly labelled evidence-only HTTP 503 injection rendered by the real UI | Captured and labelled; never describe this as a genuine backend outage |

The runner masks password inputs, records PNG SHA-256, viewport, timestamp, role/state, simulations, source hashes and scenario status. It never reads or changes Lab 3 evidence. Human visual/accessibility review stays pending even after capture assertions pass.

## Acceptance criteria coverage

“Recorded” below means supporting automated workspace verification exists in Issue #54, not a fresh run or final-main approval. Full approved AC wording and planned test mapping remain in [specification §13](../../docs/lab-04/specification.md#13-acceptance-criteria) and [tests.md](../../docs/lab-04/tests.md).

| AC | Available supporting paths | Evidence state / remaining requirement |
|---|---|---|
| AC-01 | `server/tests/lab-04/migration-regression.test.ts` | Recorded fresh/upgrade/preservation, constraints, UTC and actual recovery |
| AC-02 | `server/tests/lab-04/seed.test.ts` | Recorded idempotent graph/history and failure/concurrent retry checks |
| AC-03 | `server/tests/lab-04/actions-taken.api.test.ts` | Recorded valid creation, server-owned identity and validation |
| AC-04 | `server/tests/lab-04/authorization.api.test.ts`; real Actions browser journeys | Recorded ownership/read/history/private-data boundaries |
| AC-05 | Action workflow unit/API and authorization tests | Recorded lifecycle/assignee/automatic completion attribution |
| AC-06 | Actions API, concurrency and real Actions browser journeys | Recorded revisions, correction, immutable attribution and stale/terminal rules |
| AC-07 | Action validation/API and Ticket workflow tests | Recorded follow-up, cancellation and correction rules |
| AC-08 | `idempotency.unit.test.ts`, `concurrency.api.test.ts`; real replay browser journey | Recorded simultaneous create, replay and mismatched key handling |
| AC-09 | `server/tests/lab-04/concurrency.api.test.ts` | Recorded lost-update/eligibility/gate interleavings |
| AC-10 | `ticket-workflow.api.test.ts`; retained workflow unit tests | Recorded full matrix/role/version/confirmation behavior |
| AC-11 | Ticket workflow API and real resolution browser journey | Recorded full transactional resolution predicate |
| AC-12 | Ticket workflow API | Recorded unfinished-work cancellation denial and legacy closing |
| AC-13 | Ticket workflow API and `e2e/lab-04/ticket-resolution.spec.ts` | Recorded new cycles/advisory clearing/current-cycle gates |
| AC-14 | `requester-dashboard.api.test.ts`, `RequesterDashboard.test.tsx`, `dashboards.spec.ts` | Recorded own metrics/legacy/UTC/empty/navigation; screenshots available in gallery; human review pending |
| AC-15 | Staff dashboard API/component/browser tests and performance smoke | Recorded attribution/grouping/exclusions; screenshots available in gallery; human review pending |
| AC-16 | Dashboard drill-down API/query tests and navigation/browser tests | Recorded matching predicates/ordering/reset/return behavior |
| AC-17 | `client/tests/lab-04/ActionsTaken.test.tsx`; both Actions browser configurations | Recorded forms, history, roles and retry/recovery; screenshots available in gallery; human review pending |
| AC-18 | Dashboard/workflow/Actions component and browser suites | Recorded loading/empty/failure/conflict recovery; representative captures available; human review pending |
| AC-19 | `e2e/lab-04/responsive.spec.ts`, mocked Actions UI and retained responsive journeys | Automated keyboard/contrast/overflow checks recorded; actual screenshots available; human checklist still pending |
| AC-20 | New/retained authorization, auth, account and concurrency API suites | Recorded session/password/CSRF/privacy/strict Admin boundaries |
| AC-21 | Issue #54 full backend/frontend/retained browser runs | Recorded workspace compatibility; complete final-main output pending |
| AC-22 | `server/tests/lab-04/dashboard-performance.test.ts` plus fixture helper | Recorded bounded queries/payloads/local latency; not a production SLA |
| AC-23 | Builds, `production-startup.test.ts`, runner discovery | Recorded fixed production start path and authenticated smoke; actual final-main verification pending |
| AC-24 | Approved contracts and this index | Actual GitHub history/board/reviews, chronology, final-main output, student reflection and PDF pending |

## Handout §14 submission checklist

Prepare exactly one concise PDF with these headings in this order. Use readable captures and working links. The final repository/main branch remains authoritative.

| PDF heading | Available material | Student completion / missing evidence |
|---|---|---|
| Answer Part 1 | Updated README, existing repository layout, release flow instructions | Actual feature → `lab4-staging` → `main` history, final board Done, rendered reviewer evidence, README/.gitignore screenshots and repository/PR links |
| Answer Part 2 | Existing specification, FR/BR/AC, decisions and Definition of Done | Render it; supply actual chronology proving contract preceded completed implementation PRs |
| Answer Part 3 | Test plan, actual-file mapping above, Issue #54 execution summary | Render test plan with this status supplement; attach complete sanitized passing final-main output and actual SHA |
| Answer Part 4 | Student-managed `ai-use.md` exists | Student names the LLM, selects 6–10 actual prompts and writes “My Reflection”; do not auto-populate |
| Answer Part 5 | Operational dashboard API/component/browser/performance evidence | Staff/Admin screenshots and nonzero assigned-work preview available; select readable panels and include manifest metric comparisons |
| Answer Part 6 | Actions API/unit/component/real-browser evidence | Actions screenshots and actual inactive-assignee/role API checks available; select readable demonstrations |
| Answer Part 7 | Workflow/concurrency/legacy/reopen and ordering tests | Actual gate/transition/history screenshots available in gallery; human review pending |
| Answer Part 8 | Requester dashboard tests and all retained browser journeys | Actual owned-dashboard/drill-down screenshots available in gallery; human review pending; link representative retained behavior without changing Lab 3 evidence |
| Answer Part 9 | UI contract and automated responsive/keyboard/contrast results | Desktop/tablet/mobile PNGs available; render UI specification and complete student/peer human visual/accessibility checklist |

Required repository documents and backend/frontend test files exist. The handout's minimum E2E name `actions-taken-flow.spec.ts` differs from the implemented real-backend file `actions-taken-integration.spec.ts`; equivalent content exists, but literal filename alignment remains a submission question. This documentation task does not rename verified suites or alter approved contracts. Planned names such as `regression.spec.ts` map to retained real journeys rather than implying nonexistent tests passed.

## Manual release checks still open

- [x] Capture actual Lab 4 evidence: six scenarios passed, 46 PNG hashes/dimensions/inventory verified; no fabricated screenshots.
- [ ] Review all major screen sizes, editable/read-only fields, validation, focus, clipping/overlap/overflow; record real reviewer identity/date/findings separately from automated checks.
- [ ] Complete the student-managed `docs/lab-04/reviewer.md` and `ai-use.md` manually.
- [ ] Supply actual GitHub board, PR comments/responses/approvals and required staged integration history.
- [ ] Confirm the handout's literal E2E filename requirement with the instructor or align it in separately authorized test maintenance.
- [ ] After the actual final merge, collect final-main SHA and complete sanitized test/build output; this task did not execute any Git command or merge.
- [ ] Assemble/render the single Answer Part 1–9 PDF, check all links and readability, and submit it through the course channel.

Issue #55 documentation and screenshot collection are prepared for peer review. Final submission remains incomplete until the manual release items above are supplied.
