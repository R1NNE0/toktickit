# Lab 4 release guide

The approved [specification](specification.md), [API](api-spec.md), [UI](ui-spec.md) and [test plan](tests.md) define policy. Their original planning registers are preserved. Later executed outcomes are recorded in the [Issue #54 results](../../artifacts/lab-04/verification/issue-54-results.json) and [release evidence index](../../artifacts/lab-04/README.md).

## Features and roles

Dashboard is the default authenticated landing view; `/#/tickets/:id` still opens existing detail. All normal operations require an active session and completion of mandatory password change.

| Role | Supported Lab 4 work | Boundaries |
|---|---|---|
| Requester | Own active/waiting/recently resolved/recently updated metrics, recent preview, filtered My Tickets, read-only Actions and advisory resolution indication | No foreign Tickets, revisions, private notes or operational mutations |
| IT Staff | Operational metrics, personally assigned unfinished Actions, recent Tickets, Queue drill-downs, Actions, Ticket ownership/workflow | Only eligible assignees start/complete Actions; backend gates remain authoritative |
| Administrator | Operational Dashboard/Queue/detail/assignee reads, permitted Actions/history, existing account management and IT Priority | No inherited claim/owner/status, discussion posting or attachment-byte permissions |

Actions use PLANNED, IN_PROGRESS, COMPLETED and CANCELLED. Creator is populated on creation, assignee identifies planned work, and performer/completion time are populated only at actual completion. Permitted current-record edits append immutable revisions. Completed correction requires a reason and preserves attribution.

The eight Ticket statuses remain unchanged. Resolution requires confirmation, current workflow version, eligible owner, at least one completed current-cycle Action, zero unfinished Actions and zero outstanding completed follow-ups. Reopen advances the work cycle and clears current resolution/advisory fields; historical Actions remain readable. Existing Resolved/Closed Tickets are preserved without invented Actions. Unknown legacy resolution dates are excluded only from recent-resolution metrics.

Metrics are calculated in a repeatable-read snapshot using one database instant, exact 168-hour `[from,to)` UTC bounds and previews of at most five rows. Display times are Asia/Bangkok. Drill-downs reuse the returned filters; later live lists may differ after intervening writes. Personal outstanding work uses current assignment/current cycle/active parent, not creator or performer attribution.

## Setup, migration and startup

Follow the existing [PowerShell setup](../../README.md#local-setup-powershell), package lockfiles and local PostgreSQL configuration. Issue #54 recorded Node 24.14.0, PostgreSQL 17.10 Alpine and Windows 10.0.26200. There is no universal application login password.

| Variable | Meaning |
|---|---|
| Server `DATABASE_URL` | Explicit URL for the intended PostgreSQL database; tests must never use development/real data |
| Server `PORT` | Normally 3000; browser tests use 3101, production startup smoke 3103 |
| Server `FRONTEND_ORIGIN` | Exact permitted origin, normally `http://localhost:5173` |
| Server `AUTH_ALLOW_HTTP_LOCALHOST` | Explicit `true` for local HTTP only; use HTTPS and `false` otherwise |
| Test `NODE_ENV`, `TEST_UPLOAD_ROOT` | `test`, `uploads/lab-03-test` |
| Client `VITE_API_URL` | API origin at Vite build/dev time, normally `http://localhost:3000` |

Set server variables explicitly in the process environment: copying `.env.example` alone does not load them into Node/tsx. Vite reads the client environment file. Use matching hostnames/ports for Origin, cookies and CSRF. Keep `.env`, credential output, sessions, upload bytes and database backups private and outside submission artifacts.

From `server`, after configuring the intended database and environment:

```powershell
npx.cmd prisma generate
npm.cmd run prisma:migrate:auth
npm.cmd run prisma:seed
npm.cmd run build
npm.cmd start
```

The forward migration command handles credential provisioning before later constraints and additive Lab 4 changes. Do not reset existing data or alter historical migrations. Credential handover runs privately and requires secure retention/confirmation. Reruns preserve existing credentials and user-modified graphs. Lab 4 seed adds missing deterministic demonstration graphs with coherent revisions, zero/one/multiple Actions and historical/follow-up cases.

`npm start` now executes `node dist/src/index.js`; Issue #54 verified production health and an authenticated dashboard read after fixing the old path. From `client`, `npm.cmd run dev` serves development and `npm.cmd run build` produces `client/dist/`. `npm.cmd run preview` is a local preview: configure its API origin and matching server frontend origin explicitly.

## Backup and recovery

Before upgrading real data, coordinate a write stop and retain a PostgreSQL backup together with its matching upload tree, hashes, timestamp and schema version. A database-only backup cannot recover attachment bytes. Protect credential/session data in backups. Rehearse restoration in isolation, compare rows/files, apply forward migrations and verify authenticated reads before planning a real cutover. Reconcile newer writes and agree downtime before real restoration; an older writable app bypasses the Lab 4 gates and is not a safe fallback.

The tested disposable rehearsal is `server/tests/lab-04/migration-regression.test.ts`: `pg_dump` of a uniquely owned schema, matching PDF backup, injected transactional failure, scoped schema-loss/upload-corruption simulation, `psql -X -v ON_ERROR_STOP=1` restore, old-row and byte-hash equality, then additive migration retry. Issue #54 also passed seed failure/retry checks. These tests are not evidence of an operator backup of a real deployment. They never restore over development or the public schema.

## Verification commands

Reuse Issue #54 results during documentation preparation. The following commands are for actual final-main verification, with complete sanitized output and its real revision retained by the student.

Inspect `toktickit-lab3-auth-test` first: loopback port 55433, database `toktickit_lab3_test`, user `lab3_test`, and volume separate from development `toktickit_postgres_data`. Start only the existing disposable container if needed. Verify `SELECT current_database(), current_user;`. Backend/browser setup resets its public schema. Run database suites sequentially and restore the original container state afterward.

From `server` in a dedicated test terminal:

```powershell
$env:DATABASE_URL='postgresql://lab3_test:lab3_test_local@127.0.0.1:55433/toktickit_lab3_test?schema=public'
$env:NODE_ENV='test'
$env:TEST_UPLOAD_ROOT='uploads/lab-03-test'
$env:AUTH_ALLOW_HTTP_LOCALHOST='true'
$env:FRONTEND_ORIGIN='http://localhost:5173'
npm.cmd test -- --exclude tests/lab-04/dashboard-performance.test.ts --reporter=dot
npx.cmd vitest run tests/lab-04/dashboard-performance.test.ts --reporter=dot
npx.cmd vitest list --filesOnly
```

The full runner includes migration/seed/recovery; the startup test compiles a fresh build and uses port 3103. Focused migration rehearsal uses `npx.cmd vitest run --config tests/lab-04/migration.config.ts --reporter=dot`.

From `client`: `npm.cmd test -- --reporter=dot` and `npm.cmd run build`. From `server`: `npm.cmd run build`. From `e2e`, sequentially:

```powershell
npx.cmd playwright test --config playwright.config.ts
npx.cmd playwright test --config playwright.actions-integration.config.ts
npx.cmd playwright test --config playwright.actions-ui.config.ts
```

These select retained journeys, real-backend Lab 4 journeys, and database-free mocked-API UI checks respectively. Do not count screenshot capture scenarios as product regression tests.

## Demonstration and screenshot capture

Verified opt-in capture command (six capture scenarios passed across the initial and focused supplemental runs):

```powershell
# From e2e, only after verifying disposable database identity and storage:
npx.cmd playwright test --config playwright.lab4-evidence.config.ts
```

This configuration selects only `e2e/evidence/lab-04.capture.spec.ts`, excluding the Lab 3 capture. It uses real application screens, synthetic fixtures and random in-memory passwords. Outputs belong only under `artifacts/lab-04/screenshots/`; response-injected feedback is explicitly labelled. The original capture workflow cannot safely be reused unchanged because it selects the historical Lab 3 file.

The prior approval-service blocker was resolved on resume. Actual database identity and isolated storage were verified before capture. The [screenshot gallery](../../artifacts/lab-04/screenshots/README.md) indexes 46 PNGs with verified hashes/dimensions and recorded provenance; the focused append run adds nonzero Staff assigned-work views without rerunning earlier captures. Student/peer human sign-off remains pending.

Suggested demonstration: Staff dashboard/drill-down; blocked resolution; Action creation/edit/assignment; eligible assigned actor completion; follow-up correction/history; resolution/reopen; Requester owned metrics and read-only history; Administrator operational access without inherited Ticket mutation controls.

## Submission and limitations

Follow **Feature Branch → PR → Peer Review → `lab4-staging` → `main`**. Actual board/history/reviews, student-authored reflection and final-main output remain manual evidence. Automated work must not populate `ai-use.md` or `reviewer.md`.

Submit exactly one readable PDF with **Answer Part 1** through **Answer Part 9** in order and working links, as required by handout §14. Render contracts with the execution supplement, inspect screenshots and complete human visual/accessibility sign-off. See the evidence index for explicit gaps.

The course scope excludes SLA engines, external notifications, billing, multi-tenancy and production-scale operations. Local performance smoke is not a production SLA; automated accessibility checks are not human sign-off. Workspace results and capture-source hashes do not establish a clean or final-main revision.
