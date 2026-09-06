# Lab 2 Sprint Engineering Specification

## 1. Sprint Goal
Deliver a robust, secure, and responsive MVP Requester-facing IT Ticketing experience (TokTickIT) adhering to the Zen Green Theme. The increment enables end users to select a temporary Development Requester persona, submit categorized IT tickets with validated attachments (up to 5 files, 5MB max, JPG/PNG/WEBP/PDF), browse and filter their own tickets via search, sorting, and pagination, view read-only ticket details with strict cross-requester access isolation, and perform soft removal of attachments with mandatory audit reasons.

## 2. Stakeholder Request Interpretation
The IT department requires an accessible self-service ticketing portal where employees (Requesters) can report IT issues, classify problem categories and affected systems, submit supporting screenshot/document evidence, and track ticket status updates. Because production authentication is scheduled for Lab 3, Lab 2 must provide a simulated Development Requester switcher to enable multi-persona testing while enforcing strict data isolation so that no Requester can inspect or mutate another user's tickets or attachments.

## 3. Scope

### Included
- **Development Requester Persona Selector:** A dedicated simulation screen and application shell header component to switch active requesters during development/testing.
- **Ticket Creation (Create Mode):** Form capturing Category, Related System, Requested Priority, Summary, Description, and file attachments with real-time and submit-time validation, automatic unique Ticket Number generation (`TKT-YYYY-XXXXXX`), and immediate feedback.
- **My Tickets List:** Requester-isolated paginated ticket list featuring full-text search (ticket number/summary), multi-field filtering (category, priority, status), column sorting (e.g., date, priority), page navigation, and distinct empty vs. no-results states.
- **Requester Ticket Detail (View Mode):** Read-only inspection of ticket metadata, categorizations, timestamps, and attachment list.
- **Attachment Lifecycle & Soft Removal:** File upload validation (type and size restrictions), active attachment download, and soft removal requiring a mandatory reason with retained metadata for audit trails.
- **Cross-Requester Authorization Protection:** Strict backend enforcement preventing access to tickets or attachments belonging to other requesters (HTTP 403/404).
- **Zen Green UI Foundation & Responsive Design:** High-polish design system implementation across Desktop (≥992px), Tablet (768–991px), and Mobile (<768px).
- **Comprehensive Test Suite:** Unit, API/integration, UI component, UI responsive, and Playwright E2E tests.

### Excluded
- Real production authentication (passwords, JWT/sessions, OAuth, registration) — deferred to Lab 3.
- IT Staff queues, ticket claiming, ticket assignment, and IT Priority edits.
- Ticket collaboration features (Public Comments, Internal Notes, Actions Taken).
- Post-creation ticket lifecycle transitions (e.g., In Progress -> Resolved, Closed, Reopened).
- Administrative functions (managing categories, related systems, or requester accounts).

## 4. Functional Requirements
- **FR-01 (Requester Context):** The system shall provide a Development Requester selector listing all active requesters loaded from PostgreSQL. Selecting a requester sets the active session context across the application.
- **FR-02 (Create Ticket):** The system shall allow an active Requester to submit a support ticket containing Category, Related System, Requested Priority, Summary, Description, and up to 5 attachments.
- **FR-03 (Auto Ticket Number):** The system shall automatically generate a unique, sequential/formatted official Ticket Number (e.g., `TKT-2026-000001`) on the backend upon creation.
- **FR-04 (My Tickets Listing):** The system shall display a paginated list containing only tickets owned by the currently selected Requester.
- **FR-05 (Search & Filter):** The system shall allow searching tickets by Ticket Number or Summary, and filtering by Category, Requested Priority, and Current Status.
- **FR-06 (Sorting & Pagination):** The system shall support sorting by creation date, priority, or status, and navigating through paginated results (e.g., 8 or 10 tickets per page).
- **FR-07 (Ticket Detail View):** The system shall render a read-only Ticket Detail view displaying full ticket attributes, system-assigned values, timestamps, and the attachment collection.
- **FR-08 (Attachment Upload):** The system shall accept supported file types (JPG, JPEG, PNG, WEBP, PDF) up to 5 MB each, enforcing a maximum of 5 active attachments per ticket.
- **FR-09 (Attachment Download):** The system shall allow the ticket owner to download active attachments securely.
- **FR-10 (Soft Removal of Attachment):** The system shall allow the ticket owner to soft-remove an active attachment by supplying a required removal reason, instantly disabling file download while retaining file metadata and audit history.
- **FR-11 (Cross-Requester Isolation):** The system shall reject unauthorized attempts to retrieve, download, or modify tickets and attachments belonging to a different Requester with appropriate HTTP status codes (403/404).

