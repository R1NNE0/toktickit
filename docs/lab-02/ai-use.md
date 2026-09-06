# Lab 2 — AI Use and Reflection

**LLM/agent used:** Gemini 3.7 Flash (Antigravity Agent)

---

## Selected key prompts (6–10)

| # | Prompt (summarised) | What I did with the result |
|:---:|---|---|
| 1 | Help review edge cases and boundary checks for the attachment download endpoint (GET /api/attachments/:id/download) to identify potential security loopholes or missing specification details. | Evaluated the AI's findings and reinforced the backend authorization boundary: explicitly enforced a 403 Forbidden response when an attachment is flagged as soft-deleted (isRemoved === true) and added strict requester ownership checks across ticket relations. |
| 2 | Generate a comprehensive manual regression and interactive checklist for the ticket creation and detail views to verify all critical business rules in the UI. | Used the AI-generated checklist to systematically execute manual sanity tests in the browser, covering dirty form guard prompts on accidental navigation, submit button busy-state locks against double submission, and actual binary attachment downloads. |
| 3 | Audit CreateTicket.tsx and TicketDetail.tsx for potential UI state leakages or residual values following form resets and navigation cancellations. | Reviewed the flagged interaction states and updated dropdown selectors (Category and Affected System) to consistently reset to their default unselected prompt (-- Select ... --) upon clearing, while ensuring user input is preserved across network failures. |
| 4 | Analyze concurrency race conditions and audit preservation on the soft-removal endpoint (DELETE /api/attachments/:id), comparing atomic update guards against repeated deletion attempts. | Adopted an audit-safe concurrency guard returning HTTP 409 Conflict if an attachment has already been soft-removed, preventing concurrent duplicate requests from overwriting historical removalReason and removedAt timestamps. |
| 5 | Review browser MIME-sniffing risks and RFC 6266 Unicode Content-Disposition standards for attachment streaming downloads. | Hardened the download endpoint by attaching the X-Content-Type-Options: nosniff security header to mitigate XSS risks and formatted Content-Disposition with filename*=UTF-8'' to preserve non-ASCII/Thai filenames across all modern browsers. |
| 6 | Design a complete end-to-end integration flow scenario (E2E-01) covering the entire Requester MVP lifecycle from persona selection to ticket creation, search/filtering, and cross-tenant data isolation. | Implemented server/tests/lab-02/e2e-flow.test.ts validating all 7 sequential steps, confirming idempotency replay, automated ticket sequencing (TKT-YYYY-XXXXXX), search/pagination envelopes, and strict 403 Forbidden cross-requester blocking. |
| 7 | Investigate intermittent database test race conditions during Vitest parallel test suite execution across multiple integration files. | Identified pagination offset drift caused by concurrent database writes across Vitest worker threads; resolved the issue by configuring fileParallelism: false in server/vitest.config.ts to enforce deterministic, sequential test execution. |

---

## Reflection

Working on TokTickIT Lab 2 with an AI pair programmer provided significant insights into modern software engineering, particularly around defensive API design, concurrency safeguards, and multi-tiered automated quality assurance.

The most valuable aspect of AI collaboration was using the model as an auditor to discover edge cases lying between an MVP prototype and an enterprise-grade service. While the fundamental specifications required ticket creation, filtering, and attachments, the pairing workflow highlighted critical vulnerability points—such as preventing duplicate soft-removal calls from overwriting audit timestamps (resolved via HTTP 409 Conflict), enforcing 32-bit integer boundaries (`MAX_INT`) to prevent database crashes, and adding `X-Content-Type-Options: nosniff` alongside RFC 6266 `filename*=UTF-8''` for Thai and Unicode filename downloads.

The test-driven approach proved indispensable when verifying complex lifecycle behavior. Across 49 server tests, 32 client tests, and the final end-to-end integration suite (`E2E-01`), strict test assertions immediately flagged subtle issues—such as database state drift caused by Vitest thread parallelism, which was solved by enforcing `fileParallelism: false`. Having a 100% green test harness allowed endpoint hardening to proceed without regression fears.

Ultimately, this sprint underscored that AI assistance delivers the greatest value when guided by disciplined human judgment. The engineer must actively filter suggestions to avoid unnecessary over-engineering while adopting genuine security and resiliency improvements. The AI functioned effectively as a brainstorming and scenario-generation partner, while final architectural decisions, code verification, and quality ownership remained entirely with the engineer.