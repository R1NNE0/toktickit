# Lab 3 Test Plan, Traceability and Evidence

Status: **Integrated suites passed; planned-scenario coverage audited for Issue #36 on 2026-09-22. Partial and manual items remain explicit below.**
Originally prepared 2026-09-15 against `main` at `8fb7e8c`. Sources: [specification.md](specification.md), [API](api-spec.md), [UI](ui-spec.md). Section 2 retains the approved scenario scope and reports current coverage; section 9 records observed Issue #35 execution, and section 10 records Issue #36 reconciliation. One ID can span many cases and files; ID totals are not passed-test counts.

## 1. Strategy and execution safety

Use Vitest for units/API/UI, Supertest authenticated cookie agents for API integration, React Testing Library/userEvent for components, and Playwright for real browser E2E/responsive captures. Write failing cases from the approved contract before implementing each Issue; record the reason for failure, then evidence of passing behavior. Do not postpone all tests to release work or weaken ownership assertions to retain an old test count.

For every execution:

- Require a dedicated test PostgreSQL database and a separate test upload root. Validate configuration before importing app code, running migrations, fixtures or cleanup. Do not run existing write-heavy tests against the ordinary development DATABASE_URL or uploads/lab-02.
- Plan app/test setup to inject the upload root and isolate fixtures; existing app import can create its upload directory. The implemented setup validates the disposable database/upload root before app imports and resets; the browser launcher reuses that guard.
- Cover two Requesters, active/inactive accounts, two active Administrators for concurrent safety tests, active/inactive Staff, an Administrator assignment candidate, all eight statuses, assigned/unassigned tickets, multiple pages, valid/invalid files and removed metadata.
- Use isolated transaction/fixture boundaries and deterministic cleanup. Existing test files run sequentially; keep that until isolation is demonstrated. Reset/cleanup only the positively identified test environment.
- Use real password hashing/session cookies/CSRF for security integration; mocks are appropriate for isolated UI states, not substitutes for authorization proof. Use controlled clocks for expiry/rate windows and concurrent requests for races.
- Assert response schemas and forbidden field absence as well as screen text. Keep test fixture shapes consistent with actual API DTOs, especially attachmentCount and note exclusion.

Phase 2.2 concurrency scope: test only the correctness invariants in BR-17/25 and retained Lab 2 rules (competing claims, current-state transitions/reasons, owner eligibility during deactivation, attachment count/removal, duplicate emails, last-active-Administrator safety and security-change session revocation). Ordinary priority/account field updates need no version token or general stale-form rejection. Keep tests focused on observable outcomes; do not require a blanket transaction, lock or retry framework.

## 2. Test IDs and current coverage

### Unit tests

