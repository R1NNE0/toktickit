# Lab 3 Sprint Engineering Specification

Status: **ED-01–10 approved by the user through Phases 2.1 and 2.2 on 2026-09-15; documentation verified; implementation not started.**
Prepared: 2026-09-15. Inspected baseline: `main`, `8fb7e8c` (Lab 2).

Source precedence: `Lab_3_sheet.pdf` §§1–13; current repository implementation; `Lab_02_labsheet.pdf` and [Lab 2 contract](../lab-02/specification.md); Lab 1 only for workflow explicitly inherited by Lab 3; Phase 0/1 analysis last. Handout requirements are marked **Required**; choices beyond them are marked **Engineering Decision (ED)**. The Phase 2.1 authorization matrix and Administrator scope in ED-05 are approved by the user's explicit decision on 2026-09-15. The remaining decisions are approved by the user's Phase 2.2 choices, including default page size 10 and the restriction against broad optimistic locking. §11 records the decisions and outstanding verification facts. Engineering approval does not authorize application implementation in this phase. No statement below is evidence that a feature exists or a test passed.

Companion contracts: [UI](ui-spec.md), [API](api-spec.md), [tests](tests.md), [review log](reviewer.md), [AI-use record](ai-use.md). This file owns roles, business rules, transitions, and acceptance criteria; the API owns exact wire formats; the UI owns presentation; the test plan owns traceability and evidence.

## 1. Sprint Goal

Replace temporary requester selection with secure authenticated accounts while preserving the Lab 2 ticket and attachment increment, deliver the first IT Staff queue and ticket workflow, and provide minimal Administrator user management with backend authorization and verifiable responsive behavior.

## 2. Stakeholder Request

People should sign in to their own accounts and change an initial password before accessing the application. Requesters should continue reporting and following their own problems. IT Staff need a shared queue, assignment, priority and status controls, public communication, and private notes. Administrators need a small account-management screen. Existing data and the Zen Green interface must remain usable throughout the increment.

## 3. Scope

### Included — Required

- Email/password login, logout, current authenticated user, mandatory first-login password change.
- Authenticated Requester identity and Lab 2 ticket/attachment regression.
- Server-side authentication, role authorization, and resource ownership authorization.
- IT Staff Ticket Queue and Ticket Detail, owner assignment, IT Priority, and eight-status workflow.
- Public Comments, Internal Notes, and Requester “Problem Appears Resolved.”
- Minimal Administrator user listing/search, creation, basic edits, one role, activation, initial-password reset, and safety rules.
- User migration preserving Lab 2 data; repeatable local development seeds.
- Responsive Zen Green UI, specification/test traceability, peer review, staged integration, and final evidence.

### Explicitly excluded — Required

- Self-registration, Requester-created accounts, email invitations, password-reset email, initial-password email delivery, MFA, social login, SSO.
- Actions Taken; resolution gates based on Actions Taken; formal SLA calculations, escalation, notifications.
- Advanced dashboards/KPIs beyond simple queue counts; multi-tenant/customer/department/organization administration.
- Multiple roles per user; user deletion; bulk operations; import/export; role/account-history screens.
- Profile photos and extended profile management; account unlocking, administrator approval workflows, advanced recovery/identity management.
- Advanced user-list pagination, multi-column sorting, or multiple simultaneous filters; only name/email search plus an optional role filter is planned.
- Category/Related System management, production/cloud infrastructure, deployment work, and unrelated framework upgrades.

### Current baseline and bounded continuity work

Existing code has five ticket statuses, `RequesterUser`, requester-header ownership checks, JSON ticket creation followed by individual uploads, and requester list/detail screens. It has no genuine login, role model, operational ticket owner, comments, or notes. `itPriority` is currently hardcoded to `MEDIUM` on creation.

**Engineering Decision ED-10:** explicitly include existing requirement gaps that directly affect Lab 3 continuity: visible My Tickets sorting; adding attachments from Ticket Detail; correct list `attachmentCount`; honest partial-upload feedback/retry; accessible mobile navigation; and consistent read-only requester/date/priority fields. Keep the current local file storage and JSON-then-upload flow. Authorization before upload writes, failed-upload cleanup, and atomic attachment limits/removal belong to this scoped boundary. Do not silently refactor other Lab 2 technical debt or rewrite historical documentation.

## 4. Functional Requirements

