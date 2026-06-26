// ═══════════════════════════════════════════════════════════════
// ORACLE — Cross-Module Integration Tests
// Scenarios 8.1 (Time→Invoice) & 8.3 (Memory→Invoice)
// Verifies data flows between modules without double data entry
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import type { TimeEntry, MemoryItem } from '@/types';
import { calculateInvoiceTotals, formatInvoiceAsText, timeEntriesToInvoiceItems } from './invoice';
import { formatMemoryForContext, memoriesToInvoiceContext } from './memory';

// ─── Helpers ──────────────────────────────────────────────────

function makeTimeEntry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: `te-${Date.now()}`,
    clientId: 'client-1',
    description: 'SEO Audit',
    hours: 2,
    rate: 1500,
    date: Date.now(),
    billable: true,
    ...overrides,
  };
}

function makeMemory(overrides: Partial<MemoryItem> = {}): MemoryItem {
  return {
    id: `mem-${Date.now()}`,
    content: 'Client prefers Net 15 payment terms',
    category: 'preference',
    importance: 2,
    createdAt: Date.now(),
    ...overrides,
  };
}



// ═══════════════════════════════════════════════════════════════
// Scenario 8.1 — Time Entry → Invoice Flow
// ═══════════════════════════════════════════════════════════════

describe('Time → Invoice integration (Scenario 8.1)', () => {
  it('converts time entries to invoice line items', () => {
    const entries = [
      makeTimeEntry({ description: 'SEO Audit', hours: 4, rate: 1500, billable: true }),
      makeTimeEntry({ description: 'Blog Writing', hours: 8, rate: 1000, billable: true }),
      makeTimeEntry({ description: 'Internal Meeting', hours: 2, rate: 1500, billable: false }),
    ];

    const items = timeEntriesToInvoiceItems(entries);

    expect(items).toHaveLength(2);
    expect(items.find((i) => i.description === 'SEO Audit')).toEqual({
      description: 'SEO Audit',
      quantity: 4,
      rate: 1500,
      amount: 6000,
    });
    expect(items.find((i) => i.description === 'Blog Writing')).toEqual({
      description: 'Blog Writing',
      quantity: 8,
      rate: 1000,
      amount: 8000,
    });
  });

  it('groups multiple time entries with same description', () => {
    const entries = [
      makeTimeEntry({ description: 'SEO Audit', hours: 2, rate: 1500, billable: true }),
      makeTimeEntry({ description: 'SEO Audit', hours: 3, rate: 1500, billable: true }),
      makeTimeEntry({ description: 'SEO Audit', hours: 1, rate: 1500, billable: true }),
    ];

    const items = timeEntriesToInvoiceItems(entries);

    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
      description: 'SEO Audit',
      quantity: 6,
      rate: 1500,
      amount: 9000,
    });
  });

  it('produces correct invoice totals from time entries', () => {
    const entries = [
      makeTimeEntry({ description: 'SEO Audit', hours: 4, rate: 1500, billable: true }),
      makeTimeEntry({ description: 'Blog Writing', hours: 8, rate: 1000, billable: true }),
    ];

    const items = timeEntriesToInvoiceItems(entries);
    const totals = calculateInvoiceTotals(items);

    expect(totals.subtotal).toBe(14000); // 6000 + 8000
    expect(totals.gst).toBe(2520); // 14000 * 0.18
    expect(totals.total).toBe(16520); // 14000 + 2520
  });

  it('generates correct text invoice from time entries', () => {
    const entries = [
      makeTimeEntry({ description: 'SEO Audit', hours: 4, rate: 1500, billable: true }),
      makeTimeEntry({ description: 'Blog Writing', hours: 8, rate: 1000, billable: true }),
    ];

    const items = timeEntriesToInvoiceItems(entries);
    const text = formatInvoiceAsText({
      agencyName: 'Oracle Agency',
      agencyAddress: '123 MG Road\nMumbai 400001',
      agencyPhone: '+91 98765 43210',
      agencyEmail: 'billing@oracle.agency',
      clientName: 'Acme Corp',
      items,
      invoiceNumber: 'INV-2026-001',
      invoiceDate: '23 Jun 2026',
      dueDate: '23 Jul 2026',
      paymentTerms: 'Net 30 days',
    });

    expect(text).toContain('SEO Audit');
    expect(text).toContain('Blog Writing');
    expect(text).toContain('14,000'); // subtotal
    expect(text).toContain('2,520'); // GST
    expect(text).toContain('16,520'); // total
  });

  it('returns empty items when all time entries are non-billable', () => {
    const entries = [
      makeTimeEntry({ description: 'Internal Meeting', hours: 2, billable: false }),
      makeTimeEntry({ description: 'Research', hours: 4, billable: false }),
    ];

    const items = timeEntriesToInvoiceItems(entries);
    expect(items).toHaveLength(0);
  });

  it('handles single time entry', () => {
    const entries = [
      makeTimeEntry({ description: 'Website Redesign', hours: 20, rate: 2000, billable: true }),
    ];

    const items = timeEntriesToInvoiceItems(entries);
    expect(items).toHaveLength(1);
    expect(items[0].amount).toBe(40000);
  });

  it('preserves rate per item when rates differ for same description', () => {
    const entries = [
      makeTimeEntry({ description: 'Consulting', hours: 2, rate: 1500, billable: true }),
      makeTimeEntry({ description: 'Consulting', hours: 3, rate: 2000, billable: true }),
    ];

    const items = timeEntriesToInvoiceItems(entries);
    // First entry wins the rate (grouped by description)
    expect(items).toHaveLength(1);
    expect(items[0].rate).toBe(1500);
    expect(items[0].quantity).toBe(5);
  });
});