## 5. Business Rules
- **BR-01 (Unique Ticket Number):** The official Ticket Number is generated strictly by the backend and must be globally unique across all tickets.
- **BR-02 (Initial Ticket State):** A newly created ticket always begins with `currentStatus = 'New'`.
- **BR-03 (Testing Identity Context):** The Development Requester selector is solely a development and testing mechanism and must never be treated as secure authentication.
- **BR-04 (Active Requesters Only):** Inactive Requesters (`isActive = false`) must never appear in the Development Requester selection dropdown and cannot be used as an active context.
- **BR-05 (Ownership Isolation):** A Requester can only view, search, and access tickets where `requesterId` matches their active session context. Cross-requester queries must never leak data.
- **BR-06 (Attachment File Constraints):** Only files with MIME types `image/jpeg`, `image/png`, `image/webp`, and `application/pdf` are accepted. Files exceeding 5 MB (5,242,880 bytes) must be rejected with a clear error.
- **BR-07 (Maximum Active Attachments):** A ticket may have at most 5 active (`isRemoved = false`) attachments at any time.
- **BR-08 (Soft Removal Auditability):** Attachment deletion is strictly non-destructive (soft removal). The system sets `isRemoved = true`, logs `removedAt` timestamp, and records `removalReason`. Soft-removed files cannot be downloaded or previewed by any user.
- **BR-09 (Mandatory Field Validation & Trimming):** Summary and Description are mandatory fields. Leading and trailing whitespace must be trimmed before validation. Blank or whitespace-only inputs are invalid.
- **BR-10 (Duplicate Submission Prevention):** When submitting a ticket or attachment, the UI submit button must immediately enter a disabled, busy state with a spinner to prevent duplicate submissions.
- **BR-11 (Form Failure State & Data Preservation):** If ticket submission fails due to an API or network error, entered form data and selected attachments must be preserved so the user does not lose input.
- **BR-12 (Cross-Requester Access Denial):** Direct API requests to view, download, or soft-remove resources belonging to another requester must return HTTP 403 Forbidden or HTTP 404 Not Found.
- **BR-13 (Default Sorting):** The My Tickets list must default to sorting by creation timestamp descending (`createdAt DESC`).
- **BR-14 (Default Priority):** If not explicitly selected, Requested Priority defaults to `MEDIUM`. Initial IT Priority defaults to `MEDIUM` upon creation.
- **BR-15 (Future Auth Transition):** The database and API contract must keep `requesterId` cleanly decoupled so that switching to JWT/Session authentication in Lab 3 requires zero schema rework.

## 6. UI Specification Summary
- **Color Palette (Zen Green Theme):**
  - Primary Green: `#006B3C` (Header bar, Primary CTAs, active highlights)
  - Secondary Green: `#0B7A46` (Hover states, focus rings, active tab accents)
  - Pale Green: `#EAF6EF` (Selected rows, subtle badge background, success callouts)
  - Page Background: `#F5F7F6` (Quiet near-white base canvas)
  - Card Surface: `#FFFFFF` (Subtle 1px border `#E5E7EB` with soft shadow)
  - Text Primary: `#1F2937` (Dark charcoal-green readability)
  - Status/Priority Badges: High/Pending (Amber `#D97706` / `#FEF3C7`), New/Open/Low (Blue/Neutral), Resolved/Success (Green `#16A34A` / `#DCFCE7`), Error (Red `#DC2626` / `#FEE2E2`).
- **Field Placement & Validation:**
  - Red asterisk (`*`) indicates mandatory fields.
  - Validation error messages appear immediately beneath the offending control in dark red (`#DC2626`).
  - Read-only fields use shaded backgrounds (`#F3F4F6` / `#EAEFEA`) with clear distinction from editable inputs.
- **Responsive Layout Breakpoints:**
  - **Desktop (≥ 992px):** Multi-column form layout, wide table view for My Tickets, centered layout with maximum container width (1200px).
  - **Tablet (768–991px):** Two-column form layout, collapsible filter bar, responsive data table with scrollable or stacked columns.
  - **Mobile (< 768px):** Single-column stacked fields, full-width touch-friendly buttons (min height 44px), card-based ticket list, zero horizontal viewport overflow.
- **Referenced Specification:** Full details, typography, and component states are defined in `docs/lab-02/ui-spec.md`.

## 7. Data Changes & Database Design

### 7.1 Schema Models (PostgreSQL via Prisma)
- **`RequesterUser`**:
  - `id` (Int, PK, autoincrement)
  - `name` (String)
  - `email` (String, Unique)
  - `isActive` (Boolean, default: true)
  - `createdAt`, `updatedAt` (DateTime)
