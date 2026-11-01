import { beforeEach, expect, it, vi } from "vitest";
import { staffDashboard } from "../../src/staffDashboard.js";
import { statusOrder, priorityOrder } from "../../src/staffQueue.js";

const mock = vi.hoisted(() => ({ query: vi.fn(), transaction: vi.fn() }));
vi.mock("../../src/prisma.js", () => ({ getPrisma: () => ({ $transaction: mock.transaction }) }));
beforeEach(() => {
  mock.query.mockReset(); mock.transaction.mockReset();
  mock.transaction.mockImplementation(async fn => fn({ $queryRaw: mock.query }));
});
it("returns complete zero maps and empty previews in one repeatable-read snapshot using five SELECTs", async () => {
  mock.query.mockResolvedValueOnce([{ now: new Date("2026-10-08T00:00:00Z") }])
    .mockResolvedValueOnce(Object.assign([Object.fromEntries([...statusOrder, ...priorityOrder, "unassigned", "mine"].map(s => [s, 0]))]))
    .mockResolvedValueOnce([{ total: 0 }]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
  const json = vi.fn(), set = vi.fn(() => ({ json }));
  await staffDashboard({ auth: { user: { id: 1, role: "IT_STAFF", mustChangePassword: false } }, query: {} } as any, { set } as any);
  expect(mock.transaction.mock.calls[0][1]).toEqual({ isolationLevel: "RepeatableRead" });
  expect(mock.query).toHaveBeenCalledTimes(5);
  const d = json.mock.calls[0][0]; expect(d.metrics.myOutstandingActions).toBe(0);
  expect(Object.keys(d.metrics.ticketsByStatus)).toEqual([...statusOrder]);
  expect(Object.values(d.metrics.ticketsByStatus)).toEqual(Array(8).fill(0));
  expect(d.recentTickets).toEqual([]); expect(d.myActions).toEqual({ total: 0, items: [] });
  expect(d.recentWindow).toEqual({ from: "2026-10-01T00:00:00.000Z", to: "2026-10-08T00:00:00.000Z" });
  for (const index of [3, 4]) expect(mock.query.mock.calls[index][0].sql).toContain("LIMIT 5");
  expect(mock.query.mock.calls[3][0].sql).toContain("AT TIME ZONE 'UTC'");
});
it.each([undefined, { id: 1, role: "REQUESTER" }, { id: 1, role: "IT_STAFF", mustChangePassword: true }])("denies unauthorized users before querying", async user => {
  await expect(staffDashboard({ auth: { user }, query: {} } as any, {} as any)).rejects.toThrow();
  expect(mock.transaction).not.toHaveBeenCalled();
});
