# Lab 2 REST API Specification

## 1. Overview & Protocol Conventions
This document defines the REST API contract for TokTickIT Lab 2.
- **Base URL:** `/api`
- **Context Header:** `x-requester-id: <number>` (Simulates authenticated user session for Lab 2 development mode).
- **Default Content-Type:** `application/json` (except file upload endpoints which use `multipart/form-data`).
- **Standard Error Format:**
  ```json
  {
    "error": "Error message description",
    "details": []
  }
  ```

---

## 2. Reference Data & Identity APIs

### 2.1 Get Active Development Requesters
- **Endpoint:** `GET /api/requesters/active`
- **Description:** Returns all active requesters available for the persona switcher. Inactive requesters are excluded.
- **Headers:** None required.
- **Success (200 OK):**
  ```json
  [
    {
      "id": 1,
      "name": "Jennifer Anderson",
      "email": "jennifer.anderson@example.com",
      "isActive": true
    },
    {
      "id": 2,
      "name": "Michael Brown",
      "email": "michael.brown@example.com",
      "isActive": true
    }
  ]
  ```

### 2.2 Get Active Ticket Categories
- **Endpoint:** `GET /api/categories`
- **Description:** Returns active IT support categories.
- **Headers:** None required.
- **Success (200 OK):**
  ```json
  [
    { "id": 1, "name": "Account and Access", "isActive": true },
    { "id": 2, "name": "Hardware", "isActive": true },
    { "id": 3, "name": "Software", "isActive": true },
    { "id": 4, "name": "Network", "isActive": true }
  ]
  ```

### 2.3 Get Active Related Systems
- **Endpoint:** `GET /api/related-systems`
- **Description:** Returns active enterprise systems/devices that can be linked to tickets.
- **Headers:** None required.
- **Success (200 OK):**
  ```json
  [
    { "id": 1, "name": "Email", "isActive": true },
    { "id": 2, "name": "Campus Wi-Fi", "isActive": true },
    { "id": 3, "name": "VPN", "isActive": true },
    { "id": 4, "name": "LEB2 App", "isActive": true },
    { "id": 5, "name": "Grade Submission App", "isActive": true },
    { "id": 6, "name": "Printer", "isActive": true },
    { "id": 7, "name": "Corporate Laptop", "isActive": true }
  ]
  ```

---

## 3. Ticket Management APIs

### 3.1 Create Ticket
- **Endpoint:** `POST /api/tickets`
- **Description:** Creates a new support ticket for the active requester with status `NEW` and auto-generated `ticketNumber`.
- **Headers:**
  - `x-requester-id`: `<number>` (Required)
  - `Content-Type`: `application/json`
- **Request Body:**
  ```json
  {
    "summary": "Laptop battery drains quickly after Windows update",
    "description": "My laptop battery is draining much faster than usual even when idle. Started happening after last week's update.",
    "categoryId": 2,
    "relatedSystemId": 7,
    "requestedPriority": "MEDIUM"
  }
  ```
- **Success (201 Created):**
  ```json
  {
    "id": 101,
    "ticketNumber": "TKT-2026-000101",
    "summary": "Laptop battery drains quickly after Windows update",
    "description": "My laptop battery is draining much faster than usual even when idle. Started happening after last week's update.",
    "requestedPriority": "MEDIUM",
    "itPriority": "MEDIUM",
    "currentStatus": "NEW",
    "requesterId": 1,
    "categoryId": 2,
    "relatedSystemId": 7,
    "createdAt": "2026-08-30T03:00:00.000Z",
    "updatedAt": "2026-08-30T03:00:00.000Z",
    "category": { "id": 2, "name": "Hardware" },
    "relatedSystem": { "id": 7, "name": "Corporate Laptop" },
    "requester": { "id": 1, "name": "Jennifer Anderson", "email": "jennifer.anderson@example.com" }
  }
  ```
- **Error Responses:**
  - `400 Bad Request`: Missing mandatory fields (`summary`, `description`, `categoryId`, `relatedSystemId`), empty trimmed strings, or invalid enum value.
  - `401 / 400 Bad Request`: Missing or invalid `x-requester-id` header.
  - `404 Not Found`: Category, Related System, or Requester does not exist.

### 3.2 List Owned Tickets (My Tickets)
- **Endpoint:** `GET /api/tickets`
- **Description:** Retrieves paginated tickets strictly owned by the active Requester with search, filtering, and sorting.
- **Headers:**
  - `x-requester-id`: `<number>` (Required)
- **Query Parameters:**
  - `search` (string, optional): Matches case-insensitively against `ticketNumber` or `summary`.
  - `categoryId` (number, optional): Filter by Category ID.
  - `requestedPriority` (string, optional): Filter by `LOW`, `MEDIUM`, `HIGH`, or `CRITICAL`.
  - `currentStatus` (string, optional): Filter by `NEW`, `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`.
  - `sortBy` (string, optional, default: `createdAt`): Sort field (`createdAt`, `ticketNumber`, `requestedPriority`, `currentStatus`, `updatedAt`).
  - `sortOrder` (string, optional, default: `desc`): `asc` or `desc`.
  - `page` (number, optional, default: `1`): 1-indexed page number.
  - `pageSize` (number, optional, default: `8`): Items per page (allowed: 5, 8, 10, 20).
