# Lab 3 Test Plan, Traceability and Evidence

Status: **Engineering decisions approved through Phase 2.2; tests Planned / Not Run — no Lab 3 implementation or execution.**
Prepared: 2026-09-15 against `main` at `8fb7e8c`. Source: [specification.md](specification.md), [API](api-spec.md), [UI](ui-spec.md). All paths below are planned unless explicitly identified as existing Lab 1/2 files. A planned test row can expand into several parameterized cases; row counts are not passed-test counts.

## 1. Strategy and execution safety

Use Vitest for units/API/UI, Supertest authenticated cookie agents for API integration, React Testing Library/userEvent for components, and Playwright for real browser E2E/responsive captures. Write failing cases from the approved contract before implementing each Issue; record the reason for failure, then evidence of passing behavior. Do not postpone all tests to release work or weaken ownership assertions to retain an old test count.

Before any future execution:

- Require a dedicated test PostgreSQL database and a separate test upload root. Validate configuration before importing app code, running migrations, fixtures or cleanup. Do not run existing write-heavy tests against the ordinary development DATABASE_URL or uploads/lab-02.
- Plan app/test setup to inject the upload root and isolate fixtures; existing app import can create its upload directory. Test configuration and fixtures are future implementation, not created here.
- Cover two Requesters, active/inactive accounts, two active Administrators for concurrent safety tests, active/inactive Staff, an Administrator assignment candidate, all eight statuses, assigned/unassigned tickets, multiple pages, valid/invalid files and removed metadata.
- Use isolated transaction/fixture boundaries and deterministic cleanup. Existing test files run sequentially; keep that until isolation is demonstrated. Reset/cleanup only the positively identified test environment.
- Use real password hashing/session cookies/CSRF for security integration; mocks are appropriate for isolated UI states, not substitutes for authorization proof. Use controlled clocks for expiry/rate windows and concurrent requests for races.
- Assert response schemas and forbidden field absence as well as screen text. Keep test fixture shapes consistent with actual API DTOs, especially attachmentCount and note exclusion.

Phase 2.2 concurrency scope: test only the correctness invariants in BR-17/25 and retained Lab 2 rules (competing claims, current-state transitions/reasons, owner eligibility during deactivation, attachment count/removal, duplicate emails, last-active-Administrator safety and security-change session revocation). Ordinary priority/account field updates need no version token or general stale-form rejection. Keep tests focused on observable outcomes; do not require a blanket transaction, lock or retry framework.

## 2. Planned test table

### Unit tests

| Test ID | Type | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final Status |
|---|---|---|---|---|---|---|
| UNIT-01 | Unit | FR-01, FR-02; BR-08; AC-01, AC-02 | Argon2 hash/verify, salt variation, wrong password, 14/15/128/129 code points, Unicode/spaces, denylist and reuse | Valid boundaries accepted; invalid/reused rejected; no plaintext hash | `server/tests/lab-03/password.unit.test.ts` | Planned / Not Run |
| UNIT-02 | Unit | FR-03; BR-09, BR-10, BR-11; AC-03, AC-25 | Session expiry boundaries, random token hashing, CSRF comparison/rotation | Idle/absolute limits enforced before touch; old tokens fail | `server/tests/lab-03/session.unit.test.ts` | Planned / Not Run |
| UNIT-03 | Unit | FR-04; BR-03, BR-04, BR-06, BR-28; AC-04, AC-05 | Full role/resource policy table including required Administrator reads/IT Priority/owner eligibility and separately chosen denials | Exact specification matrix, no role inheritance | `server/tests/lab-03/authorization.unit.test.ts` | Planned / Not Run |
| UNIT-04 | Unit | FR-11, FR-14; BR-05, BR-16, BR-17, BR-19; AC-12, AC-15 | All 8x8 status pairs/roles, owner/reason/confirmation rules and indication states | Only listed edges/actions valid; repeat indication idempotent | `server/tests/lab-03/workflow.unit.test.ts` | Planned / Not Run |
| UNIT-05 | Unit | FR-06, FR-08; BR-24; AC-07, AC-09 | Query parser, aliases, unknown keys, IDs/overflow, enum ranks, default 10 across paginated endpoints, bounded sizes and explicit legacy Requester size 8 | Stable explicit ordering; strict documented rejection | `server/tests/lab-03/query.unit.test.ts` | Planned / Not Run |
| UNIT-06 | Unit | FR-12, FR-13, FR-15, FR-16; BR-07, BR-18, BR-26; AC-13, AC-14, AC-17 | Email normalization; name/email/body bounds; one-role validation | Consistent validation without trimming passwords | `server/tests/lab-03/validation.unit.test.ts` | Planned / Not Run |

