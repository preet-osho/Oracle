'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { motionVariants, transitions, cardHoverProps, buttonTapProps } from '@/styles/design-tokens';
import type { RevenueStream } from '@/types';
import { DEFAULT_REVENUE_TEMPLATES } from '@/data/revenue-templates';
import { generateAnnualReport, formatAnnualReportAsText, type AnnualReport } from '@/lib/annual-revenue-report';
import { loadExpenses, seedExpensesIfEmpty } from '@/lib/expense-tracker';
import { DEFAULT_EXPENSE_TEMPLATES } from '@/data/expense-templates';
import { fetchWithTimeout, TIMEOUT_QUICK_MS } from '@/lib/fetch-utils';

// ─── API Helpers ─────────────────────

/** Convert snake_case API row → camelCase RevenueStream */
function rowToStream(row: Record<string, unknown>): RevenueStream {
  return {
    id: row.id as string,
    name: row.name as string,
    type: row.type as RevenueStream['type'],
    description: row.description as string,
    monthlyProjection: row.monthly_projection as number,
    annualProjection: row.annual_projection as number,
    status: row.status as RevenueStream['status'],
    margin: row.margin as number,
    effort: row.effort as RevenueStream['effort'],
    timeline: row.timeline as string,
    tools: row.tools as string[],
    notes: row.notes as string,
    createdAt: row.created_at as number,
  };
}

const STATUS_COLORS: Record<string, string> = {
  Planning: 'var(--oracle-warning)',
  Building: 'var(--oracle-info)',
  Active: 'var(--oracle-success)',
  Paused: 'var(--oracle-text-muted)',
};

const TYPE_COLORS: Record<string, string> = {
  Service: '#3b82f6',
  Product: '#10b981',
  Retainer: '#8b5cf6',
  Affiliate: '#f59e0b',
  SaaS: '#ec4899',
};

// ─── BusinessTab Component ────────────

