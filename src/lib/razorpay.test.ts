import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getRazorpayConfig,
  setRazorpayConfig,
  createRazorpayOrder,
  verifyRazorpayPayment,
  generateUPIQR,
  getUPIQRCodes,
  markUPIQRPaid,
  deleteUPIQR,
  generatePaymentLink,
  getPaymentLinks,
  markPaymentLinkPaid,
  deletePaymentLink,
  getPaymentRecords,
  addManualPayment,
  deletePayment,
  generatePaymentMessage,
  formatINRRazorpay,
} from './razorpay';

// ─── Config ─────────────────────────────

describe('Razorpay config', () => {
  it('returns null when no config is set', () => {
    expect(getRazorpayConfig()).toBeNull();
  });

  it('stores and retrieves config', () => {
    setRazorpayConfig({ keyId: 'rzp_test_123', keySecret: 'secret_456' });
    const config = getRazorpayConfig();
    expect(config).toEqual({ keyId: 'rzp_test_123', keySecret: 'secret_456' });
  });

  it('returns null on corrupted localStorage data', () => {
    localStorage.setItem('oracle_razorpay_config', '{invalid json');
    expect(getRazorpayConfig()).toBeNull();
  });
});

// ─── Server-side Order Creation ─────────

describe('createRazorpayOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls /api/razorpay/orders and returns order data', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        orderId: 'order_abc',
        amount: 100000,
        currency: 'INR',
        status: 'created',
      }),
    };
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(mockResponse as any);

    const result = await createRazorpayOrder(1000, 'INR', 'receipt_1', { project: 'Web' });

    expect(fetch).toHaveBeenCalledWith('/api/razorpay/orders', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 1000, currency: 'INR', receipt: 'receipt_1', notes: { project: 'Web' } }),
    }));
    expect(result).toEqual({
      orderId: 'order_abc',
      amount: 100000,
      currency: 'INR',
      status: 'created',
    });
  });

  it('throws on server error', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Invalid amount' }),
    } as any);

    await expect(createRazorpayOrder(0)).rejects.toThrow('Invalid amount');
  });
});

// ─── Signature Verification ─────────────

describe('verifyRazorpayPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls /api/razorpay/verify and returns verified result', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ verified: true, amount: 50000, status: 'captured' }),
    } as any);

    const result = await verifyRazorpayPayment('order_1', 'pay_1', 'sig_abc');

    expect(fetch).toHaveBeenCalledWith('/api/razorpay/verify', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        razorpay_order_id: 'order_1',
        razorpay_payment_id: 'pay_1',
        razorpay_signature: 'sig_abc',
      }),
    }));
    expect(result).toEqual({ verified: true, amount: 50000, status: 'captured' });
  });

  it('throws on verification failure', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Signature mismatch' }),
    } as any);

    await expect(verifyRazorpayPayment('order_1', 'pay_1', 'bad_sig')).rejects.toThrow('Signature mismatch');
  });
});

// ─── UPI QR Code Generation ─────────────

describe('UPI QR code generation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('generates a UPI QR code with correct data', () => {
    const qr = generateUPIQR('test@upi', 500, 'Website Development');

    expect(qr.id).toMatch(/^upi_/);
    expect(qr.upiId).toBe('test@upi');
    expect(qr.amount).toBe(500);
    expect(qr.description).toBe('Website Development');
    expect(qr.status).toBe('active');
    expect(qr.qrUrl).toContain('api.qrserver.com');
    expect(qr.upiLink).toContain('upi://pay');
    expect(qr.upiLink).toContain('pa=test%40upi');
    expect(qr.upiLink).toContain('am=500');
  });

  it('sets expiry when specified', () => {
    const before = Date.now();
    const qr = generateUPIQR('test@upi', 100, 'Service', 30);

    expect(qr.expiresAt).toBeDefined();
    expect(qr.expiresAt).toBeGreaterThanOrEqual(before + 30 * 60 * 1000);
  });

  it('does not set expiry by default', () => {
    const qr = generateUPIQR('test@upi', 100, 'Service');
    expect(qr.expiresAt).toBeUndefined();
  });

  it('persists QR codes in localStorage', () => {
    generateUPIQR('test@upi', 100, 'Service 1');
    generateUPIQR('test@upi', 200, 'Service 2');

    const codes = getUPIQRCodes();
    expect(codes).toHaveLength(2);
    expect(codes[0].description).toBe('Service 2'); // most recent first
    expect(codes[1].description).toBe('Service 1');
  });

  it('marks QR code as paid', () => {
    const qr = generateUPIQR('test@upi', 100, 'Service');
    markUPIQRPaid(qr.id);

    const codes = getUPIQRCodes();
    expect(codes[0].status).toBe('paid');
  });

  it('deletes QR code', () => {
    const qr1 = generateUPIQR('test@upi', 100, 'Service 1');
    const qr2 = generateUPIQR('test@upi', 200, 'Service 2');

    deleteUPIQR(qr1.id);

    const codes = getUPIQRCodes();
    expect(codes).toHaveLength(1);
    expect(codes[0].id).toBe(qr2.id);
  });
});

