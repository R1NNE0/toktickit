# Lab 3 screenshot evidence - Issue #36

Initially captured on 2026-09-22 using Chromium and the real integrated application, at base revision `8fdcc590a9552b912dc3034a524dde0f35bc27c2` on `feat/lab3-final-release-evidence`. This is workspace evidence, not future final-main verification or human peer approval. No screenshots existed in this directory at the start of Issue #36; all 64 PNGs below are new. No prior screenshots were reused in that initial capture. On 2026-09-26, only the six Staff detail/confirmation images were recaptured after the owner metadata correction; the other 58 originals and their manifest entries are unchanged. The manifest update records the uncommitted application-file hashes and per-image provenance.

Desktop: **1280x800 (23 images)**. Tablet: **768x1024 (21 images)**. Mobile: **375x812 (20 images)**. Full-page image heights can exceed viewport height; widths remain native. Open long pages at native width and scroll, or use readable sections in the submission PDF rather than shrinking an entire long queue onto one page. Modal captures show their entire dialog at the configured viewport. The tablet My Tickets table has a paired right-edge image; together they expose every column.

The [manifest](manifest.json) is the exact per-file inventory: role, state, viewport, PNG dimensions, SHA-256, capture scope and any simulated response. Files follow `<state>-<viewport>.png`, with `-right` for the companion table image. The helper also supports `-bottom` for a scrollable dialog; none was needed in this run.

## Capture method and privacy

From e2e, run `npx.cmd playwright test --config playwright.evidence.config.ts`. This opt-in configuration reuses the existing guarded launcher and fixtures, runs one worker with no retries, and writes runner output separately under ignored `e2e/test-results/evidence/`. The normal `npm.cmd test` still targets only `e2e/lab-03/`.

The disposable PostgreSQL database is `toktickit_lab3_test` at localhost:55433, with uploads under `server/uploads/lab-03-test`; development data/bytes are not used. Accounts, tickets, comments and the PDF attachment are synthetic. Other names visible in queue rows are the existing synthetic test seed. Login credentials are generated in memory; every password input is masked in screenshots, including empty inputs. No cookies, CSRF/session tokens, request headers, terminal credentials or developer tools are captured. Traces/videos remain disabled. Actor records and uploaded fixture bytes are cleaned up by the existing fixture.

Creation/upload/resolution success images follow actual successful requests. The Staff loading image deliberately holds a request, and safe-failure deliberately injects HTTP 500; both are labeled in the manifest. These two states are captured only on desktop. No successful response is fabricated. Fixture seeding establishes the prior Staff reply, private note and waiting status before the Requester journey.

## Inventory

Each link below resolves to an actual original PNG.