- **Success (200 OK):**
  ```json
  {
    "data": [
      {
        "id": 101,
        "ticketNumber": "TKT-2026-000101",
        "summary": "Laptop battery drains quickly after Windows update",
        "requestedPriority": "MEDIUM",
        "itPriority": "MEDIUM",
        "currentStatus": "NEW",
        "createdAt": "2026-08-30T03:00:00.000Z",
        "updatedAt": "2026-08-30T03:00:00.000Z",
        "category": { "id": 2, "name": "Hardware" },
        "relatedSystem": { "id": 7, "name": "Corporate Laptop" },
        "attachmentCount": 1
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "pageSize": 8,
      "totalPages": 1
    }
  }
  ```
- **Error Responses:**
  - `400 Bad Request`: Invalid query parameters (e.g., negative page number).

### 3.3 Get Single Owned Ticket Details
- **Endpoint:** `GET /api/tickets/:id`
- **Description:** Returns full read-only details of an owned ticket, including all active and soft-removed attachments.
- **Headers:**
  - `x-requester-id`: `<number>` (Required)
- **Success (200 OK):**
  ```json
  {
    "id": 101,
    "ticketNumber": "TKT-2026-000101",
    "summary": "Laptop battery drains quickly after Windows update",
    "description": "My laptop battery is draining much faster than usual even when idle. Started happening after last week's update.",
    "requestedPriority": "MEDIUM",
    "itPriority": "MEDIUM",
    "currentStatus": "NEW",
    "createdAt": "2026-08-30T03:00:00.000Z",
    "updatedAt": "2026-08-30T03:00:00.000Z",
    "category": { "id": 2, "name": "Hardware" },
    "relatedSystem": { "id": 7, "name": "Corporate Laptop" },
    "requester": { "id": 1, "name": "Jennifer Anderson", "email": "jennifer.anderson@example.com" },
    "attachments": [
      {
        "id": 5,
        "fileName": "battery_report.pdf",
        "fileSize": 1048576,
        "mimeType": "application/pdf",
        "isRemoved": false,
        "removedAt": null,
        "removalReason": null,
        "createdAt": "2026-08-30T03:05:00.000Z"
      },
      {
        "id": 6,
        "fileName": "wrong_screenshot.png",
        "fileSize": 524288,
        "mimeType": "image/png",
        "isRemoved": true,
        "removedAt": "2026-08-30T03:10:00.000Z",
        "removalReason": "Uploaded accidentally, contained private information",
        "createdAt": "2026-08-30T03:06:00.000Z"
      }
    ]
  }
  ```
- **Error Responses:**
  - `403 Forbidden` or `404 Not Found`: Ticket not found or ticket belongs to another requester.

---

## 4. Attachment APIs

### 4.1 Upload Attachment
- **Endpoint:** `POST /api/tickets/:id/attachments`
- **Description:** Uploads a single supporting file to an existing owned ticket.
- **Headers:**
  - `x-requester-id`: `<number>` (Required)
  - `Content-Type`: `multipart/form-data`
- **Form Data:**
  - `file`: Binary file (Allowed MIME: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`). Max size: 5 MB (5,242,880 bytes).
- **Success (201 Created):**
  ```json
  {
    "id": 7,
    "ticketId": 101,
    "fileName": "system_diagnostics.png",
    "fileSize": 204800,
    "mimeType": "image/png",
    "isRemoved": false,
    "createdAt": "2026-08-30T03:15:00.000Z"
  }
  ```
- **Error Responses:**
  - `400 Bad Request`: Unsupported file type, or ticket already has 5 active attachments.
  - `413 Payload Too Large`: File exceeds 5 MB.
  - `403 Forbidden`: Ticket is not owned by the active Requester.
  - `404 Not Found`: Ticket does not exist.

### 4.2 Download Active Attachment
- **Endpoint:** `GET /api/attachments/:id/download`
- **Description:** Streams binary file download for an active attachment on an owned ticket.
- **Headers:**
  - `x-requester-id`: `<number>` (Required)
- **Success (200 OK):**
  - Binary stream with headers:
    - `Content-Type: <mimeType>`
    - `Content-Disposition: attachment; filename="<original_fileName>"`
- **Error Responses:**
  - `403 Forbidden`: Cross-requester access attempt OR attachment has been soft-removed (`isRemoved = true`).
  - `404 Not Found`: Attachment record or physical file not found.

### 4.3 Soft Remove Attachment
- **Endpoint:** `DELETE /api/attachments/:id`
- **Description:** Soft-removes an attachment, records a mandatory reason, and permanently disables file download.
- **Headers:**
  - `x-requester-id`: `<number>` (Required)
  - `Content-Type`: `application/json`
- **Request Body:**
  ```json
  {
    "reason": "Attached obsolete system log"
  }
  ```
- **Success (200 OK):**
  ```json
  {
    "id": 5,
    "fileName": "battery_report.pdf",
    "isRemoved": true,
    "removedAt": "2026-08-30T03:20:00.000Z",
    "removalReason": "Attached obsolete system log"
  }
  ```
- **Error Responses:**
  - `400 Bad Request`: Missing or empty `reason`.
  - `403 Forbidden`: Attachment belongs to a ticket not owned by the requester.
  - `404 Not Found`: Attachment does not exist.