### API, integration and security tests

| Test ID | Type | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final Status |
|---|---|---|---|---|---|---|
| API-01 | API | FR-01; BR-01, BR-08, BR-12; AC-01 | Valid, unknown-email, wrong-password and inactive login | 200 for valid; same safe 401/body for credential failures; no hashes/secrets | `server/tests/lab-03/auth.api.test.ts` | Planned / Not Run |
| API-02 | API | FR-02; BR-02, BR-08; AC-02 | Initial-password login; restricted-session GET me/CSRF, POST password-change/logout; re-login with valid same-account or other-account credentials and valid Origin/CSRF; invalid/current/reused/mismatched passwords; successful change | Initial login 200 creates restricted session; me/CSRF 200; normal APIs and re-login 403 PASSWORD_CHANGE_REQUIRED with identity/session unchanged; invalid password change 400 stays restricted; valid change 200 rotates to normal and revokes old sessions; restricted logout 204 revokes access | `server/tests/lab-03/auth.api.test.ts` | Planned / Not Run |
| API-03 | API | FR-03; BR-09, BR-10; AC-03 | Safe me, logout, invalid/replayed cookie, idle/absolute expiry | Safe identity or 401; revoked sessions cannot regain access | `server/tests/lab-03/auth.api.test.ts` | Planned / Not Run |
| API-04 | Security | FR-01, FR-03; BR-11, BR-12; AC-25 | CSRF/origin missing/wrong on login/logout/password/admin/ticket/comment/note/upload; rate windows | 403 before mutation/file write; 429 + Retry-After; allowed origin/token succeeds | `server/tests/lab-03/auth.api.test.ts` | Planned / Not Run |
| API-05 | Security | FR-04; BR-01, BR-02, BR-10, BR-28; AC-02, AC-03, AC-05 | Every protected endpoint with no session, must-change session, inactive user and each role; explicit restricted-session login attempt with valid credentials and Origin/CSRF | Missing/inactive/revoked authentication 401; normal role denials 403; restricted sessions allow only GET me/CSRF and POST password-change/logout subject to validation, while normal APIs and POST login return 403 PASSWORD_CHANGE_REQUIRED without replacing the session; fresh role/activation state enforced | `server/tests/lab-03/authorization.api.test.ts` | Planned / Not Run |
| API-06 | Security | FR-04, FR-06; BR-03, BR-28; AC-04, AC-07 | Forged requesterId in body/query, old header alone/with another user's valid session; cross-owner IDs | Body/query override 400; header cannot authenticate or change scope; same 404 for absent/cross-owner | `server/tests/lab-03/authorization.api.test.ts` | Planned / Not Run |
| API-07 | Security | FR-04, FR-13; BR-04, BR-06, BR-28; AC-05, AC-14 | Requester note attempts; A queue/claim/reassignment/status/posting denied by ED-05 (exclude permitted IT Priority); non-A user management; unsupported delete/edit | Constant safe 403 for forbidden endpoints; no note metadata/content/hash leakage; unsupported operations 404 | `server/tests/lab-03/authorization.api.test.ts` | Planned / Not Run |
| API-08 | API/regression | FR-05; BR-15, BR-20; AC-06 | Authenticated create, blank/over-limit fields, inactive refs, number uniqueness, normal/concurrent key replay | One owned NEW ticket; requested priority copied into IT priority; 201/200 replay; invalid input stores none | `server/tests/lab-02/tickets.create.test.ts` (adapt existing) | Planned / Not Run |
| API-09 | API/regression | FR-06; BR-03, BR-24, BR-28; AC-07 | Own list/detail, search all fields, combined filters, stable sorts, boundaries and legacy aliases | Correct scoped rows/counts/attachmentCount; safe 404; omitted size defaults to 10, explicit size 8 and legacy aliases retained | `server/tests/lab-02/tickets.list.test.ts` (adapt existing) | Planned / Not Run |
| API-10 | API/regression | FR-07; BR-21, BR-23; AC-08 | Each permitted type/signature, wrong type, zero/missing file, limit boundary, fifth/sixth concurrent upload, unauthorized upload | 201 permitted valid file; 400/413 restrictions; at most five; rejected requests leave no unrecorded bytes | `server/tests/lab-03/attachments-regression.api.test.ts` | Planned / Not Run |
| API-11 | API/regression | FR-07; BR-22, BR-28; AC-08 | Own/Staff downloads, Unicode names, removed/missing bytes, reason limits, repeated/concurrent removal | Correct binary/headers; bytes retained on soft removal; removed 403; first reason/time cannot be overwritten; A denied byte operations | `server/tests/lab-02/tickets.detail.test.ts` (adapt existing) | Planned / Not Run |
| API-12 | API | FR-08; BR-24; AC-09 | Shared queue, assigned/unassigned and Admin owner, search/category/status/two priorities/owner, sorts/pages | Correct deterministic rows and counts using identical filters without Requester scope; no frozen snapshot required during concurrent edits | `server/tests/lab-03/staff-queue.api.test.ts` | Planned / Not Run |
| API-13 | API | FR-08; BR-24, BR-28; AC-09 | Empty/no-results/out-of-range/invalid/overflow/repeated query and simulated DB failure | Empty metadata coherent; 400 invalid input; safe 500; no stale/fabricated result | `server/tests/lab-03/staff-queue.api.test.ts` | Planned / Not Run |
| API-14 | API | FR-09; BR-13, BR-14, BR-17; AC-10 | Detail, eligible assignees, claim/reassign/null unassignment; competing claims/inactive roles | Staff success; A eligible owner but denied claim/reassignment under ED-05; one claim wins; 400/409 as documented | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned / Not Run |
| API-15 | API | FR-10; BR-15, BR-17; AC-11 | S and A priority update/no-op without version tokens, independent field writes and ordinary same-field edits, invalid enum, requestedPriority override; R denial | Both permitted roles succeed identically; Requested Priority and unrelated fields preserved; normal updatedAt metadata maintained; R 403 and invalid input 400; ordinary same-field last successful write accepted | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned / Not Run |
| API-16 | API | FR-11; BR-05, BR-16, BR-17; AC-12 | All transition edges and representative invalid/self/role attempts, confirmations/reasons, competing transitions evaluated against current stored status | Exact matrix; cancel/reopen reason saved atomically as public comment; no Actions Taken requirement | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned / Not Run |
| API-17 | API | FR-12; BR-04, BR-18; AC-13 | Public reads/writes by R/S/A, text boundaries, author/time override, default 10 and bounded chronological pagination | R own/S append; A read only; backend author/time; immutable entries | `server/tests/lab-03/comments-notes.api.test.ts` | Planned / Not Run |
| API-18 | API/security | FR-13; BR-04, BR-18, BR-28; AC-14 | Note Staff append and S/A read, invalid/blank/oversized text, R requests and alternate projections | Private text never reaches R; safe 403; no note edit/delete | `server/tests/lab-03/comments-notes.api.test.ts` | Planned / Not Run |
| API-19 | API | FR-14; BR-05, BR-19; AC-15 | Owned indication, concurrent repeat/status change, forbidden/terminal states, reopening | Atomic actor/time, idempotent active-cycle repeat, unchanged status; cleared on reopen | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned / Not Run |
| API-20 | API | FR-15; BR-06, BR-28; AC-16 | Admin list name/email search, role filter, no-results, invalid queries and non-A access | Safe sorted records only; 400 invalid; non-A 403 | `server/tests/lab-03/users-admin.api.test.ts` | Planned / Not Run |
| API-21 | API | FR-15; BR-06, BR-07, BR-08, BR-26; AC-17 | User create, role arrays/invalid roles, duplicate normalized email including concurrent create | One account/hash/role; change required; 400/409 errors; no secrets returned | `server/tests/lab-03/users-admin.api.test.ts` | Planned / Not Run |
| API-22 | API | FR-16; BR-07, BR-10, BR-27; AC-18 | Edit fields/activation/role/email without timestamp tokens, duplicate normalized emails, field-specific edits, assignment/deactivation races, owner unassignment and session revocation | Data/history retained; constraint conflicts return safe 409; unrelated fields preserved; affected sessions invalid; owners active/eligible or null; ordinary same-field last successful write accepted | `server/tests/lab-03/users-admin.api.test.ts` | Planned / Not Run |
| API-23 | API/security | FR-16; BR-25; AC-18 | Self-deactivation; last-admin deactivate/demote; concurrent two-admin demotions/deactivations | 409 protects self/at least one active admin after every interleaving | `server/tests/lab-03/users-admin.api.test.ts` | Planned / Not Run |
| API-24 | API/security | FR-16, FR-02, FR-03; BR-10, BR-26; AC-19 | Set new initial password, expired old sessions/password, inactive reset, self-reset | Hash stored; old sessions fail; no implicit activation; next login restricted until change | `server/tests/lab-03/users-admin.api.test.ts` | Planned / Not Run |
| API-25 | API/regression | FR-06, FR-20; BR-30; AC-07, AC-26 | Retained Lab 1 health/category contracts against isolated seeded DB | Exact health payload, four ordered categories, normal failure behavior | `server/tests/lab-01/health.test.ts`, `server/tests/lab-01/categories.test.ts` (retain) | Planned / Not Run |
| API-26 | Security/API | FR-04, FR-09, FR-10, FR-12, FR-13; BR-04, BR-13, BR-15, BR-17, BR-28; AC-05, AC-10, AC-11, AC-13, AC-14 | Administrator required comment/note reads, permitted read-only detail/attachment metadata, active-owner eligibility through Staff assignment, priority success on accessible tickets including unassigned and another user's tickets; all approved matrix denials, inactive/must-change sessions and CSRF failures | General detail and reads allowed; valid S/A priority write works even though URL starts /staff/; no inherited queue/claim/owner/status/posting/attachment-byte privileges; proper 401/403/400/404 for auth/validation/missing cases; no stale-version requirement | `server/tests/lab-03/authorization.api.test.ts` | Planned / Not Run |

