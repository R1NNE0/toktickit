import type { CurrentUser } from "../../src/auth-client.js";
import type { ActionRecord, ActionTicket, ActionMutation } from "../../src/actions-api.js";
export const staff: CurrentUser = { id: 2, name: "Casey Staff", email: "staff@example.com", role: "IT_STAFF", isActive: true, mustChangePassword: false };
export const admin: CurrentUser = { ...staff, id: 3, name: "Alex Admin", role: "ADMINISTRATOR" };
export const requester: CurrentUser = { ...staff, id: 1, name: "Requester", role: "REQUESTER" };
export const ticket: ActionTicket = { id: 101, ticketNumber: "TKT-101", summary: "Network repair", description: "Network unavailable", currentStatus: "IN_PROGRESS",
  workCycle: 1, workflowVersion: 7, requesterId: 1, categoryId: 1, relatedSystemId: 1, requestedPriority: "HIGH", itPriority: "HIGH",
  createdAt: "2026-10-28T00:00:00.000Z", updatedAt: "2026-10-28T01:00:00.000Z", attachments: [] };
export const action: ActionRecord = { id: 5, ticketId: 101, cycle: 1, status: "PLANNED", description: "Inspect router", result: null,
  assignee: staff, createdBy: admin, performedBy: null, followUpRequired: false, followUpNote: null, attachmentNotes: null,
  createdAt: ticket.createdAt, updatedAt: ticket.updatedAt, completedAt: null, cancelledAt: null, cancellationReason: null, version: 2 };
export const page = <T,>(data: T[], current = 1, totalPages = 1) => ({ data, pagination: { page: current, pageSize: 20, totalItems: data.length, totalPages } });
export const mutation = (a: Partial<ActionRecord> = {}, version = 8): ActionMutation => ({ action: { ...action, ...a },
  ticket: { id: ticket.id, workflowVersion: version, workCycle: 1, updatedAt: ticket.updatedAt }, replayed: false });