| ID | Observable requirement |
|---|---|
| FR-01 | An active account can log in using email/password; invalid/inactive credentials receive safe failure feedback. |
| FR-02 | An initial-password account must save a valid new password before any normal application operation. |
| FR-03 | A user can retrieve their safe current identity and log out; revoked/expired sessions cannot access protected resources. |
| FR-04 | Navigation and every protected API enforce the role/resource matrix independently of client controls. |
| FR-05 | A Requester creates a ticket as themselves with backend number/date, validated fields, status New, and IT Priority copied from Requested Priority. |
| FR-06 | A Requester searches, filters, sorts, paginates, and opens only their submitted tickets. |
| FR-07 | Permitted users can upload/download/soft-remove attachments while preserving all Lab 2 restrictions and metadata. |
| FR-08 | IT Staff browse a shared queue with search, filters, sorting, pagination, ownership, priorities, status, and usable feedback. |
| FR-09 | IT Staff open grouped ticket details and claim or reassign an eligible primary owner. |
| FR-10 | IT Staff and Administrators change IT Priority independently of immutable submitted Requested Priority; this explicit Administrator permission does not grant other IT Staff operations. |
| FR-11 | IT Staff perform only the transitions in §6.2 with validation and conflict feedback. |
| FR-12 | Authorized users read Public Comments; Requesters on own tickets and IT Staff append Public Comments. |
| FR-13 | IT Staff append/read Internal Notes; Administrators read them; Requesters receive no note data. |
| FR-14 | A Requester indicates that their problem appears resolved without formally resolving/closing the ticket. |
| FR-15 | Administrators list/search users by name/email, optionally filter one role, and create accounts. |
| FR-16 | Administrators edit name/email/one role/activation and set new initial passwords with account-safety checks. |
| FR-17 | Migration preserves existing requester IDs, ticket submitter relations, tickets, attachments, and reference data. |
| FR-18 | Repeated seeds supply required role fixtures without resetting changed credentials or operational data. |
| FR-19 | All required screens use consistent Zen Green states, responsive layouts, labels, and keyboard access. |
| FR-20 | Approved requirements map to planned tests and actual review, migration, responsive, and final-main evidence. |

## 5. Business Rules

