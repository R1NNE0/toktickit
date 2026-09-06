# TokTickIT (ตอกติ๊กกิต) — IT Service Desk Application

> **CPE 334 Introduction to Software Engineering in the Age of AI Agents**  
> Department of Computer Engineering, King Mongkut's University of Technology Thonburi (KMUTT)  
> Semester 1/2026

![Tests](https://img.shields.io/badge/Tests-81%2F81%20Passing%20(100%25)-success?style=flat-square)
![Frontend](https://img.shields.io/badge/Frontend-React%2018%20%7C%20Vite%20%7C%20Bootstrap%205-blue?style=flat-square)
![Backend](https://img.shields.io/badge/Backend-Express%20%7C%20Node.js%20%7C%20TypeScript-green?style=flat-square)
![Database](https://img.shields.io/badge/Database-PostgreSQL%2017%20%7C%20Prisma%20ORM-indigo?style=flat-square)
![Design](https://img.shields.io/badge/Design-Zen%20Green%20System-darkgreen?style=flat-square)

TokTickIT is a full-stack IT service desk web application designed to streamline campus IT support across **Account and Access**, **Hardware**, **Software**, and **Network** domains.

Following the foundation established in Lab 1, **Lab 2: Requester Ticketing MVP with UI Foundation** introduces a complete, production-grade Requester workflow featuring ticket submission with multi-file attachments, an interactive personal ticket dashboard with search/filtering/pagination, comprehensive ticket detail views with lifecycle status audits, and the custom **Zen Green Design System**.

---

## 🌟 Core Features (Lab 2 — Requester MVP)

1. **👤 Simulated Requester Identity & Switcher**
   - Header-level user switcher to simulate authenticated requesters (e.g., Somchai Jaidee, Somsri Rakdi).
   - Global `RequesterContext` maintaining reactive session state across views.

2. **📝 Ticket Submission & File Attachments**
   - Dynamic category selection and priority flags (`LOW`, `MEDIUM`, `HIGH`, `URGENT`).
   - Multi-file attachment upload with client and server-side MIME type verification and size limits (up to 5 files, 5MB per file).
   - Client-side idempotency key safeguard to prevent accidental double-submission on network latency.

3. **📊 "My Tickets" Dashboard**
   - Real-time status filtering (`ALL`, `NEW`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`, `CANCELLED`).
   - Keyword search across Ticket ID and title.
   - Category filtering and sorting controls.
   - Dual layout: responsive tabular view on desktop and card-based layout on mobile viewports.
   - Client-side pagination with configurable page size.

4. **🔍 Ticket Detail & Lifecycle Audit Timeline**
   - In-depth ticket view displaying metadata, requester info, status badges, and description.
   - Chronological audit timeline recording state transitions and timestamps.
   - Secure file attachment download with RFC 6266 compliant UTF-8 `Content-Disposition` headers and `X-Content-Type-Options: nosniff`.
   - Soft-delete ticket cancellation (`CANCELLED`) with 409 Conflict audit guardrails against duplicate operations.

5. **🌿 Zen Green Design System**
   - Custom color tokens inspired by nature (`#2D5A27`, `#4A7C59`, `#F4F7F4`, `#1B3B1A`).
   - Accessible contrast levels (WCAG AA compliant), glassmorphism headers, responsive grids, and subtle micro-animations.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, TypeScript, Vite 6, Bootstrap 5.3, Custom Zen Green CSS |
| **Backend** | Node.js (ES Modules), Express 4, TypeScript, Multer |
| **Database & ORM** | PostgreSQL 17 (Docker Compose), Prisma ORM 5 |
| **Testing** | Vitest 2, React Testing Library, Supertest (81/81 automated tests green) |
| **DevOps & Standards** | Docker Compose, tsx, ESLint, Git PR Review Flow |

---

## 📁 Repository Structure

```text
toktickit/
├── client/                     # React + Vite + TypeScript Frontend
│   ├── src/
│   │   ├── components/         # TicketForm, TicketList, TicketDetail, UserSwitcher, etc.
│   │   ├── context/            # RequesterContext (simulated authentication)
│   │   ├── styles/             # Zen Green CSS variables & design tokens
│   │   ├── types/              # TypeScript interface definitions
│   │   └── api/                # API client fetchers
│   ├── tests/                  # Client unit & integration tests (Vitest + RTL)
│   └── .env.example            # Client environment configuration template
├── server/                     # Express + Node.js + TypeScript Backend
│   ├── prisma/
│   │   ├── schema.prisma       # Prisma schema (User, Category, Ticket, Attachment, AuditLog)
│   │   ├── migrations/         # Version-controlled migration history
│   │   └── seed.ts             # Database seeder (categories, users, sample tickets)
│   ├── src/
│   │   ├── controllers/        # Express route handlers
│   │   ├── routes/             # API route definitions
│   │   ├── middleware/         # File upload & validation middleware
│   │   └── app.ts              # Express application setup
│   ├── uploads/                # Local attachment storage (gitignored)
│   ├── tests/                  # Backend integration tests (Supertest)
│   │   ├── lab-01/             # Lab 1 baseline tests
│   │   └── lab-02/             # Lab 2 requester & E2E lifecycle tests
│   └── .env.example            # Server environment configuration template
├── docs/                       # Course documentation & sprint deliverables
│   ├── lab-01/                 # Lab 1 vertical slice documentation
│   └── lab-02/                 # Lab 2 Requester MVP documentation
│       ├── specification.md    # System requirements & user stories
│       ├── api-spec.md         # RESTful API specifications
│       ├── ui-spec.md          # Zen Green UI/UX design specifications
│       ├── tests.md            # Test matrix & verification evidence (21/21 passed)
│       ├── reviewer.md         # Peer review logs for PRs #19 - #25
│       └── ai-use.md           # AI assistance logs & reflection essay
├── docker-compose.yml          # PostgreSQL 17 container definition (port 5433:5432)
├── .gitignore                  # Git ignore rules for node_modules, .env, uploads & build
└── README.md                   # Project documentation & setup instructions
```

---

## 🌿 Git Branching Model & Sprint 2 Delivery

This project strictly follows the course branching model with mandatory peer reviews before merging into integration branches:

- **Release Flow:** `feat/*` ➔ Pull Request ➔ `lab2-staging` ➔ Release PR ➔ `main`
- **Sprint 2 Pull Requests:**
  - **PR #19** (`feat/lab2-spec-and-test-plan`): System specification, API spec, UI spec, and test matrix.
  - **PR #20** (`feat/lab2-db-seed`): Prisma schema extensions, migration, and comprehensive seed data.
  - **PR #21** (`feat/lab2-requester-context`): Simulated user switcher, header, and global requester context.
  - **PR #22** (`feat/lab2-create-ticket`): Ticket creation form, multi-file upload, and idempotency protection.
  - **PR #23** (`feat/lab2-my-tickets`): My Tickets dashboard with real-time filtering, search, and pagination.
  - **PR #24** (`feat/lab2-ticket-details`): Ticket detail view, audit history, attachment download, and soft deletion.
  - **PR #25** (`feat/lab2-e2e-release`): End-to-end integration test suite, release verification, and documentation.

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18.x or v20.x+
- **npm**: v9.x+
- **Docker Desktop**: for running PostgreSQL container

---

### 1. Database Setup (Docker Compose)

Start the PostgreSQL 17 database service:

```bash
docker compose up -d
```

> **Note:** The database is exposed on host port **5433** to avoid conflicting with any default local PostgreSQL instance on port 5432.

---

### 2. Backend Setup

```bash
cd server

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env

# Apply database migrations
npx prisma migrate dev

# Seed database with initial categories, users, and sample tickets
npm run prisma:seed

# Start backend server in development mode
npm run dev
```

The Express API will be available at **`http://localhost:3000`**.

---

### 3. Frontend Setup

```bash
cd client

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env

# Start frontend development server
npm run dev
```

The React web application will be accessible at **`http://localhost:5173`**.

---

## 🧪 Automated Testing & Verification

Both frontend and backend include comprehensive automated test suites using **Vitest**, **React Testing Library**, and **Supertest**:

```bash
# Run backend integration tests (49 tests)
cd server
npm test

# Run frontend unit & component tests (32 tests)
cd client
npm test
```

### Test Suite Status: **81 / 81 Tests Passing (100%)**

```text
Backend Integration Tests (Vitest + Supertest) — 49 tests:
 ✓ server/tests/lab-02/e2e-flow.test.ts (14 tests)
 ✓ server/tests/lab-02/tickets.create.test.ts (10 tests)
 ✓ server/tests/lab-02/tickets.detail.test.ts (10 tests)
 ✓ server/tests/lab-02/tickets.list.test.ts (6 tests)
 ✓ server/tests/lab-02/requester-auth.test.ts (5 tests)
 ✓ server/tests/lab-02/requesters.api.test.ts (2 tests)
 ✓ server/tests/lab-01/health.test.ts (1 test)
 ✓ server/tests/lab-01/categories.test.ts (1 test)

Frontend Component & Unit Tests (Vitest + RTL) — 32 tests:
 ✓ client/src/tests/lab-02/MyTickets.test.tsx (6 tests)
 ✓ client/src/tests/lab-02/CreateTicket.test.tsx (5 tests)
 ✓ client/tests/lab-02/CreateTicket.test.tsx (5 tests)
 ✓ client/src/tests/lab-02/TicketDetail.test.tsx (5 tests)
 ✓ client/src/tests/lab-02/RequesterContext.test.tsx (4 tests)
 ✓ client/tests/lab-02/RequesterContext.test.tsx (4 tests)
 ✓ client/tests/lab-01/App.test.tsx (3 tests)

Total: 81 passed across 15 test files (100% green)
```

---

## 📡 RESTful API Endpoints Summary

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service health check and uptime status |
| `GET` | `/api/categories` | Retrieve active ticket categories |
| `GET` | `/api/users` | List available users for simulated switcher |
| `POST` | `/api/tickets` | Create new ticket with multi-part attachments (`multipart/form-data`) |
| `GET` | `/api/tickets` | Query requester tickets with status, search, and category filters |
| `GET` | `/api/tickets/:id` | Fetch ticket detail by ID, including audit logs and attachments |
| `PATCH` | `/api/tickets/:id/remove` | Soft-remove ticket (`CANCELLED` status) with conflict protection |
| `GET` | `/api/attachments/:id/download` | Download attachment file with RFC 6266 UTF-8 Content-Disposition |

Detailed API parameters, schemas, and error codes are documented in [`docs/lab-02/api-spec.md`](docs/lab-02/api-spec.md).

---

## 📖 Documentation Index

- [Lab 2 System Specification](docs/lab-02/specification.md) — System scope, actors, and user stories.
- [Lab 2 API Specification](docs/lab-02/api-spec.md) — REST endpoints, payloads, response codes.
- [Lab 2 UI/UX Design Specification](docs/lab-02/ui-spec.md) — Zen Green design tokens, wireframes, component rules.
- [Lab 2 Test Plan & Evidence](docs/lab-02/tests.md) — Test matrix and manual verification checklists.
- [Lab 2 Peer Review Records](docs/lab-02/reviewer.md) — Peer review logs across PRs #19 through #25.
- [Lab 2 AI Assistance Reflection](docs/lab-02/ai-use.md) — Agent prompt history, workflow insights, and AI reflection.

---

## 📜 License & Course Attribution

Developed for **CPE 334 Introduction to Software Engineering in the Age of AI Agents**, Department of Computer Engineering, King Mongkut's University of Technology Thonburi (KMUTT).
