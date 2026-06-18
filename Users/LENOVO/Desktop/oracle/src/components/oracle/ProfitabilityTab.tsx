'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { motionVariants, transitions, buttonTapProps } from '@/styles/design-tokens';
import { projectsApi, timeEntriesApi, invoicesApi } from '@/lib/api';
import { calculateProfitability, aggregateProfitability, getMarginColor, getMarginLabel, getROIIcon, type ProfitabilityData, type CostBreakdown } from '@/lib/profitability';

// ─── Types ─────────────────────────────

interface ProjectWithFinancials {
  id: string;
  clientName: string;
  industry: string;
  service: string;
  status: string;
  value: string;
  totalHours: number;
  invoiceTotal: number;
}

// ─── ProfitabilityTab ──────────────────

export function ProfitabilityTab({ onAskOracle }: { onAskOracle?: () => void }) {
  const [projects, setProjects] = useState<ProjectWithFinancials[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const rows = await projectsApi.list();
      setProjects(rows.map((r) => ({
        id: r.id,
        clientName: r.client_name,
        industry: r.industry,
        service: r.service,
        status: r.status,
        value: r.value,
        totalHours: r.total_hours,
        invoiceTotal: r.invoice_total,
      })));
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  };

  const profitabilityData = useMemo(() => {
    return projects.map((p) => {
      const revenue = p.invoiceTotal || parseFloat(p.value) || 0;
      const costs: CostBreakdown[] = [
        { category: 'Time Cost', amount: p.totalHours * 1000, percentage: 100 },
      ];
      return calculateProfitability(p.id, p.clientName, revenue, costs, p.totalHours);
    });
  }, [projects]);

  const aggregate = useMemo(() => aggregateProfitability(profitabilityData), [profitabilityData]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="oracle-spinner">
          <div className="oracle-spinner-ring" />
          <span className="oracle-spinner-text">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-6xl space-y-6">
          {/* Header */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
            <h1 className="text-[22px] font-bold text-[var(--oracle-text-1)]">💰 Project Profitability</h1>
            <p className="mt-1 text-[13px] text-[var(--oracle-text-3)]">Track revenue vs costs per project</p>
          </motion.div>

          {/* Aggregate Stats */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard icon="💰" label="Total Revenue" value={`₹${aggregate.totalRevenue.toLocaleString()}`} />
              <StatCard icon="💸" label="Total Costs" value={`₹${aggregate.totalCosts.toLocaleString()}`} />
              <StatCard icon="📈" label="Total Profit" value={`₹${aggregate.totalProfit.toLocaleString()}`} accent={aggregate.totalProfit > 0} />
              <StatCard icon="📊" label="Avg Margin" value={`${aggregate.avgMargin}%`} color={getMarginColor(aggregate.avgMargin)} />
            </div>
          </motion.div>

          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="oracle-glass rounded-xl p-4 text-center">
              <span className="text-2xl">✅</span>
              <p className="mt-1 text-[18px] font-bold text-[var(--oracle-success)]">{aggregate.profitableCount}</p>
              <p className="text-[11px] text-[var(--oracle-text-muted)]">Profitable</p>
            </div>
            <div className="oracle-glass rounded-xl p-4 text-center">
              <span className="text-2xl">➡️</span>
              <p className="mt-1 text-[18px] font-bold text-[var(--oracle-text-2)]">{aggregate.breakevenCount}</p>
              <p className="text-[11px] text-[var(--oracle-text-muted)]">Break-even</p>
            </div>
            <div className="oracle-glass rounded-xl p-4 text-center">
              <span className="text-2xl">⚠️</span>
              <p className="mt-1 text-[18px] font-bold text-[var(--oracle-error)]">{aggregate.lossCount}</p>
              <p className="text-[11px] text-[var(--oracle-text-muted)]">Loss</p>
            </div>
          </div>

          {/* Project List */}
          {profitabilityData.length === 0 ? (
            <div className="oracle-glass rounded-xl p-12 text-center">
              <span className="text-4xl">📁</span>
              <p className="mt-3 text-[16px] font-semibold text-[var(--oracle-text-1)]">No Projects Yet</p>
              <p className="mt-1 text-[13px] text-[var(--oracle-text-3)]">Add projects and log time/invoices to track profitability</p>
              {onAskOracle && (
                <button
                  onClick={onAskOracle}
                  className="mt-4 rounded-lg oracle-gradient-bg px-4 py-2 text-[12px] font-semibold text-white"
                >
                  Ask ORACLE to create a project
                </button>
              )}
            </div>
          ) : (
            <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
              <div className="oracle-glass rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-[var(--oracle-border)]">
                  <h3 className="text-[15px] font-bold text-[var(--oracle-text-1)]">Project Breakdown</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="border-b border-[var(--oracle-border)]">
                        <th className="px-4 py-3 text-left font-semibold text-[var(--oracle-text-1)]">Client</th>
                        <th className="px-4 py-3 text-right font-semibold text-[var(--oracle-text-1)]">Revenue</th>
                        <th className="px-4 py-3 text-right font-semibold text-[var(--oracle-text-1)]">Costs</th>
                        <th className="px-4 py-3 text-right font-semibold text-[var(--oracle-text-1)]">Profit</th>
                        <th className="px-4 py-3 text-right font-semibold text-[var(--oracle-text-1)]">Margin</th>
                        <th className="px-4 py-3 text-right font-semibold text-[var(--oracle-text-1)]">ROI</th>
                        <th className="px-4 py-3 text-center font-semibold text-[var(--oracle-text-1)]">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profitabilityData.map((p) => (
                        <tr key={p.projectId} className="border-b border-[var(--oracle-border)] last:border-0 hover:bg-[var(--oracle-card-hover)] transition-colors">
                          <td className="px-4 py-3">
                            <span className="font-medium text-[var(--oracle-text-1)]">{p.clientName}</span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-[var(--oracle-text-3)]">₹{p.totalRevenue.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right font-mono text-[var(--oracle-text-3)]">₹{p.totalCosts.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right font-mono font-medium" style={{ color: getMarginColor(p.grossMarginPercent) }}>
                            ₹{p.grossMargin.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: `${getMarginColor(p.grossMarginPercent)}20`, color: getMarginColor(p.grossMarginPercent) }}>
                              {p.grossMarginPercent}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-[var(--oracle-text-3)]">
                            {getROIIcon(p.roi)} {p.roi}%
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              p.status === 'profitable' ? 'bg-[var(--oracle-success)]/10 text-[var(--oracle-success)]' :
                              p.status === 'loss' ? 'bg-[var(--oracle-error)]/10 text-[var(--oracle-error)]' :
                              'bg-[var(--oracle-surface-2)] text-[var(--oracle-text-muted)]'
                            }`}>
                              {getMarginLabel(p.grossMarginPercent)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Stat Card ─────────────────────────

function StatCard({ icon, label, value, accent, color }: { icon: string; label: string; value: string; accent?: boolean; color?: string }) {
  return (
    <div className={`oracle-glass rounded-xl p-4 ${accent ? 'ring-1 ring-[var(--oracle-success)]/20' : ''}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <span className="text-[11px] text-[var(--oracle-text-muted)]">{label}</span>
      </div>
      <p className="text-[20px] font-bold" style={{ color: color || (accent ? 'var(--oracle-success)' : 'var(--oracle-text-1)') }}>{value}</p>
    </div>
  );
}