| ID | Rule and source |
|---|---|
| BR-01 | **Required:** only active users with valid credentials authenticate. Missing/disabled credentials never establish a normal session. |
| BR-02 | **Required:** `mustChangePassword` blocks all normal APIs/screens. **ED-02:** allow only CSRF bootstrap, current user, password change, and logout during this restriction. |
| BR-03 | **Required:** server-authenticated identity determines Requester ownership. **ED-04:** reject body/query ownership overrides with 400; ignore `x-requester-id` entirely, so it can never authenticate. |
| BR-04 | **Required:** Public Comments are visible to the submitting Requester, IT Staff, and Administrator; Internal Notes only to IT Staff/Administrator. **ED-05:** Administrators read but do not append these entries; this communication-specific choice does not restrict their explicit IT Priority permission. |
| BR-05 | **Required:** Requester resolution indication cannot formally set Resolved or Closed. **ED-06:** Requesters perform no formal status transitions. |
| BR-06 | **Required:** exactly one role from `REQUESTER`, `IT_STAFF`, `ADMINISTRATOR`; no role arrays, user deletion, or self-registration. |
| BR-07 | **Required:** prevent duplicate emails. **ED-03:** trim and lowercase a separate normalized identity key and enforce database uniqueness on it. Do not merge colliding legacy accounts automatically. |
| BR-08 | **Required:** no plaintext password storage. **ED-01:** Argon2id through `argon2`, explicit 19 MiB memory / 2 iterations / parallelism 1 minimum; 15–128 Unicode code points; allow spaces; do not trim/truncate passwords; reject a small documented local common-password list and reuse of the current password. |
| BR-09 | **ED-02:** random opaque HttpOnly cookie sessions, PostgreSQL persistence, 30-minute idle / 8-hour absolute expiry; 10-minute anonymous CSRF bootstrap sessions. Server expiry wins over browser state. |
| BR-10 | **Required:** logout removes authenticated access and inactive accounts cannot use the system. **ED-02:** logout revokes current session; password changes/resets, role/email changes, and deactivation revoke all target-user sessions. Revalidate current role/activation/password-change state on every protected request. |
| BR-11 | **ED-02:** exact allowed Origin and session-bound CSRF token required for every mutation, including login, logout and multipart upload. Cookies are Secure on HTTPS; an explicit localhost HTTP mode is the only exception. Never put auth tokens in localStorage or URLs. |
| BR-12 | **ED-01:** five failed logins per normalized-email/IP pair in 15 minutes and 100 attempts per IP in 15 minutes return 429 with Retry-After; bounded in-memory counters suit one local server. Unknown/wrong/inactive credentials share 401 code/message and comparable password-verification work. No permanent lockout or unlock UI. |
| BR-13 | **Required:** each ticket retains its submitting user and has zero/one operational owner; assignment candidates include active IT Staff and Administrators. Owner eligibility is distinct from permission to claim/reassign. **ED-05:** an Administrator may be assigned by IT Staff; assignment grants no additional permissions beyond the matrix, including the explicit IT Priority permission. |
| BR-14 | **ED-06:** any IT Staff may operate any ticket regardless of assigned owner; claim assigns self only if unassigned; reassignment explicitly chooses an active eligible user or null. Claim does not change status. |
| BR-15 | **Required (Lab 3 §4.5):** Requested Priority remains the submitted value; new IT Priority copies it; IT Staff and Administrators are permitted to change IT Priority and Requesters are not. **Approved authorization ED-05:** Administrators may update IT Priority on accessible tickets without an owner-only restriction; §6.1 permits general detail access to any known ticket. **Approved ED-06:** retain shared Staff authority and validate each operation against current server state; no client version token is required. Retain historical priorities during migration. Missing Requested Priority still defaults to MEDIUM. |
| BR-16 | **Required:** eight statuses listed in §6.2. **ED-06:** only listed edges are valid; confirmation for resolve/close/cancel/reopen; a 1–4000-character public reason for cancel/reopen. Reason comment and transition commit atomically. No Actions Taken condition. |
| BR-17 | **Approved ED-06 / concurrency scope:** no broad optimistic-locking/versioning system. Use field-specific updates and only the atomic conditions, database constraints or short transactions needed for business correctness: claim only while unassigned, active-owner eligibility, valid current-state transitions with their reason/indication changes, and account/attachment safeguards. Ordinary priority/basic-field updates require no client version token; same-field edits use the last successful write. Update existing `updatedAt` on actual ticket-field changes; it is display metadata, not a lock token. |
| BR-18 | **Required:** comments/notes are append-only with server author and creation time; blank text rejected. **ED-07:** trim text, 1–4000 Unicode code points, escaped plain text, stable creation-time/ID order; no edit/delete routes. |
| BR-19 | **ED-07:** resolution indication stores the latest timestamp and actor for the work cycle, is idempotent, and is allowed in New/Open/In Progress/Waiting for Requester/Reopened only. Reopening clears it; indication itself leaves status unchanged. |
| BR-20 | **Lab 2 continuity:** backend-generated unique `TKT-YYYY-XXXXXX`, active category/system, trimmed nonblank summary/description, requester-scoped idempotency; same key replays original ticket (200), not a new ticket. **ED-10:** new input limits are summary 200 / description 10000 characters; historical longer records remain readable and are not truncated. |
| BR-21 | **Required continuity:** JPG/JPEG, PNG, WEBP, PDF; at most 5,242,880 bytes/file and five active files/ticket. Enforce type/size/count server-side. |
| BR-22 | **Required continuity:** soft removal preserves bytes and metadata and blocks download/preview for everyone. **ED-10:** retain mandatory trimmed reason (1–1000 characters), removal timestamp, and 409 on repeat removal; never overwrite the first removal record. |
| BR-23 | **ED-10:** ticket creation survives partial upload failure; report each failed file and retry it against the existing ticket, never silently report all files saved. Authorize before writing; remove bytes for failed uploads that never became an attachment. Preserve existing attachment records/paths. |
| BR-24 | **Approved ED-08:** default page size 10, bounded sizes, existing search/filter/sort and pagination aliases follow api-spec.md; invalid queries return 400. Requester lists retain authenticated submitter scope and explicit legacy page sizes; only the omitted-size default changes from 8 to 10 as approved in Phase 2.2. |
| BR-25 | **Required:** Administrator cannot deactivate self or remove/deactivate the last active Administrator. **ED-09:** also prevent demotion of the last active Administrator; protect the last-active-Administrator check and change together in a narrowly scoped transaction with a database lock shared by changes that could remove an active Administrator. Do not serialize all account edits; enforce normalized-email uniqueness with a database constraint and return a safe conflict. |
| BR-26 | **Required:** new/reset initial password forces change at next login. **ED-09:** Administrator supplies it in a masked form; store only hash; hand over outside the application; never echo it in a response, persist it client-side, or send email. |
| BR-27 | **ED-09:** disabling an owner or changing their role to Requester atomically unassigns their tickets and updates affected tickets' existing `updatedAt` timestamps. Retain all submitted tickets/authorship even if an author's role changes. Preview/warn about unassignment in the edit form. |
| BR-28 | **Required:** distinguish authentication, forbidden, validation, missing, conflict, and unexpected errors without leaking protected-resource existence. **ED-04:** 401 no valid auth; 403 disallowed role; indistinguishable 404 for missing/cross-requester resources. No notes/counts in Requester projections. |
| BR-29 | **Required:** preserve Lab 2 data and repeatable seeds. **ED-03:** additive migration and Prisma `User @@map("RequesterUser")`; create missing fixtures without overwriting existing credentials/account choices/ticket progress. |
| BR-30 | **Required:** role-aware, responsive Zen Green interface and safe feedback. **ED-10:** clear all private view/form state on confirmed logout/account change; cancel or disregard obsolete async responses. Preserve entered non-password data during ordinary API failures. |

