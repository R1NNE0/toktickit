# Lab 2 Test Plan and Traceability

## 1. Test Strategy
The testing approach for TokTickIT Lab 2 follows a multi-tiered Test-Driven Development (TDD) strategy to guarantee quality, security isolation, and UI responsiveness:
1. **Unit & API Integration Tests (Server - Vitest / Supertest):** Verify route handlers, database operations, input validation, auto-generated Ticket Number logic, query filters, pagination, attachment size/type limits, and cross-requester access blocking (403/404).
2. **UI Component Tests (Client - Vitest / React Testing Library):** Validate form validation errors, disabled/busy submit button states, dynamic table/card rendering, badge styling, and attachment removal modal interactions.
3. **Responsive & Visual Checks:** Verify layouts on Desktop (1280px), Tablet (768px), and Mobile (375px) viewports with zero horizontal scrolling or clipping.
4. **End-to-End (E2E) Tests (Playwright):** Simulate complete user journeys from persona selection to ticket creation, attachment upload, My Tickets search/filter, and soft-removing attachments.

---

## 2. Planned Tests Table

| Test ID | Level | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final Status |
| :--- | :---: | :---: | :--- | :--- | :--- | :---: |
| **API-01** | API | FR-02, AC-01 | Create ticket with valid data & requester context | 201 Created; returns ticket with unique `TKT-YYYY-XXXXXX` and status `NEW` | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| **API-02** | API | BR-09, AC-02 | Create ticket with missing or whitespace Summary/Description | 400 Bad Request; field-level validation errors returned | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| **API-03** | API | FR-04, AC-04 | List tickets for active Requester A | 200 OK; returns only tickets where `requesterId == Requester A` | `server/tests/lab-02/my-tickets.api.test.ts` | Planned |
| **API-04** | API | FR-05, AC-05 | Search by summary and filter by category/priority/status | 200 OK; filtered data matching query criteria | `server/tests/lab-02/my-tickets.api.test.ts` | Planned |
| **API-05** | API | FR-06, AC-05 | Pagination on ticket list (page, pageSize) | 200 OK; paginated slice with total count and totalPages metadata | `server/tests/lab-02/my-tickets.api.test.ts` | Planned |
| **API-06** | API | FR-07, AC-04 | Get single owned ticket details | 200 OK; full ticket details with active & removed attachments | `server/tests/lab-02/ticket-detail.api.test.ts` | Planned |
| **API-07** | API | FR-11, AC-06 | Requester B attempts to fetch Requester A's ticket | 403 Forbidden or 404 Not Found; access denied | `server/tests/lab-02/ticket-detail.api.test.ts` | Planned |
| **API-08** | API | FR-08, AC-07 | Upload valid attachment (PDF/PNG <= 5MB) | 201 Created; attachment metadata saved with `isRemoved: false` | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| **API-09** | API | BR-06, AC-07 | Upload invalid file type (.exe) or oversized file (> 5MB) | 400 Bad Request / 413 Payload Too Large; upload rejected | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| **API-10** | API | BR-07, AC-07 | Upload more than 5 active attachments to a ticket | 400 Bad Request; limit exceeded error | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| **API-11** | API | FR-09, AC-08 | Download active attachment on owned ticket | 200 OK; streams binary content with correct headers | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| **API-12** | API | FR-10, AC-08 | Soft-remove attachment with mandatory reason | 200 OK; `isRemoved = true`, `removedAt` set, `removalReason` saved | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| **API-13** | API | BR-08, AC-08 | Attempt to download soft-removed attachment | 403 Forbidden; download permanently blocked | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| **API-14** | API | FR-01, BR-04 | Get active development requesters | 200 OK; returns only active requesters (`isActive = true`) | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| **UI-01** | UI | FR-02, AC-02 | Form validation on empty submit | Displays inline red error messages below inputs without calling API | `client/src/tests/lab-02/CreateTicket.test.tsx` | Planned |
| **UI-02** | UI | BR-10, AC-09 | Submit button busy state | Button disabled and displays loading spinner while submitting | `client/src/tests/lab-02/CreateTicket.test.tsx` | Planned |
| **UI-03** | UI | FR-04, AC-04 | My Tickets table rendering | Renders rows matching current requester context | `client/src/tests/lab-02/MyTickets.test.tsx` | Planned |
| **UI-04** | UI | FR-05, AC-05 | Search input and filter change interactions | Triggers data refresh with updated query parameters | `client/src/tests/lab-02/MyTickets.test.tsx` | Planned |
| **UI-05** | UI | FR-07, AC-06 | Read-only Ticket Detail view rendering | Displays read-only styled values and metadata correctly | `client/src/tests/lab-02/RequesterTicketDetail.test.tsx` | Planned |
| **UI-06** | UI | FR-10, AC-08 | Attachment soft removal modal & reason validation | Opens modal on click, requires non-empty reason, updates UI state | `client/src/tests/lab-02/AttachmentSection.test.tsx` | Planned |
| **E2E-01** | E2E | AC-01..08 | Complete Requester Flow: Select persona -> Create ticket with upload -> View in My Tickets -> Inspect detail -> Soft-remove file | 100% flow passes end-to-end; Ticket Number confirmed | `e2e/lab-02/requester-ticket-flow.spec.ts` | Planned |