// ═══════════════════════════════════════════════════════════════
// Scenario 8.3 — Memory → Invoice Context Flow
// ═══════════════════════════════════════════════════════════════

describe('Memory → Invoice context integration (Scenario 8.3)', () => {
  it('extracts payment terms from client memories', () => {
    const memories = [
      makeMemory({ content: 'Client prefers Net 15 payment terms', category: 'preference' }),
      makeMemory({ content: 'Always sends payment on time', category: 'fact' }),
    ];

    const context = memoriesToInvoiceContext(memories);
    expect(context.paymentTerms).toBe('Client prefers Net 15 payment terms');
  });

  it('extracts GST/TDS notes from client memories', () => {
    const memories = [
      makeMemory({ content: 'Client requires GST invoice with HSN codes', category: 'preference' }),
      makeMemory({ content: 'Client deducts 10% TDS on all payments', category: 'fact' }),
    ];

    const context = memoriesToInvoiceContext(memories);
    expect(context.notes).toContain('GST invoice');
    expect(context.notes).toContain('10% TDS');
  });

  it('extracts billing preferences from client memories', () => {
    const memories = [
      makeMemory({ content: 'Client prefers monthly billing cycle', category: 'preference' }),
      makeMemory({ content: 'Client prefers INR invoices only', category: 'preference' }),
      makeMemory({ content: 'Client is based in Mumbai', category: 'fact' }),
    ];

    const context = memoriesToInvoiceContext(memories);
    expect(context.billingPreferences).toHaveLength(2);
    expect(context.billingPreferences[0]).toContain('monthly billing');
    expect(context.billingPreferences[1]).toContain('INR invoices');
  });

  it('uses default Net 30 when no payment preferences found', () => {
    const memories = [
      makeMemory({ content: 'Client is a dental clinic in Bangalore', category: 'fact' }),
      makeMemory({ content: 'Prefers formal communication', category: 'preference' }),
    ];

    const context = memoriesToInvoiceContext(memories);
    expect(context.paymentTerms).toBe('Net 30 days');
    expect(context.notes).toBe('');
  });

  it('handles empty memories gracefully', () => {
    const context = memoriesToInvoiceContext([]);
    expect(context.paymentTerms).toBe('Net 30 days');
    expect(context.notes).toBe('');
    expect(context.billingPreferences).toHaveLength(0);
  });

  it('formats memory context for display', () => {
    const memories = [
      makeMemory({ content: 'Prefers Net 15 terms', category: 'preference', importance: 3 }),
      makeMemory({ content: 'Requires GST invoice', category: 'preference', importance: 2 }),
      makeMemory({ content: 'Based in Pune', category: 'fact', importance: 1 }),
    ];

    const formatted = formatMemoryForContext(memories);
    expect(formatted).toContain('What I remember about this client:');
    expect(formatted).toContain('[Preference]');
    expect(formatted).toContain('[Fact]');
    expect(formatted).toContain('Prefers Net 15 terms');
  });

  it('prioritizes high-importance memories for invoice context', () => {
    const memories = [
      makeMemory({ content: 'Minor formatting preference', category: 'preference', importance: 1 }),
      makeMemory({ content: 'Client requires 50% upfront payment', category: 'preference', importance: 3 }),
    ];

    const formatted = formatMemoryForContext(memories);
    const lines = formatted.split('\n').filter((l) => l.trim().startsWith('-'));
    // High importance should come first
    expect(lines[0]).toContain('50% upfront payment');
    expect(lines[1]).toContain('Minor formatting preference');
  });

  it('detects upfront payment preferences', () => {
    const memories = [
      makeMemory({ content: 'Client requires 50% upfront before work begins', category: 'preference' }),
    ];

    const context = memoriesToInvoiceContext(memories);
    expect(context.paymentTerms).toContain('50% upfront');
  });

  it('detects invoice format preferences', () => {
    const memories = [
      makeMemory({ content: 'Client prefers digital invoices via email only', category: 'preference' }),
      makeMemory({ content: 'Client wants itemized billing format', category: 'preference' }),
    ];

    const context = memoriesToInvoiceContext(memories);
    expect(context.billingPreferences).toHaveLength(2);
    expect(context.billingPreferences[0]).toContain('digital invoices');
    expect(context.billingPreferences[1]).toContain('itemized billing');
  });
});

