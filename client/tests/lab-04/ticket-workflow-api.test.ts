import { beforeEach, expect, it, vi } from 'vitest';
import * as api from '../../src/api.js';
import * as auth from '../../src/auth-client.js';
beforeEach(() => { vi.restoreAllMocks(); vi.spyOn(auth, 'sessionFetch').mockImplementation(async () => new Response('{}')); });
it('sends explicit workflow versions for every Ticket writer and expectedCycle for advisory indication', async () => {
  await api.claimTicket(101, 7);
  expect(auth.sessionFetch).toHaveBeenLastCalledWith('/api/staff/tickets/101/claim', expect.objectContaining({ method: 'POST', body: JSON.stringify({ expectedWorkflowVersion: 7 }) }));
  await api.updateTicketOwner(101, null, 8);
  expect(auth.sessionFetch).toHaveBeenLastCalledWith('/api/staff/tickets/101/owner', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ ownerId: null, expectedWorkflowVersion: 8 }) }));
  await api.updateTicketPriority(101, 'HIGH', 9);
  expect(auth.sessionFetch).toHaveBeenLastCalledWith('/api/staff/tickets/101/priority', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ itPriority: 'HIGH', expectedWorkflowVersion: 9 }) }));
  const body = { expectedWorkflowVersion: 10, currentStatus: 'REOPENED' as const, confirmed: true, reason: 'Problem returned' };
  await api.updateTicketStatus(101, body);
  expect(auth.sessionFetch).toHaveBeenLastCalledWith('/api/staff/tickets/101/status', expect.objectContaining({ method: 'PATCH', body: JSON.stringify(body) }));
  await api.indicateResolution(101, 2);
  expect(auth.sessionFetch).toHaveBeenLastCalledWith('/api/tickets/101/resolution-indication', expect.objectContaining({ method: 'POST', body: JSON.stringify({ expectedCycle: 2 }) }));
});
it('retains resolution blocker counts and structured read denials', async () => {
  const details = { eligibleOwner: false, completedActions: 0, incompleteActions: 2, outstandingFollowUps: 1 };
  vi.mocked(auth.sessionFetch).mockResolvedValueOnce(new Response(JSON.stringify({ code: 'RESOLUTION_BLOCKED', error: 'Finish work', details, currentWorkflowVersion: 8 }), { status: 409 }));
  await expect(api.updateTicketStatus(101, { expectedWorkflowVersion: 7, currentStatus: 'RESOLVED', confirmed: true })).rejects.toMatchObject({ status: 409, details, currentWorkflowVersion: 8 });
  vi.mocked(auth.sessionFetch).mockResolvedValueOnce(new Response(JSON.stringify({ code: 'NOT_FOUND', error: 'Ticket unavailable' }), { status: 404 }));
  await expect(api.getTicketDetail(101)).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
});