### Migration and seed tests

| Test ID | Type | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final Status |
|---|---|---|---|---|---|---|
| MIG-01 | Migration | FR-17; BR-29; AC-20 | Upgrade populated Lab 2 including non-seeded/inactive users, ticket fields/FKs and attachment metadata/file hashes | IDs/relationships/counts/content/bytes preserved; hashes provisioned once; sequence still generates unique IDs | `server/tests/lab-03/migration-regression.test.ts` | Planned / Not Run |
| MIG-02 | Migration | FR-17; BR-07, BR-08, BR-29; AC-20 | Normalized-email collision, unprovisioned login, final constraints and migration reattempt | Fail safely without merging/deleting; unprovisioned denied; no plaintext SQL; final required fields valid | `server/tests/lab-03/migration-regression.test.ts` | Planned / Not Run |
| MIG-03 | Regression | FR-17, FR-04; BR-03, BR-28; AC-04, AC-20 | Migrated-user login/first change and old header/selector endpoint removal | Existing ticket access remains correct; /requesters/active 404; old header not identity | `server/tests/lab-03/migration-regression.test.ts` | Planned / Not Run |
| MIG-04 | Seed | FR-18; BR-29; AC-21 | Seed twice after passwords/roles/activation/ticket state/removal change | Required role/reference fixtures exist; no duplicate comments/notes/records; no reset of existing choices/data | `server/tests/lab-03/migration-regression.test.ts` | Planned / Not Run |