export function BusinessTab({ onAskOracle }: { onAskOracle?: (prompt: string) => void }) {
  const [activeView, setActiveView] = useState<'streams' | 'projections' | 'forecast' | 'micro-saas' | 'annual-report'>('streams');
  const [streams, setStreams] = useState<RevenueStream[]>(() =>
    DEFAULT_REVENUE_TEMPLATES.map((t) => ({ ...t, id: `template-${t.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, createdAt: Date.now() }))
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddStream, setShowAddStream] = useState(false);

  // Seed default templates on first load, then fetch streams
  useEffect(() => {
    let cancelled = false;
    async function loadStreams() {
      try {
        // Try seed endpoint first — inserts defaults if user has none
        const seedRes = await fetchWithTimeout('/api/revenue-streams/seed', { method: 'POST', timeoutMs: TIMEOUT_QUICK_MS });
        if (seedRes.ok) {
          const { streams } = await seedRes.json();
          if (!cancelled && Array.isArray(streams) && streams.length > 0) {
            setStreams(streams.map(rowToStream));
            return;
          }
        }
        // Fallback to regular fetch if seed fails
        const fetchRes = await fetchWithTimeout('/api/revenue-streams', { timeoutMs: TIMEOUT_QUICK_MS });
        if (!cancelled && fetchRes.ok) {
          const rows = await fetchRes.json();
          if (Array.isArray(rows) && rows.length > 0) {
            setStreams(rows.map(rowToStream));
          }
        }
      } catch {
        // Keep template data as fallback
      }
    }
    loadStreams();
    return () => { cancelled = true; };
  }, []);

  const stats = useMemo(() => {
    const active = streams.filter((s) => s.status === 'Active');
    const totalMonthly = active.reduce((s, stream) => s + stream.monthlyProjection, 0);
    const totalAnnual = active.reduce((s, stream) => s + stream.annualProjection, 0);
    const avgMargin = active.length > 0 ? Math.round(active.reduce((s, stream) => s + stream.margin, 0) / active.length) : 0;
    return { activeCount: active.length, totalMonthly, totalAnnual, avgMargin };
  }, [streams]);

  const updateStreamStatus = useCallback(async (id: string, status: RevenueStream['status']) => {
    setStreams((prev) => prev.map((s) => s.id === id ? { ...s, status } : s));
    try {
      await fetchWithTimeout(`/api/revenue-streams/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
        timeoutMs: TIMEOUT_QUICK_MS,
      });
    } catch { /* optimistic update already applied */ }
  }, []);

  const deleteStream = useCallback(async (id: string) => {
    setStreams((prev) => prev.filter((s) => s.id !== id));
    try {
      await fetchWithTimeout(`/api/revenue-streams/${id}`, { method: 'DELETE', timeoutMs: TIMEOUT_QUICK_MS });
    } catch { /* optimistic update already applied */ }
  }, []);

  const formatINR = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-6xl">
          {/* Header */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-[22px] font-bold text-[var(--oracle-text-1)]">💼 Business Operations</h1>
              <p className="mt-1 text-[13px] text-[var(--oracle-text-3)]">Revenue streams, financial projections, and micro-SaaS research</p>
            </div>
            <motion.button {...buttonTapProps} onClick={() => setShowAddStream(true)} className="rounded-xl oracle-gradient-bg px-4 py-2 text-[13px] font-semibold text-white transition-all">
              + Add Stream
            </motion.button>
          </motion.div>

          {/* View Tabs */}
          <div className="mb-4 flex gap-2">
            {[
              { id: 'streams' as const, label: '💰 Revenue Streams' },
              { id: 'projections' as const, label: '📈 Financial Projections' },
              { id: 'forecast' as const, label: '🔮 12-Month Forecast' },
              { id: 'micro-saas' as const, label: '☁️ Micro-SaaS Research' },
              { id: 'annual-report' as const, label: '📊 Annual Report' },
            ].map((tab) => (
              <motion.button
                key={tab.id}
                {...buttonTapProps}
                onClick={() => setActiveView(tab.id)}
                className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all ${
                  activeView === tab.id
                    ? 'bg-[var(--oracle-primary)]/10 text-[var(--oracle-primary-l)] border border-[var(--oracle-primary)]/30'
                    : 'text-[var(--oracle-text-muted)] border border-transparent hover:text-[var(--oracle-text-3)]'
                }`}
              >
                {tab.label}
              </motion.button>
            ))}
          </div>

          {/* Stats Row */}
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: 'Active Streams', value: stats.activeCount, icon: '🟢', color: 'var(--oracle-success)' },
              { label: 'Monthly Revenue', value: formatINR(stats.totalMonthly), icon: '💰', color: 'var(--oracle-primary-l)' },
              { label: 'Annual Projection', value: formatINR(stats.totalAnnual), icon: '📈', color: 'var(--oracle-info)' },
              { label: 'Avg Margin', value: `${stats.avgMargin}%`, icon: '📊', color: 'var(--oracle-warning)' },
            ].map((s) => (
              <div key={s.label} className="oracle-glass rounded-xl p-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{s.icon}</span>
                  <span className="text-[11px] text-[var(--oracle-text-muted)]">{s.label}</span>
                </div>
                <p className="mt-1 text-[18px] font-bold" style={{ color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Content */}
          {activeView === 'streams' && (
            <RevenueStreamsView
              streams={streams}
              expandedId={expandedId}
              onToggleExpand={(id) => setExpandedId(expandedId === id ? null : id)}
              onUpdateStatus={updateStreamStatus}
              onDelete={deleteStream}
              onAskOracle={onAskOracle}
            />
          )}

          {activeView === 'projections' && (
            <ProjectionsView streams={streams} />
          )}

          {activeView === 'forecast' && (
            <RevenueForecastView streams={streams} />
          )}

          {activeView === 'micro-saas' && (
            <MicroSaaSView onAskOracle={onAskOracle} />
          )}

          {activeView === 'annual-report' && (
            <AnnualReportView streams={streams} />
          )}

          {/* Add Stream Modal */}
          <AnimatePresence>
            {showAddStream && (
              <AddStreamModal
                onClose={() => setShowAddStream(false)}
                onSave={async (stream) => {
                  const newStream: RevenueStream = { ...stream, id: crypto.randomUUID(), createdAt: Date.now() };
                  setStreams((prev) => [newStream, ...prev]);
                  setShowAddStream(false);
                  try {
                    const res = await fetchWithTimeout('/api/revenue-streams', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        name: stream.name, type: stream.type, description: stream.description,
                        monthlyProjection: stream.monthlyProjection,
                        annualProjection: stream.annualProjection,
                        status: stream.status, margin: stream.margin, effort: stream.effort,
                        timeline: stream.timeline, tools: stream.tools, notes: stream.notes,
                      }),
                      timeoutMs: TIMEOUT_QUICK_MS,
                    });
                    if (res.ok) {
                      const saved = await res.json();
                      setStreams((prev) => prev.map((s) => s.id === newStream.id ? rowToStream(saved) : s));
                    }
                  } catch { /* optimistic update already applied */ }
                }}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ─── Revenue Streams View ─────────────

function RevenueStreamsView({
  streams, expandedId, onToggleExpand, onUpdateStatus, onDelete, onAskOracle,
}: {
  streams: RevenueStream[];
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
  onUpdateStatus: (id: string, status: RevenueStream['status']) => void;
  onDelete: (id: string) => void;
  onAskOracle?: (prompt: string) => void;
}) {
  const formatINR = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  return (
    <div className="space-y-3">
      {streams.map((stream) => (
        <motion.div key={stream.id} variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} {...cardHoverProps}>
          <div className={`oracle-glass rounded-2xl p-4 transition-all ${expandedId === stream.id ? 'ring-1 ring-[var(--oracle-primary)]/30' : 'hover:border-[var(--oracle-border-strong)]'}`}>
            <div className="flex items-start justify-between">
              <div className="flex-1 cursor-pointer" onClick={() => onToggleExpand(stream.id)}>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[15px] font-bold text-[var(--oracle-text-1)]">{stream.name}</h3>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: `${STATUS_COLORS[stream.status]}20`, color: STATUS_COLORS[stream.status] }}>
                    {stream.status}
                  </span>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: `${TYPE_COLORS[stream.type]}20`, color: TYPE_COLORS[stream.type] }}>
                    {stream.type}
                  </span>
                </div>
                <p className="mt-1 text-[12px] text-[var(--oracle-text-3)]">{stream.description}</p>
              </div>
              <div className="text-right">
                <p className="text-[16px] font-bold text-[var(--oracle-primary-l)]">{formatINR(stream.monthlyProjection)}</p>
                <p className="text-[10px] text-[var(--oracle-text-muted)]">/month</p>
                <p className="text-[11px] text-[var(--oracle-text-muted)]">{stream.margin}% margin</p>
              </div>
            </div>

            {/* Expanded Details */}
            <AnimatePresence>
              {expandedId === stream.id && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={transitions.smooth} className="overflow-hidden">
                  <div className="mt-4 space-y-3 border-t border-[var(--oracle-border)] pt-4">
                    <div className="grid grid-cols-2 gap-3 text-[12px]">
                      <div><span className="text-[var(--oracle-text-muted)]">Annual:</span> <span className="text-[var(--oracle-text-2)] font-semibold">{formatINR(stream.annualProjection)}</span></div>
                      <div><span className="text-[var(--oracle-text-muted)]">Effort:</span> <span className="text-[var(--oracle-text-2)]">{stream.effort}</span></div>
                      <div><span className="text-[var(--oracle-text-muted)]">Timeline:</span> <span className="text-[var(--oracle-text-2)]">{stream.timeline}</span></div>
                      <div><span className="text-[var(--oracle-text-muted)]">Tools:</span> <span className="text-[var(--oracle-text-2)]">{stream.tools.join(', ')}</span></div>
                    </div>
                    {stream.notes && (
                      <div className="rounded-xl bg-[var(--oracle-surface-2)] p-3">
                        <h4 className="mb-1 text-[11px] font-semibold text-[var(--oracle-text-muted)]">Notes</h4>
                        <p className="text-[12px] text-[var(--oracle-text-2)]">{stream.notes}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-[var(--oracle-text-muted)]">Status:</span>
                      {(['Planning', 'Building', 'Active', 'Paused'] as const).map((s) => (
                        <button key={s} onClick={() => onUpdateStatus(stream.id, s)} className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-all ${stream.status === s ? 'ring-1' : 'hover:opacity-80'}`} style={{ backgroundColor: `${STATUS_COLORS[s]}20`, color: STATUS_COLORS[s] }}>
                          {s}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <motion.button {...buttonTapProps} onClick={() => onAskOracle?.(`Analyze revenue stream: ${stream.name}. Suggest ways to increase revenue and reduce effort. What tools can automate this further?`)} className="rounded-lg oracle-gradient-bg px-3 py-1.5 text-[11px] font-semibold text-white">⚡ Ask Oracle</motion.button>
                      <motion.button {...buttonTapProps} onClick={() => onDelete(stream.id)} className="rounded-lg border border-[var(--oracle-error)]/30 px-3 py-1.5 text-[11px] text-[var(--oracle-error)] hover:bg-[var(--oracle-error)]/10 transition-colors">🗑 Remove</motion.button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Projections View ─────────────────

function ProjectionsView({ streams }: { streams: RevenueStream[] }) {
  const activeStreams = streams.filter((s) => s.status === 'Active');
  const planningStreams = streams.filter((s) => s.status === 'Planning');
  const formatINR = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  const totalActiveMonthly = activeStreams.reduce((s, stream) => s + stream.monthlyProjection, 0);
  const totalPlanningMonthly = planningStreams.reduce((s, stream) => s + stream.monthlyProjection, 0);

  return (
    <div className="space-y-6">
      {/* Monthly Breakdown */}
      <div className="oracle-glass rounded-2xl p-5">
        <h3 className="mb-4 text-[15px] font-bold text-[var(--oracle-text-1)]">💰 Revenue by Stream</h3>
        <div className="space-y-3">
          {activeStreams.map((stream) => (
            <div key={stream.id} className="flex items-center gap-3">
              <span className="w-32 truncate text-[12px] text-[var(--oracle-text-2)]">{stream.name}</span>                <div className="flex-1 h-3 rounded-full bg-[var(--oracle-surface-2)] overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.min((stream.monthlyProjection / Math.max(totalActiveMonthly, 1)) * 100, 100)}%`, backgroundColor: TYPE_COLORS[stream.type] || '#6366f1' }} />
              </div>
              <span className="w-20 text-right text-[12px] font-mono text-[var(--oracle-text-muted)]">{formatINR(stream.monthlyProjection)}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 border-t border-[var(--oracle-border)] pt-3 flex justify-between">
          <span className="text-[13px] font-semibold text-[var(--oracle-text-1)]">Total Active Monthly</span>
          <span className="text-[13px] font-bold text-[var(--oracle-primary-l)]">{formatINR(totalActiveMonthly)}</span>
        </div>
      </div>

      {/* Growth Scenarios */}
      <div className="oracle-glass rounded-2xl p-5">
        <h3 className="mb-4 text-[15px] font-bold text-[var(--oracle-text-1)]">📈 Growth Scenarios</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {[
            { label: 'Conservative', months: '6 months', active: totalActiveMonthly, planning: Math.round(totalPlanningMonthly * 0.3), icon: '📊' },
            { label: 'Moderate', months: '12 months', active: totalActiveMonthly, planning: Math.round(totalPlanningMonthly * 0.6), icon: '📈' },
            { label: 'Aggressive', months: '18 months', active: totalActiveMonthly, planning: totalPlanningMonthly, icon: '🚀' },
          ].map((scenario) => (
            <div key={scenario.label} className="rounded-xl bg-[var(--oracle-surface-2)] p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{scenario.icon}</span>
                <span className="text-[13px] font-semibold text-[var(--oracle-text-1)]">{scenario.label}</span>
              </div>
              <p className="text-[10px] text-[var(--oracle-text-muted)] mb-2">{scenario.months}</p>
              <p className="text-[18px] font-bold text-[var(--oracle-primary-l)]">{formatINR(scenario.active + scenario.planning)}</p>
              <p className="text-[10px] text-[var(--oracle-text-muted)]">/month projected</p>
              <div className="mt-2 space-y-1 text-[11px]">
                <div className="flex justify-between"><span className="text-[var(--oracle-text-muted)]">Active streams:</span><span className="text-[var(--oracle-text-2)]">{formatINR(scenario.active)}</span></div>
                <div className="flex justify-between"><span className="text-[var(--oracle-text-muted)]">New streams:</span><span className="text-[var(--oracle-text-2)]">{formatINR(scenario.planning)}</span></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Priority */}
      <div className="oracle-glass rounded-2xl p-5">
        <h3 className="mb-3 text-[15px] font-bold text-[var(--oracle-text-1)]">🎯 Priority: Highest Impact + Lowest Effort</h3>
        <div className="space-y-2">
          {planningStreams
            .sort((a, b) => (b.monthlyProjection / (b.effort === 'Low' ? 1 : b.effort === 'Medium' ? 2 : 3)) - (a.monthlyProjection / (a.effort === 'Low' ? 1 : a.effort === 'Medium' ? 2 : 3)))
            .slice(0, 3)
            .map((stream, i) => (
              <div key={stream.id} className="flex items-center gap-3 rounded-xl bg-[var(--oracle-surface-2)] p-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full oracle-gradient-bg text-[10px] font-bold text-white">{i + 1}</span>
                <div className="flex-1">
                  <span className="text-[12px] font-semibold text-[var(--oracle-text-1)]">{stream.name}</span>
                  <span className="ml-2 text-[10px] text-[var(--oracle-text-muted)]">{stream.effort} effort</span>
                </div>
                <span className="text-[12px] font-bold text-[var(--oracle-primary-l)]">{formatINR(stream.monthlyProjection)}/mo</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

// ─── Micro-SaaS View ─────────────────

function MicroSaaSView({ onAskOracle }: { onAskOracle?: (prompt: string) => void }) {
  const SAAS_IDEAS = [
    { name: 'AI Proposal Generator', description: 'Input client brief → outputs professional proposal + pricing', buildComplexity: 2, monthlyPotential: 99900, willPay: 'High', freeAlt: 'Low' },
    { name: 'Local Lead Finder', description: 'Find local businesses with no website in any Indian city', buildComplexity: 3, monthlyPotential: 149850, willPay: 'High', freeAlt: 'Medium' },
    { name: 'Client Report Automator', description: 'Connect GA4/Ads → auto-generate branded PDF reports', buildComplexity: 3, monthlyPotential: 199800, willPay: 'High', freeAlt: 'Low' },
    { name: 'Agency Invoice Manager', description: 'GST-compliant invoices with payment tracking for agencies', buildComplexity: 2, monthlyPotential: 99900, willPay: 'Medium', freeAlt: 'High' },
    { name: 'WhatsApp Campaign Builder', description: 'No-code WhatsApp broadcast + chatbot builder for SMEs', buildComplexity: 4, monthlyPotential: 299700, willPay: 'High', freeAlt: 'Medium' },
    { name: 'SEO Rank Tracker', description: 'Track Google rankings for clients with automated reports', buildComplexity: 3, monthlyPotential: 149850, willPay: 'High', freeAlt: 'Medium' },
  ];

  const formatINR = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  return (
    <div className="space-y-4">
      <div className="oracle-glass rounded-2xl p-5">
        <h3 className="mb-3 text-[15px] font-bold text-[var(--oracle-text-1)]">☁️ Micro-SaaS Ideas for Indian Agencies</h3>
        <p className="mb-4 text-[12px] text-[var(--oracle-text-3)]">Evaluate each idea: Will agencies pay ₹999/month? Build complexity? Monthly recurring potential?</p>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[var(--oracle-border)]">
                <th className="px-3 py-2 text-left font-semibold text-[var(--oracle-text-1)]">Product</th>
                <th className="px-3 py-2 text-left font-semibold text-[var(--oracle-text-1)]">Build Complexity</th>
                <th className="px-3 py-2 text-left font-semibold text-[var(--oracle-text-1)]">Will Pay?</th>
                <th className="px-3 py-2 text-left font-semibold text-[var(--oracle-text-1)]">Free Alt?</th>
                <th className="px-3 py-2 text-right font-semibold text-[var(--oracle-text-1)]">MRR Potential</th>
                <th className="px-3 py-2 text-left font-semibold text-[var(--oracle-text-1)]">Action</th>
              </tr>
            </thead>
            <tbody>
              {SAAS_IDEAS.map((idea) => (
                <tr key={idea.name} className="border-b border-[var(--oracle-border)] last:border-0 hover:bg-[var(--oracle-card-hover)] transition-colors">
                  <td className="px-3 py-3">
                    <p className="font-medium text-[var(--oracle-text-1)]">{idea.name}</p>
                    <p className="text-[10px] text-[var(--oracle-text-muted)]">{idea.description}</p>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }, (_, i) => (
                        <div key={i} className={`h-2 w-2 rounded-full ${i < idea.buildComplexity ? 'bg-[var(--oracle-warning)]' : 'bg-[var(--oracle-surface-2)]'}`} />
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-[var(--oracle-text-2)]">{idea.willPay}</td>
                  <td className="px-3 py-3 text-[var(--oracle-text-2)]">{idea.freeAlt}</td>
                  <td className="px-3 py-3 text-right font-bold text-[var(--oracle-primary-l)]">{formatINR(idea.monthlyPotential)}</td>
                  <td className="px-3 py-3">
                    <motion.button {...buttonTapProps} onClick={() => onAskOracle?.(`Research micro-SaaS idea: ${idea.name}. Analyze the Indian market, existing competitors, pricing strategy, and build plan. Suggest the best tech stack for a solo developer.`)} className="rounded-lg oracle-gradient-bg px-3 py-1.5 text-[10px] font-semibold text-white">
                      ⚡ Research
                    </motion.button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recommended Winner */}
      <div className="oracle-glass rounded-2xl p-5">
        <h3 className="mb-3 text-[15px] font-bold text-[var(--oracle-text-1)]">🏆 Recommended: Client Report Automator</h3>
        <div className="space-y-2 text-[12px] text-[var(--oracle-text-2)]">
          <p><strong>Why:</strong> Every agency needs this. Low competition in India. High perceived value.</p>
          <p><strong>Stack:</strong> Next.js + Supabase (free) + Vercel (free) + Razorpay</p>
          <p><strong>Pricing:</strong> ₹999/month — 100 customers = ₹99,900 MRR</p>
          <p><strong>Build time:</strong> 2-4 weeks with Claude Code</p>
          <p><strong>MVP features:</strong> GA4 connection, branded PDF reports, automated email delivery</p>
        </div>
        <motion.button {...buttonTapProps} onClick={() => onAskOracle?.(`Create a detailed product plan for "Client Report Automator" — a micro-SaaS for Indian agencies. Include: MVP features, tech stack, pricing tiers, launch strategy, and 12-month revenue projection.`)} className="mt-3 rounded-lg oracle-gradient-bg px-4 py-2 text-[12px] font-semibold text-white transition-all">
          ⚡ Generate Full Plan
        </motion.button>
      </div>
    </div>
  );
}

// ─── Revenue Forecast View ──────────────

function RevenueForecastView({ streams }: { streams: RevenueStream[] }) {
  const activeStreams = streams.filter((s) => s.status === 'Active' || s.status === 'Building');
  const planningStreams = streams.filter((s) => s.status === 'Planning');
  const formatINR = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();
  const currentMonth = now.getMonth();

  // Calculate 12-month forecast
  const forecast = months.map((month, i) => {
    const monthIndex = (currentMonth + i) % 12;
    const rampUp = Math.min((i + 1) / 3, 1); // 3-month ramp for new streams
    const activeRevenue = activeStreams.reduce((s, stream) => {
      const growth = 1 + (stream.effort === 'Low' ? 0.02 : stream.effort === 'Medium' ? 0.035 : 0.05) * i;
      return s + Math.round(stream.monthlyProjection * growth);
    }, 0);
    const planningRevenue = Math.round(planningStreams.reduce((s, stream) => s + stream.monthlyProjection, 0) * rampUp * 0.6);
    const totalRevenue = activeRevenue + planningRevenue;
    const totalCost = Math.round(totalRevenue * 0.35); // 35% cost estimate
    const profit = totalRevenue - totalCost;
    return { month: months[monthIndex], activeRevenue, planningRevenue, totalRevenue, totalCost, profit };
  });

  const maxRevenue = Math.max(...forecast.map((f) => f.totalRevenue), 1);
  const totalYearRevenue = forecast.reduce((s, f) => s + f.totalRevenue, 0);
  const totalYearProfit = forecast.reduce((s, f) => s + f.profit, 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: '12-Month Revenue', value: formatINR(totalYearRevenue), icon: '💰', color: 'var(--oracle-primary-l)' },
          { label: '12-Month Profit', value: formatINR(totalYearProfit), icon: '📈', color: 'var(--oracle-success)' },
          { label: 'Avg Monthly', value: formatINR(Math.round(totalYearRevenue / 12)), icon: '📊', color: 'var(--oracle-info)' },
          { label: 'Growth Rate', value: `${forecast.length > 1 ? Math.round(((forecast[11].totalRevenue - forecast[0].totalRevenue) / Math.max(forecast[0].totalRevenue, 1)) * 100) : 0}%`, icon: '🚀', color: 'var(--oracle-warning)' },
        ].map((s) => (
          <div key={s.label} className="oracle-glass rounded-xl p-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">{s.icon}</span>
              <span className="text-[11px] text-[var(--oracle-text-muted)]">{s.label}</span>
            </div>
            <p className="mt-1 text-[16px] font-bold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Revenue Chart (CSS bars) */}
      <div className="oracle-glass rounded-2xl p-5">
        <h3 className="mb-4 text-[15px] font-bold text-[var(--oracle-text-1)]">🔮 12-Month Revenue Forecast</h3>
        <div className="flex items-end gap-1.5 h-48">
          {forecast.map((f, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[9px] font-mono text-[var(--oracle-text-muted)] truncate w-full text-center" title={formatINR(f.totalRevenue)}>
                {formatINR(f.totalRevenue).slice(0, 8)}
              </span>
              <div className="w-full flex flex-col gap-0.5" style={{ height: `${(f.totalRevenue / maxRevenue) * 120}px` }}>
                <div className="w-full rounded-t-sm" style={{ flex: f.activeRevenue, backgroundColor: 'var(--oracle-primary)' }} />
                <div className="w-full rounded-b-sm" style={{ flex: Math.max(f.planningRevenue, 1), backgroundColor: 'var(--oracle-info)', opacity: 0.6 }} />
              </div>
              <span className="text-[10px] text-[var(--oracle-text-muted)]">{f.month}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-4 text-[11px] text-[var(--oracle-text-muted)]">
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-[var(--oracle-primary)]" /> Active Revenue</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-[var(--oracle-info)] opacity-60" /> Planning Revenue</span>
        </div>
      </div>

      {/* Monthly Breakdown Table */}
      <div className="oracle-glass rounded-2xl p-5">
        <h3 className="mb-4 text-[15px] font-bold text-[var(--oracle-text-1)]">📋 Monthly Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[var(--oracle-border)]">
                <th className="px-3 py-2 text-left font-semibold text-[var(--oracle-text-1)]">Month</th>
                <th className="px-3 py-2 text-right font-semibold text-[var(--oracle-text-1)]">Active</th>
                <th className="px-3 py-2 text-right font-semibold text-[var(--oracle-text-1)]">Planning</th>
                <th className="px-3 py-2 text-right font-semibold text-[var(--oracle-text-1)]">Total</th>
                <th className="px-3 py-2 text-right font-semibold text-[var(--oracle-text-1)]">Est. Cost</th>
                <th className="px-3 py-2 text-right font-semibold text-[var(--oracle-text-1)]">Profit</th>
              </tr>
            </thead>
            <tbody>
              {forecast.map((f, i) => (
                <tr key={i} className="border-b border-[var(--oracle-border)] last:border-0 hover:bg-[var(--oracle-card-hover)] transition-colors">
                  <td className="px-3 py-2 font-medium text-[var(--oracle-text-1)]">{f.month}</td>
                  <td className="px-3 py-2 text-right text-[var(--oracle-text-3)]">{formatINR(f.activeRevenue)}</td>
                  <td className="px-3 py-2 text-right text-[var(--oracle-text-3)]">{formatINR(f.planningRevenue)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-[var(--oracle-text-1)]">{formatINR(f.totalRevenue)}</td>
                  <td className="px-3 py-2 text-right text-[var(--oracle-text-muted)]">{formatINR(f.totalCost)}</td>
                  <td className="px-3 py-2 text-right font-semibold" style={{ color: f.profit >= 0 ? 'var(--oracle-success)' : 'var(--oracle-error)' }}>{formatINR(f.profit)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[var(--oracle-border)]">
                <td className="px-3 py-2 font-bold text-[var(--oracle-text-1)]">Total</td>
                <td className="px-3 py-2 text-right font-semibold text-[var(--oracle-text-1)]">{formatINR(forecast.reduce((s, f) => s + f.activeRevenue, 0))}</td>
                <td className="px-3 py-2 text-right font-semibold text-[var(--oracle-text-1)]">{formatINR(forecast.reduce((s, f) => s + f.planningRevenue, 0))}</td>
                <td className="px-3 py-2 text-right font-bold text-[var(--oracle-primary-l)]">{formatINR(totalYearRevenue)}</td>
                <td className="px-3 py-2 text-right text-[var(--oracle-text-muted)]">{formatINR(forecast.reduce((s, f) => s + f.totalCost, 0))}</td>
                <td className="px-3 py-2 text-right font-bold text-[var(--oracle-success)]">{formatINR(totalYearProfit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Key Assumptions */}
      <div className="oracle-glass rounded-2xl p-5">
        <h3 className="mb-3 text-[15px] font-bold text-[var(--oracle-text-1)]">⚙️ Forecast Assumptions</h3>
        <div className="grid grid-cols-1 gap-2 text-[12px] text-[var(--oracle-text-2)] md:grid-cols-2">
          <div className="flex items-start gap-2 rounded-xl bg-[var(--oracle-surface-2)] p-3">
            <span className="text-[var(--oracle-primary-l)]">→</span>
            <span>Active streams grow 2-5% monthly based on effort level</span>
          </div>
          <div className="flex items-start gap-2 rounded-xl bg-[var(--oracle-surface-2)] p-3">
            <span className="text-[var(--oracle-primary-l)]">→</span>
            <span>Planning streams ramp up over 3 months at 60% projection</span>
          </div>
          <div className="flex items-start gap-2 rounded-xl bg-[var(--oracle-surface-2)] p-3">
            <span className="text-[var(--oracle-primary-l)]">→</span>
            <span>Estimated operating costs at 35% of revenue</span>
          </div>
          <div className="flex items-start gap-2 rounded-xl bg-[var(--oracle-surface-2)] p-3">
            <span className="text-[var(--oracle-primary-l)]">→</span>
            <span>Growth rates: Low effort 2%, Medium 3.5%, High 5%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Add Stream Modal ─────────────────

function AddStreamModal({ onClose, onSave }: { onClose: () => void; onSave: (stream: Omit<RevenueStream, 'id' | 'createdAt'>) => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<RevenueStream['type']>('Service');
  const [description, setDescription] = useState('');
  const [monthly, setMonthly] = useState('');
  const [margin, setMargin] = useState('80');
  const [effort, setEffort] = useState<RevenueStream['effort']>('Medium');
  const [error, setError] = useState('');

  const handleSave = () => {
    if (!name.trim()) { setError('Name is required.'); return; }
    const monthlyNum = parseInt(monthly) || 0;
    onSave({
      name: name.trim(),
      type,
      description: description.trim(),
      monthlyProjection: monthlyNum,
      annualProjection: monthlyNum * 12,
      status: 'Planning',
      margin: parseInt(margin) || 80,
      effort,
      timeline: '',
      tools: [],
      notes: '',
    });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="oracle-glass oracle-card-shadow w-full max-w-lg rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-[17px] font-bold text-[var(--oracle-text-1)]">+ Add Revenue Stream</h3>
        {error && <p className="mb-3 rounded-lg bg-[var(--oracle-error)]/10 px-3 py-2 text-[12px] text-[var(--oracle-error)]">{error}</p>}
        <div className="space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Stream Name *" className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[13px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)]" />
          <div className="flex gap-3">
            <select value={type} onChange={(e) => setType(e.target.value as RevenueStream['type'])} className="flex-1 rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[12px] text-[var(--oracle-text-2)] outline-none">
              {['Service', 'Product', 'Retainer', 'Affiliate', 'SaaS'].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={effort} onChange={(e) => setEffort(e.target.value as RevenueStream['effort'])} className="rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[12px] text-[var(--oracle-text-2)] outline-none">
              {['Low', 'Medium', 'High'].map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" rows={2} className="w-full resize-none rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[12px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none" />
          <div className="flex gap-3">
            <div className="flex-1"><label className="mb-1 block text-[11px] text-[var(--oracle-text-muted)]">Monthly ₹</label><input type="number" value={monthly} onChange={(e) => setMonthly(e.target.value)} className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2 text-[13px] text-[var(--oracle-text-1)] outline-none" /></div>
            <div className="w-24"><label className="mb-1 block text-[11px] text-[var(--oracle-text-muted)]">Margin %</label><input type="number" value={margin} onChange={(e) => setMargin(e.target.value)} className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2 text-[13px] text-[var(--oracle-text-1)] outline-none" /></div>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <motion.button {...buttonTapProps} onClick={onClose} className="rounded-lg px-4 py-2 text-[13px] text-[var(--oracle-text-3)] hover:bg-[var(--oracle-card-hover)]">Cancel</motion.button>
          <motion.button {...buttonTapProps} onClick={handleSave} className="rounded-lg oracle-gradient-bg px-4 py-2 text-[13px] font-semibold text-white">Add Stream</motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Annual Revenue Report View ──────

function AnnualReportView({ streams }: { streams: RevenueStream[] }) {
  const [report, setReport] = useState<AnnualReport | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showText, setShowText] = useState(false);
  const formatINR = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  const handleGenerate = useCallback(() => {
    seedExpensesIfEmpty(DEFAULT_EXPENSE_TEMPLATES);
    const expenses = loadExpenses();

    // Build invoice data from streams — distribute evenly across months
    const invoices = streams
      .filter((s) => s.status === 'Active')
      .flatMap((s) =>
        Array.from({ length: 12 }, (_, i) => ({
          clientName: s.name,
          amount: Math.round(s.monthlyProjection),
          service: s.type,
          date: new Date(selectedYear, i, 15).getTime(),
          status: 'Paid' as const,
        }))
      );

    const report = generateAnnualReport(
      selectedYear,
      invoices,
      expenses.map((e) => ({ category: e.category, amount: e.amount, date: e.date, clientName: e.clientName })),
      streams.map((s) => ({
        name: s.name,
        createdAt: s.createdAt,
        totalRevenue: s.annualProjection,
        active: s.status === 'Active',
      }))
    );
    setReport(report);
  }, [selectedYear, streams]);

  if (!report) {
    return (
      <div className="space-y-4">
        <div className="oracle-glass rounded-2xl p-6 text-center">
          <p className="text-[32px]">📊</p>
          <h3 className="mt-2 text-[15px] font-bold text-[var(--oracle-text-1)]">Generate Annual Revenue Report</h3>
          <p className="mt-1 text-[12px] text-[var(--oracle-text-muted)]">Get a comprehensive breakdown of your yearly performance, profitability, and client metrics.</p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-2 text-[13px] text-[var(--oracle-text-1)] outline-none"
            >
              {[0, 1, 2].map((offset) => {
                const year = new Date().getFullYear() - offset;
                return <option key={year} value={year}>{year}</option>;
              })}
            </select>
            <motion.button {...buttonTapProps} onClick={handleGenerate} className="rounded-xl oracle-gradient-bg px-5 py-2 text-[13px] font-semibold text-white">
              ⚡ Generate Report
            </motion.button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Total Revenue', value: formatINR(report.revenue.totalINR), icon: '💰', color: 'var(--oracle-primary-l)' },
          { label: 'Total Expenses', value: formatINR(report.expenses.totalINR), icon: '📤', color: 'var(--oracle-warning)' },
          { label: 'Net Profit', value: formatINR(report.profitability.netProfit), icon: '📈', color: report.profitability.netProfit >= 0 ? 'var(--oracle-success)' : 'var(--oracle-error)' },
          { label: 'Gross Margin', value: `${report.profitability.grossMargin}%`, icon: '📊', color: 'var(--oracle-info)' },
        ].map((s) => (
          <div key={s.label} className="oracle-glass rounded-xl p-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">{s.icon}</span>
              <span className="text-[11px] text-[var(--oracle-text-muted)]">{s.label}</span>
            </div>
            <p className="mt-1 text-[16px] font-bold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Client Metrics */}
      <div className="oracle-glass rounded-2xl p-5">
        <h3 className="mb-3 text-[15px] font-bold text-[var(--oracle-text-1)]">👥 Client Metrics</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {[
            { label: 'Total Clients', value: report.clients.totalClients },
            { label: 'New Clients', value: report.clients.newClients },
            { label: 'Retention Rate', value: `${report.clients.retentionRate}%` },
            { label: 'Repeat Rate', value: `${report.clients.repeatRate}%` },
            { label: 'Avg Lifetime Value', value: formatINR(report.clients.averageLifetimeValue) },
            { label: 'Lost Clients', value: report.clients.lostClients },
          ].map((m) => (
            <div key={m.label} className="rounded-xl bg-[var(--oracle-surface-2)] p-3">
              <p className="text-[11px] text-[var(--oracle-text-muted)]">{m.label}</p>
              <p className="mt-1 text-[14px] font-bold text-[var(--oracle-text-1)]">{m.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Insights */}
      {report.insights.length > 0 && (
        <div className="oracle-glass rounded-2xl p-5">
          <h3 className="mb-3 text-[15px] font-bold text-[var(--oracle-text-1)]">💡 Key Insights</h3>
          <div className="space-y-2">
            {report.insights.map((insight, i) => (
              <div key={i} className="flex items-start gap-2 rounded-xl bg-[var(--oracle-surface-2)] p-3 text-[12px] text-[var(--oracle-text-2)]">
                <span className="text-[var(--oracle-primary-l)]">→</span>
                <span>{insight}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <motion.button {...buttonTapProps} onClick={() => setShowText(!showText)} className="rounded-lg border border-[var(--oracle-border)] px-4 py-2 text-[12px] font-medium text-[var(--oracle-text-3)] hover:bg-[var(--oracle-card-hover)]">
          {showText ? '📊 Hide Text' : '📋 Show Text Report'}
        </motion.button>
        <motion.button {...buttonTapProps} onClick={() => {
          navigator.clipboard.writeText(formatAnnualReportAsText(report));
        }} className="rounded-lg oracle-gradient-bg px-4 py-2 text-[12px] font-semibold text-white">
          📋 Copy Report
        </motion.button>
        <motion.button {...buttonTapProps} onClick={() => setReport(null)} className="rounded-lg border border-[var(--oracle-border)] px-4 py-2 text-[12px] font-medium text-[var(--oracle-text-3)] hover:bg-[var(--oracle-card-hover)]">
          ← Regenerate
        </motion.button>
      </div>

      {/* Text Report */}
      {showText && (
        <div className="oracle-glass rounded-2xl p-5">
          <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-[var(--oracle-text-2)]">{formatAnnualReportAsText(report)}</pre>
        </div>
      )}
    </div>
  );
}
