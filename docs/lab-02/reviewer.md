# Lab 2 — Peer Review Record

**Author:** Songwit Rueangsawat — 67070501060 — GitHub: @R1NNE0  
**Peer reviewer:** Thanawat Suntarawattana — 67070501022 — GitHub: @Maibokdaimhai  
**Partner I review:** Tanadet Nuchaikaew — 67070501081 — GitHub: @Kawi-HBLI  

---

## Pull Requests I authored (reviewed by my partner)

| PR | Branch | Reviewer verdict |
|:---:|---|:---:|
| #19 | `feat/lab2-spec-and-test-plan` | Approved |
| #20 | `feat/lab2-database-and-seed` | Approved |
| #21 | `feat/lab2-requester-context` | Approved |
| #22 | `feat/lab2-create-ticket` | Approved |
| #23 | `feat/lab2-my-tickets` | Approved |
| #6 | `feat/lab2-ticket-detail-and-attachment` | Pending |
| #7 | `feat/lab2-e2e-and-release` | Pending |

### docs: setup sprint 2 specifications, test plan, and review templates (Issue #1)
- **PR Link:** [#19](https://github.com/R1NNE0/toktickit/pull/19)

**Reviewer comment I received:**
> ### Peer Review Checklist & Verification
> I have reviewed the engineering specification and test plan deliverables for this issue in Lab 2.
> 
> #### Verification Results
> - [x] **`specification.md` Sections:** Covers all 11 required sections from Appendix A (Goal, Stakeholder Interpretation, Scope, FRs, BRs, UI Summary, Database Design, API Summary, ACs, DoD, Assumptions).
> - [x] **Acceptance Criteria Format:** AC-01 through AC-10 strictly follow the Given-When-Then format.
> - [x] **`api-spec.md` Completeness:** Specifies full REST contracts for active requesters, categories, related systems, ticket management, file upload, streaming download, and soft removal.
> - [x] **`ui-spec.md` Design Tokens & Breakpoints:** Enforces Zen Green tokens (`#006B3C`, `#0B7A46`, `#EAF6EF`, `#F3F4F6`), button/form states, desktop/tablet/mobile layout rules, and screenshot artifact paths.
> - [x] **`tests.md` Traceability:** Maps 21 planned test scenarios (API-01..14, UI-01..06, E2E-01) directly to target test files and satisfies full AC-01..10 traceability.
> - [x] **Documentation Templates:** `reviewer.md` and `ai-use.md` follow standard structure.
> 
> #### Verdict
> **Approved!** Excellent detail and clear traceability between requirements, API endpoints, UI tokens, and test files. Ready for implementation in Sprint Next Issue.
> 
> *Note:* I forgot to tell you about issue that you linked. I think you linked in wrong with the another one on pull request description. It links to #1 instead of #12.

**How I responded:**
> Thanks for the review and for pointing that out!
> 
> GitHub automatically hyperlinks #1 to the very first item in the repository (which happened to be PR #1 from Lab 1). In this context, it was intended to reference Issue #1 of Lab 2 on our project board rather than the old pull request.
> 
> I appreciate you catching that detail! Everything is clear now, and this PR is ready to be merged into `lab2-staging`.

---

### feat(db): setup lab 2 prisma schema and idempotent seed data (#2)
- **PR Link:** [#20](https://github.com/R1NNE0/toktickit/pull/20)

**Reviewer comment I received:**
> ### Peer Review Checklist & Verification
> I have reviewed the database schema migrations and idempotent seed scripts for Lab 2 (Issue #2).
> 
> #### Verification Results
> - [x] **Prisma Models & Enums:** `RequesterUser`, `Category`, `RelatedSystem`, `Ticket`, and `Attachment` strictly conform to `docs/lab-02/specification.md` Section 7. Enums `Priority` and `TicketStatus` are correctly declared.
> - [x] **Performance Query Indexes:** Composite indexes `(requesterId, createdAt DESC)` and `(requesterId, currentStatus)` are defined on `Ticket` to ensure fast requester-scoped filtering.
> - [x] **Soft Removal Support:** `Attachment` model contains `isRemoved`, `removedAt`, and `removalReason` fields with `onDelete: Cascade`.
> - [x] **Migration SQL:** Migration script `20260830193542_init_lab2_schema` generates schema DDL cleanly.
> - [x] **Idempotent Seed Script (`server/prisma/seed.ts`):**
>   - Seeds 4 Categories and 7 Related Systems using `upsert`.
>   - Seeds 4 Active Requesters + 1 Inactive Requester (`isActive: false`).
>   - Seeds 5 realistic sample Tickets across various statuses and priorities.
>   - Seeds 2 sample attachments (1 active PDF, 1 soft-removed PNG with removal reason).
>   - Can be executed multiple consecutive times without duplicate key errors.
> 
> #### Verdict
> **Approved!** The database schema and seed script meet all technical specifications and idempotency requirements. Ready to merge into `lab2-staging`.

**How I responded:**
> Thank you for the thorough review and verification!
> 
> I appreciate you checking the Prisma models, composite indexes, soft-removal fields, and verifying the seed script's idempotency.
> 
> Everything is in order and this PR is ready to be merged into `lab2-staging`.

---

### feat(auth): implement development requester context and persona selection screen (#3)
- **PR Link:** [#21](https://github.com/R1NNE0/toktickit/pull/21)

**Reviewer comment I received:**
> ### Peer Review Checklist & Verification
> I have reviewed the Development Requester context, persona switcher UI, and backend authentication middleware.
> 
> #### Verification Results
> - [x] **Active Requesters API (GET /api/requesters/active):** Returns only active requesters (isActive: true) ordered alphabetically by name (orderBy: { name: 'asc' }).
> - [x] **Authentication Middleware (requireRequester):** Enforces header presence, checks numeric format, and returns HTTP 403 Forbidden if the requester is non-existent or inactive.
> - [x] **State & Persistence (RequesterContext):** localStorage synchronizes toktickit_selected_requester_id cleanly. authFetch() automatically injects the x-requester-id header into outgoing API calls.
> - [x] **Zen Green UI Implementation:** Header displays active avatar initials with "Switch" CTA. RequesterSelector includes the mandatory Lab 3 disclaimer callout banner, spinner loading state, and retry action.
> - [x] **Automated Tests:** Verified locally — all 9 server API/middleware tests and all 11 client UI component tests pass with 100% assertions green.
> 
> #### Verdict
> **Approved!** Excellent implementation of the simulated identity context, middleware validation, and Zen Green UI layout. Ready to merge into lab2-staging.

**How I responded:**
> Thanks for the thorough review and verification!
> 
> I appreciate you validating both the backend identity boundary (requireRequester middleware, sorted active requesters) and the frontend RequesterContext state persistence via localStorage.
> 
> The branch is clean and ready for you to merge into lab2-staging. Once merged, I will update my local records and the project board before proceeding to Issue #4!

---

### feat(ticket): implement create ticket form with file upload and idempotency (#4)
- **PR Link:** [#22](https://github.com/R1NNE0/toktickit/pull/22)

**Reviewer comment I received:**
> ### Peer Review Checklist & Verification — Issue #4
> I have reviewed the ticket creation workflow, attachment handling, concurrency-safe ticket numbering, and idempotency protection for Lab 2 (Issue #4).
> 
> #### Verification Results
> - [x] **Prisma Schema & Idempotency Key:** Added `idempotencyKey` field to Ticket model with `@@unique([requesterId, idempotencyKey])`. Re-submitting duplicate requests with identical key returns existing ticket without duplicating records.
> - [x] **Ticket Numbering & Validation (POST /api/tickets):** Generates sequential `TKT-YYYY-XXXXXX` ticket numbers. Enforces `x-requester-id` context, input trimming, non-empty text validation, and valid Category/Related System relation checks.
> - [x] **Attachment Upload Constraints (POST /api/tickets/:id/attachments):** Multer middleware restricts uploads to <= 5MB each, allowed formats (`image/jpeg`, `image/png`, `image/webp`, `application/pdf`), and max 5 active files per ticket. Saved under `uploads/lab-02/`.
> - [x] **Create Ticket UI Component (`CreateTicket.tsx`):**
>   - Dropdown selectors with empty prompts and red asterisk indicators.
>   - Attachment dropzone with file preview, size validation, and item remove CTA before submit.
>   - Submit button busy state with animated spinner preventing duplicate submissions.
>   - Preserves entered form values upon network/server failures (AC-10 / BR-11).
>   - Dirty form confirmation prompt when attempting to leave with unsaved changes.
>   - Confirmation card displaying generated `ticketNumber` upon creation.
> - [x] **Automated Tests & Scenario Audit:** Verified locally — all 19 server integration tests and 21 client UI component tests pass cleanly. Audited all edge-case scenarios (input trimming, size limits, format restrictions, double submit, and server error preservation).
> 
> #### Verdict
> **Approved!** Robust implementation of ticket creation, file uploads, idempotency protection, and Zen Green UX. Ready to merge into `lab2-staging`.

**How I responded:**
> Thanks for the thorough review and verification!
> 
> I appreciate you checking the entire ticket creation pipeline—from the database idempotency constraint (`@@unique([requesterId, idempotencyKey])`) and concurrency-safe numbering, to the Zen Green form safeguards and attachment restrictions.
> 
> The branch is clean, verified, and ready for you to merge into `lab2-staging`. Once merged, I will sync my local branch and update our project board before proceeding to Issue #5 (My Tickets)!

---

### feat(ticket): implement my tickets list with search, filter, and pagination (#5)
- **PR Link:** [#23](https://github.com/R1NNE0/toktickit/pull/23)

**Reviewer comment I received:**
> ### Peer Review Checklist & Verification — Issue #5
> I have reviewed the requester-scoped ticket listing interface, search keyword filtering, multi-criteria filtering, deterministic pagination, and responsive layout for Lab 2 (Issue #5).
> 
> #### Verification Results
> - [x] **Requester Data Isolation (GET /api/tickets):** Strictly enforces `x-requester-id` context. Requesters can only access their own tickets (`requesterId == activeRequester.id`).
> - [x] **Full-Text Search & Multi-Field Filtering:** Supports case-insensitive keyword search across `ticketNumber`, `summary`, and `description`, alongside `categoryId`, `requestedPriority`, and `currentStatus` filters.
> - [x] **Deterministic Sorting & Pagination:** Defaults to `createdAt DESC` with secondary tie-breaker `{ id: sortOrder }`. Delivers pagination envelope with total count, `totalPages` metadata, and active attachment count per ticket.
> - [x] **Responsive Zen Green UI (`MyTickets.tsx`):**
>   - Desktop/Tablet (≥768px): Full 8-column data table with sortable headers and status/priority badges.
>   - Mobile (<768px): Touch-friendly card-based list representation.
>   - Distinct empty state ("No tickets submitted yet") vs no-results state ("No tickets match your filters").
>   - Boundary-safe pagination toolbar.
> - [x] **Automated Tests:** Verified locally — all 25 server integration tests and 27 client UI component tests pass with 100% green assertions.
> 
> #### Verdict
> **Approved!** Excellent implementation of ticket listing, searching, filtering, pagination, and responsive mobile/desktop design. Ready to merge into `lab2-staging`.

**How I responded:**
> Thanks for the thorough review and verification!
> 
> I appreciate you validating the requester data isolation, deterministic secondary sorting (`{ id: sortOrder }`), responsive desktop/mobile layouts, and the distinction between empty states.
> 
> The branch is clean and ready for you to merge into `lab2-staging`. Once merged, I will sync my local branch and update our project records before moving on to Issue #6 (Ticket Detail View)!

---

### feat: requester ticket detail and attachment management (Issue #6)
- **PR Link:** 

**Reviewer comment I received:**
> *(Paste reviewer feedback and checklist here)*

**How I responded:**
> *(Paste response here)*

---

### feat: e2e tests, responsive verification, and sprint integration (Issue #7)
- **PR Link:** 

**Reviewer comment I received:**
> *(Paste reviewer feedback and checklist here)*

**How I responded:**
> *(Paste response here)*

---

## Pull Requests I reviewed for my partner

### docs: define Lab 2 engineering contract
- **PR Link:** [#12](https://github.com/Kawi-HBLI/TokTickIT/pull/12)

**My comment:**
> ### Peer Review: APPROVED ✅
> The Lab 2 sprint engineering specification and test plan contract are thoroughly defined and align perfectly with all Lab 2 requirements:
> 
> - **Specification (`specification.md`):** Complete coverage of FRs, BRs, database models/indexes, API summaries, Given-When-Then ACs, and DoD.
> - **Test Plan (`tests.md`):** Comprehensive test breakdown across Unit, API, UI, Responsive, and E2E levels with full AC-to-Test traceability.
> - **UI & API Specs (`ui-spec.md`, `api-spec.md`):** Correct Zen Green palette tokens, responsive breakpoints, endpoints, headers (`x-requester-id`), and ownership failure handling.
> 
> #### Minor Recommendations:
> 1. Proceed with creating the remaining GitHub Issues on the project board to track progress cleanly.
> 2. Record this PR review in `docs/lab-02/reviewer.md` upon merging into `lab2-staging`.
> 
> Ready to merge and proceed to the next feature branch.

**Partner's response:**
> Noted. All seven Lab 2 Issues have now been created, with their implementation order and dependencies documented.
> 
> I will record this approval and review summary in `docs/lab-02/reviewer.md` after PR #12 is merged into `lab2-staging`.
> 
> The PR is ready to be merged.

---

### feat: add Lab 2 database schema and seed data- #20
- **PR Link:** [#20](https://github.com/Kawi-HBLI/TokTickIT/pull/20)

**My comment:**
> ### Peer Review: APPROVED ✅
> I have reviewed the database schema, migration strategy, idempotent seed data, and test suite for Issue #13. Everything meets the Lab 2 engineering specifications:
> 
> - **Schema & Relationships:** All 5 models (Category, RequesterUser, RelatedSystem, Ticket, Attachment) are properly defined with `onDelete: Restrict` foreign key policies and optimal filter/ownership indexes.
> - **Ticket Numbering & Forward Migration:** PostgreSQL sequence generation is concurrency-safe. The forward migration correctly prevents digit truncation for numbers beyond 5 digits without modifying historical migrations.
> - **Idempotent Seed:** Seeds 4 categories, 7 related systems, 4 active requesters, and 1 inactive requester safely via upserts with zero duplicate key errors on consecutive runs.
> - **Automated Tests:** All 20 server integration tests passed cleanly (including temporary schema isolation, boundary values, and concurrent inserts).
> - **Documentation:** `reviewer.md` and `ai-use.md` logs are up to date.
> 
> I am approving this PR so it can be merged into `lab2-staging`. Please update your review log and project board accordingly before moving on to Issue #14 (feature/3-requester-context).

**Partner's response:**
> Approval noted. The PR is ready for you to merge into `lab2-staging`.

---

### feat: implement Development Requester context- #21
- **PR Link:** [#21](https://github.com/Kawi-HBLI/TokTickIT/pull/21)

**My comment:**
> ### Peer Review: APPROVED ✅
> I have reviewed the code, UI behavior, and test suites for Issue #15 (feature/3-requester-context). The implementation meets all Lab 2 technical requirements:
> 
> - **Server Boundary & Validation:** GET /api/requesters accurately filters active accounts. The requireRequester middleware safely enforces integer-based x-requester-id headers and returns structured safe errors without leaking internal exceptions.
> - **UI & Interaction Design:** RequesterSelector gracefully handles Loading, Empty, and Error states (with working Retry mechanism). The Zen Green tokens and mobile layout (375px) meet design guidelines, including the testing disclaimer.
> - **Session Restoration & Shell:** Uses sessionStorage with safe invalid-ID fallback, provides clear active persona switching with cancel actions, and preserves the Lab 1 diagnostic workflow.
> - **Test Evidence:** All 34 server tests and 8 client tests pass cleanly. Production builds for both frontend and backend completed without issues.
> - **Documentation:** Test matrix updates in tests.md and AI reflections in ai-use.md are well-documented.
> 
> Approved and ready to merge into lab2-staging. Looking forward to Issue #16 (feature/4-create-ticket).

**Partner's response:**
> Thank you for the thorough review and approval!
> 
> Glad that the middleware boundary, session restoration fallback, and UI states all look solid and pass the verification checks.
> 
> Whenever you're ready, please go ahead and hit the Merge pull request button to merge this into lab2-staging. Once merged, I will sync staging and get started on Issue #16 (feature/4-create-ticket).

---

### feat: implement Create Ticket workflow and validation (#16)- #22
- **PR Link:** [#22](https://github.com/Kawi-HBLI/TokTickIT/pull/22)

**My comment:**
> ### Peer Review: APPROVED ✅
> I have reviewed the code, verified the automated test suites, and conducted live end-to-end testing for PR 4 (feature/4-create-ticket, Issue #16). The implementation is enterprise-ready and exceeds the Lab 2 requirements:
> 
> - **Server Validation & Constraints:** Enforces strict boundary checks for Summary (5–100 chars) and Description (10–2,000 chars) post-trim, rejecting extraneous fields and validating active foreign keys.
> - **Attachment Handling:** Robust validation against allowed MIME types and extensions (JPG, PNG, WEBP, PDF up to 5 MiB, max 5 files). Filenames are sanitized and persisted via random UUIDs to avoid path traversal.
> - **Idempotency & Concurrency:** Excellent implementation using PostgreSQL transaction advisory locks and SHA-256 fingerprints, safely differentiating between identical replay (HTTP 200) and payload conflicts (HTTP 409). Handled attachment savepoints gracefully.
> - **Zen Green UI & Accessibility:** Implements reactive character counters, automatic focus movement to invalid fields, busy submission spinners, and a modal dirty-form guard with focus trapping.
> - **Test Evidence & Builds:** All 79 server tests and 19 client tests pass cleanly. Production builds for both frontend and backend completed with zero errors.
> - **Traceability:** Documentation in tests.md, reviewer.md, and ai-use.md is complete and accurate.
> 
> Approved and ready to merge into lab2-staging. Great job!

**Partner's response:**
> ขอบคุณที่ช่วยรีวิวและ approve ครับ ฝากกด merge เข้า lab2-staging ให้ด้วยนะครับขอบคุณค้าบบบบบบบ

---

### feat: implement My Tickets workflow with search, filter, and pagination- #23
- **PR Link:** [#23](https://github.com/Kawi-HBLI/TokTickIT/pull/23)

**My comment:**
> ### Peer Review: APPROVED ✅
> I have reviewed the code, verified the test results, and audited the query architecture for PR 5 (feature/5-my-tickets, Issue #17). The implementation satisfies all Lab 2 requirements:
> 
> - **Strict Ownership Isolation:** GET /api/tickets strictly scopes queries by requesterId, preventing cross-requester data leakage.
> - **Query Architecture & Pagination:** Case-insensitive search across summary and ticketNumber works seamlessly. Deterministic secondary sorting (ticketNumber DESC) prevents pagination drift, and active attachment counting correctly excludes soft-deleted files (isRemoved: false).
> - **Zen Green UX & Dual Layout:** Cleanly toggles between multi-column data tables on desktop and responsive card lists on mobile. Correctly separates empty states (0 tickets vs. filtered no-results with Clear Filters CTA) and handles debounced search cleanly.
> - **Test Evidence & Builds:** All 135 server tests and 28 client tests pass cleanly. Production builds and TypeScript type checks completed with zero errors.
> - **Traceability:** Documentation updates in tests.md, reviewer.md, and ai-use.md are complete and accurate.
> 
> Approved and ready to merge into lab2-staging.

**Partner's response:**
> thank bro

---

### Issue 6
- **PR Link:** 

**My comment:**
> 

**Partner's response:**
> 

---

### Issue 7
- **PR Link:** 

**My comment:**
> 

**Partner's response:**
> 