### Frontend component tests

Use one canonical directory for new tests: `client/tests/lab-03/`. Adapt existing suites explicitly; do not silently duplicate them again.

| Test ID | Type | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final Status |
|---|---|---|---|---|---|---|
| UI-01 | Component | FR-01; BR-01, BR-12, BR-30; AC-01, AC-22 | Login fields/labels, validation, busy, safe credential/inactive/throttle/network feedback | No registration/identity selector, no duplicate submit or secret storage | `client/tests/lab-03/Login.test.tsx` | Planned / Not Run |
| UI-02 | Component | FR-02; BR-02, BR-08; AC-02, AC-22 | Mandatory/voluntary password rules, current/new/confirm, saving/errors/success | Mandatory screen cannot be bypassed; successful rotation enters role home; passwords cleared appropriately | `client/tests/lab-03/ChangePassword.test.tsx` | Planned / Not Run |
| UI-03 | Component | FR-03, FR-04; BR-09, BR-10, BR-30; AC-03, AC-05, AC-20 | Auth bootstrap/role nav/logout/401/password-change gate, old storage cleanup, obsolete async responses | No prior-user flash, no old selector/header, correct name/role/navigation, no normal app before change | `client/tests/lab-03/AuthContext.test.tsx` | Planned / Not Run |
| UI-04 | Component/regression | FR-05, FR-07; BR-20, BR-23, BR-30; AC-06, AC-08, AC-22 | Existing create validation/busy/idempotent retry, read-only identity/date, partial upload failure/recovery | Inputs retained on recoverable failure; correct server number; failed files explicit; no second ticket | `client/tests/lab-03/RequesterRegression.test.tsx` | Planned / Not Run |
| UI-05 | Component/regression | FR-06; BR-24, BR-30; AC-07, AC-22 | My Tickets sort/filter/page, canonical attachmentCount, empty/no-results/failure | Correct queries/data and feedback; mocks match real list DTO | `client/tests/lab-03/RequesterRegression.test.tsx` | Planned / Not Run |
| UI-06 | Component/regression | FR-07, FR-12, FR-14; BR-04, BR-19, BR-21, BR-22; AC-08, AC-13, AC-15 | Detail upload/download/remove, Public Comments and resolution indication; reload after Staff reopening; no Internal Notes | Correct controls/counts/removal states and limits; reopening clears the old displayed indication/timestamp and re-enables a fresh Requester indication without a formal status control | `client/tests/lab-03/RequesterRegression.test.tsx` | Planned / Not Run |
| UI-07 | Component | FR-08; BR-24, BR-30; AC-09, AC-22 | Queue filters/sorts/pages/owner, loading/empty/no-results/forbidden/failure, out-of-order queries | Latest query wins; usable controls and feedback; no fake fresh results | `client/tests/lab-03/StaffTicketQueue.test.tsx` | Planned / Not Run |
| UI-08 | Component | FR-09, FR-10, FR-11; BR-13, BR-14, BR-15, BR-16, BR-17; AC-10, AC-11, AC-12, AC-22 | Staff grouped detail, claim/reassign/priority/transition confirmation and business-rule conflict | Only approved actions; read-only submitter fields; reload on conflict | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Planned / Not Run |
| UI-09 | Component/security | FR-12, FR-13; BR-04, BR-18; AC-13, AC-14, AC-22 | Separate public/internal composers, author/time, limits, literal HTML text, failure and pagination | Distinct destinations; no XSS execution; no edit/delete; A reads discussion without composers, while separate IT Priority control remains permitted | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Planned / Not Run |
| UI-10 | Component | FR-15, FR-16; BR-06, BR-07, BR-25, BR-26, BR-27; AC-16, AC-17, AC-18, AC-19, AC-22 | User list/search/role filter/create/edit/initial reset, duplicate/safety/forbidden feedback without timestamp preconditions | One role, no delete/advanced controls, safe session reset/unassignment warning | `client/tests/lab-03/UserManagement.test.tsx` | Planned / Not Run |
| UI-11 | Component/regression | FR-19; BR-30; AC-22 | Lab 1 heading and Check System loading/success/offline after shell change | Diagnostics remain available and use API results, not fake hardcoded success | `client/tests/lab-01/App.test.tsx` (adapt existing setup) | Planned / Not Run |
| UI-12 | Component | FR-04, FR-10, FR-12, FR-13; BR-04, BR-15, BR-17; AC-05, AC-11, AC-13, AC-14, AC-22 | Administrator read-only known-ticket information/attachment metadata with separate IT Priority Save regardless of owner, required comment/note reads, busy/success/invalid/not-found/failure states and no denied actions | Requested Priority unchanged; calls explicit S/A priority endpoint with only itPriority and CSRF; no queue/claim/reassign/status/composer/attachment-byte controls | `client/tests/lab-03/AdministratorTicketAccess.test.tsx` | Planned / Not Run |