## 6. UI Specification Summary and Authorization

### 6.1 Backend authorization matrix

Apply valid active session, then password-change gate, then allowed role, then resource scope. Navigation is feedback, never an authorization control. “Own” means `ticket.requesterId == session.userId`, not operational Ticket Owner.

| Operation | Requester | IT Staff | Administrator |
|---|---|---|---|
| Current user, own password change, logout | Yes | Yes | Yes |
| Create / list own tickets | Yes / Own | No | No |
| Shared queue and assignee lookup | No | Yes | No |
| Read Ticket Detail | Own | Any | Any via known ticket link, read-only (approved ED-05); IT Priority update is a separate permitted action |
| Read Public Comments | Own | Any | Any |
| Append Public Comments | Own | Any | No (ED-05) |
| Read Internal Notes | No | Any | Any |
| Append Internal Notes | No | Any | No (ED-05) |
| Attachment metadata | Own | Any | Any in Ticket Detail; metadata is read-only (ED-05) |
| Upload/download/soft-remove attachments | Own | Any (ED-05) | No (ED-05) |
| Download/preview removed bytes | Never | Never | Never |
| Claim / assignment / reassignment | No | Yes | No (ED-05), distinct from being an eligible owner |
| Change IT Priority | No | Yes | Yes (Lab 3 §4.5); accessible tickets, not owner-only (approved ED-05) |
| Transition status | No | Yes | No (approved ED-05); Staff transitions remain ED-06 |
| Be eligible Ticket Owner | No | Yes, if active | Yes, if active (handout §4.5) |
| Problem Appears Resolved | Own | No | No |
| List/search/create/edit/reset accounts | No | No | Yes |
| Delete users / edit or delete comments/notes | Never | Never | Never |

#### Administrator capability classification against the handout

“Required by Lab 3” below includes role participation explicitly permitted by the handout and required to be represented in this contract. “Forbidden by Lab 3” identifies an explicit exclusion, not merely a permission this draft chooses to withhold. The Administrator choices in this table were explicitly approved by the user on 2026-09-15. Their classification remains “Engineering Decision / authorization-matrix choice” because approval does not turn a chosen restriction into a handout prohibition. Supporting Ticket Detail is read-only; IT Priority update is a separate authorized action on accessible tickets without an owner-only restriction. Accessible means an existing ticket permitted by the general detail policy after normal session/role checks; the approved policy allows any known ticket and does not require assignment or Queue access.

| Administrator capability | Classification | Contract behavior / source |
|---|---|---|
| Ticket Queue access | Engineering Decision / authorization-matrix choice | Deny (approved); §4.3 does not automatically grant the Staff Queue. User Management remains the default destination |
| Ticket Detail access and scope | Engineering Decision / authorization-matrix choice | Allow read-only access to any known ticket via general detail/deep link for permitted Ticket information, Public Comments, Internal Notes, IT Priority and attachment metadata (approved); IT Priority update is separate; no queue implied |
| Be a Ticket Owner | Required by Lab 3 | Active Administrators are eligible alongside active IT Staff (§4.5); preserve them in assignment candidates |
| Claim | Engineering Decision / authorization-matrix choice | Deny (approved); owner eligibility is not permission to self-claim |
| Assignment/reassignment | Engineering Decision / authorization-matrix choice | Deny (approved); IT Staff can assign/reassign to an eligible Administrator |
| Change IT Priority | Required by Lab 3 | Allow IT Staff OR Administrator (§4.5); Requester denied. Accessible-ticket scope without an owner-only restriction is approved ED-05 |
| Status transitions | Engineering Decision / authorization-matrix choice | Deny for Administrator (approved); existing IT Staff transition matrix remains unchanged (§4.3/§4.5) |
| Read Public Comments | Required by Lab 3 | Allow (§4.4 BR-04, §4.6) |
| Append Public Comments | Engineering Decision / authorization-matrix choice | Deny for Administrator (approved); visibility does not imply authorship |
| Read Internal Notes | Required by Lab 3 | Allow (§4.4 BR-04, §4.6); Requester remains forbidden |
| Append Internal Notes | Engineering Decision / authorization-matrix choice | Deny for Administrator (approved); no automatic Staff authorship |
| Edit/delete Public Comments or Internal Notes | Forbidden by Lab 3 | Never; append-only for all roles (§4.6) |
| Read attachment metadata | Engineering Decision / authorization-matrix choice | Allow permitted metadata in read-only Ticket Detail (approved) |
| Upload active attachments | Engineering Decision / authorization-matrix choice | Deny for Administrator (approved) |
| Download active attachment bytes | Engineering Decision / authorization-matrix choice | Deny for Administrator (approved) |
| Soft-remove attachments | Engineering Decision / authorization-matrix choice | Deny for Administrator (approved) |
| Download/preview removed attachments | Forbidden by Lab 3 | Never; Lab 3 §4.1/§8.2 preserve Lab 2's removed-file prohibition |
| User Management | Required by Lab 3 | Existing list/search/create/edit/one-role/activation/initial-password responsibilities and safeguards unchanged (§4.3/§4.4/§8.5) |