- **`Category`**:
  - `id` (Int, PK, autoincrement)
  - `name` (String, Unique)
  - `isActive` (Boolean, default: true)
  - `createdAt` (DateTime)
- **`RelatedSystem`**:
  - `id` (Int, PK, autoincrement)
  - `name` (String, Unique)
  - `isActive` (Boolean, default: true)
  - `createdAt` (DateTime)
- **`Ticket`**:
  - `id` (Int, PK, autoincrement)
  - `ticketNumber` (String, Unique, Indexed)
  - `summary` (String)
  - `description` (Text)
  - `requestedPriority` (Enum: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`, default: `MEDIUM`)
  - `itPriority` (Enum: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`, default: `MEDIUM`)
  - `currentStatus` (Enum: `NEW`, `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`, default: `NEW`)
  - `requesterId` (Int, FK -> `RequesterUser.id`)
  - `categoryId` (Int, FK -> `Category.id`)
  - `relatedSystemId` (Int, FK -> `RelatedSystem.id`)
  - `createdAt`, `updatedAt` (DateTime)
- **`Attachment`**:
  - `id` (Int, PK, autoincrement)
  - `ticketId` (Int, FK -> `Ticket.id`, onDelete: Cascade)
  - `fileName` (String)
  - `storedPath` (String)
  - `fileSize` (Int)
  - `mimeType` (String)
  - `isRemoved` (Boolean, default: false)
  - `removedAt` (DateTime, nullable)
  - `removalReason` (String, nullable)
  - `createdAt` (DateTime)

### 7.2 Justified Database Design Decisions
1. **Composite Index on Ticket Query Filters `(requesterId, createdAt DESC)` & `(requesterId, currentStatus)`:**
   - *Rationale:* Since all Requester queries are strictly partitioned by `requesterId` and sorted by date, composite indexes ensure sub-millisecond query performance and eliminate full-table scans as ticket volume scales.
2. **Soft Deletion Pattern for Attachments (`isRemoved`, `removedAt`, `removalReason`):**
   - *Rationale:* IT enterprise compliance requires permanent audit logs of all uploaded evidence. Hard deletes destroy provenance. Retaining metadata while blocking file streaming satisfies both security policies and forensic requirements.
3. **Dedicated Reference Tables for Categories and Related Systems:**
   - *Rationale:* Decoupling dynamic organizational IT systems and support categories into relational lookup tables with active flags (`isActive`) avoids enum schema migrations when new enterprise services are introduced.

### 7.3 Idempotent Seed Data Requirements
- **Categories (4):** Account and Access, Hardware, Software, Network.
- **Related Systems (6+):** Email, Campus Wi-Fi, VPN, LEB2 App, Grade Submission App, Printer, Corporate Laptop.
- **Requesters (5+):** At least 4 Active Requesters (e.g., Jennifer Anderson, Michael Brown, David Lee, Sarah Johnson) and at least 1 Inactive Requester (e.g., Robert Taylor [Inactive]).

## 8. API Contract Summary
- `GET /api/requesters/active` — List active development requesters.
- `GET /api/categories` — List active ticket categories.
- `GET /api/related-systems` — List active related systems.
- `POST /api/tickets` — Create a new ticket (Header: `x-requester-id`).
- `GET /api/tickets` — Retrieve paginated tickets owned by requester with filters (`search`, `categoryId`, `requestedPriority`, `currentStatus`, `sortBy`, `sortOrder`, `page`, `pageSize`).
- `GET /api/tickets/:id` — Retrieve full read-only details of an owned ticket.
- `POST /api/tickets/:id/attachments` — Upload up to 5 attachments per ticket (multipart/form-data).
- `GET /api/attachments/:id/download` — Stream active attachment binary.
- `DELETE /api/attachments/:id` — Soft-remove attachment with mandatory `{ reason: string }`.
- *Full specification with schemas and response examples is documented in `docs/lab-02/api-spec.md`.*

## 9. Acceptance Criteria

- **AC-01 (Ticket Creation Happy Path):**
  - **Given** an active Development Requester and valid form inputs (Summary, Description, Category, Related System, Priority),
  - **When** the Requester submits the Create Ticket form,
  - **Then** a Ticket is persisted with status `NEW`, an official unique Ticket Number is generated, and a success confirmation with the Ticket Number is displayed.

- **AC-02 (Form Validation on Empty/Invalid Input):**
  - **Given** the Create Ticket form is open,
  - **When** the user attempts to submit without a Summary or Description (or whitespace only),
  - **Then** submission is blocked, red validation error messages appear immediately below the respective invalid fields, and no network request is sent.

