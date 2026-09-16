# Lab 3 UI and Responsive Specification

Status: **Engineering decisions approved through Phase 2.2 — screens not implemented or visually verified.**
Policy: [specification.md](specification.md), especially §6. Wire behavior: [api-spec.md](api-spec.md). Preserve React/Bootstrap and the actual [Lab 2 tokens](../../client/src/index.css); do not implement the inaccurate alternate palette in README.

## 1. Zen Green foundation

| Existing token | Value | Use |
|---|---|---|
| --primary-green | #006b3c | Header, primary actions |
| --secondary-green | #0b7a46 | Hover, links, focus accents |
| --pale-green | #eaf6ef | Subtle emphasis/selection |
| --page-bg / --surface-card | #f5f7f6 / #ffffff | Page and cards |
| --border-neutral | #e5e7eb | Borders |
| --text-primary / --text-muted | #1f2937 / #6b7280 | Text and secondary labels |
| --readonly-bg | #f3f4f6 | Non-editable values |
| --error-red / --error-light | #dc2626 / #fee2e2 | Errors/destructive actions |
| --warning-amber / --warning-light | #d97706 / #fef3c7 | Meaningful warnings |
| --success-green / --success-light | #16a34a / #dcfce7 | Success feedback |

Retain system font, 4px spacing increments, restrained borders/shadows, 24px page titles, 18px section titles and 14px labels/body. Labels sit above controls; mandatory fields show a red asterisk plus programmatic required state. Use white editable controls, shaded read-only value panels, associated red field messages, visible focus and disabled/busy buttons. Make interactive targets at least 44px high without requiring every compact read-only row to be that tall.

Reuse/extract existing zen-card, button styles, Header, attachment presentation and badge patterns only where needed. Proposed shared components: FormField, StatusBadge, PriorityBadge, RoleBadge, FeedbackPanel, Pagination, ConfirmDialog, AttachmentSection. Avoid a wholesale component-library rewrite. Always use visible text alongside icons/colors; user content is escaped plain text with safe wrapping and line breaks.

Retain existing five status badge styles. **ED-10:** Waiting for Requester uses warning styling, Reopened uses existing open/indigo styling plus its full label, Cancelled uses neutral styling plus full label. Keep LOW/MEDIUM/HIGH/CRITICAL styles; label Requested Priority and IT Priority distinctly. Role badges show Requester, IT Staff, Administrator in text and do not imply inherited permissions.

## 2. Application shell and access states

Application flow: bootstrap current user -> Login, Mandatory Change Password, or permitted shell. Never flash prior/private data during bootstrap. Derive identity solely from `/auth/me`/login response; remove Development Requester selector, persona banners, Switch/Change Requester and localStorage identity.

| Role/state | Navigation and entry |
|---|---|
| Signed out | Login; retain non-sensitive Lab 1 System Status diagnostic card |
| Mandatory change | Change Password and Logout only; normal destinations unavailable |
| Requester | My Tickets (default), Create Ticket, own Ticket Detail |
| IT Staff | Ticket Queue (default), Staff Ticket Detail |
| Administrator | User Management (default); known-ticket Detail with IT Priority editing and comment/note reads; no Staff Queue or other operational controls under ED-05 |

Normal shell shows TokTickIT, authenticated name, exact role, active-page indication, Change Password and Logout. Desktop navigation is inline; mobile uses an accessible expandable menu with the same destinations (do not simply hide navigation). Provide safe Access Denied and Not Found panels with a return-to-role-home action.

**Approved ED-05/10:** support lightweight hash deep links using existing App navigation, such as `#/tickets/123`, without requiring a routing-library migration. An Administrator opening a known ticket deep link sees grouped Ticket Detail, Public Comments and Internal Notes, plus an editable IT Priority dropdown and Save Priority action. Readable comments/notes and IT Priority participation follow Lab 3 §4.4–4.6; read-only general Ticket Detail access is an approved matrix choice, with a separate IT Priority update action for accessible tickets regardless of ownership. Other ticket fields and discussion entries are read-only for Administrator. Queue, claim/reassignment, status changes, discussion posting and attachment-byte operations remain absent as approved ED-05 choices, not blanket handout prohibitions. The server authorizes every read and priority write; no further authorization approval is pending for this scope.

