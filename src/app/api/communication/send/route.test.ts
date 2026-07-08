import { vi, describe, it, expect, beforeEach } from 'vitest';

// ─── Mocks ───

const mockValidateAuth = vi.fn();
vi.mock('@/lib/supabase/validate', () => ({
  validateAuth: (...a: any[]) => mockValidateAuth(...a),
}));

const mockCheckCommunicationHealth = vi.fn();
vi.mock('@/lib/communication-hub-server', () => ({
  checkCommunicationHealth: (...a: any[]) => mockCheckCommunicationHealth(...a),
}));

import { GET } from './route';

// ─── Tests ───

describe('GET /api/communication/send (Health Check)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: all providers healthy
    mockCheckCommunicationHealth.mockResolvedValue({
      email: { resend: true, sendgrid: false, preferred: 'resend' },
      whatsapp: { configured: true, fromNumber: '+919876543210' },
    });
  });

  it('returns health status without requiring authentication', async () => {
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty('email');
    expect(body).toHaveProperty('whatsapp');
  });

  it('returns email provider health status', async () => {
    const res = await GET();
    const body = await res.json();

    expect(body.email).toEqual({
      resend: true,
      sendgrid: false,
      preferred: 'resend',
    });
  });

  it('returns WhatsApp provider health status', async () => {
    const res = await GET();
    const body = await res.json();

    expect(body.whatsapp).toEqual({
      configured: true,
      fromNumber: '+919876543210',
    });
  });

  it('returns degraded status when no email providers are configured', async () => {
    mockCheckCommunicationHealth.mockResolvedValue({
      email: { resend: false, sendgrid: false, preferred: 'resend' },
      whatsapp: { configured: false, fromNumber: '' },
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.email.resend).toBe(false);
    expect(body.email.sendgrid).toBe(false);
    expect(body.whatsapp.configured).toBe(false);
    expect(body.whatsapp.fromNumber).toBe('');
  });

  it('propagates health check errors', async () => {
    mockCheckCommunicationHealth.mockRejectedValue(new Error('Provider unreachable'));

    // The endpoint should propagate the error (Next.js will handle it)
    await expect(GET()).rejects.toThrow('Provider unreachable');
  });

  it('does not call validateAuth (unauthenticated endpoint)', async () => {
    await GET();

    expect(mockValidateAuth).not.toHaveBeenCalled();
  });

  it('returns SendGrid as preferred when configured', async () => {
    mockCheckCommunicationHealth.mockResolvedValue({
      email: { resend: false, sendgrid: true, preferred: 'sendgrid' },
      whatsapp: { configured: true, fromNumber: '+15551234567' },
    });

    const res = await GET();
    const body = await res.json();

    expect(body.email.preferred).toBe('sendgrid');
    expect(body.email.sendgrid).toBe(true);
  });
});
