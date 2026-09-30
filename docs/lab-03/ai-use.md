# Lab 3 — AI Use and Reflection

**LLM/agent used:** OpenAI Codex (VS Code) and Gemini (Antigravity Agent)

## Selected key prompts (6–10)

| # | Prompt (summarised) | What I did with the result |
|:---:|---|---|
| 1 | Review the Lab 3 engineering specification to identify missing requirements and inconsistencies in role-based authentication, authorization, and ticket workflows. | Used the AI-assisted review to refine the engineering contract, clarify acceptance criteria, and improve traceability between requirements and planned tests before implementation. |
| 2 | Investigate potential credential recovery failures during user migration and database seeding, particularly when the initial-password handover process fails. | Addressed peer review feedback by improving credential provisioning to support safe recovery and retries, then added regression tests covering failed handovers, migration retries, and successfully provisioned accounts. |
| 3 | Audit Requester authorization to ensure ticket and attachment access is derived from authenticated sessions rather than client-provided identity headers. | Verified session-derived Requester identity, CSRF protection, and cross-requester isolation, ensuring that unauthorized access could not bypass backend authorization checks. |
| 4 | Review the IT Staff Ticket Queue and Ticket Detail workflows to identify potential bugs in owner assignment, status transitions, attachment handling, and role-based access control. | Used AI-assisted code review to inspect workflow edge cases, verify ownership and status transitions against the specification, and identify areas requiring additional regression coverage. |
| 5 | Design integration and end-to-end tests covering authentication, Requester, IT Staff, and Administrator workflows, including authorization failures and responsive behavior. | Expanded automated verification across API, component, and browser levels, checking cross-role permissions, workflow integration, error handling, and responsive layouts. |
| 6 | Investigate why Staff Ticket Detail displays an active IT Staff owner as “Administrator — Inactive,” and identify the smallest correction consistent with the API contract. | Identified missing role and isActive fields in the backend response, corrected the API projection, added focused regression tests, and regenerated the affected visual evidence. |

## Reflection

Working on TokTickIT Lab 3 with AI coding agents helped me gain experience in developing and verifying a more complex system involving authentication, role-based authorization, and ticket workflows. Compared with previous labs, the main challenge was ensuring that multiple features and user roles worked together correctly while remaining consistent with the engineering specification.

One important lesson was that passing automated tests does not always guarantee correctness. During development, peer reviews and AI-assisted verification helped identify issues such as unsafe credential provisioning during migration and missing owner metadata in the Staff Ticket Detail API. I used these findings to investigate the root causes, apply focused corrections, and add regression tests. I also learned to control AI operations by defining clear boundaries, including preserving existing functionality, avoiding unnecessary refactoring, and requiring read-only access during peer reviews.

Overall, Lab 3 reinforced that AI is most useful as a coding, testing, and review assistant rather than an unquestionable source of solutions. Although AI helped accelerate implementation and uncover edge cases, I remained responsible for evaluating its suggestions, verifying results against the specification, and making final engineering decisions.