On confirmed logout or session expiry, clear identity, tickets/details, pending file/form state and previous-account async results before showing Login. Unsaved input may prompt before a voluntary logout/navigation; this cannot preserve authenticated access after server expiry/revocation. If logout fails due to network loss, show “Logout could not be confirmed. Retry.” Hide private content locally; do not claim server revocation. A returned 401 counts as already signed out.

## 3. Login

Centered Zen card, max-width approximately 480px: page title, Email and Password labels, required markers, Sign In primary button. Email autocomplete=username; password autocomplete=current-password; permit paste/password managers. Optional reveal button must be labeled and keyboard accessible. No registration, social-login, invitation or email-reset links.

States: empty form; inline missing/malformed email/password validation; signing-in spinner and disabled submit; generic safe credential failure; rate-limit message with retry time; connection failure and Retry. Wrong, unknown and inactive accounts use the same wording from api-spec.md, with a contact-administrator suggestion; never say an email is registered. Never persist/log the password; clear it on completed successful login. A must-change response routes only to the mandatory screen.

## 4. Mandatory and voluntary Change Password

Show current/initial password, New Password, Confirm New Password; current-password/new-password autocomplete as appropriate. Explain 15–128 characters, spaces allowed, no current-password reuse. Use the same validation on frontend/backend and show mismatched confirmation near confirmation field.

Mandatory mode explains why the change is required; no cancel-to-application or re-login action. Only current-user/CSRF bootstrap, password change and logout are permitted for the restricted session; a direct login request returns 403 PASSWORD_CHANGE_REQUIRED and leaves it restricted. Saving disables submit; errors preserve nonsecret context and permit retry; successful response rotates the session and enters the correct role home. Normal application remains unavailable if save fails or a direct navigation is attempted. Voluntary mode uses the same form and allows Cancel back to role home. Clear password fields when leaving/succeeding, never store them in localStorage, URLs, analytics or error messages.

## 5. Requester continuity

### Create Ticket

Preserve category/system loading, classification fields, requested priority, summary/description, file selection, inline validation, busy submit, server number confirmation, and dirty-form warning. Display authenticated Requester read-only; show Ticket Number/Date as server-assigned after save rather than inventing final values in advance. IT Priority is read-only and initially reflects Requested Priority.

Fields follow API limits. Five active attachments maximum, 5 MB each, JPG/JPEG/PNG/WEBP/PDF. Explain allowed types and show selected filenames/sizes/removal controls. Submit ticket JSON then individual files. On partial failure, show “Ticket TKT-… created; some files were not uploaded,” list failed files and Retry Failed Uploads; do not create another ticket. After ambiguous upload failure, refresh metadata before retrying. Permit going to detail to inspect/retry. Preserve ticket input on create failure; keep retry identity key until reset/new submission.

### My Tickets

Preserve owned list, 300ms search debounce, category/status/requested-priority filters, Clear Filters, desktop rows/mobile cards and pagination. Add visible Sort By / Direction controls for API-supported fields; default newest first, ten items/page. Filter changes reset page to 1. Show active `attachmentCount` returned by the API, not a count from an absent attachments array. Do not display other users' tickets while refetching after an identity change.

Use compact number/summary, category, status, requested priority, IT priority and updated-date grouping. Distinguish no tickets from no matching filters; include Create Ticket in the former and Clear Filters in the latter. On failed fetch, label any retained data as stale or replace with Retry feedback; never imply stale results are current.

### Requester Ticket Detail and Attachments

Show grouped read-only number/date, Requester, summary/description, category/system, both priorities, status, owner and timestamps. Keep active/removed file metadata, download/removal dialogs, mandatory reason and retained removal record. **ED-10 bounded repair:** add the required Add Attachment action to existing detail, using the shared upload section and the same constraints. Removed files have a Removed label, reason/time and no download/preview. Conflict refreshes metadata; failed actions display inline feedback without faking success.

