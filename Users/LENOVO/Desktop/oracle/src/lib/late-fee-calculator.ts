// ═══════════════════════════════════════
// ORACLE — Late Fee Calculator
// Enforce payment terms · Escalating reminders · Late fee calculation
// ═══════════════════════════════════════

// ─── Types ─────────────────────────────

export type PaymentStatus = 'on-time' | 'overdue' | 'late-charged' | 'disputed' | 'paid';

export interface LateFeeConfig {
  /** Grace period in days after due date */
  gracePeriodDays: number;
  /** Daily late fee percentage */
  dailyFeePercent: number;
  /** Maximum late fee as percentage of invoice total */
  maxFeePercent: number;
  /** Flat late fee amount in INR */
  flatFee?: number;
  /** Whether to compound daily */
  compoundDaily: boolean;
}

export interface PaymentRecord {
  id: string;
  invoiceId: string;
  clientName: string;
  amount: number;
  dueDate: number;
  paidDate?: number;
  status: PaymentStatus;
  lateFee: number;
  remindersSent: number;
  lastReminderDate?: number;
  notes?: string;
  createdAt: number;
}

export interface LateFeeBreakdown {
  daysOverdue: number;
  withinGrace: boolean;
  lateFee: number;
  totalOwed: number;
  dailyRate: number;
  escalationLevel: 'none' | 'gentle' | 'firm' | 'final' | 'legal';
}

// ─── Default Config ────────────────────

export const DEFAULT_LATE_FEE_CONFIG: LateFeeConfig = {
  gracePeriodDays: 7,
  dailyFeePercent: 1.5,
  maxFeePercent: 15,
  compoundDaily: false,
};

// ─── Calculation Engine ────────────────

export function calculateLateFee(
  invoiceAmount: number,
  dueDate: number,
  currentDate: number,
  config: LateFeeConfig = DEFAULT_LATE_FEE_CONFIG
): LateFeeBreakdown {
  const DAY = 24 * 60 * 60 * 1000;
  const daysSinceDue = Math.max(0, Math.floor((currentDate - dueDate) / DAY));
  const withinGrace = daysSinceDue <= config.gracePeriodDays;
  const effectiveDays = Math.max(0, daysSinceDue - config.gracePeriodDays);

  let lateFee = 0;
  const dailyRate = config.dailyFeePercent / 100;

  if (effectiveDays > 0) {
    if (config.flatFee) {
      lateFee = config.flatFee * effectiveDays;
    } else if (config.compoundDaily) {
      // Compound: amount * (1 + rate)^days - amount
      lateFee = invoiceAmount * (Math.pow(1 + dailyRate, effectiveDays) - 1);
    } else {
      // Simple: amount * rate * days
      lateFee = invoiceAmount * dailyRate * effectiveDays;
    }

    // Cap at max
    const maxFee = invoiceAmount * (config.maxFeePercent / 100);
    lateFee = Math.min(lateFee, maxFee);
  }

  lateFee = Math.round(lateFee * 100) / 100;

  // Determine escalation level
  let escalationLevel: LateFeeBreakdown['escalationLevel'] = 'none';
  if (effectiveDays === 0) {
    escalationLevel = 'none';
  } else if (effectiveDays <= 7) {
    escalationLevel = 'gentle';
  } else if (effectiveDays <= 21) {
    escalationLevel = 'firm';
  } else if (effectiveDays <= 45) {
    escalationLevel = 'final';
  } else {
    escalationLevel = 'legal';
  }

  return {
    daysOverdue: daysSinceDue,
    withinGrace,
    lateFee,
    totalOwed: invoiceAmount + lateFee,
    dailyRate: dailyRate * 100,
    escalationLevel,
  };
}

// ─── Reminder Templates ────────────────

export function getReminderTemplate(
  escalationLevel: LateFeeBreakdown['escalationLevel'],
  clientName: string,
  invoiceNumber: string,
  amount: number,
  daysOverdue: number,
  lateFee: number
): string {
  const total = amount + lateFee;

  switch (escalationLevel) {
    case 'gentle':
      return `Hi ${clientName}, just a friendly reminder that Invoice ${invoiceNumber} (₹${amount.toLocaleString('en-IN')}) was due ${daysOverdue} day${daysOverdue > 1 ? 's' : ''} ago. Could you please process the payment at your earliest convenience? Let me know if you need the invoice resent.`;

    case 'firm':
      return `Hi ${clientName}, this is a follow-up regarding Invoice ${invoiceNumber} for ₹${amount.toLocaleString('en-IN')}, which is now ${daysOverdue} days overdue. As per our payment terms, a late fee of ₹${lateFee.toLocaleString('en-IN')} has been applied, bringing the total to ₹${total.toLocaleString('en-IN')}. Please process the payment to avoid further charges.`;

    case 'final':
      return `Dear ${clientName}, this is a final reminder regarding Invoice ${invoiceNumber}. The invoice of ₹${amount.toLocaleString('en-IN')} is now ${daysOverdue} days overdue with late fees of ₹${lateFee.toLocaleString('en-IN')} (total: ₹${total.toLocaleString('en-IN')}). Please settle this immediately to avoid further escalation.`;

    case 'legal':
      return `Dear ${clientName}, despite multiple reminders, Invoice ${invoiceNumber} (₹${amount.toLocaleString('en-IN')} + ₹${lateFee.toLocaleString('en-IN')} late fees = ₹${total.toLocaleString('en-IN')}) remains unpaid for ${daysOverdue} days. We reserve the right to pursue legal remedies if payment is not received within 7 days.`;

    default:
      return `Payment reminder for Invoice ${invoiceNumber}: ₹${total.toLocaleString('en-IN')} outstanding.`;
  }
}

