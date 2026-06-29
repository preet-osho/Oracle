'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { TOAST_DEFAULTS } from '@/lib/toast-config';
import { projectsApi, invoicesApi } from '@/lib/api';
import { loadQualityScores } from '@/lib/quality';

// ─── Types ─────────────────────────────

interface Notification {
  id: string;
  type: 'deadline' | 'invoice' | 'quality' | 'client' | 'system';
  title: string;
  message: string;
  clientName?: string;
  timestamp: number;
  read: boolean;
  dismissible: boolean;
}

// ─── Notification Type Config ──────────

const NOTIFICATION_CONFIG: Record<string, { icon: string; color: string }> = {
  deadline: { icon: '⏰', color: 'var(--oracle-warning)' },
  invoice: { icon: '📄', color: 'var(--oracle-error)' },
  quality: { icon: '📊', color: 'var(--oracle-primary-l)' },
  client: { icon: '👤', color: 'var(--oracle-info)' },
  system: { icon: '⚡', color: 'var(--oracle-success)' },
};

// ─── Generate Notifications (async, from API) ──

async function generateNotifications(): Promise<Notification[]> {
  const notifications: Notification[] = [];
  const now = Date.now();


  // 1. Project deadline notifications (from API)
  try {
    const projects = await projectsApi.list();
    for (const p of projects) {
      if (p.deadline && p.status !== 'Complete') {
        const deadline = new Date(p.deadline).getTime();
        const daysUntil = Math.ceil((deadline - now) / (24 * 60 * 60 * 1000));

        if (daysUntil < 0) {
          notifications.push({
            id: `deadline-${p.id}`,
            type: 'deadline',
            title: `Project overdue: ${p.client_name}`,
            message: `This project was due ${Math.abs(daysUntil)} days ago`,
            clientName: p.client_name,
            timestamp: now,
            read: false,
            dismissible: true,
          });
        } else if (daysUntil <= 3) {
          notifications.push({
            id: `deadline-${p.id}`,
            type: 'deadline',
            title: `Project due in ${daysUntil} days`,
            message: `${p.client_name} — ${p.service}`,
            clientName: p.client_name,
            timestamp: now,
            read: false,
            dismissible: true,
          });
        }
      }
    }   } catch {
    toast('⚠️ Failed to load project notifications', TOAST_DEFAULTS);
  }

  // 2. Invoice overdue notifications (from API)
  try {
    const invoices = await invoicesApi.list();
    for (const inv of invoices) {
      if (inv.status === 'Sent' || inv.status === 'Overdue') {
        const dueAt = inv.due_at;
        const overdueDays = Math.floor((now - dueAt) / (24 * 60 * 60 * 1000));
        if (overdueDays >= 7) {
          notifications.push({
            id: `invoice-${inv.id}`,
            type: 'invoice',
            title: `Invoice overdue — follow up`,
            message: `${inv.client_name} — ₹${inv.total.toLocaleString('en-IN')} overdue by ${overdueDays} days`,
            clientName: inv.client_name,
            timestamp: now,
            read: false,
            dismissible: true,
          });
        }
      }
    }   } catch {
    toast('⚠️ Failed to load invoice notifications', TOAST_DEFAULTS);
  }

  // 3. Low quality score notifications (from localStorage — already wired)
  try {
    const scores = loadQualityScores();
    const recentLow = scores
      .filter((s) => s.total < 50 && now - s.scoredAt < 24 * 60 * 60 * 1000)
      .slice(0, 3);
    for (const s of recentLow) {
      notifications.push({
        id: `quality-${s.scoredAt}`,
        type: 'quality',
        title: `Low quality response — consider retry`,
        message: `Scored ${s.total}/100 at ${new Date(s.scoredAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`,
        timestamp: s.scoredAt,
        read: false,
        dismissible: true,
      });
    }   } catch {
    toast('⚠️ Failed to load notification data', TOAST_DEFAULTS);
  }

  // 4. Welcome system notification if nothing else
  if (notifications.length === 0) {
    notifications.push({
      id: 'welcome',
      type: 'system',
      title: 'ORACLE is ready',
      message: 'All systems operational. Add API keys in Config to start using AI features.',
      timestamp: Date.now(),
      read: false,
      dismissible: false,
    });
  }

  return notifications;
}

// ─── NotificationPanel Component ───────

