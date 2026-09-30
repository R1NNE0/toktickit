# TokTickIT — IT Service Desk

Course project for CPE 334, KMUTT, semester 1/2026. Lab 3 adds authenticated Requester, IT Staff and Administrator workflows to the preserved Lab 1–2 increment.

## Current functionality

- **Authentication:** Argon2id passwords, mandatory initial-password change, opaque PostgreSQL sessions, HttpOnly cookies, CSRF checks, login throttling and logout/revocation. Identity comes from the server session; the development Requester selector and header identity are removed.
- **Requester:** create Tickets, My Tickets search/filter/sort/pagination, owned detail, attachments, Public Comments and an independent “Problem Appears Resolved” indication.
- **IT Staff:** shared Queue, claim/assignment, IT Priority, approved status transitions, Public Comments, Internal Notes and permitted attachment operations.
- **Administrator:** user listing/search/create/edit/activation/initial-password reset and account safeguards. Known-ticket detail, Public Comments, Internal Notes and attachment metadata are readable; IT Priority is editable. Queue, claim, assignment, status changes, discussion posting and attachment upload/download/removal are denied.
- **Continuity:** IDs, ownership, existing Tickets and Attachments survive forward migrations. Attachment soft removal retains metadata and bytes. Requesters do not change formal Ticket status.

Statuses: NEW, OPEN, IN_PROGRESS, WAITING_FOR_REQUESTER, RESOLVED, CLOSED, REOPENED, CANCELLED. Both priorities: LOW, MEDIUM, HIGH, CRITICAL. The approved [authorization and transition matrices](docs/lab-03/specification.md) remain authoritative.

The Issue #36 owner-label blocker was resolved and verified on 2026-09-26: detail responses now include the contract's owner role/isActive fields. Current verification passed **252 backend tests, 87 client tests, 11 E2E tests and both builds**; only the six affected detail/confirmation captures were regenerated. See [tests.md §11](docs/lab-03/tests.md#11-owner-metadata-blocker-correction-2026-09-26). Other documented Partial/manual items and final release approval remain outstanding.

## Stack and structure

React 18 / TypeScript / Vite 6 / Bootstrap 5, Express 4, Prisma 5 and PostgreSQL 17. Tests use Vitest, React Testing Library, Supertest and Playwright Chromium. Zen Green tokens live in `client/src/index.css` (primary `#006b3c`, pale `#eaf6ef`, page `#f5f7f6`).

```text
client/src/                     App, components, AuthContext, api.ts, auth-client.ts, index.css
client/tests/                  Lab 1–3 component/unit tests
client/src/tests/lab-02/        Retained Lab 2 component tests
server/src/                    Express app, auth, policy, query and workflow modules
server/prisma/                 Mapped User schema, additive migrations, create-only seed
server/scripts/                Forward auth migration and private credential handover
server/tests/lab-01..03/        API/unit/security/migration/regression tests
e2e/lab-03/                    Real-browser regression specs and isolated fixtures
e2e/evidence/                  Opt-in screenshot capture using the same application/fixtures
docs/lab-01..03/               Contracts, tests and student-owned delivery records
artifacts/lab-03/screenshots/   Sanitized visual evidence and index
docker-compose.yml             Development PostgreSQL on localhost:5433
```

## Local setup (PowerShell)

Verified tooling: Node **24.14.0**, npm **11.9.0**, Docker Desktop with Linux containers, PostgreSQL **17 Alpine**. Use lockfiles with `npm ci`. Chromium is installed separately for browser tests. Distributed rate limiting, email recovery and deployment hardening are outside this local course project's scope.

Start the development database from the repository root:

```powershell
docker compose up -d
```

In a private interactive terminal, from `server`:

```powershell
npm ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
$env:DATABASE_URL='postgresql://toktickit:toktickit@localhost:5433/toktickit?schema=public'
$env:PORT='3000'
$env:FRONTEND_ORIGIN='http://localhost:5173'
$env:AUTH_ALLOW_HTTP_LOCALHOST='true'
npx prisma generate
npm run prisma:migrate:auth
npm run prisma:seed
npm run dev
```

These database credentials are local Compose defaults, not application login passwords. For another database use its local configuration. Set variables explicitly: `tsx` does not load `.env` for the application automatically. Copying the example alone is insufficient.

**Existing Lab 2 database:** use `prisma:migrate:auth`, not reset or a blanket migration command that applies required-credential constraints before provisioning. It checks normalized-email collisions, expands identity fields, provisions missing credentials, then applies required fields and later additive migrations. Keep the existing upload directory with the database. Resolve collisions explicitly; never delete/merge legacy users just to make migration pass.

Migration/seed show only newly generated initial passwords in a private terminal and require `SAVED` confirmation after secure retention by the operator. Do not redirect, record, screenshot or commit that output. Handover failure leaves pending credentials recoverable on retry; ordinary reruns do not reset already provisioned hashes. Seed creates missing role/reference fixtures and preserves existing roles, activation and Ticket data. There is no universal application password. Sign in using the credentials actually handed over, then change the initial password before normal use.

In another terminal, from `client`:

```powershell
npm ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
npm run dev
```

