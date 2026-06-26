import { vi, describe, it, expect, beforeEach } from 'vitest';
import { castMockResponse, createGetRequest, createPutRequest, makeSetupChain } from '../../test-helpers';

const { from, authMock } = vi.hoisted(() => ({ from: vi.fn(), authMock: vi.fn() }));
vi.mock('@/lib/supabase/validate', () => ({ validateAuth: (...a: any[]) => authMock(...a) }));

import { GET, PUT, DELETE } from './route';
const setupChain = makeSetupChain(from, authMock);
const params = { params: Promise.resolve({ id: 'proj-1' }) };

describe('Single Project API /api/projects/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); setupChain(); });

  it('fetches a project by id', async () => {
    const c = setupChain({ data: { id: 'proj-1', client_name: 'Acme' } });
    const res = castMockResponse(await GET(createGetRequest() as any, params));
    expect(from).toHaveBeenCalledWith('projects');
    expect(c.eq).toHaveBeenCalledWith('id', 'proj-1');
    expect(res.body).toEqual({ id: 'proj-1', client_name: 'Acme' });
  });
  it('returns 500 on error', async () => { setupChain({ data: null, error: new Error('Not found') }); const res = castMockResponse(await GET(createGetRequest() as any, params)); expect(res.init).toEqual({ status: 500 }); });

  it('updates project fields', async () => {
    const c = setupChain({ data: { id: 'proj-1', status: 'Closed' } });
    const res = castMockResponse(await PUT(createPutRequest({ status: 'Closed' }) as any, params));
    expect(c.update).toHaveBeenCalled();
    expect(res.body).toEqual({ id: 'proj-1', status: 'Closed' });
  });
  it('maps contacts to contact fields', async () => {
    const c = setupChain({ data: { id: 'proj-1' } });
    await PUT(createPutRequest({ contacts: { name: 'Jane', phone: '456', email: 'j@k.com' } }) as any, params);
    expect(c.update.mock.calls[0][0].contact_name).toBe('Jane');
  });
  it('returns 500 on update error', async () => { setupChain({ data: null, error: new Error('Failed') }); const res = castMockResponse(await PUT(createPutRequest({ status: 'X' }) as any, params)); expect(res.init).toEqual({ status: 500 }); });

  it('deletes a project by id', async () => {
    const c = setupChain({ data: null });
    const res = castMockResponse(await DELETE(createGetRequest() as any, params));
    expect(c.delete).toHaveBeenCalled();
    expect(res.body).toEqual({ success: true });
  });
  it('returns 500 on delete error', async () => { setupChain({ data: null, error: new Error('Failed') }); const res = castMockResponse(await DELETE(createGetRequest() as any, params)); expect(res.init).toEqual({ status: 500 }); });
});