// ═══════════════════════════════════════════════════════════════
// Combined Flow — Time + Memory → Complete Invoice
// ═══════════════════════════════════════════════════════════════

describe('Combined time + memory → invoice flow', () => {
  it('generates a complete invoice from time entries and client memories', () => {
    // Step 1: Log time entries
    const timeEntries = [
      makeTimeEntry({ description: 'SEO Audit', hours: 4, rate: 1500, billable: true }),
      makeTimeEntry({ description: 'Content Writing', hours: 8, rate: 1000, billable: true }),
      makeTimeEntry({ description: 'Team Standup', hours: 1, rate: 1500, billable: false }),
    ];

    // Step 2: Get client memories
    const memories = [
      makeMemory({ content: 'Client prefers Net 15 payment terms', category: 'preference', importance: 3 }),
      makeMemory({ content: 'Client requires GST invoice with HSN codes', category: 'preference', importance: 2 }),
      makeMemory({ content: 'Client deducts 10% TDS', category: 'fact', importance: 3 }),
    ];

    // Step 3: Convert time → invoice items
    const items = timeEntriesToInvoiceItems(timeEntries);
    expect(items).toHaveLength(2); // 2 billable tasks

    // Step 4: Extract invoice context from memories
    const context = memoriesToInvoiceContext(memories);

    // Step 5: Generate complete invoice
    const text = formatInvoiceAsText({
      agencyName: 'Oracle Agency',
      agencyAddress: '123 MG Road\nMumbai 400001',
      agencyGST: '27AABCU9603R1ZM',
      agencyPhone: '+91 98765 43210',
      agencyEmail: 'billing@oracle.agency',
      clientName: 'Acme Corp',
      clientGST: '19AABCA1234N1ZP',
      items,
      invoiceNumber: 'INV-2026-001',
      invoiceDate: '23 Jun 2026',
      dueDate: '08 Jul 2026',
      paymentTerms: context.paymentTerms,
      notes: context.notes || undefined,
    });

    // Verify line items from time entries
    expect(text).toContain('SEO Audit');
    expect(text).toContain('Content Writing');
    expect(text).not.toContain('Team Standup'); // non-billable excluded

    // Verify totals
    // SEO: 4 × 1500 = 6000, Content: 8 × 1000 = 8000, Subtotal = 14000
    expect(text).toContain('14,000');
    expect(text).toContain('2,520'); // GST 18%
    expect(text).toContain('16,520'); // Total

    // Verify payment terms from memory
    expect(text).toContain('Net 15 payment terms');

    // Verify client details
    expect(text).toContain('Acme Corp');
    expect(text).toContain('19AABCA1234N1ZP');
  });

  it('handles zero billable hours gracefully', () => {
    const entries = [
      makeTimeEntry({ description: 'Internal Meeting', hours: 4, billable: false }),
    ];
    const items = timeEntriesToInvoiceItems(entries);
    expect(items).toHaveLength(0);

    const totals = calculateInvoiceTotals(items);
    expect(totals.subtotal).toBe(0);
    expect(totals.total).toBe(0);
  });
});