| Screen/state | Desktop | Tablet | Mobile |
|---|---|---|---|
| authentication/login | [desktop](authentication/login-desktop.png) | [tablet](authentication/login-tablet.png) | [mobile](authentication/login-mobile.png) |
| authentication/login-validation | [desktop](authentication/login-validation-desktop.png) | [tablet](authentication/login-validation-tablet.png) | [mobile](authentication/login-validation-mobile.png) |
| authentication/login-failure | [desktop](authentication/login-failure-desktop.png) | Not separately captured | Not separately captured |
| authentication/mandatory-change | [desktop](authentication/mandatory-change-desktop.png) | [tablet](authentication/mandatory-change-tablet.png) | [mobile](authentication/mandatory-change-mobile.png) |
| requester-regression/my-tickets-empty | [desktop](requester-regression/my-tickets-empty-desktop.png) | [tablet](requester-regression/my-tickets-empty-tablet.png) | [mobile](requester-regression/my-tickets-empty-mobile.png) |
| requester-regression/create-ticket | [desktop](requester-regression/create-ticket-desktop.png) | [tablet](requester-regression/create-ticket-tablet.png) | [mobile](requester-regression/create-ticket-mobile.png) |
| requester-regression/create-success | [desktop](requester-regression/create-success-desktop.png) | [tablet](requester-regression/create-success-tablet.png) | [mobile](requester-regression/create-success-mobile.png) |
| requester-regression/ticket-detail | [desktop](requester-regression/ticket-detail-desktop.png) | [tablet](requester-regression/ticket-detail-tablet.png) | [mobile](requester-regression/ticket-detail-mobile.png) |
| requester-regression/resolution-confirmation | [desktop](requester-regression/resolution-confirmation-desktop.png) | [tablet](requester-regression/resolution-confirmation-tablet.png) | [mobile](requester-regression/resolution-confirmation-mobile.png) |
| requester-regression/resolution-indicated | [desktop](requester-regression/resolution-indicated-desktop.png) | [tablet](requester-regression/resolution-indicated-tablet.png) | [mobile](requester-regression/resolution-indicated-mobile.png) |
| requester-regression/my-tickets | [desktop](requester-regression/my-tickets-desktop.png) | [tablet](requester-regression/my-tickets-tablet.png), [Right edge](requester-regression/my-tickets-tablet-right.png) | [mobile](requester-regression/my-tickets-mobile.png) |
| staff-queue/queue | [desktop](staff-queue/queue-desktop.png) | [tablet](staff-queue/queue-tablet.png) | [mobile](staff-queue/queue-mobile.png) |
| staff-queue/no-results | [desktop](staff-queue/no-results-desktop.png) | [tablet](staff-queue/no-results-tablet.png) | [mobile](staff-queue/no-results-mobile.png) |
| staff-queue/loading | [desktop](staff-queue/loading-desktop.png) | Not separately captured | Not separately captured |
| staff-queue/safe-failure | [desktop](staff-queue/safe-failure-desktop.png) | Not separately captured | Not separately captured |
| staff-ticket-detail/detail | [desktop](staff-ticket-detail/detail-desktop.png) | [tablet](staff-ticket-detail/detail-tablet.png) | [mobile](staff-ticket-detail/detail-mobile.png) |
| staff-ticket-detail/status-confirmation | [desktop](staff-ticket-detail/status-confirmation-desktop.png) | [tablet](staff-ticket-detail/status-confirmation-tablet.png) | [mobile](staff-ticket-detail/status-confirmation-mobile.png) |
| user-management/directory | [desktop](user-management/directory-desktop.png) | [tablet](user-management/directory-tablet.png) | [mobile](user-management/directory-mobile.png) |
| user-management/create-user | [desktop](user-management/create-user-desktop.png) | [tablet](user-management/create-user-tablet.png) | [mobile](user-management/create-user-mobile.png) |
| user-management/edit-user | [desktop](user-management/edit-user-desktop.png) | [tablet](user-management/edit-user-tablet.png) | [mobile](user-management/edit-user-mobile.png) |
| user-management/initial-password-reset | [desktop](user-management/initial-password-reset-desktop.png) | [tablet](user-management/initial-password-reset-tablet.png) | [mobile](user-management/initial-password-reset-mobile.png) |
| user-management/self-deactivation-protected | [desktop](user-management/self-deactivation-protected-desktop.png) | [tablet](user-management/self-deactivation-protected-tablet.png) | [mobile](user-management/self-deactivation-protected-mobile.png) |
| staff-ticket-detail/administrator-permitted-detail | [desktop](staff-ticket-detail/administrator-permitted-detail-desktop.png) | [tablet](staff-ticket-detail/administrator-permitted-detail-tablet.png) | [mobile](staff-ticket-detail/administrator-permitted-detail-mobile.png) |

## Inspection and findings

Agent inspection on 2026-09-22 reviewed overview sheets for all primary captures and original-size examples for Staff detail, mobile dialogs, queue and tablet tables; the final added tablet right-edge image was also inspected. This is not a human review or exhaustive accessibility certification. The overview sheets were temporary inspection aids under ignored runner output, not substituted for original evidence.