Add Public Comments with author/time, multiline composer, 4000-character limit, busy state and paginated chronological entries (10/page; Load More). No Internal Notes section, counts, hidden note data, or note requests for Requesters.

Add “Problem Appears Resolved” only for own tickets in the five permitted active-workflow states. Confirm explanatory text: “This informs IT Staff; it does not close your ticket.” Show submitted timestamp/indicator after success and prevent unnecessary repeat clicks. After IT Staff reopens the ticket, reload its server state, clear the previous indication/timestamp, and re-enable the action for the new work cycle; the Requester still performs no formal status transition. Formal status controls never appear; Requester may describe a reopening request in Public Comments.

## 6. IT Staff Ticket Queue

Search ticket number/summary/description; status, category, requested priority, IT priority and owner/unassigned filters; Clear Filters; one Sort By/Direction control; page sizes 10/20/50. Show matching count, assigned/unassigned owner labels, and explicit Open Detail action. Query parameters/default ordering exactly match api-spec.md.

| Viewport | Representation |
|---|---|
| Desktop >=992px | Approximately six grouped columns: Ticket Number + Summary + Requester; Category; Requested + IT Priority; Status; Owner; Last Updated + Open Detail. Avoid a separate column for every field |
| Tablet 768–991px | Two-column filter layout; compact rows/cards with secondary metadata on another line; no page-wide overflow |
| Mobile <768px | Single-column filters in an expandable region; stacked ticket cards with labeled priorities/status/owner/update and a full accessible Open Detail action |

Loading, empty shared queue, no matching results, forbidden, and network failure states must be distinct. Preserve filters after detail/back navigation. Prevent out-of-order searches replacing the latest results. No KPI dashboard, saved searches or complex multi-sort interface.

## 7. IT Staff Ticket Detail

- Read-only ticket identity/submission section reuses Requester detail; Requester, Requested Priority, category/system, summary/description remain noneditable.
- Operational section: owner/Unassigned display, Claim button when unassigned, assignee dropdown containing active IT Staff/Administrators, explicit Save Owner; IT Priority dropdown and Save Priority; Current Status and allowed next-status dropdown only.
- Owner assignment and status are separate. Submit only the action fields; no version/timestamp token is required. A business-rule 409 (such as an already claimed ticket or invalid transition) shows the actual reason and offers refresh. Ordinary priority edits do not promise stale-form detection; same-field edits use the last successful write.
- Resolve/close/cancel/reopen confirmation dialogs explain the effect; cancel/reopen require a public reason. Owner-required transitions show useful inline validation. Exact edges are in specification §6.2, not a separate UI-only matrix.
- Public Comments use a section labeled “Public — visible to the Requester.” Internal Notes use a separate section labeled “Internal — IT Staff and Administrator only,” a separate composer and submit button. Never share a composer with a hidden visibility toggle or accidentally retain text across sections.
- Both entry lists show author/time, plain text, 4000-character validation, loading/empty/failure feedback and Load More. Notes have no edit/delete controls.
- Show Requester resolution indication near operational status without labeling the ticket Resolved automatically.
- Attachments reuse the same section; Staff can add/download/soft-remove permitted files, but removed bytes stay blocked for every role.

Stack operational controls and communication sections on mobile. Keep cancel/confirm reachable with keyboard, preserve unsaved text on recoverable save errors and restore focus to the triggering control on modal close.

### Administrator Ticket Detail capability view

The approved per-capability authorization and classification are in specification.md §6.1. Ticket Detail provides read-only permitted information and a separate IT Priority action for accessible tickets, including tickets unassigned or assigned to another user. Reuse the detail presentation and IT Priority control; do not create an Administrator copy of the full Staff workflow. Call GET `/tickets/:id` for context and PATCH `/staff/tickets/:id/priority` with `{ itPriority }` for the one permitted field change. Show loading/saving/success, invalid priority, expired/mandatory-change session, safe failure and not-found feedback. Do not invent a stale-version 409 for priority updates. Requested Priority remains read-only; preserve it after every successful change. No claim/reassign/status controls or public/internal composers appear. Show attachment metadata without upload/download/removal actions. An active Administrator can appear as owner in the Staff assignee dropdown, but eligibility does not make these additional controls available. Exercise this capability view at the existing desktop/tablet/mobile viewports; a URL prefix or hidden button is never sufficient authorization.

