# Lab 3 AI Use and Reflection

Status: **Factual record through Phase 2.2 — all engineering decisions approved; documentation only; implementation and test execution not started.**
Recorded: 2026-09-15. Assistant used: **OpenAI Codex** in the shared repository workspace. Exact model variant/reasoning setting: TODO if independently available from session settings; do not infer them or copy the Gemini model names in historical Lab 1/2 records. No sub-agents were used for these phases.

## Selected prompts that actually occurred

The entries below are labeled summaries of actual user requests, not invented verbatim transcripts. Six selected prompts exist so far; submission ultimately needs 6–10 real selected prompts.

| # | Actual phase | Prompt summary | Result / human direction |
|---|---|---|---|
| 1 | Phase 0 — Inspect Lab 1–2 architecture | Inspect the existing repository, Requester/Ticket/Attachment implementation, API/UI/tests/conventions, Git state and Lab 3 impact; do not modify files or implement Lab 3. | Read-only architecture audit identified simulated identity, current routes/models, tests, Git state and documentation/code mismatches. No test execution or code changes. Initial PDF extraction was incomplete; later Phase 1 recovered text from all three sheets. |
| 2 | Phase 1 — Lab 3 gap analysis and engineering decisions | Compare repository and three lab sheets; propose authentication, preserved User migration, authorization/transitions, staff/admin changes, tests, documentation, Issues and approval decisions; no changes. | Produced a gap analysis with proposed policies. Its Administrator operational-access recommendation was not approved and is superseded by the explicit restrictive direction in Phase 2. No Issues/branches/PRs created. |
| 3 | Phase 2 — Engineering Contract / Spec DD / Test DD | Create only the six docs/lab-03 Markdown files; follow Lab 3 above earlier long-term recommendations; distinguish engineering decisions; map ACs to planned tests; propose eight Issues and stop for human review. | Prepared specification/UI/API/test drafts and initial review/AI-use templates. Administrator has no automatic IT Staff operations; tests remain Planned / Not Run; implementation and human approval were pending at that phase. |
| 4 | Phase 2.1 — Correct Administrator authorization against the handout (including resumed work) | Re-review all six documents; distinguish required, forbidden and matrix-choice Administrator capabilities; preserve role separation and unchanged Requester/Staff/User Management/migration behavior; resume only unfinished corrections after interruption. | Initial inspection had made no Phase 2.1 edits; the resumed inspection confirmed all six files matched the saved pre-edit snapshot. Corrected Administrator IT Priority permission across specification/API/UI/tests, retained required reads and owner eligibility, and classified optional permissions without granting all Staff operations. Added planned tests only; no application implementation or peer approval. |
| 5 | Phase 2.1 — Approve final authorization matrix | Approve explicit Administrator permissions and denials, read-only permitted Ticket Detail, and separate IT Priority updates on accessible tickets without an owner-only restriction; update documentation and verify FR/BR/AC, API and test traceability only. | Recorded explicit user authorization approval on 2026-09-15 and removed pending markers for those choices. Other engineering decisions were pending at that phase; no application implementation, test execution or GitHub actions were authorized or performed. |
| 6 | Phase 2.2 — Approve remaining engineering decisions | Approve ED-01–04/06–10, keep Lab 3 simple, use default page size 10, and prohibit broad optimistic locking unless later evidence proves it necessary; update and verify documentation only. | Recorded user approval on 2026-09-15; removed version fields/tokens and generic stale-edit expectations from data/API/UI/test plans, retained targeted business safeguards and approved Administrator permissions, and aligned pagination. No application code, migrations, database changes or GitHub operations. |

## Decisions and corrections actually visible in the conversation

- User required read-only analysis in Phases 0/1 and authorized only `docs/lab-03/` documentation in Phase 2.
- Phase 2 corrected Phase 1's blanket operational recommendation but the draft over-restricted Administrator IT Priority. The user's Phase 2.1 correction required the handout's explicit Staff OR Administrator permission. The current contract includes it alongside required comment/note visibility and active-owner eligibility; queue/claim/reassignment/status/posting/attachment permissions remain explicit matrix choices, subsequently approved by the user along with read-only Ticket Detail/metadata and non-owner-only IT Priority updates.
- The agent identified that current IT Priority creation is MEDIUM, whereas Lab 3 requires copying Requested Priority for new tickets; historical data must remain intact.
- Tests were inspected rather than executed because existing backend suites write database records/files. Historical “passing” claims were not reused as new evidence.
- Bounded Lab 2 continuity gaps are explicitly described in the contract; application fixes were not performed during drafting.
- Phase 2.2 supersedes the proposed general Ticket/account versioning design. The user approved only targeted correctness transactions/constraints and default page size 10. Explicit Requester size 8 and existing aliases remain supported; comments/notes also default to 10. Package/runtime and migration facts remain future verification tasks, not unapproved engineering decisions.

## Evidence and later entries

Prompt sources are the current conversation: Phase 0 direct message; Phase 1 and Phase 2 pasted requests; Phase 2.1 correction, continuation and final authorization-approval messages; Phase 2.2 remaining-decisions approval. Those local attachment paths are not portable repository artifacts. Before submission, select actual prompts/excerpts from the conversation and add only later prompts that really occur, with outcomes and student corrections. Do not invent prompts to reach the required count.

Documentation validation through Phase 2.2 is a static consistency check, not an application test result. All ED-01–10 are explicitly approved by the user through Phases 2.1/2.2 on 2026-09-15, with the Phase 2.2 simplicity/concurrency constraints. Implemented behavior, executed tests, peer reviews and release evidence remain unverified; no engineering-policy approval remains outstanding.

## My Reflection — student to complete later

TODO: in my own words, explain which specification-agent suggestions I accepted or corrected, how I verified decisions, which coding-agent prompts helped or failed, and what I learned about preserving an existing increment. Do not present an AI-written first-person reflection as my completed experience.

Engineering-decision approval is recorded above; it is not peer PR approval or completion of the increment.
- [ ] Verify the six selected prompt summaries against the actual conversation before submission; add only real later prompts if useful.
- [ ] Complete student reflection based on actual work.
- [ ] Verify named tools/models and linked evidence before submission.
