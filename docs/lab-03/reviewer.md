# Lab 3 — Peer Review Record

**Author:** Songwit Rueangsawat — 67070501060 — GitHub: @R1NNE0
**Peer reviewer:** Thanawat Suntarawattana — 67070501022 — GitHub: @Maibokdaimhai
**Partner I review:** Tanadet Nuchaikaew — 67070501081 — GitHub: @Kawi-HBLI

---

## Pull Requests I authored (reviewed by my partner)

|      PR     | Branch        | Reviewer verdict |
| :---------: | ------------- | :--------------: |
| #37 | `docs/lab3-engineering-contract` | Approved |
| #38 | `feat/lab3-user-auth-foundation` | Approved |
| #40 | `feat/lab3-authorization-requester` | Approved |
| #41 | `feat/lab3-staff-queue` | Approved |
| #42 | `feat/lab3-staff-ticket-workflow` | Approved |
| #43 | `feat/lab3-user-management` | Approved |
| #44 | `feat/lab3-integration-e2e` | Approved |
| #45 | `feat/lab3-final-release-evidence` | Approved |

### Lab 3 Issue 1: Sprint 3 Engineering Contract and Test Plan

- **PR Link:** [#37](https://github.com/R1NNE0/toktickit/pull/37)
- **Branch:** `docs/lab3-engineering-contract`

**Reviewer comment I received:**

> Approved. The Sprint 3 documents comprehensively cover the Lab 3 requirements and are internally consistent.
> Minor non-blocking follow-up: please add README, .gitignore, and repository directory-structure evidence to the Product Definition of Done or P8 scope, as these are explicitly required for Answer Part 1 of the final submission. This can be addressed before final release and does not block implementation.

**How I responded:**

> Thanks for the review and approval. I agree with the follow-up and will add README, .gitignore, and repository structure evidence to the final documentation/P8 scope before release. This does not block implementation.

---

### feat(lab-03): implement user migration and authentication foundation

- **PR Link:** [#38](https://github.com/R1NNE0/toktickit/pull/38)
- **Branch:** `feat/lab3-user-auth-foundation`

**Reviewer comment I received:**

> **Request changes:** there is one blocking migration-safety issue.
>
> Initial-password hashes are saved before the credential handover succeeds. If the terminal output or another handover mechanism fails, rerunning the migration skips those users because their passwordHash is already populated. Their generated passwords are therefore permanently lost, and a later run may still complete the final NOT NULL migration successfully.
>
> The seed process has the same failure mode for newly created accounts. This is especially risky because Administrator password reset is deferred, potentially leaving the only seeded Administrator inaccessible.
>
> Please make credential persistence and handover recoverable or atomic, provide an explicit secure recovery mechanism, and add a regression test covering:
> 1. Credential handover failure.
> 2. Migration or seed retry.
> 3. Successful recovery of usable initial credentials.
>
> The rest of the authentication foundation looks carefully aligned with the contract, particularly session rotation, password-change/logout concurrency, CSRF enforcement, mandatory password change, and preservation of the existing data model.

**How I responded:**

> Thanks for catching this.
>
> I changed the migration and seed provisioning flow to use a shared handover-before-persistence mechanism.
>
> Initial credentials are now persisted only after successful private-terminal handover and explicit `SAVED` confirmation. If handover fails, is cancelled, or is not confirmed, the account remains pending and can be safely recovered on retry.
>
> I also added regression coverage for:
> - handover failure;
> - migration/seed retry;
> - successful recovery of usable Requester and Administrator credentials;
> - mandatory password-change enforcement;
> - preservation of successfully provisioned credentials on later reruns.
>
> Verification:
> - targeted provisioning/migration tests: 12 passed
> - full backend suite: 80 passed across 16 files
> - Prisma validate: PASS
> - backend build: PASS
> - git diff --check: PASS
>
> Ready for re-review.

**Reviewer comment I received:**

> Approved.
> The blocking credential-recovery issue is resolved. The updated flow now:
> - Completes private handover and requires explicit SAVED confirmation before persisting a hash.
> - Leaves failed or cancelled accounts pending and recoverable on retry.
> - Preserves credentials already provisioned successfully.
> - Covers migration and seed failure/retry paths, including Administrator recovery and mandatory password change.

**How I responded:**

> Thanks for the re-review and approval.
>
> I’ve confirmed the credential-recovery fix and regression coverage are in place. The flow now remains recoverable on failed handover while preserving successfully provisioned credentials.
>
> Appreciate the catch on this issue.

---

### feat(lab-03): enforce requester authorization and regression

- **PR Link:** [#40](https://github.com/R1NNE0/toktickit/pull/40)
- **Branch:** `feat/lab3-authorization-requester`

**Reviewer comment I received:**

> ### Peer Review Checklist & Verification
>
> I have reviewed and verified **Issue 3: Authorization and Requester Regression** on branch `feat/lab3-authorization-requester` against commit `f58a964`.
>
> ---
>
> #### 1. Automated Verification Results
>
> - [x] **Backend Test Suite (`server`):**
>   - Full suite: `npm test` → **19 files / 127 passed** (100% green)
>   - Targeted suite: `npm run test:lab3` → **13 files / 75 passed** (100% green)
>   - TypeScript build: `npm run build` (`tsc`) → **PASS** (0 errors)
>   - Schema check: `npx prisma validate` → **PASS**
> - [x] **Frontend Test Suite & Build (`client`):**
>   - Unit/Component suite: `npm test` → **10 files / 39 passed** (100% green)
>   - Production bundle: `npm run build` (`tsc && vite build`) → **PASS**
> - [x] **Repository Hygiene:**
>   - `git diff --check` → **PASS** (no whitespace errors or conflict markers)
>
> ---
>
> #### 2. Code Inspection & Requirements Traceability
>
> - [x] **Session-Derived Requester Identity (FR-04 / AC-04 / AC-05):**
>   - Requester identity is extracted strictly from the authenticated session (`req.auth.user`).
>   - Legacy `x-requester-id` header and `?requesterId=` query injection are completely blocked.
>   - Non-Requester roles (`IT_STAFF`, `ADMINISTRATOR`) are rejected with `403 FORBIDDEN` on requester endpoints.
>   - Client-side `sessionFetch` strips legacy headers and automatically attaches CSRF tokens on mutations.
> - [x] **Safe Cross-Requester Isolation (FR-06 / AC-07):**
>   - Direct access to another requester's ticket details, attachment downloads, or attachment deletions consistently returns a safe `404 NOT_FOUND` rather than leaking existence.
> - [x] **Attachment Security, Concurrency & Cleanup (FR-07 / AC-08):**
>   - Ownership is checked before disk write operations.
>   - File signature validation (`validAttachment`) correctly checks magic bytes for PDF, PNG, JPG, and WEBP.
>   - Transactional `SELECT ... FOR UPDATE` lock prevents concurrent 5th/6th upload race conditions.
>   - Failed or rejected uploads are immediately cleaned up from the filesystem via `unlink`.
>   - Soft removal preserves metadata and audit reason while blocking downloads with `403 ATTACHMENT_REMOVED`.
> - [x] **Ticket Creation Regression & Continuity (FR-05 / AC-06):**
>   - New tickets correctly copy `requestedPriority` into `itPriority`.
>   - Idempotency key replay and concurrent unique constraint conflicts (`P2002`) are handled safely, returning the existing ticket with HTTP 200.
>   - Form state preservation and partial upload retry handling work smoothly on the client.
>
> ---
>
> #### Verdict
>
> **Approved!** All authorization checks, isolation rules, concurrency protections, and regression guarantees are fully satisfied and pass all verification tests. Ready to merge into `lab3-staging`.

**How I responded:**

> Thanks for the thorough review and verification.
>
> I’ve confirmed the authorization, requester-isolation, attachment security, and regression checks are all covered as expected.
>
> Appreciate the detailed testing and approval. This PR is ready to merge into `lab3-staging`.

---

### feat(lab-03): implement IT staff ticket queue

- **PR Link:** [#41](https://github.com/R1NNE0/toktickit/pull/41)
- **Branch:** `feat/lab3-staff-queue`

**Reviewer comment I received:**

> ### Peer Review Checklist & Verification
>
> I have reviewed and verified **Issue 4: IT Staff Ticket Queue** on branch `feat/lab3-staff-queue` against commit `95981db`.
>
> ---
>
> #### 1. Automated Verification Results
>
> - [x] **Backend Full & Targeted Suites (`server`):**
>   - Full suite: `npm test` → **20 files / 170 passed** (100% green)
>   - Targeted Queue suite: `staff-queue.api`, `query.unit`, `migration-regression` → **3 files / 71 passed** (100% green)
>   - TypeScript build: `npm run build` (`tsc`) → **PASS** (0 errors)
>   - Prisma validation: `npx prisma validate && npx prisma generate` → **PASS**
> - [x] **Frontend Full & Targeted Suites (`client`):**
>   - Full suite: `npm test` → **11 files / 53 passed** (100% green)
>   - Targeted `StaffTicketQueue.test.tsx` suite → **14 passed** (100% green)
>   - Production bundle: `npm run build` (`tsc && vite build`) → **PASS** (359ms)
> - [x] **Repository Cleanliness:**
>   - `git diff --check` → **PASS** (no trailing whitespace or conflict markers)
>
> ---
>
> #### 2. Code Inspection & Requirements Traceability
>
> - [x] **Staff-Only Queue Authorization (FR-08 / AC-09):**
>   - `/api/staff/tickets` strictly permits `IT_STAFF` users. Requesters and Administrators receive safe `403 FORBIDDEN`.
>   - Non-authenticated, expired, or unverified sessions are rejected before query execution.
> - [x] **Filtering, Search & Deterministic Pagination (FR-08 / BR-24 / AC-09):**
>   - Case-insensitive search spans ticket number, summary, and description.
>   - Multi-attribute filters for status, category, requested priority, IT priority, and owner (assigned vs unassigned) behave correctly.
>   - Secondary tie-breaker ordering on `id` guarantees deterministic pagination without row shifting.
>   - Page sizes 10, 20, 50 are supported; invalid parameters and size 8 are rejected with `400 INVALID_QUERY`.
> - [x] **Queue Projection & Additive Migration (FR-17 / BR-29):**
>   - Migration `20260917000100_staff_queue` safely adds nullable `ownerId` with `ON DELETE SET NULL` and adds missing statuses without data loss.
>   - DTO projection exposes only necessary ticket, requester, and owner metadata; internal data remains protected.
> - [x] **Responsive UI & Status Badge Fix:**
>   - `StaffTicketQueue` renders an accessible data table on desktop and responsive cards on mobile.
>   - Layout fix in `index.css` (`table-layout: fixed` and scoped `.queue-table .badge-status`) effectively resolves badge clipping/overflow on long status labels near desktop breakpoints.
>   - "Open Detail" read-only overview preserves active filters and pagination upon returning to the queue.
>
> ---
>
> #### Verdict
>
> **Approved!** The Staff Queue API, additive schema migration, deterministic sorting, and responsive UI components meet all requirements and pass all checks. Ready to merge into `lab3-staging`.

**How I responded:**

> Thanks for the detailed review and verification.
>
> I appreciate you checking the full and targeted test suites, authorization, migration safety, pagination, and the responsive UI fix.
>
> This PR is ready to merge into `lab3-staging`.

---

### feat(lab-03): implement IT staff ticket workflow and discussions

- **PR Link:** [#42](https://github.com/R1NNE0/toktickit/pull/42)
- **Branch:** `feat/lab3-staff-ticket-workflow`

**Reviewer comment I received:**

> ### Peer Review: APPROVED ✅
>
> Thank you for quickly addressing the review feedback and aligning the `CANCELLED` workflow in `f993040`!
>
> #### Re-verification Results
> - **Automated Client Tests:** 13 files / 67 passed (including the new regression test asserting terminal state behavior on cancelled tickets).
> - **Automated Server Tests:** 17 files / 160 passed with zero failures.
> - **Production Builds:** Both backend (`tsc`) and frontend (`vite build`) compiled cleanly with 0 errors.
> - **Workflow & UI Conformance:** The status transition matrix strictly conforms to §6.2 (exactly 15 allowed transitions, `CANCELLED` treated as terminal).
> - **Authorization & Data Shielding:** Requester isolation on internal notes, read-only comments/notes for Administrator, and IT Priority calibration boundaries are fully verified.
>
> Everything looks solid and ready to merge into `lab3-staging`. Great work!

**How I responded:**

> Thanks for the thorough re-review and verification.
>
> I appreciate you confirming the workflow correction, full test suites, authorization boundaries, and UI/spec conformance.
>
> This PR is ready to merge into `lab3-staging`.

---

### feat(lab-03): implement administrator user management

- **PR Link:** [#43](https://github.com/R1NNE0/toktickit/pull/43)
- **Branch:** `feat/lab3-user-management`

**Reviewer comment I received:**

> ### 📝 Peer Review Checklist & Verification: Issue #34 Administrator User Management
>
> I have reviewed and independently executed verification checks on branch `feat/lab3-user-management` at commit `0246ddac18841c9e1fbbc011ae0b84531f25f233`.
>
> ---
>
> #### 🧪 Independent Test & Build Verification Results
>
> - [x] **Administrator API Focused Suite (`server/tests/lab-03/users-admin.api.test.ts`):**
>   - **27 / 27 tests PASSED** (Deterministic sorting, search/filter, concurrent duplicate email race conditions, self-deactivation guard, last-admin demotion/deactivation concurrency, ticket unassignment, and session revocation).
> - [x] **Full Server Test Suite (`npm run test:lab3`):**
>   - **18 / 18 test files PASSED, 187 / 187 tests PASSED** (0 failures).
>   *(Verified with `AUTH_ALLOW_HTTP_LOCALHOST=true` for local HTTP cookie testing).*
> - [x] **Server Build (`npm run build`):**
>   - Exited `0` with zero TypeScript errors.
> - [x] **User Management UI Suite (`client/tests/lab-03/UserManagement.test.tsx`):**
>   - **7 / 7 tests PASSED** (Directory rendering, search/role filtering, create user with password reveal toggle, duplicate email inline mapping, self-deactivation disabled state, unassignment warning alert, and initial password reset flow).
> - [x] **Full Client Test Suite (`npm test`):**
>   - **14 / 14 test files PASSED, 74 / 74 tests PASSED** (0 failures).
> - [x] **Client Build (`npm run build`):**
>   - Production bundle generated cleanly in `581ms`.
> - [x] **Repository Hygiene:**
>   - `git diff --check 0f4bc86..HEAD` passed with zero whitespace or formatting issues.
>
> ---
>
> #### 📋 Requirements & Architectural Compliance
>
> 1. **FR-15 / AC-16 (User Directory & Search):**
>    - `GET /api/admin/users` deterministic ordering (`name ASC, id ASC`) verified.
>    - Query whitelisting strictly enforces allowed parameters (`search`, `role`), returning `400 INVALID_QUERY` for unexpected parameters.
>    - Role filter dropdown and case-insensitive name/email search operate reliably.
>
> 2. **FR-15 / AC-17 (Account Creation & Password Policy):**
>    - Strictly validates body keys with `bodyFields()`; unexpected keys reject with `400 VALIDATION_ERROR`.
>    - Hashes passwords using Argon2id with shared Lab 3 policy (15–128 chars, Unicode boundaries); flags `mustChangePassword = true`.
>    - Never exposes plaintext passwords or password hashes in API projections.
>
> 3. **FR-16 / AC-18 & BR-25 (Administrator Safety Guardrails & Concurrency):**
>    - Uses PostgreSQL transactional advisory lock (`SELECT pg_advisory_xact_lock(hashtext('admin_user_protection'))`) in `updateAdminUser` to prevent race conditions during concurrent Administrator demotions or deactivations.
>    - Prevents self-deactivation with `409 SELF_DEACTIVATION` on the backend and disables the checkbox with clear helper text on the frontend.
>    - Rejects deactivation/demotion of the last active Administrator with `409 LAST_ADMIN`.
>    - Adheres strictly to the specification: no user deletion endpoint is implemented.
>
> 4. **BR-27 / ED-09 (Ticket Ownership Continuity):**
>    - Atomically unassigns tickets (`ownerId: null`) when an active IT Staff or Administrator is deactivated or demoted to `REQUESTER`.
>    - Preserves all ticket histories, requester associations, public comments, internal notes, and attachments.
>    - The UI displays an alert warning about automatic ticket unassignment when deactivating or demoting an owner.
>
> 5. **BR-10, BR-26 / AC-19 (Session Revocation & Initial Password Reset):**
>    - Role, email, and activation changes immediately revoke all active sessions for the target user (`revokeUserSessions`).
>    - Initial-password reset forces `mustChangePassword = true`, clears `passwordChangedAt`, revokes all target sessions, and preserves account activation status.
>    - Frontend triggers `reloadAuth?.()` if the current administrator mutates their own session credentials.
>
> 6. **Regression Protection:**
>    - Scoped navigation assertion in `StaffTicketQueue.test.tsx` to `{ name: "IT Staff" }`, accommodating the new Administrator navigation pill without weakening Staff-only queue restrictions.
>
> ---
>
> #### 💡 Observations & Notes
> - **Testing environment reminder:** Running the backend suite locally requires `AUTH_ALLOW_HTTP_LOCALHOST=true` when executing on localhost HTTP cookies, as documented in `.env.example`.
>
> ---
>
> #### ✅ Verdict
> **APPROVED.** Exceptional code quality, complete test coverage, and strict compliance with the Lab 3 specification and safety requirements. Ready to merge into `lab3-staging`.

**How I responded:**

> Thanks for the detailed review and verification.
>
> I appreciate you independently checking the tests, builds, concurrency safeguards, session revocation, and Administrator protection rules.
>
> Glad everything is aligned with the Lab 3 specification. This PR is ready to merge into `lab3-staging`.

---

### test(lab3): complete integrated verification and e2e coverage

- **PR Link:** [#44](https://github.com/R1NNE0/toktickit/pull/44)
- **Branch:** `feat/lab3-integration-e2e`

**Reviewer comment I received:**

>   **Verdict:** **APPROVED** ✅
>
> ---
>
> ### 1. Verification Checklist & Independent Execution Results
>
> All automated verification commands and test suites were independently executed in the local environment against the isolated Lab 3 test database:
>
> - [x] **Backend Integration Suite (`server/tests/lab-03/integration.api.test.ts`):**
>   **10 / 10 tests PASSED**
>   *(Verifies all 22 implemented business route method/path combinations across all 3 roles, anonymous header rejection, restricted/inactive/expired/revoked session cookies, mutation CSRF enforcement, Internal Note isolation, Administrator reads/priority without staff inheritance, and instant session revocation upon role change).*
> - [x] **Full Lab 3 Server Test Suite (`npm run test:lab3`):**
>   **19 / 19 test files PASSED, 197 / 197 tests PASSED** (0 failures).
> - [x] **Server Production Build (`npm run build`):**
>   Exited `0` with zero TypeScript errors.
> - [x] **Client Integrated Feedback & Zen Green Suites:**
>   - `IntegratedFeedback.test.tsx`: **6 / 6 tests PASSED** (discussion loading/failure/retry states, note exclusion, access-denied stability, and race-condition suppression for stale directory responses).
>   - `ZenGreen.test.tsx`: **3 / 3 tests PASSED** (approved palette tokens, login validation focus, and password confirmation error binding).
>   - Full client suite (`npm test`): **16 / 16 test files PASSED, 83 / 83 tests PASSED** (0 failures).
> - [x] **Client Production Build (`npm run build`):**
>   Compiled cleanly with Vite in **370ms** with zero errors.
> - [x] **Playwright E2E Suite (`e2e/lab-03/*`):**
>   **11 / 11 tests PASSED** across 5 test specs (executed on Chromium with 1 worker and 0 retries in 22.9s):
>   - `authentication.spec.ts`: Initial restricted session, password change rotation, logout revocation, and uniform invalid credential messages.
>   - `requester-regression.spec.ts`: Ticket creation, attachment byte verification, soft-removal, and cross-requester privacy.
>   - `staff-ticket-flow.spec.ts`: Queue filtering/sorting, claim, assignment, discussions, and resolution flow.
>   - `user-administration.spec.ts`: Admin directory, creation, edit, reset, deactivation, and last-admin protections.
>   - `responsive.spec.ts`: Multi-viewport verification (1280×800, 768×1024, 375×812) ensuring no horizontal page overflow and proper mobile layout wrapping.
> - [x] **Repository Hygiene (`git diff --check 08710a0..HEAD`):**
>   Clean; no merge artifacts, trailing whitespace, or formatting issues.
>
> ---
>
> ### 2. Technical Evaluation & Key Quality Improvements
>
> #### A. Comprehensive Cross-Role Authorization Matrix
> - `server/tests/lab-03/integration.api.test.ts` systematically tests real HTTP cookie sessions across all 22 business endpoints.
> - Verifies that:
>   - Unauthorized roles strictly receive `403 FORBIDDEN` with safe error payloads (no database queries or stack traces leaked).
>   - Legacy header authentication (`x-requester-id`) is rejected across all routes (`401 UNAUTHENTICATED`).
>   - Restricted (`mustChangePassword`), inactive, expired, and revoked sessions are denied access across every endpoint.
>   - Internal Notes and note metadata remain strictly inaccessible to Requesters (returning `404` or `403`).
>
> #### B. Accessibility & Focus Management (`client/src/useDialogFocus.ts`)
> - Added a reusable focus trap hook for inline modal dialogs (`useDialogFocus.ts`).
> - Ensures:
>   - Immediate focus movement to the first interactive control upon dialog opening.
>   - Tab and Shift+Tab keyboard focus cycling strictly contained within the dialog.
>   - Escape key handling to dismiss modals safely.
>   - Automatic focus restoration to the previously active triggering element upon modal closure.
>
> #### C. Responsive Behavior & Content Wrapping (RESP-01 / RESP-02)
> - Added long-string and email wrapping styles in `index.css` (`break-words`, `overflow-hidden text-overflow-ellipsis`) to prevent horizontal layout blowout on mobile screens.
> - Breakpoint boundary testing (`responsive.spec.ts`) confirms that at desktop (1280px), tablet (768px), and mobile (375px), all ticket queues, card views, and modal dialogs conform to the viewport with `scrollWidth <= innerWidth + 1`.
>
> #### D. Safe E2E Architecture & Test Isolation
> - Playwright runner is configured with dedicated test servers (`server/tests/lab-03/e2e-server.ts` on port 3101, client on port 5174).
> - Uses isolated database connection (`55433 / toktickit_lab3_test`) and dedicated test uploads root (`uploads/lab-03-test`).
> - Fixtures dynamically provision random credentials with Argon2id and perform deterministic teardown (unlinking created files and deleting database records).
> - Traces, videos, and screenshots are disabled to avoid persisting user credentials or session data.
>
> #### E. Backward Compatibility & Regression Preservation
> - Preserves all Lab 1 and Lab 2 functionality, database entities, attachment bytes, and ticket relationships.
> - Fixed historical priority query snapshot ordering in `server/tests/lab-02/tickets.create.test.ts` to ensure deterministic assertions without weakening regression checks.
> - Scope discipline maintained: no unauthorized features or out-of-scope modifications were introduced.
>
> ---
>
> ### 3. Conclusion
>
> This PR solidifies the verification layer for Lab 3 with outstanding rigor, covering cross-role integration, responsive viewports, accessibility, and real end-to-end browser journeys. All criteria for **Issue #35 (Phase 7)** are fully met.
>
> **Ready to merge into `lab3-staging`.**

**How I responded:**

> Thanks for the thorough review and independent verification.
>
> I appreciate you checking the integration suite, full server/client tests, E2E coverage, accessibility, responsive behavior, authorization boundaries, and repository hygiene.
>
> Glad everything is aligned with Issue #35 requirements.
>
> Ready to merge into `lab3-staging`.

---

### docs(lab-03): finalize evidence and release documentation

- **PR Link:** [#45](https://github.com/R1NNE0/toktickit/pull/45)
- **Branch:** `feat/lab3-final-release-evidence`

**Reviewer comment I received:**

> ### Review: Approved

I have completed an independent audit of this PR on branch `feat/lab3-final-release-evidence`.

#### 1. Independent Verification Results
- **Server Tests:** 252 passed across 25 test files (0 skipped, 0 failed).
- **Client Tests:** 87 passed across 16 test files (0 skipped, 0 failed).
- **E2E Tests:** 11 scenarios passed across 5 spec files in Chromium (0 skipped, 0 failed).
- **Builds:** Both `server` (`tsc`) and `client` (`tsc && vite build`) compile cleanly.
- **Repository Hygiene:** `git diff --check` passes with zero whitespace or conflict issues.
- **Visual Evidence:** All 64 screenshot files exist under `artifacts/lab-03/screenshots/`, and all SHA-256 hashes match `manifest.json` exactly.

#### 2. Code Quality & Bug Fix
- The fix for the Staff Ticket Owner metadata in `server/src/attachments.ts` and `server/src/staffTicket.ts` is clean, targeted, and introduces no regression or sensitive field leakage.
- The accompanying API, component, and E2E regression assertions verify the `OwnerRef` display for IT Staff, Administrator, and Unassigned states across contexts.
- The refreshed visual evidence correctly reflects the active IT Staff owner label.

#### 3. Documentation & Release Readiness
- Documentation in `README.md`, `specification.md`, `api-spec.md`, `ui-spec.md`, and `tests.md` is thorough, consistent, and provides clear traceability against all Lab 3 acceptance criteria.
- Genuine partial/manual inspection items (e.g. tablet column scrolling, accessibility review) are documented transparently.
- `ai-use.md` and `reviewer.md` are well-structured and complete.

Ready to merge into `lab3-staging` for release preparation.


**How I responded:**

> Thank you for the detailed review and verification.

I appreciate you checking the automated tests, builds, visual evidence, documentation, and the Staff Ticket Owner metadata fix.

Since no blocking issues were found, this PR is ready to be merged into `lab3-staging` for release preparation.

---

## Pull Requests I reviewed for my partner

### docs(lab-03): define engineering contract and test plan

- **PR Link:** [#36](https://github.com/Kawi-HBLI/TokTickIT/pull/36)
- **Status:** Closed and Approved

**My comment:**

> ## Request Changes
>
> The contract is comprehensive and the AC-01–AC-30 traceability is well covered, but a few documentation inconsistencies should be resolved before implementation:
>
> - Please make the **“Problem Appears Resolved”** lifecycle consistent between the specification and API, especially whether the indication is cleared when a ticket becomes **Resolved, Closed, or Cancelled**.
> - Please clarify the **identifier representation** so the Lab 3 API contract remains compatible with the existing Lab 2 numeric IDs.
> - Please separate **product-completion criteria** from **course-delivery evidence** in the Product Definition of Done, as required by Issue #28.
>
> ## Minor Follow-ups
>
> - Fix the `UNIT-DISC-01` references.
> - Standardize the `ai-use.md` filename.
>
> Overall, the planning is strong. These changes are mainly to make the contract more consistent and implementation-ready.

**Partner's response:**

> Addressed the documentation review items:
>
> - Clarified that the active “Problem Appears Resolved” indication is cleared atomically when a ticket enters `RESOLVED`, `CLOSED`, `CANCELLED`, or `REOPENED`, consistently across the specification, API contract, and test plan.
> - Documented positive integer resource IDs for Lab 2 compatibility while keeping IDs opaque to clients; `ticketNumber` and security tokens remain strings.
> - Separated Product completion criteria from Course delivery evidence in the Product Definition of Done.
> - Corrected the traceability references to `UNIT-DISCUSSION-01`.
> - Standardized the Lab 3 filename to `docs/lab-03/ai-use.md`.
>
> The branch is ready for re-review.

**My comment:**

> Reviewed the requested changes.
>
> The previously raised documentation inconsistencies have been addressed:
> - the “Problem Appears Resolved” lifecycle is now consistent;
> - resource ID compatibility with Lab 2 is clarified;
> - Product completion is separated from Course delivery evidence;
> - the traceability reference has been corrected;
> - the Lab 3 AI-use filename is standardized.
>
> No remaining blocking issues from my previous review.
>
> Approved.

**Partner's response:**

> thank you so much you can merge now.

---

### feat(lab-03): add authentication foundation

- **PR Link:** [#37](https://github.com/Kawi-HBLI/TokTickIT/pull/37)
- **Status:** Closed and Approved

**My comment:**

> ## Request Changes
>
> The migration preserves the existing Lab 2 data well, and the authentication foundation looks solid. However, a few Issue #29 requirements and compatibility regressions still need to be addressed before approval:
>
> - Complete the missing Issue #29 persistence: Public Comments, Internal Notes, required workflow/status fields, and IT Priority backfill while preserving existing non-null values.
> - Add the required representative seed data for Tickets, Comments, and Notes, with safe/idempotent rerun behavior.
> - Keep the retained Requester flow compatible until the next authorization issue:
>   - allow the current `x-requester-id` header in CORS;
>   - restrict the legacy Requester list/lookup to active `REQUESTER` users so Staff/Admin accounts cannot appear or be selected.
> - Add a real populated Lab 2 → Lab 3 migration regression test that verifies preservation of existing users, ownership, Tickets, Attachments, and related data.
>
> The authentication endpoints are out of Issue #29 scope, but I would treat that as non-blocking scope creep by itself.
>
> Once these are corrected, the PR should be ready for re-review.

**Partner's response:**

> Addressed the requested changes in commit `9d57d1a`:
>
> - Added workflow/status persistence, IT Priority backfill, Public Comments, and Internal Notes.
> - Added representative Ticket, Comment, and Note seed fixtures with idempotent reruns.
> - Added `X-Requester-Id` to CORS and restricted the legacy Requester flow to active `REQUESTER` users.
> - Added a populated Lab 2 → Lab 3 migration regression test covering IDs, ownership, Ticket data, Attachments, receipts, files, sequence state, and seed stability.
> - Kept the original migration checksum unchanged by adding a follow-up migration.
>
> Build, Prisma validation, schema tests, seed tests, and authentication tests pass locally. The database integration test is ready to run when PostgreSQL is available.

**My comment:**

> Re-reviewed commit `9d57d1a`.
>
> The previously blocking issues have been addressed, including the missing workflow persistence, representative seed data, legacy Requester compatibility, and populated Lab 2 → Lab 3 migration regression coverage.
>
> The changes are consistent with Issue #29 and I did not find any remaining blockers from my previous review.
>
> Approved.

**Partner's response:**

> thank for review

---

### feat(lab-03): migrate requester flow to authenticated sessions

- **PR Link:** [#38](https://github.com/Kawi-HBLI/TokTickIT/pull/38)
- **Status:** Closed and Approved

**My comment:**

> Thanks for the implementation. I reviewed PR #38 against Issue #30 and the Lab 3 requirements.
>
> The requester session migration itself looks solid: requester identity is derived from the authenticated session, `x-requester-id` is removed, requester role checks are enforced server-side, CSRF is applied to unsafe operations, and Ticket/Attachment access remains scoped to the authenticated requester.
>
> However, I’m requesting changes because this PR currently says `Closes #30`, while several explicit Issue #30 deliverables are still missing:
>
> - Login UI
> - Mandatory first-login Change Password UI/flow
> - Client Logout action
> - Corresponding authentication component/guard/E2E tests
>
> The backend login/current-user/change-password/logout APIs are present, but the frontend cannot currently complete the full authentication lifecycle required by Issue #30.
>
> Please either:
> 1. complete the remaining Issue #30 frontend/authentication requirements in this PR, or
> 2. remove `Closes #30` and keep Issue #30 open for the remaining authentication UI work.
>
> Requesting changes for the Issue #30 scope mismatch.

**Partner's response:**

> Addressed the requested changes in commit `c9e2d3f`.
>
> The remaining Issue #30 frontend authentication work is now included:
> - Login UI
> - Mandatory first-login Change Password flow
> - Client Logout
> - Authentication guards and related component/E2E tests
>
> I also updated the PR description. `Closes #30` now matches the completed scope.
>
> Verification:
> - Client tests: 63 passed
> - Client build: passed
> - Server build: passed
>
> Please re-review when convenient.

**My comment:**

> Re-reviewed commit `c9e2d3f`.
>
> The previously requested changes have been addressed:
> - Login UI is now implemented.
> - Mandatory first-login Change Password flow is in place.
> - Client Logout and authentication guards are included.
> - Related component/E2E coverage has been added.
> - `Closes #30` now matches the completed Issue scope.
>
> No blocking issues remain.
>
> Approved.

**Partner's response:**

> thank for review

---

### feat(staff-queue): implement IT staff ticket queue API and UI

- **PR Link:** [#40](https://github.com/Kawi-HBLI/TokTickIT/pull/40)
- **Status:** Closed and Approved

**My comment:**

> Thanks for the implementation. The core Staff Queue API, filtering, sorting, pagination, authorization, and responsive queue UI look solid and remain within Issue #32 scope.
>
> I found two blocking items before approval:
>
> 1. Issue #32 explicitly requires API, component, style, responsive, accessibility, and E2E test coverage. The current PR includes API and component tests, but the required style/responsive/accessibility/E2E coverage is still missing.
>
> 2. The Staff Queue does not currently provide a distinct forbidden state. A 403 response falls into the generic error state with a Retry action, which will simply repeat the forbidden request. AC-13 requires a distinct forbidden/access-denied state with an appropriate recovery action.
>
> Non-blocking:
> - The PR description mentions search over “title/description” and an `ownerId` filter, while the implementation correctly uses `summary` and `owner`.
> - There is also a small response-envelope documentation mismatch (`meta` vs `pagination`) worth reconciling later.
>
> I was not able to independently execute the test/build commands in the review snapshot because dependencies were not installed and the extracted workspace did not include `.git`, so those verification results remain based on the submitted PR claims rather than my local execution.
>
> Verdict: REQUEST CHANGES

**Partner's response:**

> I've addressed all blocking and non-blocking items in commit `e3d6f5d`:
>
> 1. **Test Coverage across all required dimensions (Issue #32 scope)**:
>    - **Style & Responsive (`UI-STYLE-01`)**: Added `client/tests/lab-03/ZenGreenLab3Styles.test.tsx` verifying Zen Green design tokens, badge classes for status/priority, and responsive desktop table vs. mobile card hooks.
>    - **Accessibility (`UI-A11Y-01`)**: Added `client/tests/lab-03/Accessibility.test.tsx` asserting input labels, polite live region announcements (`aria-live="polite"`), semantic table headers (`scope="col"`), and accessible action button names.
>    - **E2E (`E2E-STAFF-01`)**: Added `e2e/lab-03/staff-queue.spec.ts` covering the complete IT Staff login, queue inspection, filtering, responsive viewport adaptation (< 992px), and ticket detail navigation.
>
> 2. **Distinct Forbidden State (AC-13)**:
>    - Updated `StaffTicketQueue.tsx` and `app.css` to render a dedicated `Access denied` screen (`.forbidden-box`) upon receiving a `403` / `FORBIDDEN` status.
>    - Included clear access-restricted messaging and a `Go to My Tickets` recovery action directing unauthorized users back to `/tickets` (no infinite-failing retry button).
>    - Added unit test coverage in `StaffTicketQueue.test.tsx`.
>
> 3. **Description & Documentation Reconciliations**:
>    - Reconciled PR description: search covers `ticketNumber`, `summary`, and `description`, with an `owner` filter (`unassigned`, `me`, or staff user ID).
>    - Reconciled response pagination envelope.
>
> Ready for re-review!

**My comment:**

> Thanks for the updates. The requested changes have been addressed, including the missing test coverage and the dedicated forbidden state.
>
> APPROVED. Ready to merge.

**Partner's response:**

> thank for review bro!

---

### feat(requester-auth): enforce role authorization and migrate requester workflow

- **PR Link:** [#41](https://github.com/Kawi-HBLI/TokTickIT/pull/41)
- **Status:** Closed and Approved

**My comment:**

> Thanks for the clarification.
>
> The previous scope concern is resolved, and the Issue #31 Requester authorization/workflow implementation meets the required acceptance criteria.
>
> Only non-blocking observations remain.
>
> APPROVED. Ready to merge.

**Partner's response:**

> thank

---

### feat(staff-ops): implement IT staff ticket operations

- **PR Link:** [#42](https://github.com/Kawi-HBLI/TokTickIT/pull/42)
- **Status:** Closed and Approved

**My comment:**

> Thanks for the implementation. The core Staff Ticket Detail workflow, authorization, claim logic, priority updates, status transition matrix, Public Comments, Internal Notes, and requester resolution handling look solid.
>
> I found two blocking issues before approval:
>
> 1. Owner unassignment is broken in the frontend.
>    Selecting “Unassigned” sets `pendingOwnerChange` to `null`, which is also used as the “dialog closed” state. As a result, the confirmation modal never opens and the unassign API call is never triggered.
>
> 2. Staff attachment Preview/Download uses raw relative `/api/...` URLs.
>    Since the client and API run on different ports and there is no Vite proxy, these links hit the frontend dev server instead of the backend. Please route these actions through the existing centralized attachment API helpers.
>
> Also recommended:
> - add a component test specifically covering owner unassignment so this regression is caught.
>
> Verdict: REQUEST CHANGES

**Partner's response:**

> Thanks for the detailed review and catching these points.
>
> I have addressed both blocking items and the recommended test:
> 1. **Owner Unassignment Dialog:** Refactored `pendingOwnerChange` state into an object `{ targetOwnerId: number | null } | null` so that selecting Unassigned opens the confirmation dialog (`Unassign Ticket Owner?`) and triggers the unassignment API call upon confirmation.
> 2. **Attachment Actions:** Replaced relative `/api/` links with button handlers invoking `previewAttachmentFile` and `downloadAttachmentFile` from `api.ts`, properly routing requests to the backend server with session credentials and blob handling.
> 3. **Test Coverage:** Added component tests for owner unassignment and centralized attachment preview/download in `StaffTicketDetail.test.tsx`, and updated the E2E suite in `staff-ticket-flow.spec.ts` to cover the full unassign workflow.
>
> Commit: `db4e916`

**My comment:**

> Thanks for the fixes. The owner unassignment issue and attachment handling have been addressed, and the additional tests cover the regressions we discussed.
>
> APPROVED. Ready to merge.

**Partner's response:**

> Thank please merge this.

---

### feat(admin): implement administrator user management

- **PR Link:** [#43](https://github.com/Kawi-HBLI/TokTickIT/pull/43)
- **Status:** Closed and Approved

**My comment:**

> Thanks for the implementation. The Administrator-only routing, responsive UI, accessibility work, and basic user-management flow are in place, but I found several blocking contract mismatches that need to be addressed before approval.
>
> Main blocking items:
>
> 1. User creation and password reset currently use a hardcoded `ChangeMe-2026!`. The contract requires the Administrator to provide the initial password, which must be validated and hashed.
>
> 2. The password reset endpoint does not match the documented contract. It should use `/api/admin/users/:id/initial-password`, accept `initialPassword`, revoke sessions, set `mustChangePassword`, clear `passwordChangedAt`, and return the updated safe user representation.
>
> 3. Deactivating an IT Staff/Administrator or changing them to `REQUESTER` does not unassign their owned tickets. This breaks the active-owner invariant and should be handled atomically, with `unassignedTicketCount` returned.
>
> 4. Role changes do not revoke the target user’s active sessions.
>
> 5. Administrator safety errors use the wrong status/error codes for self-deactivation and last-active-admin protection.
>
> 6. `department` management is out of scope for Lab 3 and should be removed from the API, UI, and safe user representation.
>
> 7. Self-demotion is blocked unconditionally, but the contract only prevents demotion when the user is the last active Administrator.
>
> There are also smaller validation/API-contract mismatches such as unknown query fields being ignored, missing optimistic locking on user edits, missing `Location` header on create, and test naming/coverage differences.
>
> Verdict: REQUEST CHANGES

**Partner's response:**

> Thanks for the thorough review. I have resolved all blocking items and aligned the implementation with the Lab 3 engineering contract:
>
> 1. **Administrator-provided Initial Password:** Replaced hardcoded default with administrator-supplied `initialPassword` (12–72 chars, scrypt hashed) on both user creation and password reset.
> 2. **Password Reset Endpoint & Contract:** Renamed to `POST /api/admin/users/:id/initial-password` accepting `{ initialPassword }`, which revokes existing sessions, sets `mustChangePassword: true`, clears `passwordChangedAt: null`, and returns the safe user object.
> 3. **Owned Ticket Unassignment:** Deactivating an IT Staff/Administrator or changing their role to `REQUESTER` now atomically unassigns all owned tickets (`ownerId: null`) and returns `unassignedTicketCount`.
> 4. **Session Revocation on Role Changes:** Updating a user's role immediately revokes all active sessions for that user.
> 5. **Safety Invariants & Status Codes:** Self-deactivation returns `409 SELF_DEACTIVATION_FORBIDDEN`. Deactivation or demotion of the last active Administrator returns `409 LAST_ACTIVE_ADMIN_REQUIRED` protected by a database advisory lock to prevent race conditions. Self-demotion is allowed as long as another active Administrator exists. Added optimistic concurrency control via `expectedUpdatedAt` (`409 USER_VERSION_CONFLICT`).
> 6. **Out-of-Scope Cleanup:** Removed `department` completely from safe user representations, schemas, API endpoints, and UI.
> 7. **Strict Validation & Whitelisting:** Enforced strict parameter whitelisting returning `400 INVALID_QUERY` / `400 VALIDATION_ERROR` and added `Location: /api/admin/users/:id` on creation (`201`).
> 8. **Test Coverage:** Added and aligned tests per `docs/lab-03/tests.md`:
>    - `server/tests/lab-03/user-validation.test.ts` (UNIT-USER-01)
>    - `server/tests/lab-03/users-admin.api.test.ts` (API-USER-01, API-USER-02, API-USER-03)
>    - `client/tests/lab-03/UserManagement.test.tsx` (UI-USER-01)
>    - `e2e/lab-03/user-administration.spec.ts` (E2E-ADMIN-01)
>
> All tests, client/server builds, and full Lab 3 Playwright E2E suites pass with zero errors.

**My comment:**

> Thanks for the fixes. All previously blocking items have been addressed and the implementation is now aligned with the Lab 3 contract.
>
> APPROVED. Ready to merge.

**Partner's response:**

> thx bro

---

### test(lab-03): complete technical final verification and regression migration

- **PR Link:** [#44](https://github.com/Kawi-HBLI/TokTickIT/pull/44)
- **Status:** Closed and Approved

**My comment:**

> The technical verification itself looks good, and I understand that reviewer.md, ai-use.md, final review records, and release documentation will be completed in the planned final documentation pass.
>
> One blocking item remains for this technical verification PR:
>
> - `docs/lab-03/tests.md` still marks the required tests as `Planned` and does not record the final integrated verification results, despite this PR reporting successful server, client, E2E, and build runs.
>
> Since the Issue explicitly requires documented test commands and traceable passing evidence, please update `tests.md` with the actual final results and mark the applicable tests as `Passed`.
>
> The remaining documentation/evidence items can be completed in the planned final documentation pass.
>
> Verdict: REQUEST CHANGES

**Partner's response:**

> Updated the final verification evidence in `docs/lab-03/tests.md` and marked applicable covered checks as Passed.
>
> The Lab 3 migration integration tests now execute instead of being skipped. Fresh verification results are:
>
> - Server: 31 test files, 251 passed, 0 skipped
> - Client: 19 test files, 101 passed
> - Server and client builds: passed
> - Lab 3 E2E: 14/14 passed
>
> `REG-L2-01` remains explicitly Partial because the Lab 2 E2E suite was not rerun in this technical-verification PR, and manual delivery evidence remains reserved for the final documentation pass.

**My comment:**

> Thanks for the update.
>
> The final verification evidence in `docs/lab-03/tests.md` is now recorded correctly, the previously skipped Lab 3 migration integration tests are executing, and the fresh server/client/build/E2E results all pass.
>
> Keeping `REG-L2-01` explicitly Partial and reserving manual delivery evidence for the final documentation pass is clear and appropriately documented.
>
> APPROVED. Ready to merge.

**Partner's response:**

> Thank you for re-reviewed. Please Merge

---

### docs(lab-03): add final evidence and release documentation

- **PR Link:** [#46](https://github.com/Kawi-HBLI/TokTickIT/pull/46)
- **Status:** Closed and Approved

**My comment:**

> ### Review: Approved
>
> I reviewed the integrated Lab 3 release candidate and the staging verification results.
>
> The implementation, documentation, retained Requester regression, and release evidence are consistent with the intended Lab 3 scope. The reported server, client, build, and E2E verification completed successfully with no blocking failures.
>
> No blocking issues were found.
>
> Approved and ready to merge into `main`.

**Partner's response:**

> Thank you
