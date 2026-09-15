# Lab 3 REST API Contract

Status: **Engineering decisions approved through Phase 2.2 — unimplemented.** Prepared 2026-09-15 against Lab 2 `8fb7e8c`.
Policy source: [specification.md](specification.md), especially BR-01–30, §6 authorization/transitions, and ED-01–10. Paths, DTOs and numerical limits are Engineering Decisions; Administrator permissions follow the capability classification in specification.md §6.1, including required IT Priority access and explicit matrix choices rather than blanket Staff inheritance.

## 1. Protocol, authorization and errors

- Base path `/api`; JSON except multipart uploads/binary downloads. Response timestamps are UTC ISO-8601 strings; IDs are positive integers at most 2147483647. Strict parsing rejects `1x`, decimals, overflow and repeated scalar parameters.
- `R` = Requester, `S` = IT Staff, `A` = Administrator. `own` = submitting user equals session user. `normal` = active authenticated session with password change completed.
- Authenticate, apply mandatory-change gate, check role, then authorize the resource. Scope Requester lookups in the database. Validate content only after authorization where necessary to avoid resource existence disclosures.
- Client `requesterId`, `authorId`, `createdAt`, password hashes and other server-owned fields in mutation bodies are rejected (400). Reject `requesterId` query overrides. Ignore legacy `x-requester-id`; it never authenticates or changes scope, even alongside a valid session.
- Every POST/PATCH/DELETE requires exact allowed Origin plus `X-CSRF-Token` associated with the session, including anonymous login. Do these checks before mutation or multipart file writes. GET must not perform business mutations.
- Error body: `{ "error": "Safe readable message", "code": "STABLE_CODE", "details": [{ "field": "name", "message": "Required" }] }`. Omit details unless field validation applies; never return submitted passwords, SQL, hashes, stacks or disk paths.