---

## 3. Acceptance-Criterion Traceability Matrix

| Acceptance Criterion | Covered By Automated Tests |
| :--- | :--- |
| **AC-01** (Create valid ticket & generate number) | `API-01`, `E2E-01` |
| **AC-02** (Validation on missing summary/description) | `API-02`, `UI-01` |
| **AC-03** (Development Requester context & switching) | `API-14`, `E2E-01` |
| **AC-04** (Requester data isolation in My Tickets) | `API-03`, `API-06`, `UI-03`, `E2E-01` |
| **AC-05** (Search, filter, sorting, and pagination) | `API-04`, `API-05`, `UI-04`, `E2E-01` |
| **AC-06** (Cross-requester access rejection) | `API-07`, `UI-05` |
| **AC-07** (Attachment validation & size constraints) | `API-08`, `API-09`, `API-10` |
| **AC-08** (Attachment soft removal & blocked download) | `API-11`, `API-12`, `API-13`, `UI-06`, `E2E-01` |
| **AC-09** (Duplicate submission prevention / busy state) | `UI-02` |
| **AC-10** (Network failure state & data preservation) | `UI-01`, `E2E-01` |

---

## 4. Responsive & Visual Checklist

- [ ] **Desktop Viewport (≥ 992px / 1280px):**
  - Application header displays TokTickIT brand and active persona selector pill.
  - Multi-column form layout on Create Ticket.
  - Full data table with all 8 columns visible on My Tickets.
- [ ] **Tablet Viewport (768px – 991px):**
  - Form adapts gracefully into 2-column layout.
  - Filter bar stacks neatly without breaking page alignment.
- [ ] **Mobile Viewport (< 768px / 375px):**
  - Form fields stack vertically in single column.
  - Table transforms to touch-friendly card items.
  - Buttons maintain minimum 44px tap target.
  - Zero horizontal page scrolling.

---

## 5. Test Execution Commands

```bash
# Run server API tests for Lab 2
npm --prefix server test -- server/tests/lab-02/

# Run client UI component tests for Lab 2
npm --prefix client test -- client/src/tests/lab-02/

# Run Playwright End-to-End tests
npx playwright test e2e/lab-02/
```

---

## 6. Final Results Summary

| Test Category | Total Planned | Passed | Failed | Skipped | Status |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Server API Tests** | 14 | 0 | 0 | 0 | Pending Implementation |
| **Client UI Tests** | 6 | 0 | 0 | 0 | Pending Implementation |
| **E2E Integration** | 1 | 0 | 0 | 0 | Pending Implementation |
| **Total** | **21** | **0** | **0** | **0** | **Ready for Issue #2** |

---

## 7. Known Limitations & Deferred Features
- Full password hashing and JWT/Session token authentication are deferred to Lab 3; Lab 2 relies strictly on `x-requester-id` header simulation.
- IT Staff workflow (ticket assignment, queue management, IT Priority modifications) and ticket comments/collaboration will be implemented in subsequent labs.