**Engineering Decision ED-05:** IT Staff primarily manage Tickets; Administrators primarily manage users. This contract now grants the handout's explicit Administrator IT Priority permission as well as required comment/note visibility and owner eligibility, without inheriting every Staff operation. The user approved denial of queue/claim/reassignment/status/posting/attachment-byte actions and permission for read-only Ticket Detail/permitted attachment metadata on 2026-09-15. IT Priority updates are allowed on accessible tickets without an owner-only restriction. Neither assignment nor the `/staff/` URL prefix overrides the endpoint's explicit role checks.

Login/mandatory password change precede the shell. Requester navigation is My Tickets/Create Ticket; IT Staff navigation is Ticket Queue; Administrator navigation is User Management. All show authenticated name/role, Change Password, Logout, and active navigation. UI details and states are in [ui-spec.md](ui-spec.md).

### 6.2 Ticket status-transition matrix — Engineering Decision ED-06

API enum labels: `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, `CANCELLED`. UI uses New, Open, In Progress, Waiting for Requester, Resolved, Closed, Reopened, Cancelled.

| Source | Destination | Role | Validation / confirmation |
|---|---|---|---|
| NEW | OPEN | IT Staff | Validate current source status |
| NEW | CANCELLED | IT Staff | Confirm; public reason |
| OPEN | IN_PROGRESS | IT Staff | Active eligible owner assigned |
| OPEN | CANCELLED | IT Staff | Confirm; public reason |
| IN_PROGRESS | WAITING_FOR_REQUESTER | IT Staff | Validate current source status |
| IN_PROGRESS | RESOLVED | IT Staff | Confirm; active eligible owner assigned |
| IN_PROGRESS | CANCELLED | IT Staff | Confirm; public reason |
| WAITING_FOR_REQUESTER | IN_PROGRESS | IT Staff | Active eligible owner assigned |
| WAITING_FOR_REQUESTER | RESOLVED | IT Staff | Confirm; active eligible owner assigned |
| WAITING_FOR_REQUESTER | CANCELLED | IT Staff | Confirm; public reason |
| RESOLVED | CLOSED | IT Staff | Confirm |
| RESOLVED | REOPENED | IT Staff | Confirm; public reason; clear resolution indication |
| CLOSED | REOPENED | IT Staff | Confirm; public reason; clear resolution indication |
| REOPENED | OPEN | IT Staff | Validate current source status |
| REOPENED | CANCELLED | IT Staff | Confirm; public reason |
| CANCELLED | None | None | Terminal; use a new ticket |

All rows validate the current stored status and required conditions atomically with the change; unlisted/self transitions return 409, unknown enums 400, prohibited roles 403. Comments/attachments remain available in all statuses to permitted roles; they do not change status. No generic ticket delete/cancel-by-Requester endpoint exists. Resolution indication is a separate action, never an edge in this matrix.

## 7. Data Changes

Field names/types below are planned, not applied. Retain Int primary keys and existing timestamps; use named Prisma relations to distinguish submitter/owner/author.

| Entity | Planned changes / retained behavior |
|---|---|
| User mapped to RequesterUser | Preserve id/name/email/isActive/createdAt/updatedAt. Add `emailNormalized String @unique`, `role UserRole`, `passwordHash String`, `mustChangePassword Boolean`, `passwordChangedAt DateTime?`. Initial migration permits null hash/key only during controlled backfill; final constraints prohibit them. |
| UserRole | Enum REQUESTER / IT_STAFF / ADMINISTRATOR; default REQUESTER for migrated rows. |
| Session | Unique SHA-256 token hash, optional userId (anonymous bootstrap only), csrfToken (random anti-CSRF value, not an auth credential), createdAt, lastSeenAt, expiresAt. Delete/revoke rows on logout/security changes; index userId and expiresAt. |
| Ticket | Preserve all existing fields, requesterId FK to same physical user row, category/system FKs and attachment relation. Add nullable ownerId, resolutionSuggestedAt and resolutionSuggestedById nullable. Do not add a version column or optimistic-lock token. Add three status enum values. New creation sets itPriority explicitly from requestedPriority. |
| PublicComment / InternalNote | Separate tables: id Int PK, ticketId FK, authorId FK, body Text, createdAt default now. Author is authenticated actor; no edit/delete API. Index (ticketId, createdAt, id). |
| Attachment / Category / RelatedSystem | Preserve records, IDs, constraints and paths. No physical file relocation, user deletion cascade, or reference-data-management increment. |

Retain unique ticketNumber, `(requesterId, idempotencyKey)` uniqueness, and existing requester/date/status indexes. Add queue indexes `(currentStatus, createdAt, id)` and `(ownerId, currentStatus)`; full substring scans are acceptable at course scale (no search service). Retain historical author/user relations with restrictive deletion behavior. Indexes do not enforce active-owner or last-admin rules; use targeted transactions/locks only for those invariants and the other multi-step correctness rules in BR-17. Do not introduce a blanket transaction or versioning framework. No Ticket audit-history or Actions Taken model is introduced.

### 7.1 Migration from Lab 2 — Engineering Decision ED-03

1. In an isolated database, capture a populated Lab 2 baseline including non-seeded users/tickets, inactive requesters, removed attachment metadata and actual file hashes. Never reset the development database to demonstrate migration.
2. Add fields/tables/enum values with forward migrations; keep existing migration files immutable. Use Prisma mapping instead of drop/recreate or physical table rename, preserving ID sequences and ticket ownership.
3. Backfill normalized emails and REQUESTER role; fail with an operator-readable collision report if emails normalize identically. Do not merge/drop users or alter activation state.
4. A controlled local provisioning step generates a unique random initial password for every legacy user lacking a hash, hashes it with the selected library, sets mustChangePassword, and hands the value once to the local operator for offline delivery. Inactive users remain inactive. Do not place passwords in SQL, ordinary logs, committed artifacts, or existing user records. An explicit later reset is recovery if handover is lost.
5. Verify every user is provisioned before final NOT NULL constraints; unprovisioned accounts cannot authenticate. Preserve historical priorities/statuses and attachment bytes/paths; no bulk correction of old IT priorities.
6. Replace requesterAuth with session/role/resource middleware. Replace RequesterContext/selector with AuthContext/login; remove Switch/Change Requester, old storage helpers and header injection. Remove stored `toktickit_selected_requester_id` once during startup without using it. Remove `/api/requesters/active` (404).
7. Compare pre/post IDs, row counts, FK mappings, content, removal records and file hashes; authenticate migrated users and replay the requester regression suite. Record evidence in tests.md. No mixed header/session identity fallback is permitted in the released application.

### 7.2 Seed strategy

**Required:** retain four categories, seven existing systems, at least four active/one inactive Requesters; add at least three active/one inactive IT Staff and one active Administrator. Add realistic tickets covering eight statuses, both assigned/unassigned ownership, priorities, and example comments/notes. Use stable fixture keys and create-only missing records. Never reset changed passwords, roles, activation, ticket progress, comments, or existing removal metadata during routine reruns. Document generated local-only initial credentials through the provisioning procedure; never use real personal secrets. Existing seeded attachment metadata may reference absent files: preserve it and return safe 404; create real synthetic files only for new test fixtures in the isolated test upload root.

## 8. API Contract

Exact methods, paths, DTOs, validation, cookies/CSRF, query behavior and safe status codes are in [api-spec.md](api-spec.md). Retain existing Requester ticket/attachment paths, JSON create plus multipart uploads, and pagination aliases where documented. Session identity replaces the header; no auth hashes/session secrets/internal-note fields appear in Requester responses.

## 9. Acceptance Criteria

| ID | Given / When / Then |
|---|---|
| AC-01 | Given an active provisioned user, when correct email/password is submitted, then a new session and safe identity are returned; invalid, unknown and inactive credentials share a safe failure. |
| AC-02 | Given an initial-password session, when normal APIs or screens are opened, then access is blocked until a valid changed password is saved and the session rotated. |
| AC-03 | Given a valid session, when current user is requested, then current safe identity is returned; after logout, idle/absolute expiry or account revocation, protected access fails. |
| AC-04 | Given absent or forged credentials/identity inputs, when protected APIs are called, then neither another identity nor unauthorized access is obtained. |
| AC-05 | Given each role, when destinations or direct APIs are accessed, then §6.1 is enforced, including required Administrator comment/note reads and IT Priority editing, separately chosen denials of other operations, and no Requester note data. |
| AC-06 | Given valid Requester input, when creating/retrying with one idempotency key, then one ticket is created with preserved submitter identity, unique number, NEW status and copied IT Priority; invalid input creates none. |
| AC-07 | Given multiple users' tickets, when Requester list/detail/search/filter/sort/page is used, then only owned data is returned with correct metadata and safe cross-owner 404. |
| AC-08 | Given permitted attachments, when upload/download/remove is used, then type/size/count limits, safe bytes, reasons, retained metadata and removed-download denial hold; partial upload failure is visible and recoverable. |
| AC-09 | Given realistic shared tickets, when IT Staff query the queue, then search/filter/order/page/owner information and empty/no-results/error states match the contract. |
| AC-10 | Given unassigned/assigned tickets, when IT Staff claim/reassign, then eligible ownership changes safely; inactive/ineligible targets and conflicting claims are rejected. |
| AC-11 | Given a normal IT Staff or Administrator session and an accessible ticket, when valid IT Priority is submitted without a version token, then IT Priority changes independently of Requested Priority; invalid input fails and Requester cannot edit it. Administrator need not be the owner and gains no other operations. Updates change only the intended field and normal timestamp metadata; ordinary same-field edits use the last successful write. |
| AC-12 | Given each source status, when a transition is attempted, then exactly §6.2 succeeds; confirmations/reasons and atomic current-state validation apply and Requester cannot resolve/close. |
| AC-13 | Given a permitted reader/writer, when Public Comments are read/appended, then scope, text limits, immutable backend author/time and safe rendering are enforced. |
| AC-14 | Given notes, when IT Staff appends or Staff/Administrator reads, then valid notes are available; Requesters obtain no content/count/metadata and no role can edit/delete them. |
| AC-15 | Given an owned active-workflow ticket, when Requester indicates resolution, then timestamp/actor appears without status change; repeats are idempotent and reopening clears the indication. |
| AC-16 | Given Administrator access, when listing/searching/filtering users, then safe Name/Email/Role/Status records match; non-Administrators are forbidden. |
| AC-17 | Given new user data, when Administrator creates an account, then one role and an initial hash/change requirement are saved; duplicate normalized email or invalid fields/role create none. |
| AC-18 | Given an existing account, when Administrator edits allowed fields or activation/role, then history remains and sessions/assignments follow the rules; prohibited self/last-admin changes fail even concurrently. |
| AC-19 | Given Administrator resets an initial password, when the user next authenticates, then old sessions/password fail and mandatory password change precedes normal use. |
| AC-20 | Given populated Lab 2 data, when migration/provisioning is applied, then IDs, ownership, tickets, attachments and reference data survive; old selector/header identity no longer works. |
| AC-21 | Given required seed fixtures, when seed is repeated after a user changes password and tickets change, then no duplicates or resets occur and required new role fixtures exist. |
| AC-22 | Given each required UI screen, when loading/saving/validation/empty/forbidden/not-found/conflict/failure states occur, then useful accessible feedback and safe state retention/clearing occur. |
| AC-23 | Given desktop/tablet/mobile and keyboard use, when major screens are exercised, then Zen Green tokens, readable labels/badges, focus, navigation and no clipping/overlap/page overflow are verified. |
| AC-24 | Given the release candidate, when actual browser authentication/staff/admin/requester journeys run, then behavior works across UI/API/DB and evidence maps to ACs. |
| AC-25 | Given a state-changing request, when CSRF/origin validation fails or login is throttled, then the request is rejected safely without unintended mutation. |
| AC-26 | Given the completed increment, when the contract is audited, then required tests, migration/visual evidence, bilateral peer approvals, staged history and final-main evidence exist with no fabricated completion claims. |

Every AC maps to planned tests/evidence in [tests.md](tests.md). All remain unverified.

## 10. Product Definition of Done and Delivery Gates

### Product completion — all unchecked

Engineering-decision approval is recorded in §11 (Phases 2.1/2.2). The product and release checks below remain unverified; approval is not evidence of implementation or passing tests.
- [ ] All FR/BR/AC entries implemented and traceable; planned tests pass with no required skip or fabricated result.
- [ ] Migration/provisioning preserves seeded and non-seeded Lab 2 records, ownership and attachment bytes/metadata.
- [ ] Auth/session/password-change/logout/CSRF/activation/security behavior proven through direct APIs and browser flows.
- [ ] Requester regression, IT Staff Queue/Detail, communication/workflow and minimal Administrator UI complete.
- [ ] Role/resource restrictions, concurrent updates and Administrator safeguards verified.
- [ ] Desktop/tablet/mobile and keyboard evidence meets ui-spec.md; actual screenshots reviewed.
- [ ] Setup, credential provisioning, test commands, failure behavior and limitations documented accurately.

### Course/process and release gates — also required, all unchecked

- [ ] Required GitHub Issues specified before implementation with dependencies, ACs and tests.
- [ ] Feature branches target lab3-staging; no development directly on main/staging.
- [ ] Peer-reviewed PRs with actual approval, responses and re-review after fixes; student's reviews/approvals of assigned peer also recorded.
- [ ] Integration tests pass on staging; reviewed release PR merges staging into main.
- [ ] Final main verified; recorded commit, complete outputs, all Issues Done and real evidence links available.
- [ ] reviewer.md and ai-use.md completed honestly; 6–10 real selected prompts and student reflection.
- [ ] One concise submission PDF uses Answer Part 1 through Answer Part 9 and links to final repository/board/reviews/tests/screenshots.

## 11. Approved Engineering Decisions and Remaining Verification

| ID | Approved Engineering Decision | Approval / verification status |
|---|---|---|
| ED-01 | Argon2id; 15–128-character passwords, no plaintext storage, basic local failed-login throttling and safe credential errors (BR-08/12); no advanced account locking/recovery. | Approved by user, Phase 2.2, 2026-09-15. Package pin/Node/Windows compatibility is an implementation verification task, not pending policy approval |
| ED-02 | Opaque PostgreSQL server sessions; HttpOnly/SameSite cookies and CSRF protection; 30-minute idle / 8-hour absolute expiry; logout and appropriate security-change revocation (BR-02/09–11). | Approved by user, Phase 2.2, 2026-09-15 |
| ED-03 | Evolve RequesterUser into mapped User with preserved IDs, requester ownership and all Ticket/Attachment data; migrate existing users to REQUESTER; safe local initial-password provisioning and non-resetting seeds. No Lab 2 drop/recreate. | Approved by user, Phase 2.2, 2026-09-15. Actual data collisions and handover remain migration preflight facts |
| ED-04 | Server-session identity only; client requesterId/header cannot authenticate; 401 unauthenticated, 403 unauthorized, safe cross-Requester 404 and no implementation/secret leakage. Existing non-sensitive Lab 1 reads retained. | Approved by user, Phase 2.2, 2026-09-15 |
| ED-05 | Administrator capability classification in §6.1: required reads/owner eligibility/IT Priority are included. Read-only general detail/permitted metadata and IT Priority updates on accessible tickets without an owner-only restriction are allowed; queue/claim/reassignment/status/posting/attachment-byte actions are denied. Staff permissions unchanged. | Administrator authorization approved by user on 2026-09-15; no pending approval for these choices |
| ED-06 | Existing minimal status edges, confirmations/reasons and shared Staff authority; invalid transitions conflict; independent Requester indication; no Lab 4 Actions Taken. No broad optimistic locking: only targeted correctness transactions/constraints (BR-17). | Approved by user, Phase 2.2, 2026-09-15; Phase 2.1 Administrator permissions unchanged |
| ED-07 | Trimmed plain-text append-only comments/notes, maximum 4000 characters, backend author/time, no edit/delete; resolution indication stored independently of formal status. | Approved by user, Phase 2.2, 2026-09-15 |
| ED-08 | Existing documented search/filter/sort and Requester aliases; default page size 10, reasonable bounded sizes and clear invalid-query rejection. Explicit legacy Requester sizes remain supported. | Approved by user, Phase 2.2, 2026-09-15 |
| ED-09 | Unique emails, no self-deactivation or last-active-Administrator deactivation/demotion; initial-password reset forces change, no email/recovery; targeted account safety/revocation/unassignment transactions only where needed. | Approved by user, Phase 2.2, 2026-09-15 |
| ED-10 | Only Lab 2 continuity repairs necessary for Lab 3 correctness, regression or explicit requirements; retain Zen Green and reusable UI, current storage and partial-upload handling; no unrelated refactoring. | Approved by user, Phase 2.2, 2026-09-15 |

Remaining non-policy facts: actual Lab 3 peer assignments, GitHub Issue/PR numbers, isolated test environment, runtime/install verification, migration collision/data/file preflight and evidence locations/results are TODO. Authorization approval is recorded from the user's explicit Phase 2.1 decision, not inferred from document creation. Phase 2.2 approves all remaining engineering decisions, subject to its simplicity/concurrency limits. No unresolved engineering-policy decision currently blocks implementation. The listed facts need verification during later authorized work; if preflight reveals a real collision or other blocker, report it then. Broad optimistic locking may be reconsidered only if implementation evidence proves it necessary. Application work and GitHub changes require a later instruction.
