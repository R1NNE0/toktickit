import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { StaffTicketDetail } from '../../src/components/StaffTicketDetail.js';
import { TicketDetail } from '../../src/components/TicketDetail.js';
import * as api from '../../src/api.js';
import * as actions from '../../src/actions-api.js';
import { staff, admin, requester, ticket, action, page } from './fixtures.js';

let actor = staff;
vi.mock('../../src/context/AuthContext.js', () => ({ useAuth: () => ({ user: actor }) }));
const option = (to: api.TicketStatus, enabled = true, blockers: api.TransitionBlocker[] = []): api.TicketTransition => ({ to, enabled, blockers,
  requiresConfirmation: ['RESOLVED','CLOSED','CANCELLED','REOPENED'].includes(to), requiresReason: ['CANCELLED','REOPENED'].includes(to) });
let current: api.StaffTicketDetail;
beforeEach(() => {
  vi.restoreAllMocks(); actor = staff;
  current = { ...ticket, requester, ownerId: staff.id, owner: { ...staff, role: "IT_STAFF" as const }, attachments: [], attachmentCount: 0,
    resolutionSuggestedAt: null, resolutionSuggestedById: null,
    resolutionBlockers: { eligibleOwner: true, completedActions: 1, incompleteActions: 0, outstandingFollowUps: 0 },
    permittedTransitions: [option('WAITING_FOR_REQUESTER'), option('RESOLVED'), option('CANCELLED')] };
  vi.spyOn(api, 'getStaffTicketDetail').mockImplementation(async () => current);
  vi.spyOn(api, 'getTicketDetail').mockImplementation(async () => current);
  vi.spyOn(api, 'getStaffAssignees').mockResolvedValue([staff, admin] as api.Assignee[]);
  vi.spyOn(api, 'getPublicComments').mockResolvedValue(page([]));
  vi.spyOn(api, 'getInternalNotes').mockResolvedValue(page([]));
  vi.spyOn(actions, 'getTicketActions').mockResolvedValue(page([]));
  vi.spyOn(actions, 'getActionTicket').mockImplementation(async () => current as actions.ActionTicket);
  vi.spyOn(api, 'updateTicketPriority').mockImplementation(async (_id, itPriority) => current = { ...current, itPriority, workflowVersion: current.workflowVersion! + 1 });
  vi.spyOn(api, 'updateTicketStatus').mockImplementation(async (_id, body) => current = { ...current, currentStatus: body.currentStatus, workflowVersion: current.workflowVersion! + 1, permittedTransitions: [] });
});
async function show(general = false) {
  render(general ? <TicketDetail ticketId={101} onBack={vi.fn()} /> : <StaffTicketDetail ticketId={101} onBack={vi.fn()} />);
  await screen.findByText(current.ticketNumber);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh Actions' })).toBeEnabled());
}
async function transition(to: string) {
  await userEvent.selectOptions(screen.getByLabelText('Next Status'), to);
  await userEvent.click(screen.getByRole('button', { name: 'Update Status' }));
}
it('uses server transition options, disables blocked edges, explains all gates and focuses repair destinations', async () => {
  current = { ...current, permittedTransitions: [option('RESOLVED', false, ['OWNER_REQUIRED','COMPLETED_ACTION_REQUIRED','ACTIONS_INCOMPLETE','FOLLOW_UP_REQUIRED']), option('CANCELLED', false, ['ACTIONS_INCOMPLETE'])],
    resolutionBlockers: { eligibleOwner: false, completedActions: 0, incompleteActions: 2, outstandingFollowUps: 1 } };
  await show();
  expect(screen.queryByRole('option', { name: /Waiting for Requester/ })).toBeNull();
  expect(screen.getByRole('option', { name: 'Resolve (RESOLVED)' })).toBeDisabled();
  expect(screen.getByText(/Unfinished Actions: 2/)).toBeInTheDocument();
  expect(screen.getByText(/Outstanding completed-Action follow-ups: 1/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Review primary owner' })); expect(screen.getByLabelText('Assign Owner')).toHaveFocus();
  await userEvent.click(screen.getByRole('button', { name: 'Review Actions Taken' })); expect(screen.getByRole('heading', { name: 'Actions Taken' })).toHaveFocus();
  expect(api.updateTicketStatus).not.toHaveBeenCalled();
});
it('uses successive authoritative versions for claim, owner and priority and retains full response metadata', async () => {
  current = { ...current, ownerId: null, owner: null };
  const claim = vi.spyOn(api, 'claimTicket').mockImplementation(async () => current = { ...current, ownerId: staff.id, owner: { ...staff, role: "IT_STAFF" as const }, workflowVersion: 8 });
  const owner = vi.spyOn(api, 'updateTicketOwner').mockImplementation(async (_id, ownerId) => current = { ...current, ownerId, owner: { ...admin, role: "ADMINISTRATOR" as const }, workflowVersion: 9 });
  await show(); await userEvent.click(screen.getByRole('button', { name: 'Claim Ticket' }));
  await screen.findByText('You have successfully claimed this ticket.'); expect(claim).toHaveBeenCalledWith(101, 7);
  await userEvent.selectOptions(screen.getByLabelText('Assign Owner'), '3'); await userEvent.click(screen.getByRole('button', { name: 'Save Owner' }));
  await screen.findByText('Ticket owner updated successfully.'); expect(owner).toHaveBeenCalledWith(101, 3, 8);
  await userEvent.selectOptions(screen.getByLabelText('IT Priority'), 'CRITICAL'); await userEvent.click(screen.getByRole('button', { name: 'Save Priority' }));
  await screen.findByText('IT Priority updated to CRITICAL.'); expect(api.updateTicketPriority).toHaveBeenCalledWith(101, 'CRITICAL', 9);
  expect(current.workflowVersion).toBe(10); expect(current.requestedPriority).toBe('HIGH');
});
it('retains stale priority drafts through separate reload and explicit review, without automatic retry', async () => {
  vi.mocked(api.updateTicketPriority).mockRejectedValueOnce(new api.ApiError(409, 'TICKET_VERSION_CONFLICT', 'Ticket changed'));
  await show(); await userEvent.selectOptions(screen.getByLabelText('IT Priority'), 'CRITICAL');
  await userEvent.click(screen.getByRole('button', { name: 'Save Priority' })); await screen.findByText('Ticket changed');
  current = { ...current, workflowVersion: 11, itPriority: 'LOW' };
  await userEvent.click(screen.getByRole('button', { name: 'Reload latest workflow' }));
  await screen.findByText(/Latest Ticket: IN_PROGRESS/);
  expect(screen.getByLabelText('IT Priority')).toHaveValue('CRITICAL'); expect(screen.getByRole('button', { name: 'Save Priority' })).toBeDisabled();
  expect(api.updateTicketPriority).toHaveBeenCalledTimes(1);
  await userEvent.click(screen.getByRole('button', { name: 'Use latest workflow after review' }));
  await userEvent.click(screen.getByRole('button', { name: 'Save Priority' }));
  await waitFor(() => expect(api.updateTicketPriority).toHaveBeenLastCalledWith(101, 'CRITICAL', 11));
});
it('keeps cancellation reason and shows real gate failures inside the modal; a newly blocked edge cannot be resubmitted', async () => {
  vi.mocked(api.updateTicketStatus).mockRejectedValueOnce(new api.ApiError(409, 'ACTIONS_INCOMPLETE', 'Finish work first', { incompleteActions: 2 }));
  await show(); await transition('CANCELLED');
  await userEvent.click(screen.getByRole('button', { name: 'Confirm Status Change' }));
  expect(screen.getByLabelText('Transition reason')).toHaveFocus(); expect(api.updateTicketStatus).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Transition reason'), { target: { value: 'Keep this public reason' } });
  await userEvent.click(screen.getByRole('button', { name: 'Confirm Status Change' }));
  expect(await within(screen.getByRole('dialog')).findByText(/Unfinished Actions: 2/)).toBeInTheDocument();
  current = { ...current, workflowVersion: 8, permittedTransitions: [option('CANCELLED', false, ['ACTIONS_INCOMPLETE'])] };
  await userEvent.click(screen.getByRole('button', { name: 'Reload latest workflow' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Use latest workflow after review' }));
  expect(screen.getByLabelText('Transition reason')).toHaveValue('Keep this public reason');
  expect(screen.getByRole('button', { name: 'Confirm Status Change' })).toBeDisabled();
});
it('reopens into the returned cycle, clears advisory state and renders prior Actions as historical', async () => {
  current = { ...current, currentStatus: 'CLOSED', permittedTransitions: [option('REOPENED')], resolutionSuggestedAt: ticket.updatedAt, resolutionSuggestedById: requester.id };
  vi.mocked(actions.getTicketActions).mockResolvedValue(page([{ ...action, status: 'COMPLETED', result: 'Repaired', performedBy: staff, completedAt: ticket.updatedAt }]));
  vi.mocked(api.updateTicketStatus).mockImplementation(async () => current = { ...current, currentStatus: 'REOPENED', workflowVersion: 8, workCycle: 2, resolvedAt: null,
    resolutionSuggestedAt: null, resolutionSuggestedById: null, permittedTransitions: [option('OPEN')], resolutionBlockers: { eligibleOwner: true, completedActions: 0, incompleteActions: 0, outstandingFollowUps: 0 } });
  await show(); await transition('REOPENED'); fireEvent.change(screen.getByLabelText('Transition reason'), { target: { value: 'Problem returned' } });
  await userEvent.click(screen.getByRole('button', { name: 'Confirm Status Change' }));
  await screen.findByText(/Ticket reopened in work cycle 2/);
  expect(await screen.findByRole('heading', { name: 'Work cycle 1 — Historical' })).toBeInTheDocument();
  expect(screen.queryByText(/Requester Resolution Notice:/)).toBeNull(); expect(screen.queryByRole('button', { name: 'Correct Action' })).toBeNull();
  expect(api.updateTicketStatus).toHaveBeenCalledWith(101, { currentStatus: 'REOPENED', expectedWorkflowVersion: 7, confirmed: true, reason: 'Problem returned' });
});
it('allows legacy resolved zero-Action closure using the server edge without inventing a resolution gate', async () => {
  current = { ...current, currentStatus: 'RESOLVED', permittedTransitions: [option('CLOSED')], resolutionBlockers: { eligibleOwner: false, completedActions: 0, incompleteActions: 0, outstandingFollowUps: 0 } };
  await show(); await transition('CLOSED'); await userEvent.click(screen.getByRole('button', { name: 'Confirm Status Change' }));
  await waitFor(() => expect(api.updateTicketStatus).toHaveBeenCalledWith(101, { currentStatus: 'CLOSED', expectedWorkflowVersion: 7, confirmed: true }));
});
it('keeps Requester indication advisory and binds it to the reviewed cycle after a real-shaped stale-cycle conflict', async () => {
  actor = requester; current.permittedTransitions = [];
  const indication = vi.spyOn(api, 'indicateResolution').mockRejectedValueOnce(new api.ApiError(409, 'TICKET_CYCLE_CONFLICT', 'Ticket reopened'))
    .mockImplementation(async () => { current = { ...current, workflowVersion: 13, resolutionSuggestedAt: ticket.updatedAt, resolutionSuggestedById: requester.id }; return { ticketId: 101, currentStatus: current.currentStatus, workflowVersion: 13, workCycle: 2, resolutionSuggestedAt: ticket.updatedAt, resolutionSuggestedById: requester.id }; });
  await show(true); await userEvent.click(screen.getByRole('button', { name: 'Problem Appears Resolved' }));
  await userEvent.click(screen.getByRole('button', { name: 'Confirm' })); await screen.findByText('Ticket reopened');
  expect(indication).toHaveBeenCalledWith(101, 1);
  current = { ...current, workflowVersion: 12, workCycle: 2, currentStatus: 'REOPENED' };
  await userEvent.click(screen.getByRole('button', { name: 'Reload latest workflow' }));
  await screen.findByText(/Latest Ticket: REOPENED; work cycle 2/);
  expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled(); expect(indication).toHaveBeenCalledTimes(1);
  await userEvent.click(screen.getByRole('button', { name: 'Use latest workflow after review' }));
  await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
  await screen.findByText(/You have indicated that this problem appears resolved/);
  expect(indication).toHaveBeenLastCalledWith(101, 2); expect(current.currentStatus).toBe('REOPENED');
  expect(screen.getByRole('button', { name: 'Resolution Indicated' })).toBeDisabled(); expect(screen.queryByLabelText('Next Status')).toBeNull();
});
it('keeps Administrator mutations limited to versioned priority and stops on forbidden responses', async () => {
  actor = admin; current.permittedTransitions = [];
  vi.mocked(api.updateTicketPriority).mockRejectedValue(new api.ApiError(403, 'FORBIDDEN', 'Forbidden'));
  await show(true); expect(screen.queryByLabelText('Assign Owner')).toBeNull(); expect(screen.queryByLabelText('Next Status')).toBeNull();
  await userEvent.selectOptions(screen.getByLabelText('IT Priority'), 'CRITICAL'); await userEvent.click(screen.getByRole('button', { name: 'Save Priority' }));
  await screen.findByText(/Access denied or Ticket unavailable/);
  expect(api.updateTicketPriority).toHaveBeenCalledWith(101, 'CRITICAL', 7);
  expect(screen.getByLabelText('IT Priority')).toHaveValue('CRITICAL'); expect(screen.getByRole('button', { name: 'Save Priority' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'Reload latest workflow' })).toBeNull();
});
it('blocks missing metadata without fabricating versions', async () => {
  current = { ...current, workflowVersion: undefined }; await show();
  expect(screen.getByRole('button', { name: 'Save Priority' })).toBeDisabled(); expect(api.updateTicketPriority).not.toHaveBeenCalled();
});
it('prevents duplicate claims and competing workflow writes while a mutation is pending', async () => {
  current = { ...current, ownerId: null, owner: null };
  let finish!: (value: api.StaffTicketDetail) => void;
  const claim = vi.spyOn(api, 'claimTicket').mockReturnValue(new Promise(resolve => { finish = resolve; }));
  await show(); const button = screen.getByRole('button', { name: 'Claim Ticket' });
  fireEvent.click(button); fireEvent.click(button);
  expect(claim).toHaveBeenCalledTimes(1); expect(screen.getByRole('button', { name: 'Save Owner' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Save Priority' })).toBeDisabled();
  current = { ...current, ownerId: staff.id, owner: { ...staff, role: 'IT_STAFF' }, workflowVersion: 8 };
  await act(async () => finish(current)); await screen.findByText('You have successfully claimed this ticket.');
});
it('refreshes untouched selectors but never silently rebases an edited priority onto an Actions refresh', async () => {
  await show();
  current = { ...current, workflowVersion: 8, itPriority: 'LOW', ownerId: admin.id, owner: { ...admin, role: 'ADMINISTRATOR' } };
  await userEvent.click(screen.getByRole('button', { name: 'Refresh Actions' }));
  await waitFor(() => expect(screen.getByLabelText('IT Priority')).toHaveValue('LOW'));
  expect(screen.getByLabelText('Assign Owner')).toHaveValue(String(admin.id));
  await userEvent.selectOptions(screen.getByLabelText('IT Priority'), 'CRITICAL');
  current = { ...current, workflowVersion: 9, itPriority: 'MEDIUM' };
  await userEvent.click(screen.getByRole('button', { name: 'Refresh Actions' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh Actions' })).toBeEnabled());
  expect(screen.getByLabelText('IT Priority')).toHaveValue('CRITICAL');
  vi.mocked(api.updateTicketPriority).mockRejectedValueOnce(new api.ApiError(409, 'TICKET_VERSION_CONFLICT', 'New work exists'));
  await userEvent.click(screen.getByRole('button', { name: 'Save Priority' }));
  await screen.findByText('New work exists'); expect(api.updateTicketPriority).toHaveBeenCalledWith(101, 'CRITICAL', 8);
});
