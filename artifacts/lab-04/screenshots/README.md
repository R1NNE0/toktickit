# Lab 4 screenshot gallery

46 actual Chromium PNGs from six passing capture scenarios. These capture scenarios are evidence collection, not additional product-regression passes. The existing Issue #54 results remain the regression record.

Capture base revision: `7ab7c86f232a37c47f28d1ee5796b3cea5082386`; branch: `docs/lab4-release-evidence`. HEAD/ref metadata was read directly without a Git command. Working-tree cleanliness was not inspected; selected product hashes and per-image timestamps are in [manifest.json](manifest.json). This is workspace evidence, not final-main verification.

All PNG hashes, dimensions and inventory were checked. Viewports are 1280x800, 768x1024 and 375x812; full-page image height can exceed viewport height. Dialog bottom images accompany scrollable captures. For the submission PDF, split tall views into readable panels rather than shrinking a whole page into illegible text; preserve the source PNGs.

Only the HTTP 503 safe-failure capture is response-injected; it is explicitly labelled. Other screen states use real backend operations and synthetic disposable fixtures. API/database comparison and authorization checks are recorded in the manifest without credentials. Attachment-note text names a synthetic diagnostic file; these captures do not claim that file was uploaded.

## Capture runs

```powershell
npx.cmd playwright test --config playwright.lab4-evidence.config.ts
```

Recorded scenarios: 3; all passed.

```powershell
$env:LAB4_EVIDENCE_APPEND='1'; npx.cmd playwright test --config playwright.lab4-evidence.config.ts -g 'Staff assigned work'
```

Recorded scenarios: 3; all passed.

## Staff and Administrator dashboards

| Image | Role | Viewport | PNG dimensions |
|---|---|---|---|
| [administrator-operational-desktop](staff-dashboard/administrator-operational-desktop.png) | ADMINISTRATOR | 1280x800 | 1280x1840 |
| [administrator-operational-mobile](staff-dashboard/administrator-operational-mobile.png) | ADMINISTRATOR | 375x812 | 375x2899 |
| [administrator-operational-tablet](staff-dashboard/administrator-operational-tablet.png) | ADMINISTRATOR | 768x1024 | 768x2282 |
| [assigned-work-desktop](staff-dashboard/assigned-work-desktop.png) | IT_STAFF | 1280x800 | 1280x1840 |
| [assigned-work-mobile](staff-dashboard/assigned-work-mobile.png) | IT_STAFF | 375x812 | 375x2882 |
| [assigned-work-tablet](staff-dashboard/assigned-work-tablet.png) | IT_STAFF | 768x1024 | 768x2282 |
| [operational-desktop](staff-dashboard/operational-desktop.png) | IT_STAFF | 1280x800 | 1280x1751 |
| [operational-mobile](staff-dashboard/operational-mobile.png) | IT_STAFF | 375x812 | 375x2771 |
| [operational-tablet](staff-dashboard/operational-tablet.png) | IT_STAFF | 768x1024 | 768x2193 |
| [safe-failure-injected-desktop](staff-dashboard/safe-failure-injected-desktop.png) | IT_STAFF | 1280x800 | 1280x800 |

## Requester dashboard and ownership

| Image | Role | Viewport | PNG dimensions |
|---|---|---|---|
| [active-drill-down-desktop](requester-dashboard/active-drill-down-desktop.png) | REQUESTER | 1280x800 | 1280x982 |
| [foreign-ticket-safe-error-desktop](requester-dashboard/foreign-ticket-safe-error-desktop.png) | REQUESTER | 1280x800 | 1280x800 |
| [genuine-empty-desktop](requester-dashboard/genuine-empty-desktop.png) | REQUESTER | 1280x800 | 1280x970 |
| [owned-activity-desktop](requester-dashboard/owned-activity-desktop.png) | REQUESTER | 1280x800 | 1280x1055 |
| [owned-activity-mobile](requester-dashboard/owned-activity-mobile.png) | REQUESTER | 375x812 | 375x1751 |
| [owned-activity-tablet](requester-dashboard/owned-activity-tablet.png) | REQUESTER | 768x1024 | 768x1218 |

## Actions Taken and immutable history