- All five required groups exist at all three viewports: authentication, Staff Queue, Staff Ticket Detail, Administrator User Management and Requester continuity. Login/validation/mandatory change, queue/no-results, detail/comments/notes/attachments/indication, status confirmation, directory/create/edit/reset/self-deactivation and Administrator permitted detail are represented.
- Browser capture assertions passed for horizontal document bounds at every capture. Existing responsive.spec.ts separately covers long text/files/email and queue 767/768/991/992 boundaries. Those bounds do not prove that every inner element or semantic label is correct.
- **V-01 resolved, 2026-09-26:** the shared detail query and formatter now preserve owner role/isActive. API exact-shape, component label and real-session browser assertions passed for Staff, Administrator and unassigned owners. All six refreshed Staff detail/confirmation images were inspected; the displayed Staff owner is correct. See [tests.md section 11](../../../docs/lab-03/tests.md#11-owner-metadata-blocker-correction-2026-09-26).
- **Presentation follow-up V-02:** tablet Requester My Tickets shows a clipped signed-in header label; the default select text is shortened, and table columns require horizontal scrolling (both sides captured). The tablet User Management Actions heading wraps mid-word. Review these at native size before asserting complete no-clipping/readability compliance. The abbreviated Password Change Req badge is actual UI text, not a hidden screenshot crop.
- **Coverage follow-up V-03:** not every saving/forbidden/not-found/conflict/session-expiry state has its own screenshot on every viewport. Relevant component/API/browser tests cover many of these states; tests.md lists genuine remaining coverage gaps. No screenshot is claimed for a missing state. Exhaustive non-auth field semantics, focus visibility and 44px targets still require manual accessibility review.
- Human visual sign-off remains pending. V-01 was closed by the targeted application fix and regression verification, not geometry assertions alone. V-02/V-03 and full ui-spec.md sign-off remain open. Permission/status rules and frontend product rendering were unchanged.

## Observed capture commands

All commands below ran from e2e on 2026-09-22. Repeated runs followed concrete capture-helper failures or missing-column evidence; no full backend/client/regression suite was rerun.

| Command | Result |
|---|---|
| `npx.cmd playwright test --config playwright.evidence.config.ts --grep desktop --max-failures=1` (initial) | 0 passed, 1 failed: error-state interception raced a preceding queue request; helper synchronization corrected |
| Same focused desktop command (after correction) | 1 passed, 0 failed, 0 skipped; 26.7s |
| `npx.cmd playwright test --config playwright.evidence.config.ts` (first three-viewport run) | 2 passed, 1 failed: mobile locator selected the hidden desktop table copy; corrected to the visible card |
| Same three-viewport command (after locator correction) | 3 passed, 0 failed, 0 skipped; 48.5s; 63 images |
| Same three-viewport command (final, paired table evidence) | **3 passed, 0 failed, 0 skipped; 45.7s; 64 images** |

The screenshot checks assert successful capture/geometry and selected UI states, not every product assertion. The prior 249 server / 83 client / 11 E2E results are historical. The owner correction was verified on 2026-09-26 with 252 server / 87 client / 11 E2E passing cases and both builds; see tests.md section 11.

## Human release follow-up

Review the verified V-01 correction and disposition of the remaining technical/visual coverage gaps. Complete reviewer.md and ai-use.md manually with real evidence and reflection. Follow feature review into lab3-staging, then a reviewed lab3-staging -> main release; record actual final-main output and prepare the required Answer Part 1-9 PDF. No review, PR, approval, merge or final-main result is asserted by this index.

## Selective owner-label refresh (2026-09-26)

From e2e:

```powershell
$env:LAB3_EVIDENCE_OWNER_ONLY='1'
npx.cmd playwright test --config playwright.evidence.config.ts
Remove-Item Env:LAB3_EVIDENCE_OWNER_ONLY
```

Result: **3 passed, 0 failed, 0 skipped (21.0s)**. The helper executes the same synthetic setup but saves only detail and status-confirmation at the three viewports; it asserts the actual owner label before capture and merges only those six manifest entries.

Refreshed files:

- [detail-desktop.png](staff-ticket-detail/detail-desktop.png)
- [detail-tablet.png](staff-ticket-detail/detail-tablet.png)
- [detail-mobile.png](staff-ticket-detail/detail-mobile.png)
- [status-confirmation-desktop.png](staff-ticket-detail/status-confirmation-desktop.png)
- [status-confirmation-tablet.png](staff-ticket-detail/status-confirmation-tablet.png)
- [status-confirmation-mobile.png](staff-ticket-detail/status-confirmation-mobile.png)

The six originals were regenerated, with five changed PNG hashes; mobile confirmation is byte-identical because the owner label is outside its modal viewport. The other 58 images were neither regenerated nor altered. No new screenshot group or product feature was introduced. The manifest retains the original capture metadata and appends the selective update with UTC timestamp and application SHA-256 hashes; dates above use Asia/Bangkok.
