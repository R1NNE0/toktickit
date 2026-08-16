# Lab 1 — AI Use and Reflection

**LLM/agent used:** Gemini 3.6 Flash (Antigravity Agent)

---

## Selected key prompts (6–10)

| # | Prompt (summarised) | What I did with the result |
|:---:|---|---|
| 1 | Check if the project foundation setup meets all Issue 1 baseline criteria and verify that sensitive files are excluded from Git. | Verified the `.gitignore` rules, confirmed `.env.example` configurations, and ensured no database credentials or `node_modules` were tracked. |
| 2 | Verify whether `GET /api/health` and the Supertest suite satisfy Issue 2 acceptance criteria, and inspect why the frontend remains in starter state. | Identified that the backend endpoint was complete but the React UI lacked API integration, then implemented the missing health check call and offline error UI state. |
| 3 | Inspect `prisma/seed.ts` to check if the seeding logic satisfies the idempotency requirement and prevents duplicate category records. | Verified the `upsert` query behavior and executed `npx prisma db seed` repeatedly to confirm no unique constraint violations occurred. |
| 4 | Audit my Issue 4 implementation against acceptance criteria: verify category sorting by ID, error handling on DB failure, and Vitest test coverage. | Confirmed `orderBy: { id: "asc" }` and HTTP 500 fallback in Express, unskipped all UI component tests, and verified that all Vitest assertions passed. |
| 5 | Inspect Docker configuration between my project and peer's repository to check for port and container name collisions before running reviews. | Analyzed the port overlap on `5433` and used `docker-compose.override.yml` to isolate the review environment onto port `5434` without altering peer code. |
| 6 | Review peer's PR for Issue 3 against specifications: check Prisma model constraints, migration validity, and idempotent seeding. | Cross-checked the peer's schema and seed script against the lab requirements, tested migrations locally, and wrote structured feedback for PR approval. |

---

## Reflection

Providing rigorous acceptance criteria checklists helped the agent accurately verify edge cases, database constraints, and test suite results. One key place I corrected the agent was during peer review setup: instead of editing the peer's base configuration, I guided it to use `docker-compose.override.yml` to spin up an isolated test database, allowing me to execute verification tests and write accurate review feedback safely.
