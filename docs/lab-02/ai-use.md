# Lab 2 — AI Use and Reflection

**LLM/agent used:** Gemini 3.7 Flash (Antigravity Agent)

---

## Selected key prompts (6–10)

| # | Prompt (summarised) | What I did with the result |
|:---:|---|---|
| 1 | Help review edge cases and boundary checks for the attachment download endpoint (GET /api/attachments/:id/download) to identify potential security loopholes or missing specification details. | Evaluated the AI's findings and reinforced the backend authorization boundary: explicitly enforced a 403 Forbidden response when an attachment is flagged as soft-deleted (isRemoved === true) and added strict requester ownership checks across ticket relations. |
| 2 | Generate a comprehensive manual regression and interactive checklist for the ticket creation and detail views to verify all critical business rules in the UI. | Used the AI-generated checklist to systematically execute manual sanity tests in the browser, covering dirty form guard prompts on accidental navigation, submit button busy-state locks against double submission, and actual binary attachment downloads. |
| 3 | Audit CreateTicket.tsx and TicketDetail.tsx for potential UI state leakages or residual values following form resets and navigation cancellations. | Reviewed the flagged interaction states and updated dropdown selectors (Category and Affected System) to consistently reset to their default unselected prompt (-- Select ... --) upon clearing, while ensuring user input is preserved across network failures. |
| 4 | | |
| 5 | | |
| 6 | | |
| 7 | | |

---

## Reflection


