import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { InvoiceItem } from '@/types';
import {
  generateInvoiceNumber,
  calculateInvoiceTotals,
  formatInvoiceAsText,
} from './invoice';

// ─── Helpers ───

function makeItem(overrides: Partial<InvoiceItem> = {}): InvoiceItem {
  return {
    description: 'SEO Audit',
    quantity: 1,
    rate: 5000,
    amount: 5000,
    ...overrides,
  };
}

const fullInvoiceData = {
  agencyName: 'Oracle Agency',
  agencyAddress: '123 MG Road\nMumbai 400001',
  agencyGST: '27AABCU9603R1ZM',
  agencyPhone: '+91 98765 43210',
  agencyEmail: 'billing@oracle.agency',
  clientName: 'Acme Corp',
  clientAddress: '456 Park Street\nKolkata 700016',
  clientGST: '19AABCA1234N1ZP',
  items: [
    makeItem({ description: 'SEO Audit', quantity: 1, rate: 5000, amount: 5000 }),
    makeItem({ description: 'Blog Writing', quantity: 4, rate: 2000, amount: 8000 }),
  ],
  invoiceNumber: 'INV-2026-001',
  invoiceDate: '10 Jun 2026',
  dueDate: '10 Jul 2026',
  paymentTerms: 'Net 30 days',
  notes: 'Thank you for your business!',
  upiId: 'oracle@upi',
  bankDetails: 'Hindi Bank\nAcct: 1234567890\nIFSC: HINB0001234',
};

// ─── Tests ─────────────────────────────

describe('calculateInvoiceTotals', () => {
  it('calculates subtotal, GST (18%), and total for single item', () => {
    const items = [makeItem({ amount: 10000 })];
    const result = calculateInvoiceTotals(items);
    expect(result.subtotal).toBe(10000);
    expect(result.gst).toBe(1800);
    expect(result.total).toBe(11800);
  });

  it('sums multiple items correctly', () => {
    const items = [
      makeItem({ amount: 5000 }),
      makeItem({ amount: 8000 }),
      makeItem({ amount: 3000 }),
    ];
    const result = calculateInvoiceTotals(items);
    expect(result.subtotal).toBe(16000);
    expect(result.gst).toBe(2880);
    expect(result.total).toBe(18880);
  });

  it('returns zero for empty items', () => {
    const result = calculateInvoiceTotals([]);
    expect(result.subtotal).toBe(0);
    expect(result.gst).toBe(0);
    expect(result.total).toBe(0);
  });

  it('handles decimal amounts', () => {
    const items = [makeItem({ amount: 1234.56 })];
    const result = calculateInvoiceTotals(items);
    expect(result.subtotal).toBe(1234.56);
    expect(result.gst).toBeCloseTo(222.22, 2);
    expect(result.total).toBeCloseTo(1456.78, 2);
  });
});

describe('generateInvoiceNumber', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('generates sequential invoice numbers', () => {
    const first = generateInvoiceNumber();
    const second = generateInvoiceNumber();
    const third = generateInvoiceNumber();

    expect(first).toMatch(/^INV-\d{4}-001$/);
    expect(second).toMatch(/^INV-\d{4}-002$/);
    expect(third).toMatch(/^INV-\d{4}-003$/);
  });

  it('uses custom prefix', () => {
    const num = generateInvoiceNumber('BILL');
    expect(num).toMatch(/^BILL-\d{4}-001$/);
  });

  it('persists counter across calls', () => {
    generateInvoiceNumber();
    generateInvoiceNumber();
    // Simulate re-import by reading localStorage directly
    const counter = localStorage.getItem('oracle_invoice_counter');
    expect(counter).toBe('2');
    const next = generateInvoiceNumber();
    expect(next).toMatch(/-003$/);
  });

  it('falls back to -001 on error', () => {
    // Mock localStorage.getItem on the replaced window.localStorage object
    const origGetItem = window.localStorage.getItem;
    window.localStorage.getItem = (() => { throw new Error('fail'); }) as unknown as typeof origGetItem;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const num = generateInvoiceNumber();
    expect(num).toMatch(/-001$/);
    expect(warnSpy).toHaveBeenCalled();

    window.localStorage.getItem = origGetItem;
    warnSpy.mockRestore();
  });
});

describe('formatInvoiceAsText', () => {
  it('includes invoice number and dates', () => {
    const text = formatInvoiceAsText(fullInvoiceData);
    expect(text).toContain('INV-2026-001');
    expect(text).toContain('10 Jun 2026');
    expect(text).toContain('10 Jul 2026');
  });

  it('includes agency details', () => {
    const text = formatInvoiceAsText(fullInvoiceData);
    expect(text).toContain('Oracle Agency');
    expect(text).toContain('123 MG Road');
    expect(text).toContain('27AABCU9603R1ZM');
    expect(text).toContain('+91 98765 43210');
    expect(text).toContain('billing@oracle.agency');
  });

  it('includes client details', () => {
    const text = formatInvoiceAsText(fullInvoiceData);
    expect(text).toContain('Acme Corp');
    expect(text).toContain('456 Park Street');
    expect(text).toContain('19AABCA1234N1ZP');
  });

  it('includes line items', () => {
    const text = formatInvoiceAsText(fullInvoiceData);
    expect(text).toContain('SEO Audit');
    expect(text).toContain('Blog Writing');
  });

  it('calculates and displays correct totals', () => {
    const text = formatInvoiceAsText(fullInvoiceData);
    expect(text).toContain('Subtotal');
    expect(text).toContain('GST (18%)');
    expect(text).toContain('TOTAL');
    // 5000 + 8000 = 13000 subtotal, 2340 GST, 15340 total
    expect(text).toContain('13,000');
    expect(text).toContain('2,340');
    expect(text).toContain('15,340');
  });

  it('includes payment details', () => {
    const text = formatInvoiceAsText(fullInvoiceData);
    expect(text).toContain('oracle@upi');
    expect(text).toContain('Hindi Bank');
    expect(text).toContain('Net 30 days');
  });

  it('includes notes', () => {
    const text = formatInvoiceAsText(fullInvoiceData);
    expect(text).toContain('Thank you for your business!');
  });

  it('omits optional fields when not provided', () => {
    const minimal = {
      ...fullInvoiceData,
      agencyGST: undefined,
      clientAddress: undefined,
      clientGST: undefined,
      notes: undefined,
      upiId: undefined,
      bankDetails: undefined,
    };
    const text = formatInvoiceAsText(minimal);
    expect(text).not.toContain('GSTIN');
    expect(text).not.toContain('UPI ID');
    expect(text).not.toContain('Notes:');
  });

  it('formats items with Indian currency notation', () => {
    const data = {
      ...fullInvoiceData,
      items: [makeItem({ description: 'Service', quantity: 1, rate: 150000, amount: 150000 })],
    };
    const text = formatInvoiceAsText(data);
    expect(text).toContain('₹1,50,000');
  });
});
