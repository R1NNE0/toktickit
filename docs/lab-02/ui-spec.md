# Lab 2 UI & Responsive Specification (Zen Green Theme)

## 1. Design System & Zen Green Tokens

### 1.1 Color Tokens
| Token Name | Hex Code | Purpose / UI Placement |
| :--- | :--- | :--- |
| **Primary Green** | `#006B3C` | App header bar, Primary CTAs (Submit, Create Ticket), key branding |
| **Secondary Green** | `#0B7A46` | Active tab indicators, focus rings, hover states on interactive links/buttons |
| **Pale Green** | `#EAF6EF` | Selected table rows, subtle card accents, success toast backgrounds |
| **Page Background** | `#F5F7F6` | Main layout canvas background (neutral near-white) |
| **Card Surface** | `#FFFFFF` | Form containers, modal dialogs, data table cards |
| **Border Neutral** | `#E5E7EB` | Subtle card borders, table dividers, input borders in neutral state |
| **Text Primary** | `#1F2937` | Dark charcoal-green for body text, headings, and labels |
| **Text Muted** | `#6B7280` | Placeholder text, secondary metadata, helper text |
| **Read-Only Shading** | `#F3F4F6` | Background fill for non-editable fields (e.g. Ticket Number, Timestamps) |
| **Error Primary** | `#DC2626` | Red borders on invalid inputs, field error text, destructive action buttons |
| **Error Light** | `#FEE2E2` | Light red callout background for global failure banners |
| **Warning Amber** | `#D97706` | Amber badges (High Priority, Pending), confirmation warnings |
| **Warning Light** | `#FEF3C7` | Background for warning callout boxes |
| **Success Green** | `#16A34A` | Success confirmation icon, Resolved status badge, positive highlights |
| **Success Light** | `#DCFCE7` | Background for success alerts and confirmations |

### 1.2 Typography & Spacing
- **Font Family:** System UI font stack (`Inter`, `-apple-system`, `BlinkMacSystemFont`, `"Segoe UI"`, `Roboto`, `sans-serif`).
- **Headings:**
  - `H1` (Page Title): `24px / 1.5`, Semi-bold (`font-weight: 600`), `#1F2937`
  - `H2` (Section Heading): `18px / 1.4`, Semi-bold (`font-weight: 600`), `#1F2937`
  - `H3` (Card Header): `16px / 1.4`, Medium (`font-weight: 500`), `#374151`
- **Body & Labels:**
  - Label: `14px / 1.4`, Medium (`font-weight: 500`), `#374151`, with mandatory red `*` (`#DC2626`)
  - Input Text: `14px / 1.5`, Regular (`font-weight: 400`), `#1F2937`
  - Helper & Validation Text: `12px / 1.4`, Regular (`font-weight: 400`)
- **Spacing Scale:** Standard 4px grid (`4px`, `8px`, `12px`, `16px`, `20px`, `24px`, `32px`).

---

## 2. Component Hierarchy & State Specifications

### 2.1 Form Controls & Input States
- **Editable Controls:** White background (`#FFFFFF`), 1px solid border (`#D1D5DB`), border-radius `6px`, padding `8px 12px`, consistent height `40px` (except multi-line `textarea` min-height `100px`).
- **Read-Only / Disabled Controls:** Background `#F3F4F6`, border `#E5E7EB`, text `#6B7280`, cursor `not-allowed`.
- **Focused Controls:** 2px outline / box-shadow in Secondary Green (`#0B7A46` with 20% opacity).
- **Invalid Controls:** 1px solid red border (`#DC2626`), background `#FFF5F5`. Validation message appears directly below the field in dark red text (`#DC2626`, `12px`).
- **Required Indicator:** Mandatory red asterisk `*` rendered in `#DC2626` right after label text.

### 2.2 Button Hierarchy & Interactive States
1. **Primary Button:** Background `#006B3C`, text `#FFFFFF`, hover `#0B7A46`, active `#00502D`.
2. **Secondary / Outline Button:** Background `#FFFFFF`, border `1px solid #006B3C`, text `#006B3C`, hover `#EAF6EF`.
3. **Tertiary / Ghost Button:** Background transparent, text `#0B7A46`, hover background `#F3F4F6`.
4. **Destructive Button:** Background `#DC2626`, text `#FFFFFF`, hover `#B91C1C`.
5. **Disabled State:** Background `#E5E7EB`, text `#9CA3AF`, cursor `not-allowed`, zero hover transform.
6. **Busy / Submitting State:** Shows animated loading spinner, text altered (e.g., "Submitting..."), disabled against duplicate clicks.

### 2.3 Status & Priority Badge System
- **Status Badges:**
  - `NEW`: Background `#DBEAFE`, text `#1E40AF` (Blue)
  - `OPEN`: Background `#E0E7FF`, text `#3730A3` (Indigo)
  - `IN_PROGRESS`: Background `#FEF3C7`, text `#92400E` (Amber)
  - `RESOLVED`: Background `#DCFCE7`, text `#166534` (Green)
  - `CLOSED`: Background `#F3F4F6`, text `#4B5563` (Neutral)
- **Priority Badges:**
  - `LOW`: Background `#F3F4F6`, text `#4B5563` (Muted)
  - `MEDIUM`: Background `#FEF3C7`, text `#92400E` (Warm amber)
  - `HIGH`: Background `#FFEDD5`, text `#C2410C` (Orange)
  - `CRITICAL`: Background `#FEE2E2`, text `#991B1B` (Red)