### Style, responsive and browser E2E

| Test ID | Type | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final Status |
|---|---|---|---|---|---|---|
| STYLE-01 | UI style | FR-19; BR-30; AC-23 | Tokens/classes, labels/required markers, editable/read-only, busy/invalid, full status/role/priority labels | Existing Zen Green semantics preserved; no color-only meaning | `client/tests/lab-03/ZenGreen.test.tsx` | Planned / Not Run |
| RESP-01 | Browser responsive | FR-19; BR-30; AC-23 | All required screens at 1280x800, 768x1024, 375x812; long text/files/emails; breakpoint edges | No page overflow/clipping/overlap; usable menu/forms/table/cards/dialogs; actual screenshots | `e2e/lab-03/responsive.spec.ts` | Planned / Not Run |
| RESP-02 | Browser accessibility | FR-19; BR-30; AC-23 | Keyboard navigation, visible focus, mobile menu, validation focus, modal trap/Escape/return | All required actions accessible; announcements/labels meaningful | `e2e/lab-03/responsive.spec.ts` | Planned / Not Run |
| E2E-01 | Browser E2E | FR-01, FR-02, FR-03, FR-04; BR-02, BR-09, BR-10, BR-11; AC-01, AC-02, AC-03, AC-24, AC-25 | Valid/invalid/inactive login, first change, role home, reload, logout, back/deep-link/direct API after logout | Real cookies/CSRF/API/DB enforce lifecycle; no private cached content after logout | `e2e/lab-03/authentication.spec.ts` | Planned / Not Run |
| E2E-02 | Browser E2E | FR-08, FR-09, FR-10, FR-11, FR-12, FR-13, FR-14; BR-04, BR-15, BR-16; AC-09, AC-10, AC-11, AC-12, AC-13, AC-14, AC-15, AC-24 | Staff queue -> claim/reassign -> priorities -> comment/note -> wait/resolve/close/reopen with Requester response | Real permitted workflow and note isolation; Requester indication never resolves ticket | `e2e/lab-03/staff-ticket-flow.spec.ts` | Planned / Not Run |
| E2E-03 | Browser E2E | FR-15, FR-16; BR-06, BR-07, BR-25, BR-26; AC-16, AC-17, AC-18, AC-19, AC-24 | Admin list/search/create/edit/deactivate/reset, duplicate/safety failures, next-login password change, non-A access | Minimal management works end-to-end; no implicit staff permission; safety checks persist | `e2e/lab-03/user-administration.spec.ts` | Planned / Not Run |
| E2E-04 | Browser regression | FR-05, FR-06, FR-07, FR-17; BR-03, BR-20, BR-21, BR-22, BR-23; AC-06, AC-07, AC-08, AC-20, AC-24 | Migrated Requester login -> create/files -> My Tickets -> detail add/download/remove; second user isolation, partial failure | Lab 2 business flow survives real auth and correct server-backed file behavior | `e2e/lab-03/requester-regression.spec.ts` | Planned / Not Run |
| E2E-05 | Browser authorization | FR-04, FR-10, FR-12, FR-13; BR-04, BR-15, BR-17; AC-05, AC-11, AC-13, AC-14, AC-24 | Administrator login -> accessible ticket assigned to another user -> read permitted detail/metadata and public/internal entries -> separately update IT Priority -> verify unchanged Requested Priority and direct API denials for approved restricted operations | Required participation works through UI/API/DB; no blanket Staff inheritance; entry/attachment/status restrictions match the matrix | `e2e/lab-03/user-administration.spec.ts` | Planned / Not Run |

