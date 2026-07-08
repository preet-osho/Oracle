// ═══════════════════════════════════════
// Tests for sendBulkWhatsApp (100ms delay verification)
// ═══════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Hoisted mock references ────────────

const { mockSendMessage } = vi.hoisted(() => ({
  mockSendMessage: vi.fn(),
}));

// ─── Module Mocks ──────────────────────

vi.mock('twilio', () => ({
  default: vi.fn().mockReturnValue({
    messages: {
      create: mockSendMessage,
      list: vi.fn(),
      fetch: vi.fn(),
    },
  }),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Set required env vars
process.env.TWILIO_ACCOUNT_SID = 'AC1234567890abcdef';
process.env.TWILIO_AUTH_TOKEN = 'auth-token-12345';
process.env.TWILIO_WHATSAPP_FROM = 'whatsapp:+14155238886';

// ─── Tests ─────────────────────────────

describe('sendBulkWhatsApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockSendMessage.mockResolvedValue({
      sid: 'SM1234567890',
      status: 'queued',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends messages to all recipients', async () => {
    const { sendBulkWhatsApp } = await import('./whatsapp');
    const recipients = ['+919876543210', '+919876543211', '+919876543212'];
    const body = 'Hello from Oracle!';

    // Run the async function
    const promise = sendBulkWhatsApp(recipients, body);

    // Fast-forward through all delays
    await vi.advanceTimersByTimeAsync(500);

    const results = await promise;

    expect(results).toHaveLength(3);
    expect(mockSendMessage).toHaveBeenCalledTimes(3);
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'whatsapp:+919876543210',
        body: body,
      }),
    );
  });

  it('applies 100ms delay between consecutive messages', async () => {
    const { sendBulkWhatsApp } = await import('./whatsapp');
    const recipients = ['+919876543210', '+919876543211', '+919876543212'];
    const body = 'Bulk test';

    const promise = sendBulkWhatsApp(recipients, body);

    // After 0ms: only first message sent
    expect(mockSendMessage).toHaveBeenCalledTimes(1);

    // After 99ms: still only first message (delay not complete)
    await vi.advanceTimersByTimeAsync(99);
    expect(mockSendMessage).toHaveBeenCalledTimes(1);

    // After 100ms: second message sent
    await vi.advanceTimersByTimeAsync(1);
    expect(mockSendMessage).toHaveBeenCalledTimes(2);

    // After 199ms: still only two messages
    await vi.advanceTimersByTimeAsync(99);
    expect(mockSendMessage).toHaveBeenCalledTimes(2);

    // After 200ms: third message sent
    await vi.advanceTimersByTimeAsync(1);
    expect(mockSendMessage).toHaveBeenCalledTimes(3);

    await promise;
  });

  it('does NOT delay after the last message', async () => {
    const { sendBulkWhatsApp } = await import('./whatsapp');
    const recipients = ['+919876543210', '+919876543211'];
    const body = 'No delay after last';

    const promise = sendBulkWhatsApp(recipients, body);

    // First message sent immediately
    expect(mockSendMessage).toHaveBeenCalledTimes(1);

    // Advance past first delay (100ms)
    await vi.advanceTimersByTimeAsync(100);
    expect(mockSendMessage).toHaveBeenCalledTimes(2);

    // Advance another 100ms - should NOT trigger more delays or messages
    const timersBefore = vi.getTimerCount();
    await vi.advanceTimersByTimeAsync(100);
    const timersAfter = vi.getTimerCount();

    // No new timers should have been created for the last message
    expect(timersAfter).toBeLessThanOrEqual(timersBefore);

    await promise;
  });

  it('handles single recipient with no delay', async () => {
    const { sendBulkWhatsApp } = await import('./whatsapp');
    const recipients = ['+919876543210'];
    const body = 'Single recipient';

    const promise = sendBulkWhatsApp(recipients, body);

    // Should complete without needing timer advancement
    // Single message means no delay needed
    expect(mockSendMessage).toHaveBeenCalledTimes(1);

    // Even after waiting, no more messages should be sent
    await vi.advanceTimersByTimeAsync(200);
    expect(mockSendMessage).toHaveBeenCalledTimes(1);

    await promise;
  });

  it('handles empty recipients array', async () => {
    const { sendBulkWhatsApp } = await import('./whatsapp');

    const results = await sendBulkWhatsApp([], 'Empty array test');

    expect(results).toHaveLength(0);
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('delays are sequential (total time ≈ (n-1) × 100ms)', async () => {
    const { sendBulkWhatsApp } = await import('./whatsapp');
    const recipients = ['+919876543210', '+919876543211', '+919876543212', '+919876543213'];
    const body = 'Sequential timing test';

    const startTime = Date.now();
    const promise = sendBulkWhatsApp(recipients, body);

    // 4 recipients = 3 delays × 100ms = 300ms total delay
    await vi.advanceTimersByTimeAsync(300);
    const results = await promise;

    expect(results).toHaveLength(4);
    expect(mockSendMessage).toHaveBeenCalledTimes(4);

    // Total time should be approximately 300ms (3 delays)
    expect(Date.now() - startTime).toBeGreaterThanOrEqual(300);
    expect(Date.now() - startTime).toBeLessThan(350);
  });

  it('returns failed status when sendWhatsAppMessage fails', async () => {
    const { sendBulkWhatsApp } = await import('./whatsapp');
    mockSendMessage.mockRejectedValueOnce(new Error('Twilio API error'));

    const recipients = ['+919876543210', '+919876543211'];
    const body = 'Failure test';

    const promise = sendBulkWhatsApp(recipients, body);
    await vi.advanceTimersByTimeAsync(200);

    const results = await promise;

    expect(results).toHaveLength(2);
    expect(results[0].status).toBe('failed');
    expect(results[0].error).toBe('Twilio API error');
    // Second message still sent despite first failure
    expect(mockSendMessage).toHaveBeenCalledTimes(2);
  });

  it('continues sending after individual message failure', async () => {
    const { sendBulkWhatsApp } = await import('./whatsapp');
    const { sendWhatsAppMessage } = await import('./whatsapp');

    // Mock to fail first, succeed second
    mockSendMessage
      .mockRejectedValueOnce(new Error('First failed'))
      .mockResolvedValueOnce({ sid: 'SM_SUCCESS', status: 'queued' });

    const recipients = ['+919876543210', '+919876543211'];
    const body = 'Continue after failure';

    const promise = sendBulkWhatsApp(recipients, body);
    await vi.advanceTimersByTimeAsync(200);

    const results = await promise;

    expect(results[0].status).toBe('failed');
    expect(results[1].status).toBe('queued');
    expect(mockSendMessage).toHaveBeenCalledTimes(2);
  });
});
