'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { motionVariants, transitions, buttonTapProps, cardHoverProps } from '@/styles/design-tokens';
import toast from 'react-hot-toast';
import { TOAST_DEFAULTS } from '@/lib/toast-config';
import { formatINR } from '@/lib/tax-calculator';
import {calculateLateFee, getReminderTemplate} from '@/lib/late-fee-calculator';

// ─── Types ─────────────────────────────

interface PaymentFollowUp {
  id: string;
  clientName: string;
  invoiceAmount: number;
  invoiceDate: string;
  dueDate: string;
  status: 'Pending' | 'Sent' | 'Overdue' | 'Paid';
  reminderCount: number;
  lastReminderDate?: string;
  nextReminderDate?: string;
  notes: string;
  createdAt: number;
}

const STATUS_COLORS: Record<string, string> = {
  Pending: 'var(--oracle-warning)',
  Sent: 'var(--oracle-info)',
  Overdue: 'var(--oracle-error)',
  Paid: 'var(--oracle-success)',
};

const REMINDER_TEMPLATES = [
  { id: 'gentle', name: '🤝 Gentle Reminder', message: 'Hi {clientName}, this is a friendly reminder that invoice #{invoiceId} for {amount} is due on {dueDate}. Please let us know if you have any questions.' },
  { id: 'standard', name: '📧 Standard Follow-up', message: 'Hi {clientName}, we wanted to follow up on invoice #{invoiceId} for {amount}. The payment was due on {dueDate}. Please process the payment at your earliest convenience.' },
  { id: 'urgent', name: '🚨 Urgent Reminder', message: 'Hi {clientName}, invoice #{invoiceId} for {amount} was due on {dueDate} and remains unpaid. Please arrange payment immediately to avoid any disruption to services.' },
  { id: 'final', name: '⚠️ Final Notice', message: 'Hi {clientName}, this is a final notice regarding invoice #{invoiceId} for {amount}, which is now significantly overdue. Please settle the outstanding amount within 7 days.' },
];

// ─── Local Storage Helpers ─────────────