Open **http://localhost:5173**; API **http://localhost:3000**. Use the configured hostname consistently: Origin/CSRF checks are exact. For HTTPS set `AUTH_ALLOW_HTTP_LOCALHOST=false` and the matching frontend origin. A known Ticket can be opened at `/#/tickets/123`; server role/ownership checks still apply.

## Testing: dedicated disposable database only

Backend/browser setup resets the test schema. **Never point tests at development port 5433 or real data.** Create the dedicated container once, or start it if it already exists:

```powershell
# First creation only; these are local disposable database credentials.
docker run --name toktickit-lab3-auth-test -e POSTGRES_USER=lab3_test -e POSTGRES_PASSWORD=lab3_test_local -e POSTGRES_DB=toktickit_lab3_test -p 127.0.0.1:55433:5432 -d postgres:17-alpine
# On later runs:
docker start toktickit-lab3-auth-test
```

From `server`, in a dedicated test terminal:

```powershell
$env:DATABASE_URL='postgresql://lab3_test:lab3_test_local@127.0.0.1:55433/toktickit_lab3_test?schema=public'
$env:NODE_ENV='test'
$env:TEST_UPLOAD_ROOT='uploads/lab-03-test'
$env:AUTH_ALLOW_HTTP_LOCALHOST='true'
npm test                 # All Lab 1–3 backend suites
npm run test:lab3        # Lab 3 plus retained Lab 1; excludes Lab 2 suites
```

From `client`: `npm test` runs all component/unit suites. From `e2e`:

```powershell
npm ci
npx playwright install chromium
npm test
```

`e2e/playwright.config.ts` explicitly targets **`e2e/lab-03/`**. It supplies the isolated database and starts separate API/UI listeners on **3101/5174**. It refuses an unexpected DATABASE_URL or existing listeners. Run backend and browser tests sequentially against their shared disposable database. Browser accounts/passwords are generated in memory; personal seed credentials are not needed.

Visual capture is opt-in and separate from the 11 regression scenarios:

```powershell
# From e2e; same isolated database, fixtures and server guards
npx playwright test --config playwright.evidence.config.ts
```

See the [screenshot index](artifacts/lab-03/screenshots/README.md) for states, dimensions, hashes, injected failure labels and inspection notes. Browser caches, traces/test-results, dependency trees, builds, `.env` and uploads are not submission artifacts. Only deliberately sanitized screenshots/metadata belong under `artifacts/`.

### Verified baseline and builds

Issue #35 runs on 2026-09-19–20 passed **249 backend tests (25 files), 83 client tests (16 files), and 11 Chromium E2E scenarios (5 specs)** with zero failures/skips. Both builds passed. Issue #36 confirmed that all 113 tracked implementation/test/configuration files match that integrated baseline before evidence preparation. These are local results, not a claim that the future final `main` revision passed. [tests.md](docs/lab-03/tests.md) distinguishes passed cases, partial planned coverage and manual delivery items.

Run `npm run build` separately in `server` and `client`. Backend output entry: `server/dist/src/index.js`; from `server`, with environment configured, use `node dist/src/index.js`. The existing `npm start` references the older `dist/index.js` layout; this documentation-only increment documents the correct entry without changing package behavior. Client output: `client/dist/` (`npm run preview` previews it locally; configure the matching API origin for authenticated preview requests).

## API and documentation

Authentication uses `/api/auth/csrf`, `/api/auth/login`, `/api/auth/me`, `/api/auth/change-password` and `/api/auth/logout`. Requester Tickets use `/api/tickets`; Staff operations use `/api/staff`; Administrator accounts use `/api/admin/users`. Ticket creation is JSON followed by separate multipart attachment uploads. There is no public persona directory or Requester Ticket-cancellation endpoint. Non-sensitive Lab 1 health/categories remain available.

- [Specification, roles, workflow, migration and ACs](docs/lab-03/specification.md)
- [API paths, payloads, cookies, errors and authorization](docs/lab-03/api-spec.md)
- [UI contract and responsive/visual checklist](docs/lab-03/ui-spec.md)
- [Test coverage, commands and execution evidence](docs/lab-03/tests.md)
- [Screenshot evidence](artifacts/lab-03/screenshots/README.md)
- [Reviewer record](docs/lab-03/reviewer.md) and [AI-use reflection](docs/lab-03/ai-use.md): reserved for the student's manual completion; intentionally untouched in Issue #36.
- Historical [Lab 1](docs/lab-01/) and [Lab 2](docs/lab-02/) documents remain prior-increment evidence.

## Human release checklist

Required flow: **feature PR -> `lab3-staging` -> reviewed release PR -> `main`**. This work creates no PR, approval, merge or GitHub state change.

- Review Issue #36 documentation/screenshots and resolve the partial technical coverage/visual findings in `tests.md` before claiming every AC complete.
- Complete `reviewer.md` with actual bilateral review evidence and `ai-use.md` with 6–10 useful real prompts and the student's reflection.
- Obtain required feature review and integrate approved work into `lab3-staging`, then create/review the release PR **from `lab3-staging` to `main`**.
- After the actual merge, verify final `main` using the documented isolated tests/builds; retain complete output and its actual revision. Confirm the real Issue board/history and approvals.
- Prepare the course PDF with **Answer Part 1** through **Answer Part 9** in order, linking final repository, board/reviews, contracts, tests, manually completed records and readable screenshots. Do not present workspace evidence as future final-main evidence.