---

## 3. Screen Layouts & Workflows

### 3.1 Application Shell & Navigation
- **Top Header Bar:** Zen Green branding (`#006B3C`), TokTickIT logo + title.
- **Nav Links:** "My Tickets", "Create Ticket". Active link has a solid white pill or underline indicator.
- **Active Requester Persona Pill:** Displays avatar initial, requester name, and a "Change Requester" button on the top-right.

### 3.2 Development Requester Selection Screen
- Centered modal/card (`max-width: 480px`) on light green background `#F5F7F6`.
- Clear info banner: *"Development Persona Switcher — For testing only. Authentication arriving in Lab 3."*
- Dropdown select listing active requesters (`name (email)`).
- "Continue" primary button to establish context and route to My Tickets.
- Loading spinner when fetching requesters; error banner if API fails.

### 3.3 Create Ticket Screen
- **Breadcrumbs:** `Home / Create Ticket`
- **Layout Structure:**
  - Card 1: Ticket Classification (Category dropdown `*`, Related System dropdown `*`, Requested Priority dropdown).
  - Card 2: Issue Details (Summary single-line input `*`, Description multi-line textarea `*`).
  - Card 3: Attachments Section (Drag-and-drop zone, file size/type helper text, attachment preview list with delete buttons).
  - Bottom Action Bar: "Cancel" outline button and "Submit Ticket" primary button.
- **States:**
  - Initial clean state.
  - Validation error state (inline red errors below fields).
  - Busy submitting state (disabled button + spinner).
  - Global error state (banner if backend down, form data intact).
  - Success state (modal / banner showing generated `TKT-2026-XXXXXX` and CTA to view ticket).

### 3.4 My Tickets Screen
- **Top Bar:** Page title "My Tickets", subtitle "View and track all your support requests", and "Create Ticket" primary CTA.
- **Search & Filter Bar:**
  - Text search input: "Search by ticket number or summary..."
  - Category dropdown filter.
  - Requested Priority dropdown filter.
  - Current Status dropdown filter.
  - "Clear Filters" secondary action button.
- **Table / List Representation:**
  - Desktop: Table with columns `Ticket No.`, `Created Date`, `Summary`, `Category`, `Requested Priority`, `IT Priority`, `Current Status`, `Last Updated`.
  - Empty State: Illustrated empty box with *"No tickets submitted yet. Click Create Ticket to get started."*
  - No-Results State: *"No tickets match your filters. Try clearing your search query."*
- **Pagination Bar:** "Showing 1 to 8 of 42 tickets", Previous button, numerical page pills (1, 2, 3...), Next button.

### 3.5 Ticket Detail Screen (View Mode)
- **Top Action Bar:** Back to "My Tickets" button.
- **Header Card (Read-Only):**
  - Displays `Ticket No.`, `Ticket Date`, `Requester`, `Category`, `Related System`, `Requested Priority`, `IT Priority`, `Current Status`.
- **Detail Body Card:**
  - `Summary` and full `Description` in structured read-only panels.
- **Attachments Card:**
  - List of active attachments: File name, file size in KB/MB, upload date, Download button, Remove button.
  - List of soft-removed attachments: File name, `Removed` badge, removal reason callout, disabled download.
  - "Add Attachment" dropzone for adding new files to existing ticket.
- **Soft-Removal Modal Dialog:**
  - Triggered by clicking "Remove" on an attachment.
  - Asks for confirmation with mandatory textarea for "Removal Reason" (`*`).
  - "Cancel" and "Confirm Removal" (Destructive red) buttons.

---

## 4. Responsive Breakpoint Rules

| Viewport | Screen Width | Layout Rules |
| :--- | :--- | :--- |
| **Desktop** | `≥ 992px` | Centered layout with `max-width: 1200px`. Multi-column form grid. Full data table view with sortable headers. |
| **Tablet** | `768px – 991px` | Two-column form layout. Compact table with horizontal scrolling or responsive stacked filters. |
| **Mobile** | `< 768px` | Single-column vertically stacked inputs. Full-width touch-friendly buttons (min 44px tap target). Table transforms into card-based list. Zero horizontal viewport overflow. |

---

## 5. Visual Checklist & Required Screenshot Artifacts

### 5.1 Verification Checklist
- [ ] Primary green (`#006B3C`) and secondary accents adhere to tokens.
- [ ] Mandatory fields show red asterisk `*` and inline errors appear directly below inputs.
- [ ] Read-only fields have distinct shaded background (`#F3F4F6`).
- [ ] No text clipping, overlapping elements, or horizontal page overflow at any viewport.
- [ ] Soft-removed attachments clearly show removal reason and cannot be downloaded.
- [ ] Active requester avatar pill and Switch Requester action are accessible on all screens.

### 5.2 Screenshot Artifact Directories
- `artifacts/lab-02/screenshots/create-ticket/` (Desktop, Tablet, Mobile, Validation Errors, Submitting, Success, File Upload).
- `artifacts/lab-02/screenshots/my-tickets/` (Desktop Table, Tablet, Mobile Cards, Search/Filter Active, Pagination, Empty State).
- `artifacts/lab-02/screenshots/ticket-detail/` (Read-only view, Attachment List, Soft-removal modal, Removed state).