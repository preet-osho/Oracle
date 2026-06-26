import { vi, describe, it, expect, beforeEach } from 'vitest';
import { castMockResponse, createGetRequest, createPostRequest, makeSetupChain } from '../test-helpers';

const { from, authMock } = vi.hoisted(() => ({ from: vi.fn(), authMock: vi.fn() }));
vi.mock('@/lib/supabase/validate', () => ({ validateAuth: (...a: any[]) => authMock(...a) }));

import { GET, POST } from './route';
const setupChain = makeSetupChain(from, authMock);

describe('Projects API /api/projects', () => {
  beforeEach(() => { vi.clearAllMocks(); setupChain(); });

  describe('GET', () => {
    it('returns projects list', async () => {
      const c = setupChain({ data: [{ id: '1', client_name: 'Acme' }] });
      const res = castMockResponse(await GET());
      expect(from).toHaveBeenCalledWith('projects');
      expect(c.select).toHaveBeenCalledWith('*');
      expect(c.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(res.body).toEqual([{ id: '1', client_name: 'Acme' }]);
    });
    it('returns empty array when null', async () => { setupChain({ data: null }); const res = castMockResponse(await GET()); expect(res.body).toEqual([]); });
    it('returns 500 on error', async () => { setupChain({ data: null, error: new Error('DB error') }); const res = castMockResponse(await GET()); expect(res.init).toEqual({ status: 500 }); });
  });

  describe('POST', () => {
    it('creates a project', async () => {
      const c = setupChain({ data: { id: 'proj-1', client_name: '' } });
      const res = castMockResponse(await POST(createPostRequest({}) as any));
      expect(c.insert).toHaveBeenCalled();
      expect(res.body).toEqual({ id: 'proj-1', client_name: '' });
    });
    it('maps camelCase fields to snake_case', async () => {
      const c = setupChain({ data: { id: '1' } });
      await POST(createPostRequest({ clientName: 'Acme', industry: 'Tech', totalHours: 40, invoiceTotal: 5000, contacts: { name: 'John', phone: '123', email: 'a@b.com' } }) as any);
      expect(c.insert.mock.calls[0][0].client_name).toBe('Acme');
      expect(c.insert.mock.calls[0][0].industry).toBe('Tech');
      expect(c.insert.mock.calls[0][0].total_hours).toBe(40);
      expect(c.insert.mock.calls[0][0].invoice_total).toBe(5000);
      expect(c.insert.mock.calls[0][0].contact_name).toBe('John');
    });
    it('returns 500 on insert error', async () => { setupChain({ data: null, error: new Error('Insert failed') }); const res = castMockResponse(await POST(createPostRequest({}) as any)); expect(res.body).toEqual({ error: 'Insert failed' }); });
  });
  describe("auth failure", () => {
    it("returns 401 when not authenticated", async () => {
      authMock.mockResolvedValue({ error: { status: 401, json: async () => ({ error: "Unauthorized" }) } });
      const res = castMockResponse(await (GET as any)(createGetRequest()));
      expect(res.status).toBe(401);
    });
  });
});
