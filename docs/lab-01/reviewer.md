# Lab 1 — Peer Review Record

**Author:** Songwit Rueangsawat — 67070501060 — GitHub: @R1NNE0  
**Peer reviewer:** Thanawat Suntarawattana — 67070501022 — GitHub: @Maibokdaimhai  
**Partner I review:** Tanadet Nuchaikaew — 67070501081 — GitHub: @Kawi-HBLI  

---

## Pull Requests I authored (reviewed by my partner)

| PR | Branch | Reviewer verdict |
|:---:|---|:---:|
| #7 | feature/1-project-foundation | Approved |
| #8 | feature/2-health-check | Approved |
| #9 | feature/3-category-seed | Approved |
| #10 | feature/4-category-list | Approved |

### feat: set up project foundation (Issue #1)
- **PR Link:** [#7](https://github.com/R1NNE0/toktickit/pull/7)

**Reviewer comment I received:**
> All setup verification tests passed successfully and ready to merge! 🚀
> 
> **Verification Checklist:**
> - [x] Frontend (React + TS + Vite): Started & verified Bootstrap UI rendering.
> - [x] Backend (Node.js + Express + TS): Up and running.
> - [x] Database & ORM: PostgreSQL connected & Prisma initialized.
> - [x] Testing Setup: Vitest & Supertest configured.
> - [x] Docs: Initial setup instructions added to README.md.

**How I responded:**
> Thanks for the thorough review and verification.
> 
> I've verified that all foundational setups are functioning as expected. Merging this PR into lab1-staging now so I can move forward with the next issues.

---

### feat: implement API health check (Issue #2)
- **PR Link:** [#8](https://github.com/R1NNE0/toktickit/pull/8)

**Reviewer comment I received:**
> **Issue 2 Status Checklist:**
> - [x] GET /api/health returns HTTP 200
> - [x] JSON response contains status = ok and service = TokTickIT API
> - [x] Supertest test passes
> - [ ] React page displays backend status based on real API call
> - [ ] Useful error message appears when backend is unavailable
> 
> **Feedback:**  
> The backend API and Supertest tests look great and pass cleanly! However, the frontend client implementation is missing:
> 
> Please update `client/src/api.ts` and `client/src/App.tsx` so clicking `[Check System]` calls `/api/health`.  
> Display `System Status: Online` on success, and `System Status: Offline` with an error message when the backend is down.

**Reviewer comment I received:**
> **Approve!**
> 
> **Issue 2 Status Checklist:**
> - [x] GET /api/health returns HTTP 200
> - [x] JSON response contains status = ok and service = TokTickIT API
> - [x] Supertest test passes
> - [x] React page displays backend status based on real API call
> - [x] Useful error message appears when backend is unavailable

**How I responded:**
> Thank you for the detailed feedback and the approval.
> 
> I've addressed the missing frontend integration by connecting the `[Check System]` button to `GET /api/health` and handling both the Online and Offline (with error message) UI states properly. Merging this PR into lab1-staging now.

---

### feat: create category model and seed initial data (Issue #3)
- **PR Link:** [#9](https://github.com/R1NNE0/toktickit/pull/9)

**Reviewer comment I received:**
> **Approved ✅**
> 
> **Acceptance Criteria Checklist:**
> - [x] Prisma Category Model: Defined with id (autoincrement), name (unique), and createdAt.
> - [x] Database Migration: Generated initial SQL migration creating the Category table and unique index.
> - [x] Seeded Categories: Successfully seeds the 4 categories (Account and Access, Hardware, Software, Network).
> - [x] Idempotency Verified: Ran npm run prisma:seed multiple times consecutively with no duplicate key errors.
> - [x] Secrets Protected: `server/.env` is excluded via `.gitignore` and database credentials remain untracked.

**How I responded:**
> Thanks for verifying the database migration and seeding logic.
> 
> I'm glad the idempotency checks and secret protections all passed smoothly. Merging this PR into lab1-staging now so I can proceed with Issue 4.

---

### feat: display IT request category list and integrate API (Issue #4)
- **PR Link:** [#10](https://github.com/R1NNE0/toktickit/pull/10)

**Reviewer comment I received:**
> **Acceptance Criteria Checklist:**
> - [x] Backend Endpoint: GET /api/categories returns HTTP 200 OK with { id, name } categories ordered by id ascending.
> - [x] Error Handling: Returns safe HTTP 500 response on database failure.
> - [x] Supertest Test: Enabled and passing in `server/tests/lab-01/categories.test.ts`.
> - [x] Frontend API & UI: `checkSystem()` fetches both endpoints and `App.tsx` dynamically renders the 4 categories on Online status.
> - [x] Frontend Vitest Tests: Enabled and passing in `client/tests/lab-01/App.test.tsx` (heading, success state, and offline error state).
> 
> **Reviewer Feedback:**  
> Awesome work on Issue 4! The full-stack integration between Express, Prisma, PostgreSQL, and React works seamlessly. All backend Supertest tests and frontend Vitest UI tests pass cleanly.
> 
> PR is approved and ready to merge into lab1-staging! Great job completing Lab 1! 🎉

**How I responded:**
> Thank you so much for the review, feedback, and approval.
> 
> It's great to see the full-stack integration and all test suites passing seamlessly across both client and server. Merging this final PR into lab1-staging now to complete Lab 1, Great teamwork.

---

## Pull Requests I reviewed for my partner

### feat: complete project foundation (Issue 1)
- **PR Link:** [#5](https://github.com/Kawi-HBLI/TokTickIT/pull/5)

**My comment:**
> ### PR Review: Issue 1 (Set up TokTickIT project foundation)
> 
> **Checklist:**
> - [x] Project structure is properly separated into `client/` and `server/`
> - [x] Environment templates (`.env.example`) are provided in both directories
> - [x] `.gitignore` correctly prevents tracking of `.env` and `node_modules`
> - [x] Vitest configuration and starter test suites are in place
> - [x] `docker-compose.yml` and `docs/lab-01/` documentation templates exist
> 
> **Verdict:**  
> LGTM! Everything is well-structured and satisfies all Issue 1 requirements. Approved.

**Partner's response:**
> Thank you for the review! The foundation is solid, and we are ready to move forward. Also, apologies for not giving you the write permission earlier to merge this PR. I've just added you as a collaborator, so from the next issue onwards, you'll be able to hit the merge button yourself!

---

### feat: implement GET /api/health endpoint (Issue 2)
- **PR Link:** [#6](https://github.com/Kawi-HBLI/TokTickIT/pull/6)

**My comment:**
> ### PR Review: Issue 2 (Implement API health check)
> 
> **Acceptance Criteria Checklist:**
> - [x] Backend `GET /api/health` returns HTTP 200 with `{ status: "ok", service: "TokTickIT API" }`
> - [x] Supertest test suite passes on the server
> - [ ] React UI calls `GET /api/health` on clicking `[Check System]`
> - [ ] UI displays `System Status: Online` on success
> - [ ] UI displays `System Status: Offline` with a helpful error message when the backend is unreachable
> 
> ---
> 
> **Feedback & Requested Changes:**  
> The backend implementation and Supertest tests are complete and working well! 
> 
> However, the frontend client side has not been implemented yet:
> 1. Update `client/src/api.ts` to export a function (e.g., `getHealthStatus()`) that fetches `GET /api/health`.
> 2. Update `client/src/App.tsx` so clicking the **[Check System]** button triggers this API call.
> 3. Handle UI states properly: render **"System Status: Online"** on success, and **"System Status: Offline"** with an informative error message on failure.
> 
> Please push these frontend changes to this branch so we can verify and approve the PR.

**Partner's response:**
> Good catch! You're absolutely right. I completely forgot to implement the frontend part of Issue 2. I've just pushed a new commit that updates `api.ts` to properly fetch `/api/health`, and updated `App.tsx` to handle the state and display the Online / Offline UI. Could you please take another look and merge if it's good?

**My comment:**
> ### PR Review: Issue 2 (Implement API health check) — Approved ✅
> 
> **Acceptance Criteria Checklist:**
> - [x] Backend `GET /api/health` returns HTTP 200 with `{ status: "ok", service: "TokTickIT API" }`
> - [x] Supertest test suite passes on the server
> - [x] React UI calls `GET /api/health` on clicking `[Check System]`
> - [x] UI displays `System Status: Online` on success
> - [x] UI displays `System Status: Offline` with a helpful error message when backend is unreachable
> 
> ---
> 
> **Feedback:**  
> Great work addressing the frontend integration! 
> 
> The `getHealthStatus()` function in `client/src/api.ts` connects properly to the backend, and `App.tsx` now handles loading, online, and offline error states cleanly. All test suites pass.
> 
> This PR is approved and ready to merge into `lab1-staging`.

**Partner's response:**
> Thanks for the detailed review and approval! I'll merge it into lab1-staging now.

---

### feat: create and seed IT request categories (Issue 3)
- **PR Link:** [#7](https://github.com/Kawi-HBLI/TokTickIT/pull/7)

**My comment:**
> ### PR Review: Issue 3 (Create and seed IT request categories) — Approved ✅
> 
> **Acceptance Criteria Checklist:**
> - [x] Prisma `Category` model exists with `id` (autoincrement), unique `name`, and `createdAt`
> - [x] Database migration/schema successfully creates the `Category` table
> - [x] Seed script inserts all 4 required categories: `Account and Access`, `Hardware`, `Software`, `Network`
> - [x] Idempotency verified: `prisma.category.upsert()` is used and safe to run multiple times without duplicates
> - [x] Database credentials and secrets are safely ignored via `.gitignore`
> 
> ---
> 
> **Feedback:**  
> Excellent job on the database model and seeding implementation! 
> 
> - The `Category` model schema perfectly matches the specifications.
> - Tested `npx prisma db push` and ran `npx prisma db seed` multiple times without duplicate key errors.
> - Everything runs cleanly and credentials remain untracked.
> 
> This PR is approved and ready to merge into `lab1-staging`.

**Partner's response:**
> Thanks for the review and verifying the database changes! I'm glad the upsert logic works cleanly. I'll merge this into lab1-staging now.

---

### feat: display the IT request category list (Issue 4)
- **PR Link:** [#8](https://github.com/Kawi-HBLI/TokTickIT/pull/8)

**My comment:**
> ### PR Review: Issue 4 (Display IT request category list) — Approved ✅
> 
> **Acceptance Criteria Checklist:**
> - [x] Backend endpoint `GET /api/categories` returns HTTP 200 with categories in predictable order
> - [x] Backend handles failures gracefully with HTTP 500
> - [x] Supertest suite passes for `categories.test.ts`
> - [x] Frontend `checkSystem()` / `getCategories()` properly integrated
> - [x] React UI dynamically renders the category list on `Online` status and handles loading/error states
> - [x] Frontend Vitest component tests pass cleanly
> 
> ---
> 
> **Feedback:**  
> Fantastic job! The end-to-end integration between Express, Prisma, PostgreSQL, and React works seamlessly, and all test suites pass without issues. 
> 
> This PR is approved and ready to merge into `lab1-staging`. Great work wrapping up Lab 1.

**Partner's response:**
> Thank you for the review and approval! Glad to hear that the end-to-end integration and tests worked smoothly on your side. Appreciate your time and feedback.