| Status | Meaning / codes |
|---|---|
| 200 | Read/update/replay success; normal JSON body |
| 201 | New user/ticket/comment/note/attachment |
| 204 | Logout completed; no response body |
| 400 | `VALIDATION_ERROR`, `INVALID_QUERY`, `INVALID_ID`, `ATTACHMENT_LIMIT`, `UNSUPPORTED_FILE_TYPE` |
| 401 | `UNAUTHENTICATED` (absent/expired/revoked/inactive session); login failure `INVALID_CREDENTIALS` |
| 403 | `FORBIDDEN`, `PASSWORD_CHANGE_REQUIRED`, `CSRF_INVALID`, `ATTACHMENT_REMOVED` |
| 404 | `NOT_FOUND` (same body for missing vs another Requester's resource); `FILE_UNAVAILABLE` only after permitted active attachment lookup |
| 409 | `ALREADY_ASSIGNED`, `INVALID_TRANSITION`, `ALREADY_REMOVED`, `DUPLICATE_EMAIL`, `SELF_DEACTIVATION`, `LAST_ADMIN`, `STATE_CONFLICT` |
| 413 | `PAYLOAD_TOO_LARGE` for file/body byte limit |
| 429 | `RATE_LIMITED`; Retry-After seconds |
| 500 | `INTERNAL_ERROR`; generic message, no implementation details |

All protected routes inherit 401/403 and safe 500 behavior even where endpoint tables list only additional errors. All ID-scoped routes inherit invalid-ID 400 and missing-resource 404. A role forbidden from an endpoint receives the same 403 for existing/nonexistent resource IDs (after syntax validation); a Requester reading someone else's permitted resource type gets the same 404 as missing. No Requester response includes Internal Notes, their counts, or note identifiers. PATCH/DELETE for comments/notes and user DELETE are unsupported (404), including for Administrators.

## 2. Session and authentication — ED-01/02

Use a random 32-byte opaque bearer value in cookie `toktickit_session`; store only its SHA-256 hash as the database lookup key. A Session row stores userId (null only before login), stable random CSRF token, createdAt, lastSeenAt, expiresAt. The CSRF token is not an authentication credential; only it may be read by frontend JavaScript, held in memory. Authentication cookie values, password hashes and application secrets never enter frontend state/storage, URLs or ordinary logs.

Cookie attributes: HttpOnly; SameSite=Lax; Path=/; no Domain; Secure on HTTPS. An explicit localhost-only HTTP mode permits Secure=false for the course. Client sends `credentials: "include"`; server allows only configured frontend origin (initially `http://localhost:5173`), credentials and required headers, never wildcard credentialed CORS. Cookies are nonpersistent; backend enforces 30-minute inactivity and eight-hour absolute lifetime. Anonymous bootstrap expires in ten minutes. Expiry is evaluated before touching lastSeenAt; activity cannot extend absolute expiry.

Rotate and replace the session/CSRF token at login and successful password change. Revoke current session on logout; revoke all target-user sessions on password change/reset, email/role change or deactivation. Every protected request verifies current user isActive/role/mustChangePassword. Database/session errors fail closed. Role information cached in a browser is never authoritative.

Argon2id: explicit minimum memoryCost 19456 KiB, timeCost 2, parallelism 1, library-generated random salt and encoded hash. Select and verify the package version for Node/Windows during later authorized implementation; the hashing decision is approved. Passwords: 15–128 Unicode code points, no trimming/truncation, allow Unicode/spaces, reject current-password reuse and exact matches after lowercasing against this local baseline denylist: `passwordpassword`, `123456789012345`, `qwertyuiopasdfgh`, `letmeinletmeinletmein`. No online password service is required. All initial passwords follow the same length policy. JSON body limit 128 KiB bounds resource use; log neither request passwords nor cookies.

Five failed logins per normalized-email/IP pair in a rolling 15-minute window and 100 login attempts/IP/15 minutes return 429. Apply counters equally to unknown/known/inactive users. Use comparable hash verification for all credential failures. Bounded in-memory counters are an explicit single-local-server limitation, not a distributed rate-limit system.

### Authentication endpoints

| Method / path | Authorization and request | Success | Validation / additional errors |
|---|---|---|---|
| GET `/auth/csrf` | Public; reuse valid anonymous/authenticated session, otherwise create short-lived anonymous session | 200 `{ csrfToken: string }`, Set-Cookie when created, Cache-Control: no-store | Does not authenticate or upgrade a session; does not bypass mandatory change |
| POST `/auth/login` | Anonymous/bootstrap or existing session plus Origin/CSRF; `{ email, password }` | 200 `{ user: CurrentUser, csrfToken }`; new cookie/session replaces previous browser session | 400 malformed email/missing/oversized fields; same 401 message “Unable to sign in. Check your credentials or contact your administrator.” for unknown/wrong/inactive; 429 throttled |
| GET `/auth/me` | Authenticated, including must-change session | 200 `{ user: CurrentUser }`, Cache-Control: no-store | 401 for absent/expired/revoked/inactive; never returns users by client-supplied ID |
| POST `/auth/change-password` | Authenticated, including must-change; `{ currentPassword, newPassword, confirmPassword }` | 200 `{ user: CurrentUser, csrfToken }`, new cookie; flag false, passwordChangedAt set, old sessions revoked | 400 current password invalid, new rules violated, unchanged password or mismatched confirmation; generic field feedback; session remains restricted on failure |
| POST `/auth/logout` | Authenticated including must-change; `{}` and CSRF | 204; revoke session and clear cookie with same scope | Invalid/expired session yields 401 and clears stale cookie; client treats that as signed out. A network failure is not proof of server revocation |

`CurrentUser = { id, name, email, role, isActive, mustChangePassword }`. It never includes passwordHash/emailNormalized/session records. A must-change login succeeds but **every normal API returns 403 PASSWORD_CHANGE_REQUIRED**; only `/auth/csrf`, `/auth/me`, `/auth/change-password`, `/auth/logout` remain usable. Frontend bootstraps with me/csrf before entering a protected screen; it must not infer auth from localStorage.

Security rationale: server persistence supports immediate revocation without JWT refresh machinery; cookie flags reduce script access; synchronizer CSRF tokens protect cookie-authenticated mutations. Reference guidance: [OWASP sessions](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html), [password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). Numerical lifetimes and implementation selection remain engineering decisions.

## 3. Response projections

These named shapes define all fields; no automatic Prisma serialization of sensitive User/Session records is permitted.

- `UserRef`: `{ id, name, email }`; `OwnerRef`: `{ id, name, role, isActive }`; category/system reference: `{ id, name }`.
- `Attachment`: `{ id, ticketId, fileName, fileSize, mimeType, isRemoved, removedAt: string|null, removalReason: string|null, createdAt }`. Never storedPath. Upload responses set removal fields to null.
- `TicketRow`: `{ id, ticketNumber, summary, description, requesterId, categoryId, relatedSystemId, requestedPriority, itPriority, currentStatus, ownerId: number|null, owner: OwnerRef|null, category, relatedSystem, createdAt, updatedAt, resolutionSuggestedAt: string|null, resolutionSuggestedById: number|null, attachmentCount }`. Count only active attachments. Staff rows additionally include `requester: UserRef`.
- `TicketDetail`: TicketRow plus `requester: UserRef` and `attachments: Attachment[]` including removed metadata, ordered createdAt/id ascending. It never embeds comments/notes; retrieve through separately authorized endpoints.
- `Entry`: `{ id, ticketId, body, author: { id, name }, createdAt }` for either a comment or a note; no password or private account metadata.
- `AdminUser`: `{ id, name, email, role, isActive, mustChangePassword, createdAt, updatedAt }`.

## 4. Reference and Requester APIs

Public GET `/health` retains `{ status: "ok", service: "TokTickIT API" }`; GET `/categories` retains active `{id,name}[]` in ID order; GET `/related-systems` retains active `{id,name,isActive}[]` in name order. These non-sensitive Lab 1 diagnostic/reference endpoints do not establish identity. GET `/requesters/active` is removed and returns 404.

| Method / path | Authorization / request | Success | Validation / additional errors |
|---|---|---|---|
| POST `/tickets` | Normal R; `{ summary, description, categoryId, relatedSystemId, requestedPriority?: Priority, idempotencyKey?: string }` | 201 TicketDetail (empty attachments), or 200 original TicketDetail on requester/key replay | Summary 1–200, description 1–10000 after trim; active category/system; priority LOW/MEDIUM/HIGH/CRITICAL (default MEDIUM); key 1–128 if supplied. 400 invalid fields; concurrent same-key requests converge on same record. Server sets requester, number, NEW, itPriority=requestedPriority, owner=null |
| GET `/tickets` | Normal R; query below, always own | 200 `{ data: TicketRow[], pagination }` | 400 invalid filters/page/sort; never expose another submitter |
| GET `/tickets/:id` | Normal R own, S any, A any known ticket (approved ED-05; read-only detail) | 200 TicketDetail | 404 missing/cross-requester; A can separately edit IT Priority through §5, but gets no other mutation/download permission from this GET |
| POST `/tickets/:id/attachments` | Normal R own or S any; multipart single field `file`, plus CSRF header | 201 Attachment | Match allowed extension and MIME and recognizable file signature; JPG/JPEG/PNG/WEBP/PDF; <=5,242,880 bytes; <=5 active. 400 missing/unsupported/count; 413 oversized; authorize before disk write; serialize count+insert; clean failed unrecorded bytes |
| GET `/attachments/:id/download` | Normal R own or S any | 200 binary with MIME, nosniff, safe UTF-8 Content-Disposition attachment filename | 403 removed; 404 missing/cross-requester or permitted file unavailable. A is 403 regardless of existence. No direct static upload serving |
| DELETE `/attachments/:id` | Normal R own or S any; `{ reason }` | 200 `{ id, fileName, isRemoved: true, removedAt, removalReason }` (legacy-compatible subset) | Reason trimmed 1–1000; 400 blank/too long; 409 already removed, atomically guarded so first audit fields survive |

Upload failure never rolls back an already-created ticket. Client reports partial success and retries failed files against that ID. Single-file retries after an ambiguous network result first reload attachment metadata to avoid blindly re-uploading a completed file. Existing attachment bytes/paths stay unchanged. Comments/attachments are allowed in all statuses for the matrix's permitted roles.

### Requester list query — ED-08 compatibility

| Parameter | Contract |
|---|---|
| search | Trimmed substring, 0–200 characters, case-insensitive OR over ticketNumber/summary/description |
| categoryId | Positive category ID; syntactically valid absent ID matches no rows |
| status / currentStatus | One of eight enum values; alias pair must agree if both supplied |
| priority / requestedPriority | LOW/MEDIUM/HIGH/CRITICAL; alias pair must agree |
| sortBy | createdAt (default), updatedAt, ticketNumber, requestedPriority, currentStatus |
| sortOrder | asc or desc (default desc) |
| page | Positive integer, default 1 |
| pageSize / limit | Default 10 (Phase 2.2); allowed 5/8/10/20/50; aliases must agree. UI sends 10. Explicit legacy 8 remains valid; only the omitted-size default changes |

Absent filters mean All; clients omit “ALL” sentinel values. Unknown query names/invalid enums/sort/page produce 400 (explicit tightening of old permissive defaults). Sort ID in the same direction as deterministic secondary order. Priority ascending order LOW, MEDIUM, HIGH, CRITICAL; status ascending order NEW, OPEN, IN_PROGRESS, WAITING_FOR_REQUESTER, RESOLVED, CLOSED, REOPENED, CANCELLED; desc reverses. Ordering must be explicit, not accidentally depend on enum append order.

`pagination = { total, totalItems, page, currentPage, pageSize, limit, totalPages }`: total=totalItems, page=currentPage, pageSize=limit, totalPages=max(1,ceil(total/pageSize)). Out-of-range positive page returns empty data without clamping. Count and records use identical filters; no transaction is required merely to freeze pagination during concurrent edits. Counts may change between requests and normal refresh reconciles them. Keep alias metadata for Lab 2 consumers. TicketRow.attachmentCount is canonical; list UI must not expect an attachments array.

## 5. IT Staff queue and ticket operations

Normal **S** may use every endpoint in this section. Normal **A** may use **PATCH `/staff/tickets/:id/priority` only**, by explicit Lab 3 §4.5 permission. The other endpoints remain S-only under the approved Administrator authorization matrix (ED-05), not handout prohibitions; ED-06 workflow and limited concurrency scope are approved in Phase 2.2. A reads supporting detail via GET `/tickets/:id` in §4; being an eligible owner does not authorize claim/reassignment. The `/staff/` prefix is not an authorization rule: middleware must allow S/A on priority and still deny A on queue, Staff-detail alias, assignee lookup, claim, owner and status routes. Apply role checks independently of ticket existence.

| Method / path | Request | Success | Validation / additional errors |
|---|---|---|---|
| GET `/staff/tickets` | Queue query below | 200 `{ data: TicketRow[], pagination }`, includes requester | 400 invalid query |
| GET `/staff/tickets/:id` | None | 200 TicketDetail | 404 missing |
| GET `/staff/assignees` | None | 200 OwnerRef[] of active IT_STAFF/ADMINISTRATOR, sorted name then id | Does not expose account-management data; never includes Requesters |
| POST `/staff/tickets/:id/claim` | `{}` | 200 TicketDetail with owner=session user | Atomic claim only if currently unassigned; 409 ALREADY_ASSIGNED if another claim won; no automatic status change |
| PATCH `/staff/tickets/:id/owner` | `{ ownerId }`; ownerId is a positive integer or null | 200 TicketDetail | 400 invalid/inactive/ineligible owner; validate eligibility together with the write; null explicitly unassigns |
| PATCH `/staff/tickets/:id/priority` | Normal S or A; `{ itPriority }`; S any ticket; A any accessible ticket, not owner-only (approved ED-05; same general detail scope) | 200 TicketDetail | 400 invalid enum; R is 403; never accepts requestedPriority. Same CSRF, active-session/password-change gate and field validation for S/A; no version precondition or stale-version conflict |
| PATCH `/staff/tickets/:id/status` | `{ currentStatus, confirmed?: boolean, reason?: string }` | 200 TicketDetail | Apply specification §6.2 exactly. 400 missing required confirmation/reason or bad enum; 409 invalid/self edge or missing eligible owner under current stored state. Cancellation/reopening creates public reason comment atomically |

No Ticket version column or client concurrency token is required. Use field-specific updates; actual owner/priority/status changes update existing updatedAt, while no-op owner/priority requests return 200 unchanged. Ordinary same-field priority/reassignment writes use the last successful write; there is no generic stale-form rejection. Check status against current stored state atomically with the transition and any reason comment/indication reset; invalid/self transitions return 409. Claim must be conditional on unassigned state. Coordinate assignment eligibility with account deactivation/unassignment using only the targeted transaction/locks necessary to preserve an active eligible owner or null. Administrator priority changes follow identical field validation and do not grant assignment/status/posting rights. Do not introduce a blanket optimistic-locking framework; reconsider it only if later implementation evidence proves it necessary.

Staff queue shares Requester search/category/status/priority parameters and sorting validation, with differences: default pageSize=10; supported sizes 10/20/50; additional `itPriority`, `ownerId` (positive ID or literal `unassigned`); additional sortBy `itPriority`. No requester scope is applied. Known nonexistent owner IDs match no rows. Defaults are createdAt desc, id desc. No advanced dashboard or multi-column sorting UI is included.

## 6. Public Comments, Internal Notes, resolution indication

| Method / path | Authorization / request | Success | Validation / additional errors |
|---|---|---|---|
| GET `/tickets/:id/comments` | Normal R own, S any, A any; `page=1`, `pageSize=10` (allowed 10/20/50) | 200 `{ data: Entry[], pagination: { page, pageSize, totalItems, totalPages } }` | Stable createdAt asc/id asc; 400 invalid page; 404 missing/cross-requester |
| POST `/tickets/:id/comments` | Normal R own or S any; `{ body }` | 201 Entry | Trim body 1–4000 characters; reject author/time overrides; A is 403 |
| GET `/tickets/:id/notes` | Normal S or A; same pagination | 200 paginated Entry list | R always 403 before ticket lookup; never disclose content/counts via another route |
| POST `/tickets/:id/notes` | Normal S only; `{ body }` | 201 Entry | Trim body 1–4000; A/R always 403; no editing/deletion |
| POST `/tickets/:id/resolution-indication` | Normal R own; `{}` | 200 `{ ticketId, currentStatus, resolutionSuggestedAt, resolutionSuggestedById }` | 409 in RESOLVED/CLOSED/CANCELLED. Atomic status check+write; repeated active-cycle request returns existing indication. S/A are 403 |

Every entry's author/time comes from backend state. React renders body as plain text with preserved line breaks; do not parse user HTML. Comments/notes do not alter status or ticket-header updatedAt; queue Last Updated means ticket-header/operational update, not latest discussion. A newly written resolution indication updates the existing updatedAt timestamp; a repeat does not. Reopening clears it within the status transaction. This is a latest-cycle signal, not an audit-history subsystem.

## 7. Administrator user APIs

Only normal **A**. Name trimmed 1–100 characters; email trimmed, valid basic email syntax, <=254 characters, normalized lowercase uniqueness; exactly one role enum; isActive must be boolean. No department/photo/multiple-role fields. Never return initial passwords or passwordHash.

| Method / path | Request | Success | Validation / additional errors |
|---|---|---|---|
| GET `/admin/users` | Optional `search` trimmed 0–200 substring over name/email; optional `role` enum | 200 `{ data: AdminUser[] }`, name asc/id asc | 400 invalid/unknown query; no pagination or advanced sorting |
| POST `/admin/users` | `{ name, email, role, isActive, initialPassword }` all required | 201 AdminUser, mustChangePassword=true | 400 invalid input/role/password; 409 DUPLICATE_EMAIL; hash before storing, no plaintext response |
| PATCH `/admin/users/:id` | At least one of `{ name, email, role, isActive }`; no concurrency token | 200 AdminUser | 400 invalid fields; 409 duplicate/self-deactivation/last-admin; role/email/activation changes revoke as specified |
| POST `/admin/users/:id/initial-password` | `{ initialPassword }` | 200 AdminUser with mustChangePassword=true | 400 password invalid; revoke all target sessions, do not activate an inactive account |

Account updates require no timestamp/version token and do not reject an ordinary edit merely because a form was opened earlier. Write only submitted allowed fields; same-field basic edits use the last successful write, and updatedAt remains ordinary metadata. Enforce normalized-email uniqueness with a database constraint and map collisions to 409 DUPLICATE_EMAIL. For changes that could remove an active Administrator, protect the current last-admin check and update in a short transaction with a shared database lock; concurrent demotions/deactivations must leave at least one active Administrator. Use targeted transactions for credential/security changes and their session revocation, and for owner ineligibility and unassignment. Do not serialize unrelated account edits or add a general conflict-token/retry framework.

Self-deactivation is always rejected. Demoting/deactivating the last active Administrator is rejected. Other role changes are allowed, including Requester-to-Staff with existing submitted tickets; preserve their submitter/history relationships. When an owner becomes inactive/ineligible, clear ownerId on their tickets and update their existing updatedAt timestamps in the transaction. An Administrator resetting their own password loses the current session and returns to login; subsequent login requires change.

## 8. Compatibility, planned implementation boundaries and review

Expected future touchpoints: server app composition and new auth/authorization/routes/services modules; client api.ts/AuthContext/App/Header and ticket components; Prisma schema/migrations/seed; environment examples and package lockfiles. **None are changed by Phase 2.** Public Lab 1 health/reference contracts survive. Historical Lab 2 tests using `prisma.requesterUser`/header identity must be adapted to `prisma.user`/authenticated agents, preserving business assertions.

ED-01–10 are approved by the user through Phases 2.1 and 2.2 on 2026-09-15. The approved Administrator matrix remains unchanged. Phase 2.2 sets default page size 10 and removes broad optimistic locking/client version tokens; 409 remains for actual business conflicts. Package compatibility, safe local provisioning, migration preflight and test-environment verification are future implementation checks, not pending engineering-policy approvals. No unresolved policy choice currently blocks implementation; application implementation is outside this documentation-only phase.