| Test ID | Type | Requirement/AC | What It Tests | Expected Result | Automated Test File | Current coverage |
|---|---|---|---|---|---|---|
| UNIT-01 | Unit | FR-01, FR-02; BR-08; AC-01, AC-02 | Argon2 hash/verify, salt variation, wrong password, 14/15/128/129 code points, Unicode/spaces, denylist and reuse | Valid boundaries accepted; invalid/reused rejected; no plaintext hash | `server/tests/lab-03/password.unit.test.ts` | Pass - implemented cases (section 9; scope notes in section 10) |
| UNIT-02 | Unit | FR-03; BR-09, BR-10, BR-11; AC-03, AC-25 | Session expiry boundaries, random token hashing, CSRF comparison/rotation | Idle/absolute limits enforced before touch; old tokens fail | `server/tests/lab-03/session.unit.test.ts` | Pass - implemented cases (section 9; scope notes in section 10) |
| UNIT-03 | Unit | FR-04; BR-03, BR-04, BR-06, BR-28; AC-04, AC-05 | Full role/resource policy table including required Administrator reads/IT Priority/owner eligibility and separately chosen denials | Exact specification matrix, no role inheritance | `server/tests/lab-03/authorization.unit.test.ts`, `server/tests/lab-03/integration.api.test.ts`, `server/tests/lab-03/authorization.api.test.ts` | Partial - resource matrix is covered by API integration, not the role-predicate unit alone |
| UNIT-04 | Unit | FR-11, FR-14; BR-05, BR-16, BR-17, BR-19; AC-12, AC-15 | All 8x8 status pairs/roles, owner/reason/confirmation rules and indication states | Only listed edges/actions valid; repeat indication idempotent | `server/tests/lab-03/workflow.unit.test.ts`, `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass - implemented cases (section 9; scope notes in section 10) |
| UNIT-05 | Unit | FR-06, FR-08; BR-24; AC-07, AC-09 | Query parser, aliases, unknown keys, IDs/overflow, enum ranks, default 10 across paginated endpoints, bounded sizes and explicit legacy Requester size 8 | Stable explicit ordering; strict documented rejection | `server/tests/lab-03/query.unit.test.ts`, `server/tests/lab-03/staff-queue.api.test.ts` | Pass - implemented cases (section 9; scope notes in section 10) |
| UNIT-06 | Unit | FR-12, FR-13, FR-15, FR-16; BR-07, BR-18, BR-26; AC-13, AC-14, AC-17 | Email normalization; name/email/body bounds; one-role validation | Consistent validation without trimming passwords | `server/tests/lab-03/validation.unit.test.ts`, `server/tests/lab-03/users-admin.api.test.ts` | Pass - implemented cases (section 9; scope notes in section 10) |

### API, integration and security tests

| Test ID | Type | Requirement/AC | What It Tests | Expected Result | Automated Test File | Current coverage |
|---|---|---|---|---|---|---|
| API-01 | API | FR-01; BR-01, BR-08, BR-12; AC-01 | Valid, unknown-email, wrong-password and inactive login | 200 for valid; same safe 401/body for credential failures; no hashes/secrets | `server/tests/lab-03/auth.api.test.ts` | Pass - implemented cases (section 9; scope notes in section 10) |
| API-02 | API | FR-02; BR-02, BR-08; AC-02 | Initial-password login; restricted-session GET me/CSRF, POST password-change/logout; re-login with valid same-account or other-account credentials and valid Origin/CSRF; invalid/current/reused/mismatched passwords; successful change | Initial login 200 creates restricted session; me/CSRF 200; normal APIs and re-login 403 PASSWORD_CHANGE_REQUIRED with identity/session unchanged; invalid password change 400 stays restricted; valid change 200 rotates to normal and revokes old sessions; restricted logout 204 revokes access | `server/tests/lab-03/auth.api.test.ts` | Pass - implemented cases (section 9; scope notes in section 10) |
| API-03 | API | FR-03; BR-09, BR-10; AC-03 | Safe me, logout, invalid/replayed cookie, idle/absolute expiry | Safe identity or 401; revoked sessions cannot regain access | `server/tests/lab-03/auth.api.test.ts`, `server/tests/lab-03/auth-concurrency.api.test.ts` | Pass - implemented cases (section 9; scope notes in section 10) |
| API-04 | Security | FR-01, FR-03; BR-11, BR-12; AC-25 | CSRF/origin missing/wrong on login/logout/password/admin/ticket/comment/note/upload; rate windows | 403 before mutation/file write; 429 + Retry-After; allowed origin/token succeeds | `server/tests/lab-03/auth.api.test.ts`, `server/tests/lab-03/integration.api.test.ts` | Pass - implemented cases (section 9; scope notes in section 10) |
| API-05 | Security | FR-04; BR-01, BR-02, BR-10, BR-28; AC-02, AC-03, AC-05 | Every protected endpoint with no session, must-change session, inactive user and each role; explicit restricted-session login attempt with valid credentials and Origin/CSRF | Missing/inactive/revoked authentication 401; normal role denials 403; restricted sessions allow only GET me/CSRF and POST password-change/logout subject to validation, while normal APIs and POST login return 403 PASSWORD_CHANGE_REQUIRED without replacing the session; fresh role/activation state enforced | `server/tests/lab-03/authorization.api.test.ts`, `server/tests/lab-03/auth.api.test.ts`, `server/tests/lab-03/integration.api.test.ts` | Pass - implemented cases (section 9; scope notes in section 10) |
| API-06 | Security | FR-04, FR-06; BR-03, BR-28; AC-04, AC-07 | Forged requesterId in body/query, old header alone/with another user's valid session; cross-owner IDs | Body/query override 400; header cannot authenticate or change scope; same 404 for absent/cross-owner | `server/tests/lab-03/authorization.api.test.ts` | Pass - implemented cases (section 9; scope notes in section 10) |
| API-07 | Security | FR-04, FR-13; BR-04, BR-06, BR-28; AC-05, AC-14 | Requester note attempts; A queue/claim/reassignment/status/posting denied by ED-05 (exclude permitted IT Priority); non-A user management; unsupported delete/edit | Constant safe 403 for forbidden endpoints; no note metadata/content/hash leakage; unsupported operations 404 | `server/tests/lab-03/authorization.api.test.ts`, `server/tests/lab-03/integration.api.test.ts`, `server/tests/lab-03/comments-notes.api.test.ts` | Pass - implemented cases (section 9; scope notes in section 10) |
| API-08 | API/regression | FR-05; BR-15, BR-20; AC-06 | Authenticated create, blank/over-limit fields, inactive refs, number uniqueness, normal/concurrent key replay | One owned NEW ticket; requested priority copied into IT priority; 201/200 replay; invalid input stores none | `server/tests/lab-02/tickets.create.test.ts`, `server/tests/lab-03/attachments-regression.api.test.ts` | Pass - implemented cases (section 9; scope notes in section 10) |
| API-09 | API/regression | FR-06; BR-03, BR-24, BR-28; AC-07 | Own list/detail, search all fields, combined filters, stable sorts, boundaries and legacy aliases | Correct scoped rows/counts/attachmentCount; safe 404; omitted size defaults to 10, explicit size 8 and legacy aliases retained | `server/tests/lab-02/tickets.list.test.ts` | Partial - exhaustive Requester sort/tie combinations are not individually asserted |
| API-10 | API/regression | FR-07; BR-21, BR-23; AC-08 | Each permitted type/signature, wrong type, zero/missing file, limit boundary, fifth/sixth concurrent upload, unauthorized upload | 201 permitted valid file; 400/413 restrictions; at most five; rejected requests leave no unrecorded bytes | `server/tests/lab-03/attachments-regression.api.test.ts` | Pass - implemented cases (section 9; scope notes in section 10) |
| API-11 | API/regression | FR-07; BR-22, BR-28; AC-08 | Own/Staff downloads, Unicode names, removed/missing bytes, reason limits, repeated/concurrent removal | Correct binary/headers; bytes retained on soft removal; removed 403; first reason/time cannot be overwritten; A denied byte operations | `server/tests/lab-02/tickets.detail.test.ts`, `server/tests/lab-03/attachments-regression.api.test.ts`, `e2e/lab-03/requester-regression.spec.ts` | Partial - Staff byte download/removal, Unicode filename and missing-file paths lack dedicated executed cases |
| API-12 | API | FR-08; BR-24; AC-09 | Shared queue, assigned/unassigned and Admin owner, search/category/status/two priorities/owner, sorts/pages | Correct deterministic rows and counts using identical filters without Requester scope; no frozen snapshot required during concurrent edits | `server/tests/lab-03/staff-queue.api.test.ts` | Pass - implemented cases (section 9; scope notes in section 10) |
| API-13 | API | FR-08; BR-24, BR-28; AC-09 | Empty/no-results/out-of-range/invalid/overflow/repeated query and simulated DB failure | Empty metadata coherent; 400 invalid input; safe 500; no stale/fabricated result | `server/tests/lab-03/staff-queue.api.test.ts` | Pass - implemented cases (section 9; scope notes in section 10) |
| API-14 | API | FR-09; BR-13, BR-14, BR-17; AC-10 | Detail, eligible assignees, claim/reassign/null unassignment; competing claims/inactive roles | Staff success; A eligible owner but denied claim/reassignment under ED-05; one claim wins; 400/409 as documented | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass - implemented cases; OwnerRef regression verified (section 11) |
| API-15 | API | FR-10; BR-15, BR-17; AC-11 | S and A priority update/no-op without version tokens, independent field writes and ordinary same-field edits, invalid enum, requestedPriority override; R denial | Both permitted roles succeed identically; Requested Priority and unrelated fields preserved; normal updatedAt metadata maintained; R 403 and invalid input 400; ordinary same-field last successful write accepted | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Partial - no-op metadata and competing same-field updates lack explicit executed cases |
| API-16 | API | FR-11; BR-05, BR-16, BR-17; AC-12 | All transition edges and representative invalid/self/role attempts, confirmations/reasons, competing transitions evaluated against current stored status | Exact matrix; cancel/reopen reason saved atomically as public comment; no Actions Taken requirement | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Partial - competing status transitions lack a deterministic race case; 64 matrix pairs and representative API/browser paths pass |
| API-17 | API | FR-12; BR-04, BR-18; AC-13 | Public reads/writes by R/S/A, text boundaries, author/time override, default 10 and bounded chronological pagination | R own/S append; A read only; backend author/time; immutable entries | `server/tests/lab-03/comments-notes.api.test.ts` | Pass - implemented cases (section 9; scope notes in section 10) |
| API-18 | API/security | FR-13; BR-04, BR-18, BR-28; AC-14 | Note Staff append and S/A read, invalid/blank/oversized text, R requests and alternate projections | Private text never reaches R; safe 403; no note edit/delete | `server/tests/lab-03/comments-notes.api.test.ts` | Pass - implemented cases (section 9; scope notes in section 10) |
| API-19 | API | FR-14; BR-05, BR-19; AC-15 | Owned indication, concurrent repeat/status change, forbidden/terminal states, reopening | Atomic actor/time, idempotent active-cycle repeat, unchanged status; cleared on reopen | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Partial - concurrent indication/status interleaving lacks a deterministic case; repeat/reopen lifecycle passes |
| API-20 | API | FR-15; BR-06, BR-28; AC-16 | Admin list name/email search, role filter, no-results, invalid queries and non-A access | Safe sorted records only; 400 invalid; non-A 403 | `server/tests/lab-03/users-admin.api.test.ts` | Pass - implemented cases (section 9; scope notes in section 10) |
| API-21 | API | FR-15; BR-06, BR-07, BR-08, BR-26; AC-17 | User create, role arrays/invalid roles, duplicate normalized email including concurrent create | One account/hash/role; change required; 400/409 errors; no secrets returned | `server/tests/lab-03/users-admin.api.test.ts` | Pass - implemented cases (section 9; scope notes in section 10) |
| API-22 | API | FR-16; BR-07, BR-10, BR-27; AC-18 | Edit fields/activation/role/email without timestamp tokens, duplicate normalized emails, field-specific edits, assignment/deactivation races, owner unassignment and session revocation | Data/history retained; constraint conflicts return safe 409; unrelated fields preserved; affected sessions invalid; owners active/eligible or null; ordinary same-field last successful write accepted | `server/tests/lab-03/users-admin.api.test.ts` | Partial - assignment versus deactivation race lacks a deterministic case; unassignment/revocation and account safety pass |
| API-23 | API/security | FR-16; BR-25; AC-18 | Self-deactivation; last-admin deactivate/demote; concurrent two-admin demotions/deactivations | 409 protects self/at least one active admin after every interleaving | `server/tests/lab-03/users-admin.api.test.ts` | Pass - implemented cases (section 9; scope notes in section 10) |
| API-24 | API/security | FR-16, FR-02, FR-03; BR-10, BR-26; AC-19 | Set new initial password, expired old sessions/password, inactive reset, self-reset | Hash stored; old sessions fail; no implicit activation; next login restricted until change | `server/tests/lab-03/users-admin.api.test.ts` | Partial - self-reset path is not directly exercised; other reset/revocation paths pass |
| API-25 | API/regression | FR-06, FR-20; BR-30; AC-07, AC-26 | Retained Lab 1 health/category contracts against isolated seeded DB | Exact health payload, four ordered categories, normal failure behavior | `server/tests/lab-01/health.test.ts`, `server/tests/lab-01/categories.test.ts` | Pass - implemented cases (section 9; scope notes in section 10) |
| API-26 | Security/API | FR-04, FR-09, FR-10, FR-12, FR-13; BR-04, BR-13, BR-15, BR-17, BR-28; AC-05, AC-10, AC-11, AC-13, AC-14 | Administrator required comment/note reads, permitted read-only detail/attachment metadata, active-owner eligibility through Staff assignment, priority success on accessible tickets including unassigned and another user's tickets; all approved matrix denials, inactive/must-change sessions and CSRF failures | General detail and reads allowed; valid S/A priority write works even though URL starts /staff/; no inherited queue/claim/owner/status/posting/attachment-byte privileges; proper 401/403/400/404 for auth/validation/missing cases; no stale-version requirement | `server/tests/lab-03/authorization.api.test.ts`, `server/tests/lab-03/integration.api.test.ts`, `server/tests/lab-03/staff-ticket-detail.api.test.ts`, `e2e/lab-03/user-administration.spec.ts` | Pass - implemented cases (section 9; scope notes in section 10) |

### Migration and seed tests

| Test ID | Type | Requirement/AC | What It Tests | Expected Result | Automated Test File | Current coverage |
|---|---|---|---|---|---|---|
| MIG-01 | Migration | FR-17; BR-29; AC-20 | Upgrade populated Lab 2 including non-seeded/inactive users, ticket fields/FKs and attachment metadata/file hashes | IDs/relationships/counts/content/bytes preserved; hashes provisioned once; sequence still generates unique IDs | `server/tests/lab-03/migration-regression.test.ts` | Pass - implemented cases (section 9; scope notes in section 10) |
| MIG-02 | Migration | FR-17; BR-07, BR-08, BR-29; AC-20 | Normalized-email collision, unprovisioned login, final constraints and migration reattempt | Fail safely without merging/deleting; unprovisioned denied; no plaintext SQL; final required fields valid | `server/tests/lab-03/migration-regression.test.ts`, `server/tests/lab-03/initial-credentials.test.ts` | Pass - implemented cases (section 9; scope notes in section 10) |
| MIG-03 | Regression | FR-17, FR-04; BR-03, BR-28; AC-04, AC-20 | Migrated-user login/first change and old header/selector endpoint removal | Existing ticket access remains correct; /requesters/active 404; old header not identity | `server/tests/lab-03/migration-regression.test.ts`, `server/tests/lab-03/auth.api.test.ts`, `server/tests/lab-03/authorization.api.test.ts` | Partial - migrated login is tested; first change plus legacy-ticket access is covered separately, not one migrated-user journey |
| MIG-04 | Seed | FR-18; BR-29; AC-21 | Seed twice after passwords/roles/activation/ticket state/removal change | Required role/reference fixtures exist; no duplicate comments/notes/records; no reset of existing choices/data | `server/tests/lab-03/migration-regression.test.ts`, `server/tests/lab-03/initial-credentials.test.ts` | Pass - implemented cases (section 9; scope notes in section 10) |

### Frontend component tests

Use one canonical directory for new tests: `client/tests/lab-03/`. Adapt existing suites explicitly; do not silently duplicate them again.

| Test ID | Type | Requirement/AC | What It Tests | Expected Result | Automated Test File | Current coverage |
|---|---|---|---|---|---|---|
| UI-01 | Component | FR-01; BR-01, BR-12, BR-30; AC-01, AC-22 | Login fields/labels, validation, busy, safe credential/inactive/throttle/network feedback | No registration/identity selector, no duplicate submit or secret storage | `client/tests/lab-03/Login.test.tsx`, `client/tests/lab-03/ZenGreen.test.tsx`, `e2e/lab-03/authentication.spec.ts` | Pass - implemented cases (section 9; scope notes in section 10) |
| UI-02 | Component | FR-02; BR-02, BR-08; AC-02, AC-22 | Mandatory/voluntary password rules, current/new/confirm, saving/errors/success | Mandatory screen cannot be bypassed; successful rotation enters role home; passwords cleared appropriately | `client/tests/lab-03/ChangePassword.test.tsx`, `client/tests/lab-03/ZenGreen.test.tsx`, `e2e/lab-03/authentication.spec.ts` | Pass - implemented cases (section 9; scope notes in section 10) |
| UI-03 | Component | FR-03, FR-04; BR-09, BR-10, BR-30; AC-03, AC-05, AC-20 | Auth bootstrap/role nav/logout/401/password-change gate, old storage cleanup, obsolete async responses | No prior-user flash, no old selector/header, correct name/role/navigation, no normal app before change | `client/tests/lab-03/AuthContext.test.tsx`, `client/tests/lab-03/auth-client.test.ts` | Pass - implemented cases (section 9; scope notes in section 10) |
| UI-04 | Component/regression | FR-05, FR-07; BR-20, BR-23, BR-30; AC-06, AC-08, AC-22 | Existing create validation/busy/idempotent retry, read-only identity/date, partial upload failure/recovery | Inputs retained on recoverable failure; correct server number; failed files explicit; no second ticket | `client/tests/lab-03/RequesterRegression.test.tsx`, `client/tests/lab-02/CreateTicket.test.tsx`, `client/src/tests/lab-02/CreateTicket.test.tsx` | Pass - implemented cases (section 9; scope notes in section 10) |
| UI-05 | Component/regression | FR-06; BR-24, BR-30; AC-07, AC-22 | My Tickets sort/filter/page, canonical attachmentCount, empty/no-results/failure | Correct queries/data and feedback; mocks match real list DTO | `client/tests/lab-03/RequesterRegression.test.tsx`, `client/src/tests/lab-02/MyTickets.test.tsx` | Pass - implemented cases (section 9; scope notes in section 10) |
| UI-06 | Component/regression | FR-07, FR-12, FR-14; BR-04, BR-19, BR-21, BR-22; AC-08, AC-13, AC-15 | Detail upload/download/remove, Public Comments and resolution indication; reload after Staff reopening; no Internal Notes | Correct controls/counts/removal states and limits; reopening clears the old displayed indication/timestamp and re-enables a fresh Requester indication without a formal status control | `client/tests/lab-03/RequesterRegression.test.tsx`, `client/src/tests/lab-02/TicketDetail.test.tsx`, `e2e/lab-03/staff-ticket-flow.spec.ts` | Pass - implemented cases (section 9; scope notes in section 10) |
| UI-07 | Component | FR-08; BR-24, BR-30; AC-09, AC-22 | Queue filters/sorts/pages/owner, loading/empty/no-results/forbidden/failure, out-of-order queries | Latest query wins; usable controls and feedback; no fake fresh results | `client/tests/lab-03/StaffTicketQueue.test.tsx` | Pass - implemented cases (section 9; scope notes in section 10) |
| UI-08 | Component | FR-09, FR-10, FR-11; BR-13, BR-14, BR-15, BR-16, BR-17; AC-10, AC-11, AC-12, AC-22 | Staff grouped detail, claim/reassign/priority/transition confirmation and business-rule conflict | Only approved actions; read-only submitter fields; reload on conflict | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Pass - implemented cases; OwnerRef regression verified (section 11) |
| UI-09 | Component/security | FR-12, FR-13; BR-04, BR-18; AC-13, AC-14, AC-22 | Separate public/internal composers, author/time, limits, literal HTML text, failure and pagination | Distinct destinations; no XSS execution; no edit/delete; A reads discussion without composers, while separate IT Priority control remains permitted | `client/tests/lab-03/StaffTicketDetail.test.tsx`, `client/tests/lab-03/IntegratedFeedback.test.tsx` | Partial - discussion load/retry and separate posts pass; Load More and save-error input retention are not directly exercised |
| UI-10 | Component | FR-15, FR-16; BR-06, BR-07, BR-25, BR-26, BR-27; AC-16, AC-17, AC-18, AC-19, AC-22 | User list/search/role filter/create/edit/initial reset, duplicate/safety/forbidden feedback without timestamp preconditions | One role, no delete/advanced controls, safe session reset/unassignment warning | `client/tests/lab-03/UserManagement.test.tsx`, `client/tests/lab-03/IntegratedFeedback.test.tsx`, `e2e/lab-03/user-administration.spec.ts` | Pass - implemented cases (section 9; scope notes in section 10) |
| UI-11 | Component/regression | FR-19; BR-30; AC-22 | Lab 1 heading and Check System loading/success/offline after shell change | Diagnostics remain available and use API results, not fake hardcoded success | `client/tests/lab-01/App.test.tsx` (adapt existing setup) | Pass - implemented cases (section 9; scope notes in section 10) |
| UI-12 | Component | FR-04, FR-10, FR-12, FR-13; BR-04, BR-15, BR-17; AC-05, AC-11, AC-13, AC-14, AC-22 | Administrator read-only known-ticket information/attachment metadata with separate IT Priority Save regardless of owner, required comment/note reads, busy/success/invalid/not-found/failure states and no denied actions | Requested Priority unchanged; calls explicit S/A priority endpoint with only itPriority and CSRF; no queue/claim/reassign/status/composer/attachment-byte controls | `client/tests/lab-03/AdministratorTicketAccess.test.tsx` | Partial - reads/priority success/not-found pass; every invalid/busy/error priority state is not independently exercised |

### Style, responsive and browser E2E

| Test ID | Type | Requirement/AC | What It Tests | Expected Result | Automated Test File | Current coverage |
|---|---|---|---|---|---|---|
| STYLE-01 | UI style | FR-19; BR-30; AC-23 | Tokens/classes, labels/required markers, editable/read-only, busy/invalid, full status/role/priority labels | Existing Zen Green semantics preserved; no color-only meaning | `client/tests/lab-03/ZenGreen.test.tsx` | Partial - palette and auth field association/focus pass; exhaustive field/label/style conformance remains manual |
| RESP-01 | Browser responsive | FR-19; BR-30; AC-23 | All required screens at 1280x800, 768x1024, 375x812; long text/files/emails; breakpoint edges | No page overflow/clipping/overlap; usable menu/forms/table/cards/dialogs; actual screenshots | `e2e/lab-03/responsive.spec.ts`, `e2e/evidence/lab-03.capture.spec.ts` | Pass - implemented cases (section 9; scope notes in section 10) |
| RESP-02 | Browser accessibility | FR-19; BR-30; AC-23 | Keyboard navigation, visible focus, mobile menu, validation focus, modal trap/Escape/return | All required actions accessible; announcements/labels meaningful | `e2e/lab-03/responsive.spec.ts` | Partial - dialog/menu/auth focus behavior passes; exhaustive focus visibility, touch targets and field semantics remain manual |
| E2E-01 | Browser E2E | FR-01, FR-02, FR-03, FR-04; BR-02, BR-09, BR-10, BR-11; AC-01, AC-02, AC-03, AC-24, AC-25 | Valid/invalid/inactive login, first change, role home, reload, logout, back/deep-link/direct API after logout | Real cookies/CSRF/API/DB enforce lifecycle; no private cached content after logout | `e2e/lab-03/authentication.spec.ts` | Pass - implemented cases (section 9; scope notes in section 10) |
| E2E-02 | Browser E2E | FR-08, FR-09, FR-10, FR-11, FR-12, FR-13, FR-14; BR-04, BR-15, BR-16; AC-09, AC-10, AC-11, AC-12, AC-13, AC-14, AC-15, AC-24 | Staff queue -> claim/reassign -> priorities -> comment/note -> wait/resolve/close/reopen with Requester response | Real permitted workflow and note isolation; Requester indication never resolves ticket | `e2e/lab-03/staff-ticket-flow.spec.ts` | Pass - implemented cases (section 9; scope notes in section 10) |
| E2E-03 | Browser E2E | FR-15, FR-16; BR-06, BR-07, BR-25, BR-26; AC-16, AC-17, AC-18, AC-19, AC-24 | Admin list/search/create/edit/deactivate/reset, duplicate/safety failures, next-login password change, non-A access | Minimal management works end-to-end; no implicit staff permission; safety checks persist | `e2e/lab-03/user-administration.spec.ts` | Pass - implemented cases (section 9; scope notes in section 10) |
| E2E-04 | Browser regression | FR-05, FR-06, FR-07, FR-17; BR-03, BR-20, BR-21, BR-22, BR-23; AC-06, AC-07, AC-08, AC-20, AC-24 | Migrated Requester login -> create/files -> My Tickets -> detail add/download/remove; second user isolation, partial failure | Lab 2 business flow survives real auth and correct server-backed file behavior | `e2e/lab-03/requester-regression.spec.ts`, `server/tests/lab-03/migration-regression.test.ts` | Partial - browser uses fresh synthetic users; migration preservation is verified separately by MIG-01/02 |
| E2E-05 | Browser authorization | FR-04, FR-10, FR-12, FR-13; BR-04, BR-15, BR-17; AC-05, AC-11, AC-13, AC-14, AC-24 | Administrator login -> accessible ticket assigned to another user -> read permitted detail/metadata and public/internal entries -> separately update IT Priority -> verify unchanged Requested Priority and direct API denials for approved restricted operations | Required participation works through UI/API/DB; no blanket Staff inheritance; entry/attachment/status restrictions match the matrix | `e2e/lab-03/user-administration.spec.ts` | Pass - implemented cases (section 9; scope notes in section 10) |

### Engineering and visual evidence (manual, not fictional automation)

| Test ID | Type | Requirement/AC | What It Tests | Expected Result | Automated Test File | Current coverage |
|---|---|---|---|---|---|---|
| EVID-01 | Contract review | FR-20; AC-26 | Complete FR/BR/AC-to-test mapping, source precedence and approved EDs | Human approval recorded before implementation; no unsupported completeness claims | N/A — human review of four contract files | Approved decisions; mapping checked (section 10); peer evidence manual |
| EVID-02 | Visual review | FR-19; BR-30; AC-23 | Inspect actual responsive screenshots against ui-spec.md checklist and sample illustrations | Human verifies readability, focus, clipping and semantic consistency; link captures/commit | N/A — screenshot review record in this file | Partial - captures and agent visual inspection are recorded in the evidence index; human visual sign-off remains manual |
| EVID-03 | Delivery review | FR-20; AC-26 | Issues/board/feature-to-staging-to-main history, bilateral reviews, AI record, final test outputs and PDF evidence | Real peer approvals and final-main evidence linked; no pending required items hidden | N/A — reviewer.md and release evidence below | Manual pending - release, peer/AI records and final-main/PDF evidence |

## 3. Acceptance-criterion traceability

| Acceptance criterion | Tests/evidence (status in section 2) |
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

Baseline declarations: 49 backend tests in eight files, 32 frontend tests in seven files. Original counts are historical; integrated regression runs are recorded in section 9. `server/tests/lab-02/e2e-flow.test.ts` is a Supertest flow, not browser E2E.

- Retain Lab 1 health/category tests and diagnostic App behavior; adapt wrapper/bootstrap mocks only as necessary.
- Adapt `tickets.create.test.ts`, `tickets.list.test.ts`, `tickets.detail.test.ts`, and `e2e-flow.test.ts` to authenticated Supertest agents, CSRF and mapped `prisma.user`. Preserve validation/isolation/idempotency/file assertions; update initial IT Priority and safe cross-owner 404 expectations explicitly.
- Replace `requester-auth.test.ts` header expectations and `requesters.api.test.ts` selector-list expectations with the new auth/authorization/removal tests. Do not keep insecure identity mechanisms just to make obsolete tests pass.
- Replace RequesterContext suites with AuthContext/role/password-change tests. Existing CreateTicket/MyTickets/TicketDetail component cases remain useful with auth mocks and accurate DTOs.
- Two retained CreateTicket suites remain under `client/tests/lab-02/` and `client/src/tests/lab-02/`; both are included in the 83-case client result, not counted as new Lab 3 coverage. Obsolete RequesterContext suites were replaced by AuthContext coverage.
- Visible sort/detail upload/mobile navigation and attachmentCount/partial-upload continuity fixes are exercised by RequesterRegression and browser flows; the original ED-10 scope is unchanged.

## 5. Commands and evidence capture

The implemented suite entrypoints are `npm --prefix server test`, `npm --prefix client test` and `npm --prefix e2e test`. See section 9 for the isolated database configuration, prerequisites, exact executed commands and observed results. No tests ran during the original Phase 2 drafting phase.

For each actual run record tested commit/branch, environment versions, exact command, fixture/database isolation, start time, complete output, pass/fail/skip totals and artifact paths. Run appropriate failing/passing tests within each feature Issue; broaden at integration/release. Final results must be obtained from the final main revision, not a stale feature branch.

Product verification covers behavioral assertions for FR-01–19, BR-01–30 and AC-01–25. Screenshot capture/submitted visual-review artifacts (including the evidence portions of RESP-01/EVID-02), peer approvals, staged history, final-main outputs and submission evidence belong to FR-20/AC-26 delivery checks. An AC-23 link to EVID-02 provides supplementary delivery evidence; it does not make screenshots a product-completion prerequisite. Current feature-branch verification is recorded in section 9; it is not final-main or submission evidence.

## 6. Final results and responsive evidence

| Evidence | Current result |
|---|---|
| Unit/API/component/security/migration/browser tests | Current workspace runs in section 9; final-main verification remains pending |
| Required screenshots and visual review | Captures/index in `artifacts/lab-03/screenshots/`; human sign-off pending (EVID-02) |
| Human engineering-decision approval | ED-01–10 approved by user through Phases 2.1/2.2 on 2026-09-15; approval is unchanged; application execution is recorded separately in section 9 |
| GitHub Issues/PRs/peer approvals/staged release | Not changed or independently certified in Issue #36; human audit required |
| Final-main test commit and complete logs | TODO |

Screenshot locations/viewports follow ui-spec.md section 10. The [index](../../artifacts/lab-03/screenshots/README.md) and [manifest](../../artifacts/lab-03/screenshots/manifest.json) record actual files, roles, states, dimensions, hashes and base revision. No human reviewer is fabricated.

## 7. Known limits and open verification facts

- The Phase 2.1 authorization matrix is approved (ED-05): read-only permitted Ticket Detail/metadata, required comment/note visibility and owner eligibility, separate IT Priority updates on accessible tickets without an owner-only restriction, and the stated operational denials. Phase 2.2 approves all remaining EDs, default page size 10, and targeted correctness safeguards without broad optimistic locking. No unresolved engineering-policy decision currently blocks implementation.
- Migration/provisioning tests use synthetic legacy records and files. They do not certify the contents or readiness of an arbitrary deployment database.
- Local Windows tooling and installed dependency versions are exercised by the runs in section 9; other browsers/platforms are not certified by the Chromium run.
- Live peer assignments, branch protections, Issue numbers and PR approvals are unverified; record actual facts later.
- No required test may be marked Pass based only on a document, mock that bypasses the relevant layer, or an agent claim.

## 8. Approved eight-Issue work breakdown

Planning IDs below are not GitHub Issue numbers. The approved dependency/scope breakdown is retained: feature PRs target lab3-staging; release PR targets main. Actual creation dates, reviews and board history require GitHub evidence; this document does not certify them.

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

## 9. Issue #35 integrated verification - historical workspace

This is feature-branch verification on `feat/lab3-integration-e2e`, not Issue #36 release packaging, peer approval or final-main evidence. Existing authorization decisions, statuses, server behavior, schema, migrations and seed logic are unchanged.

### Implemented coverage

| Area / planned IDs | Implemented verification |
|---|---|
| Auth/session: API-01-05, E2E-01 | `authentication.spec.ts` covers initial restricted login, denied re-login, mandatory change, reload, logout and browser back/direct API after logout; `auth.api.test.ts`, `session.unit.test.ts` and `auth-concurrency.api.test.ts` retain expiry, CSRF, throttle and logout-race checks. |
| Cross-role: API-04-07/26 | New `server/tests/lab-03/integration.api.test.ts` uses real login cookies across all 22 implemented business method/path combinations: role denials, anonymous legacy headers, restricted/inactive/expired/revoked sessions and mutation CSRF. Its connected flow verifies note isolation, Administrator reads/priority and role-change revocation. Existing authorization and resource suites cover real/absent/cross-owner records. |
| Requester/attachments: E2E-04, API-08-11, UI-04-06 | `requester-regression.spec.ts`: real create/list/detail, upload/download byte equality and browser download, soft removal, literal public text, another Requester's safe 404 and partial-upload retry without duplicate Ticket. Existing migration and attachment suites separately cover preservation, limits, idempotency and concurrency. Browser accounts are synthetic; legacy migration claims come from the migration suite, not browser setup. |
| Staff/workflow: E2E-02, API-12-19, UNIT-04 | `staff-ticket-flow.spec.ts`: queue search/filter/sort/pagination, preserved page and filters after detail, refreshed matching rows after claim, active Administrator assignment, independent IT Priority, public/internal posts, upload and Requester response. Wait/resolve/close/reopen clears the indication without changing status on Requester submission. Existing workflow tests cover all 64 status pairs, cancellation, reason/owner/confirmation restrictions and competing claims. |
| Administrator: E2E-03/05, API-20-24/26 | `user-administration.spec.ts`: create/duplicate/edit/reset/change password/role change/deactivate, revoked sessions, self-deactivation and last-admin safeguards; separate ticket reads and IT Priority without Staff inheritance. Existing API tests retain concurrent account safety and owner-unassignment checks. |
| Feedback/accessibility: UI-01/02/06section 10/12, STYLE-01 | New `client/tests/lab-03/IntegratedFeedback.test.tsx` covers discussion loading/failure/retry, Requester note exclusion, forbidden directory without false empty success and stale directory response rejection. `ZenGreen.test.tsx` checks approved palette plus field-associated login/password validation and focus. Existing component suites retain validation/busy/empty/no-results/success/forbidden/error coverage. |
| Responsive/keyboard: RESP-01/02 | `responsive.spec.ts` exercises login/change password, Requester create/list/detail, Staff queue/detail/workflow, Administrator directory/dialog and permitted Ticket Detail at 1280x800, 768x1024 and 375x812; long unbroken content, email and filename, mobile cards/menu, modal accessible names, focus containment/Escape/return, validation focus, and queue 767/768/991/992 boundaries. Geometry/behavior assertions avoid pixel snapshots. |
| Migration/regression: MIG-01-04, API-25 | Existing full backend suite includes synthetic populated Lab 2 upgrades, unchanged IDs/relationships/attachment bytes, handover failure/retry, create-only seed reruns, removed selector/legacy identity, and retained Lab 1-2 contracts. |

All browser spec paths above are under `e2e/lab-03/`; server suite names are under `server/tests/lab-03/` unless explicitly identified as Lab 1-2. Coverage combines layers; an individual browser scenario is not a claim that every matrix edge was clicked in the browser.

Targeted repairs revealed by these checks: retain and refresh Staff Queue query state across full detail; announce failed/loading discussion reads and provide retry; reject stale directory responses and suppress false empty state after errors; wrap mobile detail content and render mobile user cards; add dialog names/keyboard handling; associate auth validation errors and focus. No new role capability or workflow feature was added. The full-suite run also exposed unordered historical-priority snapshots in the existing Lab 2 create test: both queries now order by ID and still compare every original ID/priority exactly. The palette test uses a raw CSS import explicitly enabled in the existing Vitest/Vite configuration, avoiding a new Node-types dependency.

### Reproduction and isolation

- Install existing server/client dependencies with `npm ci` in their directories; install the new single browser runner with `npm --prefix e2e ci`, then run `npx playwright install chromium` from `e2e`.
- Use the existing disposable PostgreSQL container `toktickit-lab3-auth-test` on localhost:55433, database `toktickit_lab3_test`, test user `lab3_test` / local-only fixture password `lab3_test_local`. The development database on 5433 is not a test target.
- Before server commands, set these PowerShell variables:

```powershell
$env:DATABASE_URL='postgresql://lab3_test:lab3_test_local@127.0.0.1:55433/toktickit_lab3_test?schema=public'
$env:NODE_ENV='test'
$env:TEST_UPLOAD_ROOT='uploads/lab-03-test'
$env:AUTH_ALLOW_HTTP_LOCALHOST='true'
```

- Backend setup resets only the guarded disposable schema. Do not run backend and browser suites concurrently against it. Browser config supplies the same database and starts dedicated API/UI servers at localhost:3101/5174; it refuses to reuse an existing listener. The launcher uses `server/tests/lab-03/e2e-server.ts`, not a product fixture API.
- Browser fixtures generate unique accounts and in-memory random passwords, hash them with real Argon2id, and remove their records and confined upload bytes. One worker and zero retries make failures visible. Traces, videos and automatic screenshots are disabled to avoid recording credentials/session data; runner outputs are ignored in Git. Screenshot/reviewer/submission packaging remains with Issue #36.

### Observed commands and results

Results below refer to this edited workspace on 2026-09-19 to 2026-09-20 (Windows, Node 24.14.0, npm 11.9.0, PostgreSQL 17 Alpine, Playwright 1.58.2 / Chromium), not a committed or released revision. Commands use `npm.cmd` in PowerShell. Observed results follow. Counts are per command and overlap; do not add focused runs to full-suite totals.

| Working directory | Exact command | Observed result |
|---|---|---|
| client | `npm.cmd test -- tests/lab-03/ZenGreen.test.tsx tests/lab-03/IntegratedFeedback.test.tsx tests/lab-03/StaffTicketQueue.test.tsx` | 23 passed, 0 failed (3 files); after the raw-CSS build correction, STYLE-01 was rerun separately below and all cases rerun in the full client suite |
| client | `npm.cmd test -- tests/lab-03/ZenGreen.test.tsx` | 3 passed, 0 failed (1 file), final raw-CSS configuration |
| server | `npm.cmd test -- tests/lab-03/integration.api.test.ts tests/lab-02/tickets.create.test.ts` | 25 passed, 0 failed (2 files) |
| server | `npm.cmd test -- tests/lab-03/auth.api.test.ts tests/lab-03/authorization.api.test.ts tests/lab-03/users-admin.api.test.ts tests/lab-03/integration.api.test.ts` | 58 passed, 0 failed (4 files) |
| server | `npm.cmd test` | 249 passed, 0 failed, 0 skipped (25 files); includes all Lab 3 plus Lab 1-2 |
| client | `npm.cmd test` | 83 passed, 0 failed, 0 skipped (16 files), final configuration |
| e2e | `npm.cmd test` | 11 passed, 0 failed, 0 skipped (5 specs), Chromium with one worker and zero retries |
| server | `npm.cmd run build` | PASS, exit 0 (`tsc`) |
| client | `npm.cmd run build` | PASS, exit 0 (`tsc && vite build`) |
| repository root | `git diff --check` | PASS, exit 0; only LF/CRLF conversion notices, no whitespace errors |

The first full backend run had 245 passed / 4 failed because the preservation test compared unordered SQL results; explicit ordering fixed the test without changing its preservation assertion. The first client build failed because the palette test used Node filesystem types absent from the client project; the final test uses raw CSS and keeps the same palette assertions. Vitest's default CSS stub initially returned an empty string, resolved by enabling that one raw stylesheet import. Existing CreateTicket negative-path tests intentionally emit their simulated server error to stderr; their assertions pass. No authorization assertion, workflow edge, preservation invariant or existing test was removed or skipped.

## 10. Issue #36 audit and release boundary (2026-09-22)

Historical audit snapshot. Section 11 supersedes the owner-label blocker and unchanged-implementation verification basis only; unrelated Partial/manual findings remain open.

### Evidence retained without redundant suite execution

Read-only Git-object and workspace hashing compared Issue #35 feature revision `a897491eefa7cbc6e84c0ac34ecd688e85ecd98b` with the current integrated base `8fdcc590a9552b912dc3034a524dde0f35bc27c2` on `feat/lab3-final-release-evidence`: all 113 tracked files under server/, client/ and e2e/ matched, with zero implementation/configuration differences. Local Vitest result caches also contained 25 server and 16 client files with no failed files; the existing normal Playwright last-run record was passed. Counts come from the observed section 9 output, not inferred from cache file counts.

Retained results: **249 server / 83 client / 11 browser cases passed, zero failed or skipped; both builds passed**. The server total includes 195 Lab 3 cases in 17 files, 52 Lab 2 cases in six files and two Lab 1 cases. `npm.cmd run test:lab3` selects Lab 3 plus Lab 1, excludes Lab 2, and was not separately executed in this audit; do not relabel 249 as the dedicated Lab 3 command result.

The new opt-in screenshot configuration has its own test directory and output directory; it does not alter normal regression selection. Screenshot tests are evidence-generation checks, not extra cases added to the retained 11-case regression count. No product file, schema, migration, seed or ordinary runner configuration changes in Issue #36.

### Coverage interpretation and outstanding checks

Section 2 preserves every original ID and planned scenario, adds actual supporting files and replaces obsolete Planned labels. **Pass means the implemented cases passed in the recorded suite; Partial identifies an uncovered part of the broader planned row.** It is not legitimate to infer every planned subcase from a passing file. All AC-01 through AC-26 retain references to declared IDs and existing intended files (manual rows identify their evidence source).

- Partial API work: exhaustive Requester sort/tie cases (API-09); Staff byte actions/Unicode/missing-file cases (API-11); priority no-op/concurrent writes (API-15); deterministic status, indication/status and assignment/deactivation interleavings (API-16/19/22); self-reset (API-24). Existing positive, authorization and sequential invariants passed. These are coverage gaps, not demonstrated product failures or permission changes.
- Partial cross-layer evidence: UNIT-03 uses API tests for resource policy; MIG-03/E2E-04 use separate migration and fresh-user browser flows, not one migrated-user first-change/browser journey.
- Partial UI/accessibility evidence: UI-09 discussion pagination/save-error retention, UI-12 exhaustive priority feedback, STYLE-01 and RESP-02 exhaustive required-field associations, visible focus and 44px targets. Existing palette, auth validation, modal keyboard, responsive and role checks passed. Screenshots cannot prove every interactive/accessibility state.
- EVID-01 records the previously approved decisions and this mapping audit; no peer approval is fabricated. EVID-02 contains actual captures plus agent inspection, with human sign-off outstanding. EVID-03 remains manual/pending: reviewer/AI records, bilateral approvals, board/PR history, final-main outputs and submission PDF.

### Reproduction and handoff

See the current [README](../../README.md) for Windows prerequisites, explicit environment variables, private acknowledged credential handover, disposable database setup and exact server/client/E2E commands. The existing backend start script points at the old output layout; the documented built-server command is `node dist/src/index.js` from server/. This audit does not silently modify that script.

Visual evidence, per-file metadata, injected states, limitations and capture outcomes are recorded in the [screenshot index](../../artifacts/lab-03/screenshots/README.md). Future final-main verification must record the actual final revision and full output. Release flow remains feature review into lab3-staging, then reviewed lab3-staging -> main; no GitHub action was performed here. reviewer.md and ai-use.md were intentionally excluded at the user's request.

### Owner metadata/label defect - resolved 2026-09-26

The September 22 audit found that the shared detail query and formatter omitted owner role/isActive, causing the active IT Staff owner to render as Administrator - Inactive. The targeted correction now preserves the exact OwnerRef contract in Staff and general detail responses, including mutation responses. API-14/UI-08 owner regression and real-response E2E checks passed; six affected captures were regenerated. Section 11 records the current results.

The earlier NOT READY verdict for this blocker is superseded by **READY FOR MANUAL FINAL DOCUMENTATION**. This is not final-main or course-release approval; the other presentation/accessibility and Partial coverage findings remain unchanged.

### Issue #36 checks actually executed

- Focused evidence capture commands and every retry/result are recorded in the screenshot index. Final `npx.cmd playwright test --config playwright.evidence.config.ts` from e2e: **3 passed, 0 failed, 0 skipped (45.7s), 64 PNGs**.
- Inline Node documentation/evidence audit: **107 local links resolved; 59 test IDs; 93 existing test-file references; all 26 AC rows reference declared IDs; 64 PNG hashes/dimensions verified; zero errors**. This checks paths/mapping structure, not completeness of every planned assertion.
- Read-only object/workspace comparison: all **113 tracked implementation/test/configuration files unchanged**; only README and the four technical Lab 3 documents differ among tracked files. New capture helper/configuration and screenshot evidence are additional files.
- SHA-256 checks of reviewer.md and ai-use.md match the pre-work hashes exactly. Both files remain reserved for manual completion.
- No full product suites/builds were rerun for documentation and isolated capture additions; retained results and their limitations are above.
- `npx.cmd playwright test --list` from e2e: **11 tests in five files**, exit 0; opt-in captures excluded.
- `git diff --check`: the first check found one extra README EOF blank line; removed. Final check after the correction: **PASS, exit 0**, with LF/CRLF notices only. No Git state-changing command was run.
- File inventory audit: **five intended tracked documentation changes, 68 expected additions (64 PNGs, index, manifest, capture spec/config), zero unexpected non-ignored files**. Ignored dependency/build/upload/runner output is excluded from delivery.

## 11. Owner metadata blocker correction (2026-09-26)

Scope: restore the existing OwnerRef contract only. `server/src/attachments.ts` now selects role/isActive alongside id/name; `server/src/staffTicket.ts` emits the same four fields explicitly. No frontend product change, permission/workflow change, schema/migration or account-management behavior change.

Regression scope: three new API cases assert exact owner DTOs for active IT Staff, active Administrator and null across Staff detail, Requester-owned general detail and Administrator-permitted general detail; claim response metadata is also asserted. Four new component cases verify Staff/Admin labels without Inactive, null/Unassigned and defensive inactive DTO display. An inactive retained owner is not a valid normal contract state: deactivation unassigns tickets, as the existing users-admin API case verifies. No policy was relaxed to manufacture an inactive-owner fixture. The existing Staff browser journey now asserts null, claimed Staff and assigned Administrator labels, including fresh detail reads in another page sharing the real session.

### Commands and observed results

Run dates are local Asia/Bangkok (2026-09-26); manifest timestamps use UTC. Server commands used the same dedicated environment variables as section 9: DATABASE_URL at 127.0.0.1:55433/toktickit_lab3_test, NODE_ENV=test, TEST_UPLOAD_ROOT=uploads/lab-03-test, AUTH_ALLOW_HTTP_LOCALHOST=true. No development database was used.

| Directory | Exact command | Result |
|---|---|---|
| server | `npm.cmd test -- tests/lab-03/staff-ticket-detail.api.test.ts -t 'preserves exact OwnerRef'` before fix | After starting the stopped test container: **1 passed, 2 failed, 17 deselected**; both failures showed missing role/isActive |
| server | Same focused command after fix | **3 passed, 0 failed, 17 deselected**; 1 file |
| client | `npm.cmd test -- tests/lab-03/StaffTicketDetail.test.tsx -t 'renders current owner'` | **4 passed, 0 failed, 9 deselected**; 1 file |
| server | `npm.cmd test -- tests/lab-03/staff-ticket-detail.api.test.ts tests/lab-03/users-admin.api.test.ts tests/lab-03/integration.api.test.ts` | **57 passed, 0 failed, 0 skipped**, 3 files |
| client | `npm.cmd test -- tests/lab-03/StaffTicketDetail.test.tsx` | **13 passed, 0 failed, 0 skipped**, 1 file |
| server | `npm.cmd test` | **252 passed, 0 failed, 0 skipped**, 25 files; 29.17s |
| client | `npm.cmd test` | **87 passed, 0 failed, 0 skipped**, 16 files; 9.65s |
| e2e | `npm.cmd test` | **11 passed, 0 failed, 0 skipped**, 5 specs; 31.5s |
| server | `npm.cmd run build` | **PASS**, exit 0 |
| client | `npm.cmd run build` | **PASS**, exit 0 |
| e2e | `$env:LAB3_EVIDENCE_OWNER_ONLY='1'` then `npx.cmd playwright test --config playwright.evidence.config.ts` | **3 passed, 0 failed, 0 skipped**; 21.0s; only six affected captures regenerated |

The first focused API attempt could not reach the stopped test database and executed no tests. `docker start toktickit-lab3-auth-test` restored the environment before the genuine failing regression above. Deselected cases in the name-filtered runs are reported as skipped by Vitest; the complete runs contain zero skips. Each full server/client/E2E suite ran exactly once in this correction. Expected simulated CreateTicket server errors appeared in client stderr while those assertions passed.

Current counts add three API and four client cases to the prior 249/83 totals; the eleven browser scenarios now contain stronger owner assertions. These are current workspace results, not final-main verification.

### Affected evidence and remaining scope

Only `staff-ticket-detail/detail-{desktop,tablet,mobile}.png` and `staff-ticket-detail/status-confirmation-{desktop,tablet,mobile}.png` were regenerated. The other 58 images and their manifest entries are retained unchanged. The recaptured mobile confirmation is byte-identical because the owner label is outside that modal viewport; five PNG hashes changed. Manifest updates record individual timestamps, the unchanged base revision and hashes of the two modified application files. All six captures were visually inspected after the successful browser assertions.

V-01 is resolved. V-02/V-03, other Partial rows, manual reviewer/AI records, peer approval, final-main verification and course delivery are not closed by this fix. No additional release blocker was identified in this bounded correction. reviewer.md and ai-use.md remain intentionally untouched.

Final checks: `git diff --check` passed (exit 0; LF/CRLF notices only). The inline documentation/evidence audit resolved 100 local links across the five affected Markdown files, validated all 59 declared test IDs and 26 AC mappings, verified all 64 PNG hashes/dimensions and both application hashes, and confirmed both protected files unchanged, with zero errors. Exactly six manifest entries were refreshed; the other 58 entries and images match the pre-correction baseline.
