import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateLateFee,
  getReminderTemplate,
  addPayment,
  getPayments,
  markAsPaid,
  recordReminder,
  getOverduePayments,
  getPaymentStats,
  DEFAULT_LATE_FEE_CONFIG,
} from './late-fee-calculator';

const DAY = 24 * 60 * 60 * 1000;

describe('calculateLateFee', () => {
  it('returns zero for on-time payment', () => {
    const result = calculateLateFee(10000, Date.now() - 3 * DAY, Date.now());
    expect(result.lateFee).toBe(0);
    expect(result.withinGrace).toBe(true);
    expect(result.daysOverdue).toBe(3);
  });

  it('applies late fee after grace period', () => {
    const result = calculateLateFee(10000, Date.now() - 15 * DAY, Date.now());
    expect(result.lateFee).toBeGreaterThan(0);
    expect(result.withinGrace).toBe(false);
    expect(result.daysOverdue).toBe(15);
  });

  it('caps late fee at max percentage', () => {
    const result = calculateLateFee(10000, Date.now() - 100 * DAY, Date.now());
    expect(result.lateFee).toBeLessThanOrEqual(10000 * 0.15);
  });

  it('calculates compound daily when configured', () => {
    const config = { ...DEFAULT_LATE_FEE_CONFIG, compoundDaily: true, gracePeriodDays: 0 };
    const result = calculateLateFee(10000, Date.now() - 10 * DAY, Date.now(), config);
    expect(result.lateFee).toBeGreaterThan(0);
  });

  it('returns correct escalation levels', () => {
    const gentle = calculateLateFee(10000, Date.now() - 5 * DAY, Date.now(), { ...DEFAULT_LATE_FEE_CONFIG, gracePeriodDays: 0 });
    expect(gentle.escalationLevel).toBe('gentle');

    const firm = calculateLateFee(10000, Date.now() - 15 * DAY, Date.now(), { ...DEFAULT_LATE_FEE_CONFIG, gracePeriodDays: 0 });
    expect(firm.escalationLevel).toBe('firm');

    const final = calculateLateFee(10000, Date.now() - 30 * DAY, Date.now(), { ...DEFAULT_LATE_FEE_CONFIG, gracePeriodDays: 0 });
    expect(final.escalationLevel).toBe('final');

    const legal = calculateLateFee(10000, Date.now() - 50 * DAY, Date.now(), { ...DEFAULT_LATE_FEE_CONFIG, gracePeriodDays: 0 });
    expect(legal.escalationLevel).toBe('legal');
  });

  it('calculates total owed correctly', () => {
    const result = calculateLateFee(10000, Date.now() - 15 * DAY, Date.now());
    expect(result.totalOwed).toBe(10000 + result.lateFee);
  });
});

describe('getReminderTemplate', () => {
  it('returns gentle reminder for early overdue', () => {
    const template = getReminderTemplate('gentle', 'Acme Corp', 'INV-001', 10000, 3, 0);
    expect(template).toContain('Acme Corp');
    expect(template).toContain('INV-001');
    expect(template).toContain('friendly');
  });

  it('returns firm reminder for mid overdue', () => {
    const template = getReminderTemplate('firm', 'Acme Corp', 'INV-001', 10000, 14, 2100);
    expect(template).toContain('late fee');
    expect(template).toContain('₹2,100');
  });

  it('returns final reminder for long overdue', () => {
    const template = getReminderTemplate('final', 'Acme Corp', 'INV-001', 10000, 30, 4500);
    expect(template).toContain('final reminder');
  });

  it('returns legal notice for very long overdue', () => {
    const template = getReminderTemplate('legal', 'Acme Corp', 'INV-001', 10000, 60, 9000);
    expect(template).toContain('legal');
  });
});

describe('localStorage persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('addPayment and getPayments round-trip', () => {
    const payment = addPayment({
      invoiceId: 'inv-1',
      clientName: 'Test Client',
      amount: 10000,
      dueDate: Date.now() - 10 * DAY,
      status: 'overdue',
    });
    const payments = getPayments();
    expect(payments).toHaveLength(1);
    expect(payments[0].clientName).toBe('Test Client');
    expect(payments[0].lateFee).toBeGreaterThan(0);
  });

  it('markAsPaid updates status', () => {
    const payment = addPayment({
      invoiceId: 'inv-1',
      clientName: 'Test Client',
      amount: 10000,
      dueDate: Date.now() - 10 * DAY,
      status: 'overdue',
    });
    markAsPaid(payment.id, Date.now());
    const payments = getPayments();
    expect(payments[0].status).toBe('paid');
    expect(payments[0].paidDate).toBeDefined();
  });

  it('recordReminder increments count', () => {
    const payment = addPayment({
      invoiceId: 'inv-1',
      clientName: 'Test Client',
      amount: 10000,
      dueDate: Date.now() - 10 * DAY,
      status: 'overdue',
    });
    recordReminder(payment.id);
    recordReminder(payment.id);
    const payments = getPayments();
    expect(payments[0].remindersSent).toBe(2);
  });

  it('getOverduePayments filters correctly', () => {
    addPayment({
      invoiceId: 'inv-1',
      clientName: 'Overdue',
      amount: 10000,
      dueDate: Date.now() - 10 * DAY,
      status: 'overdue',
    });
    addPayment({
      invoiceId: 'inv-2',
      clientName: 'Paid',
      amount: 5000,
      dueDate: Date.now() + 5 * DAY,
      status: 'paid',
    });
    const overdue = getOverduePayments();
    expect(overdue.length).toBe(1);
    expect(overdue[0].clientName).toBe('Overdue');
  });

  it('getPaymentStats aggregates correctly', () => {
    addPayment({
      invoiceId: 'inv-1',
      clientName: 'Client A',
      amount: 10000,
      dueDate: Date.now() - 10 * DAY,
      status: 'overdue',
    });
    const stats = getPaymentStats();
    expect(stats.overdueCount).toBe(1);
    expect(stats.totalOutstanding).toBe(10000);
    expect(stats.totalLateFees).toBeGreaterThan(0);
  });
});