### Engineering and visual evidence (manual, not fictional automation)

| Test ID | Type | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final Status |
|---|---|---|---|---|---|---|
| EVID-01 | Contract review | FR-20; AC-26 | Complete FR/BR/AC-to-test mapping, source precedence and approved EDs | Human approval recorded before implementation; no unsupported completeness claims | N/A — human review of four contract files | Planned / Not Run |
| EVID-02 | Visual review | FR-19; BR-30; AC-23 | Inspect actual responsive screenshots against ui-spec.md checklist and sample illustrations | Human verifies readability, focus, clipping and semantic consistency; link captures/commit | N/A — screenshot review record in this file | Planned / Not Run |
| EVID-03 | Delivery review | FR-20; AC-26 | Issues/board/feature-to-staging-to-main history, bilateral reviews, AI record, final test outputs and PDF evidence | Real peer approvals and final-main evidence linked; no pending required items hidden | N/A — reviewer.md and release evidence below | Planned / Not Run |

## 3. Acceptance-criterion traceability

| Acceptance criterion | Planned tests/evidence |
|---|---|
| AC-01 | UNIT-01, API-01, UI-01, E2E-01 |
| AC-02 | UNIT-01, API-02, API-05, UI-02, E2E-01 |
| AC-03 | UNIT-02, API-03, API-05, UI-03, E2E-01 |
| AC-04 | UNIT-03, API-06, MIG-03 |
| AC-05 | UNIT-03, API-05, API-07, API-26, UI-03, UI-12, E2E-05 |
| AC-06 | API-08, UI-04, E2E-04 |
| AC-07 | UNIT-05, API-06, API-09, API-25, UI-05, E2E-04 |
| AC-08 | API-10, API-11, UI-04, UI-06, E2E-04 |
| AC-09 | UNIT-05, API-12, API-13, UI-07, E2E-02 |
| AC-10 | API-14, API-26, UI-08, E2E-02 |
| AC-11 | API-15, API-26, UI-08, UI-12, E2E-02, E2E-05 |
| AC-12 | UNIT-04, API-16, UI-08, E2E-02 |
| AC-13 | UNIT-06, API-17, API-26, UI-06, UI-09, UI-12, E2E-02, E2E-05 |
| AC-14 | UNIT-06, API-07, API-18, API-26, UI-09, UI-12, E2E-02, E2E-05 |
| AC-15 | UNIT-04, API-19, UI-06, E2E-02 |
| AC-16 | API-20, UI-10, E2E-03 |
| AC-17 | UNIT-06, API-21, UI-10, E2E-03 |
| AC-18 | API-22, API-23, UI-10, E2E-03 |
| AC-19 | API-24, UI-10, E2E-03 |
| AC-20 | MIG-01, MIG-02, MIG-03, UI-03, E2E-04 |
| AC-21 | MIG-04 |
| AC-22 | UI-01, UI-02, UI-04, UI-05, UI-07, UI-08, UI-09, UI-10, UI-11, UI-12 |
| AC-23 | STYLE-01, RESP-01, RESP-02, EVID-02 |
| AC-24 | E2E-01, E2E-02, E2E-03, E2E-04, E2E-05 |
| AC-25 | UNIT-02, API-04, E2E-01 |
| AC-26 | API-25, EVID-01, EVID-03 |