| Image | Role | Viewport | PNG dimensions |
|---|---|---|---|
| [administrator-capability-boundary-desktop](actions-taken/administrator-capability-boundary-desktop.png) | ADMINISTRATOR | 1280x800 | 1280x3467 |
| [append-only-history-desktop](actions-taken/append-only-history-desktop.png) | IT_STAFF | 1280x800 | 1280x800 |
| [append-only-history-mobile](actions-taken/append-only-history-mobile.png) | IT_STAFF | 375x812 | 375x812 |
| [append-only-history-tablet](actions-taken/append-only-history-tablet.png) | IT_STAFF | 768x1024 | 768x1024 |
| [complete-attribution-desktop](actions-taken/complete-attribution-desktop.png) | IT_STAFF | 1280x800 | 1280x800 |
| [complete-attribution-mobile](actions-taken/complete-attribution-mobile.png) | IT_STAFF | 375x812 | 375x812 |
| [complete-attribution-tablet](actions-taken/complete-attribution-tablet.png) | IT_STAFF | 768x1024 | 768x1024 |
| [create-follow-up-validation-desktop](actions-taken/create-follow-up-validation-desktop.png) | IT_STAFF | 1280x800 | 1280x800 |
| [create-follow-up-validation-mobile](actions-taken/create-follow-up-validation-mobile.png) | IT_STAFF | 375x812 | 375x812 |
| [create-follow-up-validation-tablet](actions-taken/create-follow-up-validation-tablet.png) | IT_STAFF | 768x1024 | 768x1024 |
| [edit-assignment-desktop](actions-taken/edit-assignment-desktop.png) | IT_STAFF | 1280x800 | 1280x800 |
| [multiple-actions-and-identities-desktop](actions-taken/multiple-actions-and-identities-desktop.png) | IT_STAFF | 1280x800 | 1280x3990 |
| [multiple-actions-and-identities-mobile](actions-taken/multiple-actions-and-identities-mobile.png) | IT_STAFF | 375x812 | 375x6774 |
| [multiple-actions-and-identities-tablet](actions-taken/multiple-actions-and-identities-tablet.png) | IT_STAFF | 768x1024 | 768x4557 |
| [requester-read-only-desktop](actions-taken/requester-read-only-desktop.png) | REQUESTER | 1280x800 | 1280x3480 |
| [requester-read-only-mobile](actions-taken/requester-read-only-mobile.png) | REQUESTER | 375x812 | 375x5413 |
| [requester-read-only-tablet](actions-taken/requester-read-only-tablet.png) | REQUESTER | 768x1024 | 768x3619 |

## Ticket workflow and resolution

| Image | Role | Viewport | PNG dimensions |
|---|---|---|---|
| [follow-up-resolution-gate-desktop](workflow/follow-up-resolution-gate-desktop.png) | IT_STAFF | 1280x800 | 1280x3990 |
| [follow-up-resolution-gate-mobile](workflow/follow-up-resolution-gate-mobile.png) | IT_STAFF | 375x812 | 375x6774 |
| [follow-up-resolution-gate-tablet](workflow/follow-up-resolution-gate-tablet.png) | IT_STAFF | 768x1024 | 768x4557 |
| [reopened-historical-cycle-desktop](workflow/reopened-historical-cycle-desktop.png) | IT_STAFF | 1280x800 | 1280x4176 |
| [reopened-historical-cycle-mobile](workflow/reopened-historical-cycle-mobile.png) | IT_STAFF | 375x812 | 375x6901 |
| [reopened-historical-cycle-tablet](workflow/reopened-historical-cycle-tablet.png) | IT_STAFF | 768x1024 | 768x4675 |
| [resolution-blocked-no-actions-desktop](workflow/resolution-blocked-no-actions-desktop.png) | IT_STAFF | 1280x800 | 1280x2303 |
| [resolution-blocked-no-actions-mobile](workflow/resolution-blocked-no-actions-mobile.png) | IT_STAFF | 375x812 | 375x3872 |
| [resolution-blocked-no-actions-tablet](workflow/resolution-blocked-no-actions-tablet.png) | IT_STAFF | 768x1024 | 768x2797 |
| [resolution-confirmation-desktop](workflow/resolution-confirmation-desktop.png) | IT_STAFF | 1280x800 | 1280x800 |
| [resolution-confirmation-mobile](workflow/resolution-confirmation-mobile.png) | IT_STAFF | 375x812 | 375x812 |
| [resolution-confirmation-tablet](workflow/resolution-confirmation-tablet.png) | IT_STAFF | 768x1024 | 768x1024 |
| [resolved-terminal-read-only-desktop](workflow/resolved-terminal-read-only-desktop.png) | IT_STAFF | 1280x800 | 1280x4064 |

## Inspection and remaining human review

Representative AI visual inspection covered: desktop history and resolution confirmation; mobile Staff dashboard (empty and nonzero personal-work previews), Requester activity, and follow-up validation. The rendered labels, text statuses, attribution/history IDs and validation placement were visible; no page-level horizontal overflow was detected by the capture assertions. The mobile validation image is scrolled to the invalid follow-up field, rather than showing the entire form. This is not a claim that every PNG received human approval.

- [ ] Student/peer inspect all major states and screen sizes, record identity/date/findings, and complete visual/accessibility sign-off.
- [ ] Select readable panels for Answer Parts 5-9 and render the UI specification.
- [ ] Supply actual final-main revision/logs and GitHub review evidence separately.
