# Lab 2 — Peer Review Record

**Author:** Songwit Rueangsawat — 67070501060 — GitHub: @R1NNE0  
**Peer reviewer:** Thanawat Suntarawattana — 67070501022 — GitHub: @Maibokdaimhai  
**Partner I review:** Tanadet Nuchaikaew — 67070501081 — GitHub: @Kawi-HBLI  

---

## Pull Requests I authored (reviewed by my partner)

| PR | Branch | Reviewer verdict |
|:---:|---|:---:|
| #19 | `feat/lab2-spec-and-test-plan` | Approved |
| #2 | `feat/lab2-database-and-seed` | Pending |
| #3 | `feat/lab2-requester-context` | Pending |
| #4 | `feat/lab2-create-ticket` | Pending |
| #5 | `feat/lab2-my-tickets` | Pending |
| #6 | `feat/lab2-ticket-detail-and-attachment` | Pending |
| #7 | `feat/lab2-e2e-and-release` | Pending |

### docs: setup sprint 2 specifications, test plan, and review templates (Issue #1)
- **PR Link:** [#19](https://github.com/R1NNE0/toktickit/pull/19)

**Reviewer comment I received:**
> ### Peer Review Checklist & Verification
> I have reviewed the engineering specification and test plan deliverables for this issue in Lab 2.
> 
> #### Verification Results
> - [x] **`specification.md` Sections:** Covers all 11 required sections from Appendix A (Goal, Stakeholder Interpretation, Scope, FRs, BRs, UI Summary, Database Design, API Summary, ACs, DoD, Assumptions).
> - [x] **Acceptance Criteria Format:** AC-01 through AC-10 strictly follow the Given-When-Then format.
> - [x] **`api-spec.md` Completeness:** Specifies full REST contracts for active requesters, categories, related systems, ticket management, file upload, streaming download, and soft removal.
> - [x] **`ui-spec.md` Design Tokens & Breakpoints:** Enforces Zen Green tokens (`#006B3C`, `#0B7A46`, `#EAF6EF`, `#F3F4F6`), button/form states, desktop/tablet/mobile layout rules, and screenshot artifact paths.
> - [x] **`tests.md` Traceability:** Maps 21 planned test scenarios (API-01..14, UI-01..06, E2E-01) directly to target test files and satisfies full AC-01..10 traceability.
> - [x] **Documentation Templates:** `reviewer.md` and `ai-use.md` follow standard structure.
> 
> #### Verdict
> **Approved!** Excellent detail and clear traceability between requirements, API endpoints, UI tokens, and test files. Ready for implementation in Sprint Next Issue.
> 
> *Note:* I forgot to tell you about issue that you linked. I think you linked in wrong with the another one on pull request description. It links to #1 instead of #12.

**How I responded:**
> Thanks for the review and for pointing that out!
> 
> GitHub automatically hyperlinks #1 to the very first item in the repository (which happened to be PR #1 from Lab 1). In this context, it was intended to reference Issue #1 of Lab 2 on our project board rather than the old pull request.
> 
> I appreciate you catching that detail! Everything is clear now, and this PR is ready to be merged into `lab2-staging`.

---

### feat: database schema and idempotent seed data (Issue #2)
- **PR Link:** 

**Reviewer comment I received:**
> *(Paste reviewer feedback and checklist here)*

**How I responded:**
> *(Paste response here)*

---

### feat: development requester context and selection screen (Issue #3)
- **PR Link:** 

**Reviewer comment I received:**
> *(Paste reviewer feedback and checklist here)*

**How I responded:**
> *(Paste response here)*

---

### feat: create ticket feature with attachment upload (Issue #4)
- **PR Link:** 

**Reviewer comment I received:**
> *(Paste reviewer feedback and checklist here)*

**How I responded:**
> *(Paste response here)*

---

### feat: my tickets screen with search, filter, sort, and pagination (Issue #5)
- **PR Link:** 

**Reviewer comment I received:**
> *(Paste reviewer feedback and checklist here)*

**How I responded:**
> *(Paste response here)*

---

### feat: requester ticket detail and attachment management (Issue #6)
- **PR Link:** 

**Reviewer comment I received:**
> *(Paste reviewer feedback and checklist here)*

**How I responded:**
> *(Paste response here)*

---

### feat: e2e tests, responsive verification, and sprint integration (Issue #7)
- **PR Link:** 

**Reviewer comment I received:**
> *(Paste reviewer feedback and checklist here)*

**How I responded:**
> *(Paste response here)*

---

## Pull Requests I reviewed for my partner

### docs: define Lab 2 engineering contract
- **PR Link:** [#12](https://github.com/Kawi-HBLI/TokTickIT/pull/12)

**My comment:**
> ### Peer Review: APPROVED ✅
> The Lab 2 sprint engineering specification and test plan contract are thoroughly defined and align perfectly with all Lab 2 requirements:
> 
> - **Specification (`specification.md`):** Complete coverage of FRs, BRs, database models/indexes, API summaries, Given-When-Then ACs, and DoD.
> - **Test Plan (`tests.md`):** Comprehensive test breakdown across Unit, API, UI, Responsive, and E2E levels with full AC-to-Test traceability.
> - **UI & API Specs (`ui-spec.md`, `api-spec.md`):** Correct Zen Green palette tokens, responsive breakpoints, endpoints, headers (`x-requester-id`), and ownership failure handling.
> 
> #### Minor Recommendations:
> 1. Proceed with creating the remaining GitHub Issues on the project board to track progress cleanly.
> 2. Record this PR review in `docs/lab-02/reviewer.md` upon merging into `lab2-staging`.
> 
> Ready to merge and proceed to the next feature branch.

**Partner's response:**
> Noted. All seven Lab 2 Issues have now been created, with their implementation order and dependencies documented.
> 
> I will record this approval and review summary in `docs/lab-02/reviewer.md` after PR #12 is merged into `lab2-staging`.
> 
> The PR is ready to be merged.

---

### Issue 2
- **PR Link:** 

**My comment:**
> 

**Partner's response:**
> 

---

### Issue 3
- **PR Link:** 

**My comment:**
> 

**Partner's response:**
> 

---

### Issue 4
- **PR Link:** 

**My comment:**
> 

**Partner's response:**
> 

---

### Issue 5
- **PR Link:** 

**My comment:**
> 

**Partner's response:**
> 

---

### Issue 6
- **PR Link:** 

**My comment:**
> 

**Partner's response:**
> 

---

### Issue 7
- **PR Link:** 

**My comment:**
> 

**Partner's response:**
> 