## 8. Administrator User Management

One screen with name/email search, optional single role filter, Create User button, and columns Name, Email, Role, Status, Edit. Name ascending ordering; no pagination/multi-sort/bulk/delete/export controls. Mobile rows become cards preserving the five fields and Edit.

- Create mode: name, email, single role select, active checkbox, masked initial password with reveal and clear local handover guidance. Fields and lengths match api-spec.md; save only after validation.
- Edit mode: same basic fields without an always-present password value; submit only changed allowed fields, with no timestamp/version token. Separate Set New Initial Password action opens a small dialog, explains session revocation/next-login change and requires confirmation.
- Warn that deactivation or role change to Requester unassigns operational tickets; historical ticket submissions/comments remain. Never imply deleting an account.
- Disable self-deactivation as helpful feedback and still handle server rejection. Explain last-active-Administrator protection; the backend is decisive even if another admin changes state after the form loaded.
- Duplicate email maps to the email field; invalid role to the role control; last-admin/self-deactivation conflicts show actionable messages without claiming success.
- Success refreshes safe list data. Non-Administrator direct access shows Access Denied; no user list should render first. If editing/resetting self revokes the current session, clear state and return to login.

## 9. State and feedback contract

| State | Required presentation |
|---|---|
| Bootstrap/loading | Labeled status/spinner; private/previous-user content withheld |
| Saving | Action-specific busy text, duplicate submit disabled, other safe navigation clearly handled |
| Success | Confirm actual backend outcome and relevant ticket number/account; partial upload has its own warning |
| Validation | Field-associated text, aria-invalid/aria-describedby, focus first invalid field |
| Empty | Explain no records yet; appropriate permitted next action |
| No results | Explain active filters; Clear Filters |
| Forbidden | Access Denied and role-home link; no forbidden resource content |
| Not found | Neutral unavailable/not-found message; do not distinguish another Requester's resource |
| Conflict | Explain data changed or rule prevents action; reload/review instead of overwriting |
| API/network failure | Safe message + retry; retain ordinary input where safe; never show secrets/internal errors |
| Expired/revoked session | Clear private state, return to login; mandatory-change responses go to restricted change screen |

Use role=status/aria-live for asynchronous feedback, role=alert for actionable errors, and accessible dialogs with focus containment/Escape/return-focus behavior. Never depend only on color, an icon, or a tooltip.

## 10. Responsive/accessibility verification and artifacts

Required captures: desktop 1280x800, tablet 768x1024, mobile 375x812; also inspect 767/768 and 991/992 breakpoint boundaries. Wrap long filenames, email addresses, descriptions and unbroken text. No horizontal page overflow, clipped labels, overlapping errors, hidden navigation or inaccessible dialog buttons.

Planned screenshot directories (not created in Phase 2):

- `artifacts/lab-03/screenshots/authentication/`
- `artifacts/lab-03/screenshots/staff-queue/`
- `artifacts/lab-03/screenshots/staff-ticket-detail/`
- `artifacts/lab-03/screenshots/user-management/`
- `artifacts/lab-03/screenshots/requester-regression/` (additional continuity evidence)

Record viewport/state/role and tested commit for each actual capture. Automate semantic/style assertions and browser dimensions, then visually inspect screenshots; jsdom rendering alone cannot prove responsiveness.

- [ ] Tokens, typography, buttons, badges and read-only fields match the contract.
- [ ] Required/invalid labels and feedback remain readable and programmatically associated.
- [ ] Keyboard navigation, visible focus, dialogs and mobile menu work.
- [ ] All relevant states in §9 captured/tested without fake success.
- [ ] Long content wraps with no clipping/overlap/page overflow at all viewports.
- [ ] Requester/Staff/Admin visibility verified in UI and direct API tests.
- [ ] Actual screenshots reviewed and linked from tests.md; no captures exist yet.