// ─── Payment Links ──────────────────────

describe('Payment links', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('generates a payment link with correct data', () => {
    const link = generatePaymentLink(2500, 'SEO Package', 'Oracle Digital');

    expect(link.id).toMatch(/^link_/);
    expect(link.amount).toBe(2500);
    expect(link.description).toBe('SEO Package');
    expect(link.shortUrl).toContain('oracle.digital/pay/');
    expect(link.status).toBe('partially_paid');
  });

  it('sets expiry when specified', () => {
    const before = Date.now();
    const link = generatePaymentLink(1000, 'Service', 'Agency', 7);

    expect(link.expiresAt).toBeDefined();
    expect(link.expiresAt).toBeGreaterThanOrEqual(before + 7 * 24 * 60 * 60 * 1000);
  });

  it('persists links in localStorage', () => {
    generatePaymentLink(1000, 'Service 1', 'Agency');
    generatePaymentLink(2000, 'Service 2', 'Agency');

    const links = getPaymentLinks();
    expect(links).toHaveLength(2);
    expect(links[0].amount).toBe(2000); // most recent first
  });

  it('marks link as paid', () => {
    const link = generatePaymentLink(1000, 'Service', 'Agency');
    markPaymentLinkPaid(link.id);

    const links = getPaymentLinks();
    expect(links[0].status).toBe('paid');
  });

  it('deletes link', () => {
    const link1 = generatePaymentLink(1000, 'Service 1', 'Agency');
    const link2 = generatePaymentLink(2000, 'Service 2', 'Agency');

    deletePaymentLink(link1.id);

    const links = getPaymentLinks();
    expect(links).toHaveLength(1);
    expect(links[0].id).toBe(link2.id);
  });
});

// ─── Payment Records ────────────────────

describe('Payment records', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns empty array initially', () => {
    expect(getPaymentRecords()).toEqual([]);
  });

  it('adds a manual payment and retrieves it', () => {
    const record = addManualPayment({
      paymentId: 'manual_001',
      amount: 5000,
      currency: 'INR',
      status: 'captured',
      method: 'bank_transfer',
      customerName: 'Acme Corp',
      description: 'Website project',
    });

    expect(record.id).toMatch(/^manual_/);
    expect(record.amount).toBe(5000);
    expect(record.customerName).toBe('Acme Corp');
    expect(record.createdAt).toBeGreaterThan(0);

    const records = getPaymentRecords();
    expect(records).toHaveLength(1);
    expect(records[0].id).toBe(record.id);
  });

  it('deletes a payment record', () => {
    const record = addManualPayment({
      paymentId: 'p1',
      amount: 1000,
      currency: 'INR',
      status: 'captured',
      method: 'upi',
      customerName: 'Client',
      description: 'Service',
    });

    deletePayment(record.id);
    expect(getPaymentRecords()).toEqual([]);
  });

  it('limits stored records to 500', () => {
    // Add 502 records (each has a unique ID due to Date.now() + random)
    for (let i = 0; i < 502; i++) {
      addManualPayment({
        paymentId: `p_${i}`,
        amount: 100 * i,
        currency: 'INR',
        status: 'captured',
        method: 'upi',
        customerName: 'Client',
        description: `Service ${i}`,
      });
    }

    const records = getPaymentRecords();
    expect(records.length).toBeLessThanOrEqual(500);
  });
});

// ─── WhatsApp Message Generation ────────

describe('generatePaymentMessage', () => {
  it('generates a formatted message with all fields', () => {
    const msg = generatePaymentMessage('Acme Corp', 15000, 'Website Redesign', 'INV-001');

    expect(msg).toContain('Acme Corp');
    expect(msg).toContain('₹15,000');
    expect(msg).toContain('Website Redesign');
    expect(msg).toContain('INV-001');
    expect(msg).toContain('UPI');
    expect(msg).toContain('ORACLE');
  });

  it('auto-generates invoice number if not provided', () => {
    const msg = generatePaymentMessage('Client', 5000, 'SEO Service');

    expect(msg).toContain('INV-');
    expect(msg).not.toContain('undefined');
  });
});

// ─── Currency Formatting ────────────────

describe('formatINRRazorpay', () => {
  it('formats zero correctly', () => {
    expect(formatINRRazorpay(0)).toBe('₹0');
  });

  it('formats small amounts with commas', () => {
    expect(formatINRRazorpay(1000)).toBe('₹1,000');
  });

  it('formats large amounts with Indian numbering', () => {
    expect(formatINRRazorpay(100000)).toBe('₹1,00,000');
  });

  it('formats crore amounts correctly', () => {
    expect(formatINRRazorpay(10000000)).toBe('₹1,00,00,000');
  });
});