- **AC-03 (Development Requester Persona Context & Switching):**
  - **Given** the application is opened,
  - **When** the user selects Requester A from the active list,
  - **Then** the application shell reflects Requester A's identity, and changing to Requester B immediately reloads and switches all ticket queries to Requester B's scope.

- **AC-04 (Requester Data Isolation in My Tickets):**
  - **Given** Requester A has created tickets and Requester B has created tickets,
  - **When** Requester A views the My Tickets list,
  - **Then** only tickets where `requesterId == Requester A` are returned, and none of Requester B's tickets are visible.

- **AC-05 (Ticket Search, Filtering, and Pagination):**
  - **Given** a Requester has multiple submitted tickets,
  - **When** filtering by Category/Status or searching by ticket summary keywords,
  - **Then** the list updates to display matching tickets, showing correct pagination counts and page numbers.

- **AC-06 (Cross-Requester Ticket Detail Access Rejection):**
  - **Given** Ticket #100 belongs to Requester A and the active user is Requester B,
  - **When** Requester B attempts to open `GET /api/tickets/100` directly,
  - **Then** the system rejects the request with HTTP 403 Forbidden or 404 Not Found and displays an unauthorized error state.

- **AC-07 (Attachment Upload Validation & Size Constraints):**
  - **Given** a ticket creation or detail form,
  - **When** the user attaches a file larger than 5 MB or of an unsupported MIME type (e.g., `.exe`),
  - **Then** the file is rejected with an inline error message and is not uploaded.

- **AC-08 (Attachment Soft Removal & Blocked Download):**
  - **Given** an active attachment on an owned ticket,
  - **When** the Requester provides a removal reason and confirms removal,
  - **Then** `isRemoved` is set to `true`, the attachment displays a `Removed` badge with the reason, and subsequent download requests return HTTP 403.

- **AC-09 (Duplicate Submission Prevention):**
  - **Given** a filled ticket form,
  - **When** the user clicks Submit,
  - **Then** the button immediately enters a disabled busy state with spinner until response completion.

- **AC-10 (Network Failure Data Preservation):**
  - **Given** the backend API is unreachable or returns a 500 error during submission,
  - **When** ticket submission fails,
  - **Then** a global error banner appears while all entered form values and attachments remain preserved in the inputs.

## 10. Definition of Done

### Part 1: Product Completion
- [ ] All Functional Requirements (FR-01 through FR-11) and Business Rules (BR-01 through BR-15) are fully implemented.
- [ ] All Acceptance Criteria (AC-01 through AC-10) pass automated test suites with 100% assertions green.
- [ ] Server APIs implement comprehensive input validation, status codes, and cross-requester protection.
- [ ] Responsive UI verified on Desktop (≥992px), Tablet (768–991px), and Mobile (<768px) with zero layout clipping or horizontal overflow.
- [ ] Prisma migrations and idempotent seed scripts run reliably without creating duplicate records.
- [ ] All planned automated test files in `server/tests/lab-02/`, `client/src/tests/lab-02/`, and `e2e/lab-02/` pass without skipped or flaky tests.

### Part 2: Course Delivery Requirements
- [ ] GitHub feature branches created for each of the 7 sprint issues and merged into `lab2-staging` via PR.
- [ ] Release PR opened from `lab2-staging` to `main`.
- [ ] Peer review comments, responses, and approvals documented in `docs/lab-02/reviewer.md`.
- [ ] AI prompt log and engineering reflection documented in `docs/lab-02/ai-use.md`.
- [ ] All visual screenshots captured into `artifacts/lab-02/screenshots/` according to the required directory structure.

## 11. Assumptions and Decisions
1. **Temporary Authentication Header:** In the absence of session cookies/JWT tokens in Lab 2, the HTTP header `x-requester-id` represents the authenticated requester identity for all API calls. The backend extracts and validates this integer against active database requesters.
2. **Attachment Storage Strategy:** Attachments are stored on the server's local filesystem (`uploads/lab-02/`) with cryptographically unique UUID filenames to prevent path traversal and filename collisions, while preserving original filenames in the database.
3. **Ticket Number Format:** The official ticket number is structured as `TKT-YYYY-XXXXXX` (e.g. `TKT-2026-000001`) with sequential zero-padded integers reset or continuous per year.
4. **Soft Removal Modal:** To ensure high UX usability and avoid accidental removals, clicking "Remove" on an attachment triggers a modal prompt requiring a non-empty text justification before executing the soft deletion.