// ─── Payment Tracking ──────────────────

const PAYMENTS_KEY = 'oracle_payments';

export function addPayment(payment: Omit<PaymentRecord, 'id' | 'lateFee' | 'remindersSent' | 'createdAt'>): PaymentRecord {
  const breakdown = calculateLateFee(payment.amount, payment.dueDate, Date.now());
  const full: PaymentRecord = {
    ...payment,
    id: `pay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    lateFee: breakdown.lateFee,
    remindersSent: 0,
    createdAt: Date.now(),
  };

  if (typeof window === 'undefined') return full;
  try {
    const raw = localStorage.getItem(PAYMENTS_KEY);
    const payments: PaymentRecord[] = raw ? JSON.parse(raw) : [];
    payments.unshift(full);
    localStorage.setItem(PAYMENTS_KEY, JSON.stringify(payments.slice(0, 500)));
  } catch {
    // Silently fail
  }
  return full;
}

export function getPayments(clientName?: string): PaymentRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PAYMENTS_KEY);
    const payments: PaymentRecord[] = raw ? JSON.parse(raw) : [];
    if (clientName) return payments.filter((p) => p.clientName === clientName);
    return payments;
  } catch {
    return [];
  }
}

export function markAsPaid(paymentId: string, paidDate: number): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(PAYMENTS_KEY);
    const payments: PaymentRecord[] = raw ? JSON.parse(raw) : [];
    const updated = payments.map((p) =>
      p.id === paymentId ? { ...p, status: 'paid' as const, paidDate } : p
    );
    localStorage.setItem(PAYMENTS_KEY, JSON.stringify(updated));
  } catch {
    // Silently fail
  }
}

export function recordReminder(paymentId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(PAYMENTS_KEY);
    const payments: PaymentRecord[] = raw ? JSON.parse(raw) : [];
    const updated = payments.map((p) =>
      p.id === paymentId
        ? { ...p, remindersSent: p.remindersSent + 1, lastReminderDate: Date.now() }
        : p
    );
    localStorage.setItem(PAYMENTS_KEY, JSON.stringify(updated));
  } catch {
    // Silently fail
  }
}

// ─── Aggregation ───────────────────────

export function getOverduePayments(): PaymentRecord[] {
  const payments = getPayments();
  return payments.filter((p) => {
    if (p.status === 'paid' || p.status === 'disputed') return false;
    const breakdown = calculateLateFee(p.amount, p.dueDate, Date.now());
    return breakdown.daysOverdue > 0;
  });
}

export function getPaymentStats(): {
  totalOutstanding: number;
  totalOverdue: number;
  totalLateFees: number;
  overdueCount: number;
  avgDaysOverdue: number;
  totalCollected: number;
} {
  const payments = getPayments();
  const now = Date.now();
  let totalOutstanding = 0;
  let totalOverdue = 0;
  let totalLateFees = 0;
  let overdueCount = 0;
  let totalDaysOverdue = 0;
  let totalCollected = 0;

  for (const p of payments) {
    const breakdown = calculateLateFee(p.amount, p.dueDate, now);
    if (p.status === 'paid') {
      totalCollected += p.amount;
    } else {
      totalOutstanding += p.amount;
      totalLateFees += breakdown.lateFee;
      if (breakdown.daysOverdue > 0) {
        totalOverdue += p.amount + breakdown.lateFee;
        overdueCount++;
        totalDaysOverdue += breakdown.daysOverdue;
      }
    }
  }

  return {
    totalOutstanding: Math.round(totalOutstanding * 100) / 100,
    totalOverdue: Math.round(totalOverdue * 100) / 100,
    totalLateFees: Math.round(totalLateFees * 100) / 100,
    overdueCount,
    avgDaysOverdue: overdueCount > 0 ? Math.round(totalDaysOverdue / overdueCount) : 0,
    totalCollected: Math.round(totalCollected * 100) / 100,
  };
}