## 4. Existing Lab 1–2 test treatment

Baseline declarations: 49 backend tests in eight files, 32 frontend tests in seven files. README's pass badge is historical; none were executed in this phase. `server/tests/lab-02/e2e-flow.test.ts` is a Supertest flow, not browser E2E.

- Retain Lab 1 health/category tests and diagnostic App behavior; adapt wrapper/bootstrap mocks only as necessary.
- Adapt `tickets.create.test.ts`, `tickets.list.test.ts`, `tickets.detail.test.ts`, and `e2e-flow.test.ts` to authenticated Supertest agents, CSRF and mapped `prisma.user`. Preserve validation/isolation/idempotency/file assertions; update initial IT Priority and safe cross-owner 404 expectations explicitly.
- Replace `requester-auth.test.ts` header expectations and `requesters.api.test.ts` selector-list expectations with the new auth/authorization/removal tests. Do not keep insecure identity mechanisms just to make obsolete tests pass.
- Replace RequesterContext suites with AuthContext/role/password-change tests. Existing CreateTicket/MyTickets/TicketDetail component cases remain useful with auth mocks and accurate DTOs.
- Two copies each of CreateTicket and RequesterContext tests exist under `client/tests/lab-02/` and `client/src/tests/lab-02/`. Review/consolidate useful coverage explicitly when adapting; no skipped duplicate suite presented as new coverage.
- Missing visible sort/detail upload/mobile menu and attachmentCount/partial-upload issues are the bounded ED-10 continuity scope, not proof the existing implementation already satisfies them.

## 5. Planned commands and evidence capture

Only after test environment isolation and later implementation authorization, intended suite entrypoints are `npm --prefix server test` and `npm --prefix client test`. The exact Playwright runner command/configuration, database preparation/provisioning command and environment overrides must be added when implemented. No test, install, build, migration or database command ran during this drafting phase.

For each actual run record tested commit/branch, environment versions, exact command, fixture/database isolation, start time, complete output, pass/fail/skip totals and artifact paths. Run appropriate failing/passing tests within each feature Issue; broaden at integration/release. Final results must be obtained from the final main revision, not a stale feature branch.

Product verification covers behavioral assertions for FR-01–19, BR-01–30 and AC-01–25. Screenshot capture/submitted visual-review artifacts (including the evidence portions of RESP-01/EVID-02), peer approvals, staged history, final-main outputs and submission evidence belong to FR-20/AC-26 delivery checks. An AC-23 link to EVID-02 provides supplementary delivery evidence; it does not make screenshots a product-completion prerequisite. All tests/checks remain unexecuted.

## 6. Final results and responsive evidence

| Evidence | Current result |
|---|---|
| Unit/API/component/security/migration/browser tests | Planned / Not Run |
| Required screenshots and visual review | Planned / Not Run |
| Human engineering-decision approval | ED-01–10 approved by user through Phases 2.1/2.2 on 2026-09-15; documentation checked, application tests unexecuted |
| GitHub Issues/PRs/peer approvals/staged release | Not created in this phase |
| Final-main test commit and complete logs | TODO |

Screenshot locations and viewports are defined in ui-spec.md §10. Later record filename, role, screen/state, viewport, commit, reviewer and observed result here; no fabricated screenshot links.

## 7. Known limits and open verification facts