function loadFollowUps(): PaymentFollowUp[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('oracle-payment-followups');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveFollowUps(items: PaymentFollowUp[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('oracle-payment-followups', JSON.stringify(items));
}

// ─── Main Component ────────────────────

export function PaymentFollowUpManager() {
  const [followUps, setFollowUps] = useState<PaymentFollowUp[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState('standard');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- safe initialization from localStorage
    setFollowUps(loadFollowUps());
  }, []);

  useEffect(() => { saveFollowUps(followUps); }, [followUps]);

  const stats = useMemo(() => {
    const total = followUps.reduce((s, f) => s + f.invoiceAmount, 0);
    const overdue = followUps.filter((f) => f.status === 'Overdue');
    const overdueAmount = overdue.reduce((s, f) => s + f.invoiceAmount, 0);
    const pending = followUps.filter((f) => f.status === 'Pending' || f.status === 'Sent');
    const pendingAmount = pending.reduce((s, f) => s + f.invoiceAmount, 0);
    const paid = followUps.filter((f) => f.status === 'Paid');
    const paidAmount = paid.reduce((s, f) => s + f.invoiceAmount, 0);
    return { total, overdue: overdue.length, overdueAmount, pending: pending.length, pendingAmount, paid: paid.length, paidAmount };
  }, [followUps]);

  const handleAdd = useCallback((item: Omit<PaymentFollowUp, 'id' | 'createdAt' | 'reminderCount' | 'status'>) => {
    const newItem: PaymentFollowUp = {
      ...item,
      id: crypto.randomUUID(),
      status: 'Pending',
      reminderCount: 0,
      createdAt: Date.now(),
    };
    setFollowUps((prev) => [newItem, ...prev]);
    setShowAddForm(false);
    toast.success('✅ Payment follow-up created', TOAST_DEFAULTS);
  }, []);

  const handleSendReminder = useCallback((id: string) => {
    const item = followUps.find((f) => f.id === id);
    if (!item) return;

    const template = REMINDER_TEMPLATES.find((t) => t.id === selectedTemplate) || REMINDER_TEMPLATES[1];
    const message = template.message
      .replace('{clientName}', item.clientName)
      .replace('{amount}', formatINR(item.invoiceAmount))
      .replace('{dueDate}', item.dueDate)
      .replace('{invoiceId}', item.id.slice(0, 8));

    navigator.clipboard.writeText(message);
    toast.success(`📋 ${template.name} copied to clipboard`, TOAST_DEFAULTS);

    const now = new Date().toISOString().split('T')[0];
    setFollowUps((prev) => prev.map((f) => f.id === id ? {
      ...f,
      status: 'Sent' as const,
      reminderCount: f.reminderCount + 1,
      lastReminderDate: now,
      nextReminderDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    } : f));
  }, [followUps, selectedTemplate]);

  const handleMarkPaid = useCallback((id: string) => {
    setFollowUps((prev) => prev.map((f) => f.id === id ? { ...f, status: 'Paid' as const } : f));
    toast.success('✅ Marked as paid', TOAST_DEFAULTS);
  }, []);

  const handleMarkOverdue = useCallback((id: string) => {
    setFollowUps((prev) => prev.map((f) => f.id === id ? { ...f, status: 'Overdue' as const } : f));
    toast.success('⚠️ Marked as overdue', TOAST_DEFAULTS);
  }, []);

  const handleDelete = useCallback((id: string) => {
    setFollowUps((prev) => prev.filter((f) => f.id !== id));
    toast.success('🗑 Removed', TOAST_DEFAULTS);
  }, []);

  const daysUntilDue = (dueDate: string) => {
    // eslint-disable-next-line react-hooks/purity
    const diff = Math.ceil((new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return `Overdue by ${Math.abs(diff)} days`;
    if (diff === 0) return 'Due today';
    return `${diff} days remaining`;
  };

  // Calculate late fees for overdue items
  const overdueWithFees = useMemo(() => {
    return followUps
      .filter((f) => f.status === 'Overdue')
      .map((f) => {
        const dueTs = new Date(f.dueDate).getTime();
        // eslint-disable-next-line react-hooks/purity
        const breakdown = calculateLateFee(f.invoiceAmount, dueTs, Date.now());
        return { ...f, breakdown };
      });
  }, [followUps]);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Total Tracked', value: stats.total, icon: '📋', color: 'var(--oracle-text-1)' },
          { label: 'Pending', value: `${stats.pending} (${formatINR(stats.pendingAmount)})`, icon: '⏳', color: 'var(--oracle-warning)' },
          { label: 'Overdue', value: `${stats.overdue} (${formatINR(stats.overdueAmount)})`, icon: '🚨', color: 'var(--oracle-error)' },
          { label: 'Paid', value: `${stats.paid} (${formatINR(stats.paidAmount)})`, icon: '✅', color: 'var(--oracle-success)' },
        ].map((s) => (
          <div key={s.label} className="oracle-glass rounded-xl p-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">{s.icon}</span>
              <span className="text-[11px] text-[var(--oracle-text-muted)]">{s.label}</span>
            </div>
            <p className="mt-1 text-[14px] font-bold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Reminder Template Selector */}
      <div className="oracle-glass rounded-xl p-3">
        <p className="mb-2 text-[11px] font-semibold text-[var(--oracle-text-muted)]">DEFAULT REMINDER TEMPLATE</p>
        <div className="flex flex-wrap gap-2">
          {REMINDER_TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTemplate(t.id)}
              className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all ${
                selectedTemplate === t.id
                  ? 'bg-[var(--oracle-primary)]/10 text-[var(--oracle-primary-l)] border border-[var(--oracle-primary)]/30'
                  : 'text-[var(--oracle-text-muted)] border border-transparent hover:text-[var(--oracle-text-3)]'
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {/* Late Fee Calculator */}
      {overdueWithFees.length > 0 && (
        <div className="oracle-glass rounded-xl p-4">
          <p className="mb-3 text-[11px] font-semibold text-[var(--oracle-text-muted)]">⚡ LATE FEE CALCULATOR</p>
          <div className="space-y-2">
            {overdueWithFees.map((item) => {
              const { breakdown } = item;
              const escalationColor = {
                none: 'var(--oracle-text-muted)',
                gentle: 'var(--oracle-warning)',
                firm: 'var(--oracle-info)',
                final: 'var(--oracle-error)',
                legal: 'var(--oracle-error)',
              }[breakdown.escalationLevel];
              return (
                <div key={item.id} className="rounded-lg bg-[var(--oracle-surface-2)] p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-[var(--oracle-text-1)]">{item.clientName}</span>
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: `${escalationColor}20`, color: escalationColor }}>
                      {breakdown.escalationLevel.toUpperCase()}
                    </span>
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 gap-2 text-[11px]">
                    <div><span className="text-[var(--oracle-text-muted)]">Days Overdue:</span> <span className="text-[var(--oracle-text-2)]">{breakdown.daysOverdue}</span></div>
                    <div><span className="text-[var(--oracle-text-muted)]">Late Fee:</span> <span className="font-semibold text-[var(--oracle-error)]">{formatINR(breakdown.lateFee)}</span></div>
                    <div><span className="text-[var(--oracle-text-muted)]">Total Owed:</span> <span className="font-bold text-[var(--oracle-primary-l)]">{formatINR(breakdown.totalOwed)}</span></div>
                    <div><span className="text-[var(--oracle-text-muted)]">Within Grace:</span> <span className="text-[var(--oracle-text-2)]">{breakdown.withinGrace ? 'Yes' : 'No'}</span></div>
                  </div>
                  <button
                    onClick={() => {
                      const msg = getReminderTemplate(breakdown.escalationLevel, item.clientName, item.id.slice(0, 8), item.invoiceAmount, breakdown.daysOverdue, breakdown.lateFee);
                      navigator.clipboard.writeText(msg);
                      toast.success(`📋 Escalated reminder copied (${breakdown.escalationLevel})`, TOAST_DEFAULTS);
                    }}
                    className="mt-2 rounded-lg bg-[var(--oracle-primary)]/10 px-3 py-1 text-[11px] font-medium text-[var(--oracle-primary-l)] hover:bg-[var(--oracle-primary)]/20"
                  >
                    📋 Copy Escalated Reminder
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Button */}
      <div className="flex justify-end">
        <motion.button {...buttonTapProps} onClick={() => setShowAddForm(true)} className="rounded-xl oracle-gradient-bg px-4 py-2 text-[13px] font-semibold text-white transition-all">
          + Add Payment Follow-up
        </motion.button>
      </div>

      {/* Follow-up Cards */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {followUps.map((item) => (
            <motion.div key={item.id} layout variants={motionVariants.fadeUp} initial="initial" animate="animate" exit="exit" transition={transitions.smooth} {...cardHoverProps}>
              <div className={`oracle-glass rounded-xl p-4 transition-all ${expandedId === item.id ? 'ring-1 ring-[var(--oracle-primary)]/30' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 cursor-pointer" onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-[14px] font-bold text-[var(--oracle-text-1)]">{item.clientName}</h4>
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: `${STATUS_COLORS[item.status]}20`, color: STATUS_COLORS[item.status] }}>{item.status}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-[12px] text-[var(--oracle-text-3)]">
                      <span className="font-semibold">{formatINR(item.invoiceAmount)}</span>
                      <span>Due: {item.dueDate}</span>
                      <span className={item.status === 'Overdue' ? 'text-[var(--oracle-error)] font-semibold' : ''}>{daysUntilDue(item.dueDate)}</span>
                    </div>
                    <div className="mt-1 text-[11px] text-[var(--oracle-text-muted)]">
                      {item.reminderCount > 0 ? `${item.reminderCount} reminder(s) sent` : 'No reminders sent'}
                      {item.lastReminderDate && ` · Last: ${item.lastReminderDate}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {item.status !== 'Paid' && (
                      <>
                        <motion.button {...buttonTapProps} onClick={() => handleSendReminder(item.id)} className="rounded-lg bg-[var(--oracle-primary)]/10 px-2.5 py-1.5 text-[11px] font-semibold text-[var(--oracle-primary-l)] hover:bg-[var(--oracle-primary)]/20" title="Send Reminder">📧 Send</motion.button>
                        <motion.button {...buttonTapProps} onClick={() => handleMarkPaid(item.id)} className="rounded-lg px-2 py-1.5 text-[11px] text-[var(--oracle-success)] hover:bg-[var(--oracle-success)]/10" title="Mark Paid">✅</motion.button>
                        {item.status !== 'Overdue' && (
                          <motion.button {...buttonTapProps} onClick={() => handleMarkOverdue(item.id)} className="rounded-lg px-2 py-1.5 text-[11px] text-[var(--oracle-error)] hover:bg-[var(--oracle-error)]/10" title="Mark Overdue">🚨</motion.button>
                        )}
                      </>
                    )}
                    <motion.button {...buttonTapProps} onClick={() => handleDelete(item.id)} className="rounded-lg px-2 py-1.5 text-[11px] text-[var(--oracle-text-muted)] hover:text-[var(--oracle-error)]" title="Delete">🗑</motion.button>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedId === item.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={transitions.smooth} className="overflow-hidden">
                      <div className="mt-3 space-y-2 border-t border-[var(--oracle-border)] pt-3">
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div><span className="text-[var(--oracle-text-muted)]">Invoice Date:</span> <span className="text-[var(--oracle-text-2)]">{item.invoiceDate}</span></div>
                          <div><span className="text-[var(--oracle-text-muted)]">Due Date:</span> <span className="text-[var(--oracle-text-2)]">{item.dueDate}</span></div>
                        </div>
                        {item.notes && (
                          <div className="rounded-lg bg-[var(--oracle-surface-2)] p-2 text-[11px] text-[var(--oracle-text-2)]">{item.notes}</div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {followUps.length === 0 && (
        <div className="py-8 text-center text-[var(--oracle-text-muted)]">
          <p className="text-[32px]">💳</p>
          <p className="mt-2 text-[13px]">No payment follow-ups yet. Track invoices and send automated reminders.</p>
        </div>
      )}

      {/* Add Form */}
      <AnimatePresence>
        {showAddForm && (
          <AddFollowUpForm onSave={handleAdd} onClose={() => setShowAddForm(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Add Follow-up Form ────────────────

function AddFollowUpForm({ onSave, onClose }: { onSave: (item: Omit<PaymentFollowUp, 'id' | 'createdAt' | 'reminderCount' | 'status'>) => void; onClose: () => void }) {
  const [clientName, setClientName] = useState('');
  const [amount, setAmount] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().split('T')[0]; });
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const handleSave = () => {
    if (!clientName.trim()) { setError('Client name is required.'); return; }
    if (!amount || parseFloat(amount) <= 0) { setError('Amount must be greater than 0.'); return; }
    onSave({
      clientName: clientName.trim(),
      invoiceAmount: parseFloat(amount),
      invoiceDate,
      dueDate,
      notes: notes.trim(),
    });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="oracle-glass oracle-card-shadow w-full max-w-md rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-[17px] font-bold text-[var(--oracle-text-1)]">💳 Add Payment Follow-up</h3>
        {error && <p className="mb-3 rounded-lg bg-[var(--oracle-error)]/10 px-3 py-2 text-[12px] text-[var(--oracle-error)]">{error}</p>}
        <div className="space-y-3">
          <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client Name *" className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[13px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)]" />
          <div><label className="mb-1 block text-[11px] text-[var(--oracle-text-muted)]">Invoice Amount (₹)</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2 text-[13px] text-[var(--oracle-text-1)] outline-none" /></div>
          <div className="flex gap-3">
            <div className="flex-1"><label className="mb-1 block text-[11px] text-[var(--oracle-text-muted)]">Invoice Date</label><input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2 text-[13px] text-[var(--oracle-text-2)] outline-none" /></div>
            <div className="flex-1"><label className="mb-1 block text-[11px] text-[var(--oracle-text-muted)]">Due Date</label><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2 text-[13px] text-[var(--oracle-text-2)] outline-none" /></div>
          </div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)..." rows={2} className="w-full resize-none rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[12px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none" />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <motion.button {...buttonTapProps} onClick={onClose} className="rounded-lg px-4 py-2 text-[13px] text-[var(--oracle-text-3)] hover:bg-[var(--oracle-card-hover)]">Cancel</motion.button>
          <motion.button {...buttonTapProps} onClick={handleSave} className="rounded-lg oracle-gradient-bg px-4 py-2 text-[13px] font-semibold text-white">Add Follow-up</motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
