import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { StaffTicketDetail } from '../../src/components/StaffTicketDetail.js';
import { TicketDetail } from '../../src/components/TicketDetail.js';
import { UserManagement } from '../../src/components/UserManagement.js';
import * as api from '../../src/api.js';
const auth = vi.hoisted(() => ({ user: { id: 1, name: 'Staff', role: 'IT_STAFF', isActive: true, mustChangePassword: false }, reload: vi.fn() }));
vi.mock('../../src/context/AuthContext.js', () => ({ useAuth: () => auth }));
const work: api.StaffTicketDetail = { id: 1, ticketNumber: 'TKT-1', summary: 'Feedback', description: 'Details',
  requesterId: 2, requester: { id: 2, name: 'Requester', email: 'test@example.com' }, categoryId: 1, category: { id: 1, name: 'Hardware' },
  relatedSystemId: 1, relatedSystem: { id: 1, name: 'Email' }, requestedPriority: 'HIGH', itPriority: 'HIGH', currentStatus: 'NEW',
  ownerId: null, owner: null, attachmentCount: 0, attachments: [], resolutionSuggestedAt: null, resolutionSuggestedById: null,
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' };
describe('Issue 35 integrated feedback regressions', () => {
  beforeEach(() => {
    vi.restoreAllMocks(); auth.user.role = 'IT_STAFF';
    vi.spyOn(api, 'getStaffTicketDetail').mockResolvedValue(work);
    vi.spyOn(api, 'getTicketDetail').mockResolvedValue(work);
    vi.spyOn(api, 'getStaffAssignees').mockResolvedValue([]);
    vi.spyOn(api, 'getPublicComments').mockResolvedValue({ data: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 1 } });
    vi.spyOn(api, 'getInternalNotes').mockResolvedValue({ data: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 1 } });
  });
  it('distinguishes discussion load failures from empty threads and permits retry', async () => {
    vi.mocked(api.getPublicComments).mockRejectedValueOnce(new Error('Offline'));
    vi.mocked(api.getInternalNotes).mockRejectedValueOnce(new Error('Offline'));
    render(<StaffTicketDetail ticketId={1} onBack={() => {}} />);
    await screen.findByText('Unable to load public comments.');
    expect(screen.queryByText('No public comments yet.')).not.toBeInTheDocument();
    await screen.findByText('Unable to load internal notes.');
    expect(screen.queryByText('No internal notes yet.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry comments' }));
    fireEvent.click(screen.getByRole('button', { name: 'Retry notes' }));
    await screen.findByText('No public comments yet.'); await screen.findByText('No internal notes yet.');
  });
  it('announces initial discussion loading rather than an empty success', async () => {
    vi.mocked(api.getPublicComments).mockReturnValue(new Promise(() => {}));
    vi.mocked(api.getInternalNotes).mockReturnValue(new Promise(() => {}));
    render(<StaffTicketDetail ticketId={1} onBack={() => {}} />);
    await screen.findByText('Loading public comments...'); await screen.findByText('Loading internal notes...');
    expect(screen.queryByText('No public comments yet.')).not.toBeInTheDocument();
  });
  it('preserves user-management forbidden and safe failure states', async () => {
    auth.user.role = 'ADMINISTRATOR';
    vi.spyOn(api, 'getAdminUsers').mockRejectedValue(new api.ApiError(403, 'FORBIDDEN', 'Forbidden'));
    render(<UserManagement />);
    await screen.findByText(/Access Denied: You do not have permission/);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText(/No users match/)).not.toBeInTheDocument();
  });
  it.each(['REQUESTER', 'ADMINISTRATOR'])('%s detail announces a failed discussion read and permits retry', async role => {
    auth.user.role = role;
    vi.mocked(api.getPublicComments).mockRejectedValueOnce(new Error('Offline'));
    vi.mocked(api.getInternalNotes).mockRejectedValueOnce(new Error('Offline'));
    render(<TicketDetail ticketId={1} onBack={() => {}} />);
    await screen.findByText('Unable to load public comments.');
    expect(screen.queryByText('No public comments yet.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry comments' }));
    await screen.findByText('No public comments yet.');
    if (role === 'ADMINISTRATOR') {
      await screen.findByText('Unable to load internal notes.');
      fireEvent.click(screen.getByRole('button', { name: 'Retry notes' }));
      await screen.findByText('No internal notes recorded.');
    } else expect(api.getInternalNotes).not.toHaveBeenCalled();
  });
  it('does not replace a new directory search with an older response', async () => {
    auth.user.role = 'ADMINISTRATOR';
    let complete!: (value: { data: api.AdminUser[] }) => void;
    vi.spyOn(api, 'getAdminUsers').mockReturnValueOnce(new Promise(resolve => { complete = resolve; })).mockResolvedValue({ data: [] });
    render(<UserManagement />);
    fireEvent.change(screen.getByLabelText('Search users'), { target: { value: 'latest' } });
    await waitFor(() => expect(api.getAdminUsers).toHaveBeenCalledTimes(2));
    await act(async () => { complete({ data: [{ id: 8, name: 'Obsolete result', email: 'old@example.com', role: 'REQUESTER', isActive: true,
      mustChangePassword: false, createdAt: '', updatedAt: '' }] }); });
    await waitFor(() => expect(screen.queryByText('Obsolete result')).not.toBeInTheDocument());
  });
});