- The Phase 2.1 authorization matrix is approved (ED-05): read-only permitted Ticket Detail/metadata, required comment/note visibility and owner eligibility, separate IT Priority updates on accessible tickets without an owner-only restriction, and the stated operational denials. Phase 2.2 approves all remaining EDs, default page size 10, and targeted correctness safeguards without broad optimistic locking. No unresolved engineering-policy decision currently blocks implementation.
- Actual legacy normalized-email collisions, files present on disk, provisioning handover and migration success are unknown until isolated preflight.
- Session/password dependency versions and Windows compatibility are unverified; package installation is outside this phase.
- Live peer assignments, branch protections, Issue numbers and PR approvals are unverified; record actual facts later.
- No required test may be marked Pass based only on a document, mock that bypasses the relevant layer, or an agent claim.

## 8. Proposed eight-Issue execution plan

Planning IDs below are not GitHub Issue numbers. All future feature PRs target lab3-staging; release PR targets main. Create the Issues before application implementation, after human review of this plan.

| Plan ID | Title / scope | Dependencies | AC summary / planned tests | Suggested branch |
|---|---|---|---|---|
| P1 | Sprint 3 engineering contract and test plan: these six documents, approved decisions and traceability | Engineering decisions approved in Phases 2.1/2.2; later implementation authorization | AC-26 planning-evidence portion only; EVID-01 | `docs/lab3-engineering-contract` |
| P2 | User migration and authentication foundation: isolated fixtures, additive mapped User/schema, provisioning/seeds, cookies/CSRF, login/me/logout/password-change UI/API | P1 | AC-01–03, AC-20 data-preservation portion, AC-21, AC-25; UNIT-01/02/06, API-01–04, MIG-01/02/04, UI-01/02 | `feat/lab3-user-auth-foundation` |
| P3 | Authorization and Requester regression: backend matrix, AuthContext/shell, old identity removal, bounded ticket/attachment continuity | P2 | AC-04–08, AC-20 identity-removal portion, AC-22; UNIT-03, API-05–11/25, MIG-03, UI-03–06/11; isolated legacy suites | `feat/lab3-authorization-requester` |
| P4 | IT Staff Ticket Queue: shared query API and responsive list | P3 | AC-09; UNIT-05, API-12/13, UI-07 | `feat/lab3-staff-queue` |
| P5 | IT Staff Ticket Detail, workflow, Comments and Notes: owner/priority/status, communication, Requester indication, Administrator required visibility/IT Priority and explicit capability choices | P3, P4 | AC-10–15; UNIT-04/06, API-14–19/26, UI-08/09/12 plus completed UI-06 | `feat/lab3-staff-ticket-workflow` |
| P6 | Administrator User Management: simple search/create/edit/reset and transactional safety | P3 | AC-16–19; API-20–24, UI-10 | `feat/lab3-user-management` |
| P7 | E2E/security/responsive/migration regression verification: complete role journeys, targeted correctness safeguards, real screenshots and failure paths | P4, P5, P6 | AC-01–25 integration; E2E-01–05, RESP-01/02, STYLE-01, MIG-01–04, EVID-02 | `test/lab3-release-verification` |
| P8 | Final documentation, evidence and staged release integration: truthful setup/results, reviews given/received, AI reflection, final-main verification and PDF evidence | P7 | AC-26; EVID-03 and final approved suite | `docs/lab3-release-evidence` |

P1 contributes only the approved planning/traceability evidence (EVID-01) to AC-26; it does not require completed application tests, screenshots, peer-release evidence or final-main/submission artifacts. P8 assembles and verifies full AC-26 delivery evidence using P7 results. P3 prepares shared Requester detail/attachment behavior; its new communication controls are completed in P5, so UI-06's communication assertions belong to P5 and must not block unrelated P3 attachment evidence. P2 must not claim the final old-selector removal regression (MIG-03/UI-03) complete before P3; P5 completes Administrator comment/note visibility and IT Priority editing with explicit optional-capability denials (API-26/UI-12); P7 runs E2E-05. Authorization matrix cases are added with each endpoint and fully exercised in P7. Required cross-feature scenarios are planned now and run when their dependencies exist; do not mark unimplemented cases passed or skip them to declare completion early.

Board transitions: Backlog (identified) -> Specified (understood, AC/tests/dependencies approved) -> Started (active feature work) -> PR Review (reviewable PR/checks) -> Fixing if requested -> PR Review again -> Done (ACs met, checks pass, peer approves, merged to staging). P8 additionally requires reviewed staging-to-main release and final-main evidence. No direct commits on staging/main. Record received peer approval and the student's actual reviews/comments/approvals on the assigned peer's PRs in reviewer.md; a staged merge alone is not peer-review evidence.