export function NotificationPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(true);
      generateNotifications()
        .then((n) => {
           
          setNotifications(n);
        })
        .catch(() => {
           
          setNotifications([]);
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const filtered = useMemo(() => {
    let result = notifications;
    if (filter === 'unread') result = result.filter((n) => !n.read);
    if (categoryFilter !== 'all') result = result.filter((n) => n.type === categoryFilter);
    return result;
  }, [notifications, filter, categoryFilter]);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50"
        onClick={onClose}
      >
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />

        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="fixed right-4 top-16 z-50 w-[360px] max-h-[70vh] overflow-hidden rounded-2xl border border-[var(--oracle-border)] bg-[var(--oracle-bg)] shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div className="flex items-center justify-between border-b border-[var(--oracle-border)] px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">🔔</span>
              <h3 className="text-[14px] font-bold text-[var(--oracle-text-1)]">Notifications</h3>
              {unreadCount > 0 && (
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--oracle-primary)] px-1.5 text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="rounded-lg px-2 py-1 text-[11px] text-[var(--oracle-info)] hover:bg-[var(--oracle-card-hover)] transition-colors"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={onClose}
                aria-label="Close notifications"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--oracle-text-muted)] hover:bg-[var(--oracle-card-hover)] transition-colors"
              >
                ✕
              </button>
            </div>
          </div>

          {/* ── Filter Tabs ── */}
          <div className="flex border-b border-[var(--oracle-border)] px-4">
            {(['all', 'unread'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`relative px-3 py-2 text-[12px] font-medium transition-colors ${
                  filter === f
                    ? 'text-[var(--oracle-text-1)]'
                    : 'text-[var(--oracle-text-muted)] hover:text-[var(--oracle-text-3)]'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {filter === f && (
                  <motion.span
                    layoutId="notificationTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-[var(--oracle-primary)]"
                  />
                )}
              </button>
            ))}
          </div>

          {/* ── Category Chips ── */}
          <div className="flex gap-1.5 overflow-x-auto px-4 py-2 scrollbar-none">
            {(['all', 'deadline', 'invoice', 'quality', 'client', 'system'] as const).map((cat) => {
              const config = cat !== 'all' ? NOTIFICATION_CONFIG[cat] : null;
              const count = cat === 'all'
                ? notifications.length
                : notifications.filter((n) => n.type === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium transition-all border ${
                    categoryFilter === cat
                      ? 'border-[var(--oracle-primary)]/30 bg-[var(--oracle-primary)]/10 text-[var(--oracle-primary-l)]'
                      : 'border-[var(--oracle-border)] text-[var(--oracle-text-muted)] hover:border-[var(--oracle-border-strong)]'
                  }`}
                >
                  {config?.icon && <span>{config.icon}</span>}
                  {cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                  {count > 0 && (
                    <span className="ml-0.5 text-[9px] opacity-60">{count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Notification List ── */}
          <div className="max-h-[calc(70vh-120px)] overflow-y-auto">
            {loading ? (
              <div className="py-12 text-center">
                <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-[var(--oracle-primary)] border-t-transparent" />
                <p className="mt-3 text-[12px] text-[var(--oracle-text-muted)]">Loading notifications…</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center">
                <span className="text-3xl">🔔</span>
                <p className="mt-2 text-[13px] text-[var(--oracle-text-muted)]">
                  {filter === 'unread' ? 'All caught up!' : 'No notifications'}
                </p>
              </div>
            ) : (
              <div className="p-2">
                {filtered.map((n) => {
                  const config = NOTIFICATION_CONFIG[n.type] || NOTIFICATION_CONFIG.system;
                  return (
                    <motion.div
                      key={n.id}
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      onClick={() => {
                        if (!n.read) {
                          setNotifications((prev) =>
                            prev.map((item) => item.id === n.id ? { ...item, read: true } : item)
                          );
                        }
                      }}
                      className={`flex items-start gap-3 rounded-xl p-3 transition-colors cursor-pointer ${
                        n.read ? 'opacity-60' : 'bg-[var(--oracle-card)]'
                      } hover:bg-[var(--oracle-card-hover)]`}
                    >
                      <span
                        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm"
                        style={{ backgroundColor: `${config.color}15` }}
                      >
                        {config.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-[var(--oracle-text-1)]">{n.title}</p>
                        <p className="mt-0.5 text-[11px] text-[var(--oracle-text-3)]">{n.message}</p>
                        <p className="mt-1 text-[10px] text-[var(--oracle-text-muted)]">
                          {new Date(n.timestamp).toLocaleString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      {n.dismissible && (
                        <button
                          onClick={() => dismiss(n.id)}
                          className="mt-1 shrink-0 text-[var(--oracle-text-muted)] hover:text-[var(--oracle-error)] text-[12px] transition-colors"
                        >
                          ✕
                        </button>
                      )}
                      {!n.read && (
                        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--oracle-primary)]" />
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Export unread count for Header ────

export function useNotificationCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    generateNotifications()
      .then((notifications) => setCount(notifications.filter((n) => !n.read).length))
      .catch(() => setCount(0));
  }, []);

  return count;
}
