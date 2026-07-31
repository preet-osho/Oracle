'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { motionVariants, transitions, buttonTapProps } from '@/styles/design-tokens';
import {
  ResponsiveContainer,
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import { generateDashboardMetrics, DATE_RANGE_OPTIONS, type DashboardMetrics, type DateRangeOption } from '@/lib/command-center';
import { exportToCSV, exportToPDF, exportToWord, buildPDFSections, formatINR, formatUSD } from '@/lib/export-utils';
import toast from 'react-hot-toast';
import { KEYBOARD_SHORTCUTS } from '@/styles';
import { useKeyboardShortcuts } from '@/hooks/keyboard-shortcuts-context';
import { AgentProviderConfigPanel } from './AgentProviderConfigPanel';


// ─── Chart Theme ──────────────────────

const tooltipStyle = {
  contentStyle: {
    backgroundColor: 'var(--oracle-surface-2)',
    border: '1px solid var(--oracle-border)',
    borderRadius: '12px',
    fontSize: '12px',
    color: 'var(--oracle-text-1)',
    boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
  } as React.CSSProperties,
  itemStyle: { color: 'var(--oracle-text-2)' } as React.CSSProperties,
  labelStyle: { color: 'var(--oracle-text-1)', fontWeight: 600 } as React.CSSProperties,
};

// ─── Types ────────────────────────────



// ─── Helpers ──────────────────────────



// ─── Sub-Components ───────────────────

function MetricCard({
  title, value, subtitle, icon, trend, color = 'var(--oracle-text-1)',
}: {
  title: string; value: string | number; subtitle?: string; icon: string;
  trend?: 'up' | 'down' | 'stable'; color?: string;
}) {
  const trendIcon = trend === 'up' ? '📈' : trend === 'down' ? '📉' : '➡️';
  return (
    <div className="oracle-glass rounded-xl p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] text-[var(--oracle-text-muted)] mb-1">{title}</p>
          <p className="text-[22px] font-bold" style={{ color }}>{value}</p>
          {subtitle && <p className="text-[11px] text-[var(--oracle-text-muted)] mt-1">{subtitle}</p>}
        </div>
        <div className="text-right">
          <span className="text-lg">{icon}</span>
          {trend && <span className="text-xs ml-1">{trendIcon}</span>}
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ value, max, color = 'var(--oracle-primary)' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-2 rounded-full bg-[var(--oracle-surface-2)] overflow-hidden">
      <motion.div
        className="h-full rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        style={{ backgroundColor: color }}
      />
    </div>
  );
}

function HealthBadge({ status }: { status: 'healthy' | 'warning' | 'error' }) {
  const styleMap = {
    healthy: {
      backgroundColor: 'color-mix(in srgb, var(--oracle-success) 15%, transparent)',
      color: 'var(--oracle-success)',
      borderColor: 'color-mix(in srgb, var(--oracle-success) 25%, transparent)',
    },
    warning: {
      backgroundColor: 'color-mix(in srgb, var(--oracle-warning) 15%, transparent)',
      color: 'var(--oracle-warning)',
      borderColor: 'color-mix(in srgb, var(--oracle-warning) 25%, transparent)',
    },
    error: {
      backgroundColor: 'color-mix(in srgb, var(--oracle-error) 15%, transparent)',
      color: 'var(--oracle-error)',
      borderColor: 'color-mix(in srgb, var(--oracle-error) 25%, transparent)',
    },
  };
  const labels = { healthy: 'Healthy', warning: 'Warning', error: 'Error' };
  return <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium" style={styleMap[status]}>{labels[status]}</span>;
}

function StatusRow({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[11px] text-[var(--oracle-text-muted)]">{label}</span>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-[11px] font-medium text-[var(--oracle-text-3)]">{count}</span>
      </div>
    </div>
  );
}

// ─── Pipeline Stage Card ──────────────

function PipelineCard({ metrics }: { metrics: DashboardMetrics['pipeline'] }) {
  return (
    <div className="oracle-glass rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-[15px] font-bold text-[var(--oracle-text-1)]">📊 Pipeline</h3>
        <HealthBadge status={metrics.dealCount > 0 ? 'healthy' : 'warning'} />
      </div>
      <div className="space-y-3">
          <div className="flex justify-between items-baseline">
            <span className="text-[11px] text-[var(--oracle-text-muted)]">Total Value</span>
            <span className="text-[15px] font-bold text-[var(--oracle-success)]">{formatINR(metrics.totalValue)}</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-[11px] text-[var(--oracle-text-muted)]">Weighted Value</span>
            <span className="text-[13px] font-medium text-[var(--oracle-text-3)]">{formatINR(metrics.weightedValue)}</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-[11px] text-[var(--oracle-text-muted)]">Active Deals</span>
            <span className="text-[13px] font-medium text-[var(--oracle-text-3)]">{metrics.dealCount}</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-[11px] text-[var(--oracle-text-muted)]">Avg Probability</span>
            <span className="text-[13px] font-medium text-[var(--oracle-text-3)]">{metrics.averageProbability}%</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-[11px] text-[var(--oracle-text-muted)]">Avg Sales Cycle</span>
            <span className="text-[13px] font-medium text-[var(--oracle-text-3)]">{metrics.averageSalesCycle} days</span>
          </div>
        </div>
    </div>
  );
}

// ─── Leads Card ───────────────────────

function LeadsCard({ metrics }: { metrics: DashboardMetrics['leads'] }) {
  const sourceData = Object.entries(metrics.leadsBySource).map(([name, value]) => ({ name, value }));
  return (
    <div className="oracle-glass rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-[15px] font-bold text-[var(--oracle-text-1)]">🎯 Leads</h3>
        <HealthBadge status={metrics.newLeadsThisMonth > 0 ? 'healthy' : 'warning'} />
      </div>
      <div className="space-y-2">
          <div className="flex justify-between items-baseline">
            <span className="text-[11px] text-[var(--oracle-text-muted)]">Total Leads</span>
            <span className="text-[15px] font-bold text-[var(--oracle-primary-l)]">{metrics.totalLeads}</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-[11px] text-[var(--oracle-text-muted)]">New This Month</span>
            <span className="text-[13px] font-medium text-[var(--oracle-text-3)]">{metrics.newLeadsThisMonth}</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-[11px] text-[var(--oracle-text-muted)]">Conversion Rate</span>
            <span className="text-[13px] font-medium text-[var(--oracle-success)]">{metrics.conversionRate}%</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-[11px] text-[var(--oracle-text-muted)]">Avg Response Time</span>
            <span className="text-[13px] font-medium text-[var(--oracle-text-3)]">{metrics.averageResponseTime}h</span>
          </div>
          {sourceData.length > 0 && (
            <div className="mt-3 pt-2 border-t border-[var(--oracle-border)]">
              <p className="text-[10px] text-[var(--oracle-text-muted)] mb-2">LEADS BY SOURCE</p>
              {sourceData.map((source) => (
                <div key={source.name} className="flex items-center justify-between py-1">
                  <span className="text-[11px] text-[var(--oracle-text-muted)]">{source.name}</span>
                  <span className="text-[11px] font-medium text-[var(--oracle-text-3)]">{source.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
    </div>
  );
}

// ─── Deals Card ───────────────────────

function DealsCard({ metrics }: { metrics: DashboardMetrics['deals'] }) {
  return (
    <div className="oracle-glass rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-[15px] font-bold text-[var(--oracle-text-1)]">💼 Deals</h3>
        <HealthBadge status={metrics.winRate >= 30 ? 'healthy' : 'warning'} />
      </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center">
            <p className="text-[20px] font-bold text-[var(--oracle-text-1)]">{metrics.activeDeals}</p>
            <p className="text-[10px] text-[var(--oracle-text-muted)]">Active</p>
          </div>
          <div className="text-center">
            <p className="text-[20px] font-bold text-[var(--oracle-success)]">{metrics.closedWon}</p>
            <p className="text-[10px] text-[var(--oracle-text-muted)]">Won</p>
          </div>
          <div className="text-center">
            <p className="text-[20px] font-bold text-[var(--oracle-error)]">{metrics.closedLost}</p>
            <p className="text-[10px] text-[var(--oracle-text-muted)]">Lost</p>
          </div>
          <div className="text-center">
            <p className="text-[20px] font-bold text-[var(--oracle-warning)]">{metrics.winRate}%</p>
            <p className="text-[10px] text-[var(--oracle-text-muted)]">Win Rate</p>
          </div>
        </div>
        <div className="mt-3 space-y-2">
          <div className="flex justify-between items-baseline">
            <span className="text-[11px] text-[var(--oracle-text-muted)]">Avg Deal Size</span>
            <span className="text-[13px] font-medium text-[var(--oracle-text-3)]">{formatINR(metrics.averageDealSize)}</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-[11px] text-[var(--oracle-text-muted)]">Closing This Month</span>
            <span className="text-[13px] font-medium text-[var(--oracle-warning)]">{metrics.dealsClosingThisMonth}</span>
          </div>
          {metrics.overdueDeals > 0 && (
            <div className="flex justify-between items-baseline">
              <span className="text-[11px] text-[var(--oracle-text-muted)]">Overdue</span>
              <span className="text-[13px] font-medium text-[var(--oracle-error)]">{metrics.overdueDeals}</span>
            </div>
          )}
        </div>
    </div>
  );
}

// ─── Activities Card ──────────────────

function ActivitiesCard({ metrics }: { metrics: DashboardMetrics['activities'] }) {
  return (
    <div className="oracle-glass rounded-2xl p-5">
      <h3 className="text-[15px] font-bold text-[var(--oracle-text-1)] mb-3">📋 Activities</h3>
      <div className="space-y-2">
          <div className="flex justify-between items-baseline">
            <span className="text-[11px] text-[var(--oracle-text-muted)]">This Week</span>
            <span className="text-[13px] font-medium text-[var(--oracle-text-3)]">{metrics.activitiesThisWeek}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <StatusRow label="Calls" count={metrics.callsMade} color="#6366f1" />
            <StatusRow label="Emails" count={metrics.emailsSent} color="#10b981" />
            <StatusRow label="Meetings" count={metrics.meetingsHeld} color="#8b5cf6" />
            <StatusRow label="Tasks Done" count={metrics.tasksCompleted} color="#06b6d4" />
          </div>
          {metrics.pendingTasks > 0 && (
            <div className="mt-2 pt-2 border-t border-[var(--oracle-border)]">
              <div className="flex justify-between items-baseline">
                <span className="text-[11px] text-[var(--oracle-text-muted)]">Pending Tasks</span>
                <span className="text-[13px] font-medium text-[var(--oracle-warning)]">{metrics.pendingTasks}</span>
              </div>
            </div>
          )}
        </div>
    </div>
  );
}

// ─── Agent Health Card ────────────────

function AgentHealthCard({ metrics }: { metrics: DashboardMetrics['agentHealth'] }) {
  return (
    <div className="oracle-glass rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-[15px] font-bold text-[var(--oracle-text-1)]">🤖 Agent Health</h3>
        <HealthBadge status={metrics.averageSuccessRate >= 80 ? 'healthy' : metrics.averageSuccessRate >= 50 ? 'warning' : 'error'} />
      </div>
        <div className="space-y-3">
          <div className="flex justify-between items-baseline">
            <span className="text-[11px] text-[var(--oracle-text-muted)]">Active Agents</span>
            <span className="text-[13px] font-medium text-[var(--oracle-text-3)]">{metrics.activeAgents}/{metrics.totalAgents}</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-[11px] text-[var(--oracle-text-muted)]">Success Rate</span>
            <span className={`text-[13px] font-medium ${metrics.averageSuccessRate >= 80 ? 'text-[var(--oracle-success)]' : metrics.averageSuccessRate >= 50 ? 'text-[var(--oracle-warning)]' : 'text-[var(--oracle-error)]'}`}>
              {metrics.averageSuccessRate}%
            </span>
          </div>
          <ProgressBar value={metrics.averageSuccessRate} max={100} color={metrics.averageSuccessRate >= 80 ? 'var(--oracle-success)' : metrics.averageSuccessRate >= 50 ? 'var(--oracle-warning)' : 'var(--oracle-error)'} />
          <div className="flex justify-between items-baseline">
            <span className="text-[11px] text-[var(--oracle-text-muted)]">Avg Response Time</span>
            <span className="text-[13px] font-medium text-[var(--oracle-text-3)]">{metrics.averageResponseTime}ms</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-[11px] text-[var(--oracle-text-muted)]">Top Performer</span>
            <span className="text-[13px] font-medium text-[var(--oracle-success)]">{metrics.topPerformingAgent}</span>
          </div>
        </div>
    </div>
  );
}

// ─── Tool Health Card ─────────────────

function ToolHealthCard({ metrics }: { metrics: DashboardMetrics['toolHealth'] }) {
  return (
    <div className="oracle-glass rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-[15px] font-bold text-[var(--oracle-text-1)]">🔧 Tool Health</h3>
        <HealthBadge status={metrics.overallStatus === 'healthy' ? 'healthy' : metrics.overallStatus === 'degraded' ? 'warning' : 'error'} />
      </div>
      <div className="space-y-3">
        <div className="flex justify-between items-baseline">
          <span className="text-[11px] text-[var(--oracle-text-muted)]">Total Servers</span>
          <span className="text-[13px] font-medium text-[var(--oracle-text-3)]">{metrics.totalServers}</span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-[11px] text-[var(--oracle-text-muted)]">Healthy</span>
          <span className="text-[13px] font-medium text-[var(--oracle-success)]">{metrics.healthyServers}</span>
        </div>
        {metrics.degradedServers > 0 && (
          <div className="flex justify-between items-baseline">
            <span className="text-[11px] text-[var(--oracle-text-muted)]">Degraded</span>
            <span className="text-[13px] font-medium text-[var(--oracle-warning)]">{metrics.degradedServers}</span>
          </div>
        )}
        {metrics.unhealthyServers > 0 && (
          <div className="flex justify-between items-baseline">
            <span className="text-[11px] text-[var(--oracle-text-muted)]">Unhealthy</span>
            <span className="text-[13px] font-medium text-[var(--oracle-error)]">{metrics.unhealthyServers}</span>
          </div>
        )}
        <div className="flex justify-between items-baseline">
          <span className="text-[11px] text-[var(--oracle-text-muted)]">Total Tools</span>
          <span className="text-[13px] font-medium text-[var(--oracle-text-3)]">{metrics.totalTools}</span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-[11px] text-[var(--oracle-text-muted)]">Avg Latency</span>
          <span className="text-[13px] font-medium text-[var(--oracle-text-3)]">{metrics.averageLatencyMs}ms</span>
        </div>
        {metrics.serverDetails.length > 0 && (
          <div className="mt-3 pt-2 border-t border-[var(--oracle-border)]">
            <p className="text-[10px] text-[var(--oracle-text-muted)] mb-2">SERVERS</p>
            {metrics.serverDetails.slice(0, 5).map((server) => (
              <div key={server.name} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    server.status === 'healthy' ? 'bg-[var(--oracle-success)]' :
                    server.status === 'degraded' ? 'bg-[var(--oracle-warning)]' :
                    'bg-[var(--oracle-error)]'
                  }`} />
                  <span className="text-[11px] text-[var(--oracle-text-muted)]">{server.name}</span>
                </div>
                <span className="text-[10px] text-[var(--oracle-text-muted)]">{server.toolCount} tools</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Memory Health Card ────────────────

function MemoryHealthCard({ metrics }: { metrics: DashboardMetrics['memoryHealth'] }) {
  const categoryColors: Record<string, string> = {
    preference: '#6366f1',
    fact: '#10b981',
    feedback: '#8b5cf6',
    decision: '#f59e0b',
    contact: '#06b6d4',
    sop: '#ec4899',
    lesson: '#ef4444',
    workflow: '#14b8a6',
  };

  return (
    <div className="oracle-glass rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-[15px] font-bold text-[var(--oracle-text-1)]">🧠 Memory Health</h3>
        <HealthBadge status={metrics.healthScore >= 70 ? 'healthy' : metrics.healthScore >= 40 ? 'warning' : 'error'} />
      </div>
      <div className="space-y-3">
        <div className="flex justify-between items-baseline">
          <span className="text-[11px] text-[var(--oracle-text-muted)]">Total Memories</span>
          <span className="text-[15px] font-bold text-[var(--oracle-primary-l)]">{metrics.totalMemories}</span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-[11px] text-[var(--oracle-text-muted)]">Health Score</span>
          <span className={`text-[13px] font-medium ${metrics.healthScore >= 70 ? 'text-[var(--oracle-success)]' : metrics.healthScore >= 40 ? 'text-[var(--oracle-warning)]' : 'text-[var(--oracle-error)]'}`}>
            {metrics.healthScore}/100
          </span>
        </div>
        <ProgressBar value={metrics.healthScore} max={100} color={metrics.healthScore >= 70 ? 'var(--oracle-success)' : metrics.healthScore >= 40 ? 'var(--oracle-warning)' : 'var(--oracle-error)'} />
        <div className="flex justify-between items-baseline">
          <span className="text-[11px] text-[var(--oracle-text-muted)]">Storage Usage</span>
          <span className={`text-[13px] font-medium ${
            metrics.storageUsage === 'low' ? 'text-[var(--oracle-success)]' :
            metrics.storageUsage === 'medium' ? 'text-[var(--oracle-warning)]' :
            'text-[var(--oracle-error)]'
          }`}>
            {metrics.storageUsage.toUpperCase()}
          </span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-[11px] text-[var(--oracle-text-muted)]">Avg Access Count</span>
          <span className="text-[13px] font-medium text-[var(--oracle-text-3)]">{metrics.averageAccessCount}</span>
        </div>
        {Object.keys(metrics.memoriesByCategory).length > 0 && (
          <div className="mt-3 pt-2 border-t border-[var(--oracle-border)]">
            <p className="text-[10px] text-[var(--oracle-text-muted)] mb-2">BY CATEGORY</p>
            {Object.entries(metrics.memoriesByCategory).slice(0, 6).map(([category, count]) => (
              <div key={category} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: categoryColors[category] || '#6b7280' }} />
                  <span className="text-[11px] text-[var(--oracle-text-muted)] capitalize">{category}</span>
                </div>
                <span className="text-[11px] font-medium text-[var(--oracle-text-3)]">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Cost Tracking Card ───────────────

function CostTrackingCard({ metrics }: { metrics: DashboardMetrics['costTracking'] }) {
  return (
    <div className="oracle-glass rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-[15px] font-bold text-[var(--oracle-text-1)]">💵 Cost Tracking</h3>
        <HealthBadge status={metrics.budgetUtilization < 80 ? 'healthy' : metrics.budgetUtilization < 95 ? 'warning' : 'error'} />
      </div>
        <div className="space-y-3">
          <div className="flex justify-between items-baseline">
            <span className="text-[11px] text-[var(--oracle-text-muted)]">Total Cost</span>
            <div className="text-right">
              <span className="text-[13px] font-medium text-[var(--oracle-text-3)]">{formatUSD(metrics.totalCostUsd)}</span>
              <span className="text-[11px] text-[var(--oracle-text-muted)] ml-1">(₹{metrics.totalCostInr.toLocaleString('en-IN')})</span>
            </div>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-[11px] text-[var(--oracle-text-muted)]">Budget Utilization</span>
            <span className={`text-[13px] font-medium ${metrics.budgetUtilization < 80 ? 'text-[var(--oracle-success)]' : metrics.budgetUtilization < 95 ? 'text-[var(--oracle-warning)]' : 'text-[var(--oracle-error)]'}`}>
              {metrics.budgetUtilization}%
            </span>
          </div>
          <ProgressBar value={metrics.budgetUtilization} max={100} color={metrics.budgetUtilization < 80 ? 'var(--oracle-success)' : metrics.budgetUtilization < 95 ? 'var(--oracle-warning)' : 'var(--oracle-error)'} />
          {Object.keys(metrics.costByProvider).length > 0 && (
            <div className="mt-3 pt-2 border-t border-[var(--oracle-border)]">
              <p className="text-[10px] text-[var(--oracle-text-muted)] mb-2">COST BY PROVIDER</p>
              {Object.entries(metrics.costByProvider).slice(0, 5).map(([provider, cost]) => (
                <div key={provider} className="flex justify-between items-center py-1">
                  <span className="text-[11px] text-[var(--oracle-text-muted)] capitalize">{provider}</span>
                  <span className="text-[11px] font-medium text-[var(--oracle-text-3)]">{formatUSD(cost)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
    </div>
  );
}

// ─── Learning Metrics Card ────────────

function LearningCard({ metrics }: { metrics: DashboardMetrics['learning'] }) {
  return (
    <div className="oracle-glass rounded-2xl p-5">
      <h3 className="text-[15px] font-bold text-[var(--oracle-text-1)] mb-3">📚 Learning</h3>
      <div className="space-y-2">
          <div className="flex justify-between items-baseline">
            <span className="text-[11px] text-[var(--oracle-text-muted)]">Tasks Completed</span>
            <span className="text-[13px] font-medium text-[var(--oracle-text-3)]">{metrics.totalTasksCompleted}</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-[11px] text-[var(--oracle-text-muted)]">Quality Score</span>
            <span className={`text-[13px] font-medium ${metrics.averageQualityScore >= 70 ? 'text-[var(--oracle-success)]' : metrics.averageQualityScore >= 50 ? 'text-[var(--oracle-warning)]' : 'text-[var(--oracle-error)]'}`}>
              {metrics.averageQualityScore}/100
            </span>
          </div>
          <ProgressBar value={metrics.averageQualityScore} max={100} color={metrics.averageQualityScore >= 70 ? 'var(--oracle-success)' : metrics.averageQualityScore >= 50 ? 'var(--oracle-warning)' : 'var(--oracle-error)'} />
          <div className="flex justify-between items-baseline">
            <span className="text-[11px] text-[var(--oracle-text-muted)]">Improvement Rate</span>
            <span className="text-[13px] font-medium text-[var(--oracle-success)]">+{metrics.improvementRate}%</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-[11px] text-[var(--oracle-text-muted)]">Accuracy Rate</span>
            <span className="text-[13px] font-medium text-[var(--oracle-text-3)]">{metrics.accuracyRate}%</span>
          </div>
        </div>
    </div>
  );
}

// ─── Pipeline Stage Chart ─────────────

function PipelineStageChart({ stageBreakdown }: { stageBreakdown: DashboardMetrics['pipeline']['stageBreakdown'] }) {
  const data = stageBreakdown.map((s) => ({
    stage: s.stage.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    deals: s.count,
    value: s.totalValue,
    weighted: s.weightedValue,
  }));

  return (
    <div className="oracle-glass rounded-2xl p-5">
      <h3 className="text-[15px] font-bold text-[var(--oracle-text-1)] mb-3">📈 Pipeline by Stage</h3>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--oracle-border)" />
            <XAxis dataKey="stage" tick={{ fontSize: 10, fill: 'var(--oracle-text-muted)' }} angle={-20} textAnchor="end" height={50} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--oracle-text-muted)' }} />
            <Tooltip contentStyle={tooltipStyle.contentStyle} itemStyle={tooltipStyle.itemStyle} labelStyle={tooltipStyle.labelStyle} formatter={(value: number) => [formatINR(value), 'Value']} />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            <Bar dataKey="value" name="Total Value" fill="#6366f1" radius={[4, 4, 0, 0]} />
            <Bar dataKey="weighted" name="Weighted Value" fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Revenue Forecast Chart ───────────

function RevenueForecastChart({ monthlyForecast }: { monthlyForecast: DashboardMetrics['pipeline']['forecast']['monthlyForecast'] }) {
  const data = monthlyForecast.map((m) => ({
    month: m.month,
    forecast: m.forecast,
    actual: m.actual,
  }));

  return (
    <div className="oracle-glass rounded-2xl p-5">
      <h3 className="text-[15px] font-bold text-[var(--oracle-text-1)] mb-3">💰 Revenue Forecast</h3>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--oracle-border)" />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--oracle-text-muted)' }} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--oracle-text-muted)' }} />
            <Tooltip contentStyle={tooltipStyle.contentStyle} itemStyle={tooltipStyle.itemStyle} labelStyle={tooltipStyle.labelStyle} formatter={(value: number) => [formatINR(value), 'Amount']} />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            <Line type="monotone" dataKey="forecast" name="Forecast" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="actual" name="Actual" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Cost Trend Chart ─────────────────

function CostTrendChart({ costTrend }: { costTrend: DashboardMetrics['costTracking']['costTrend'] }) {
  return (
    <div className="oracle-glass rounded-2xl p-5">
      <h3 className="text-[15px] font-bold text-[var(--oracle-text-1)] mb-3">💵 Cost Trend (7 Days)</h3>
      <div className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={costTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--oracle-border)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--oracle-text-muted)' }} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--oracle-text-muted)' }} />
            <Tooltip contentStyle={tooltipStyle.contentStyle} itemStyle={tooltipStyle.itemStyle} labelStyle={tooltipStyle.labelStyle} formatter={(value: number) => [`$${value.toFixed(4)}`, 'Cost']} />
            <Bar dataKey="cost" name="Cost" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── PDF Preview Modal ────────────────

function PDFPreviewModal({
  metrics,
  dateRange,
  onClose,
}: {
  metrics: DashboardMetrics;
  dateRange: DateRangeOption;
  onClose: () => void;
}) {
  const dateRangeLabel = DATE_RANGE_OPTIONS.find((o) => o.value === dateRange)?.label || 'Month';
  const pdfSections = buildPDFSections(metrics);

  const handleDownload = useCallback(() => {
    try {
      const dateRangeOpt = DATE_RANGE_OPTIONS.find((o) => o.value === dateRange)?.label || 'Month';
      exportToPDF({
        title: 'Agency Command Center',
        subtitle: `${dateRangeOpt} Report — Generated ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`,
        sections: pdfSections,
        fileName: `agency-command-center-${dateRange}`,
        showBranding: true,
      });
      toast.success('Dashboard exported as PDF');
      onClose();
    } catch (err) {
      console.error('[AgencyCommandCenter] PDF export failed:', err);
      toast.error(`Failed to export PDF: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [pdfSections, dateRange, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <motion.div
        data-testid="pdf-preview-modal"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="relative w-full max-w-2xl max-h-[85vh] flex flex-col bg-[var(--oracle-bg)] rounded-2xl border border-[var(--oracle-border)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--oracle-border)]">
          <div>
            <h2 className="text-[16px] font-bold text-[var(--oracle-text-1)]">📄 PDF Preview</h2>
            <p className="text-[11px] text-[var(--oracle-text-muted)] mt-0.5">
              {dateRangeLabel} Report — {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <motion.button
            {...buttonTapProps}
            onClick={onClose}
            className="rounded-lg p-2 text-[var(--oracle-text-muted)] hover:text-[var(--oracle-text-1)] hover:bg-[var(--oracle-card-hover)] transition-colors"
          >
            ✕
          </motion.button>
        </div>

        {/* ── Scrollable Content ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Brand Header Preview */}
          <div className="text-center pb-3 border-b border-[var(--oracle-border)]">
            <p className="text-[18px] font-bold text-[var(--oracle-primary)]">ORACLE</p>
            <p className="text-[10px] text-[var(--oracle-text-muted)]">Universal Agency Intelligence</p>
            <h3 className="text-[14px] font-bold text-[var(--oracle-text-1)] mt-2">Agency Command Center</h3>
            <p className="text-[11px] text-[var(--oracle-text-muted)]">{dateRangeLabel} Report</p>
          </div>

          {/* Sections - using shared PDF sections for preview */}
          {pdfSections.map((section) => (
            <div key={section.heading} className="oracle-glass rounded-xl p-4">
              <h4 className="text-[13px] font-bold text-[var(--oracle-primary)] mb-2">{section.heading}</h4>
              <div className="space-y-1.5">
                {section.tableRows?.map(([label, value]) => (
                  <div key={label} className="flex justify-between items-center py-1 border-b border-[var(--oracle-border)]/50 last:border-0">
                    <span className="text-[11px] text-[var(--oracle-text-muted)]">{label}</span>
                    <span className="text-[11px] font-medium text-[var(--oracle-text-3)]">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Footer Preview */}
          <div className="text-center pt-2 pb-1">
            <p className="text-[9px] text-[var(--oracle-text-muted)]">
              Generated by ORACLE — Universal Agency Intelligence
            </p>
          </div>
        </div>

        {/* ── Footer Actions ── */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--oracle-border)] bg-[var(--oracle-surface-1)]">
          <motion.button
            {...buttonTapProps}
            onClick={onClose}
            className="rounded-xl border border-[var(--oracle-border)] px-4 py-2 text-[12px] font-medium text-[var(--oracle-text-3)] hover:bg-[var(--oracle-card-hover)] transition-colors"
          >
            Cancel
          </motion.button>
          <motion.button
            {...buttonTapProps}
            onClick={handleDownload}
            className="flex items-center justify-center gap-2 rounded-xl oracle-gradient-bg px-4 py-2 text-[12px] font-semibold text-white transition-all hover:opacity-90"
          >
            📥 Download PDF
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────

// ─── Keyboard Shortcuts Help Modal ────

function ShortcutsHelpModal({ onClose }: { onClose: () => void }) {
  const shortcuts = KEYBOARD_SHORTCUTS;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <motion.div
        data-testid="shortcuts-help-modal"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="relative w-full max-w-md bg-[var(--oracle-bg)] rounded-2xl border border-[var(--oracle-border)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--oracle-border)]">
          <h2 className="text-[16px] font-bold text-[var(--oracle-text-1)]">⌨️ Keyboard Shortcuts</h2>
          <motion.button
            {...buttonTapProps}
            onClick={onClose}
            className="rounded-lg p-2 text-[var(--oracle-text-muted)] hover:text-[var(--oracle-text-1)] hover:bg-[var(--oracle-card-hover)] transition-colors"
          >
            ✕
          </motion.button>
        </div>

        {/* ── Shortcuts List ── */}
        <div className="px-5 py-4 space-y-3">
          {shortcuts.map((shortcut) => (
            <div key={shortcut.description} className="flex items-center justify-between py-2 border-b border-[var(--oracle-border)]/50 last:border-0">
              <span className="text-[13px] text-[var(--oracle-text-3)]">{shortcut.description}</span>
              <div className="flex items-center gap-1">
                {shortcut.keys.map((key, i) => (
                  <React.Fragment key={key}>
                    {i > 0 && <span className="text-[10px] text-[var(--oracle-text-muted)]">+</span>}
                    <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 rounded border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-1.5 text-[11px] font-mono font-medium text-[var(--oracle-text-3)]">
                      {key}
                    </kbd>
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-3 border-t border-[var(--oracle-border)] bg-[var(--oracle-surface-1)]">
          <p className="text-[11px] text-[var(--oracle-text-muted)] text-center">
            Press <kbd className="inline-flex items-center justify-center h-4 px-1 rounded border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] text-[10px] font-mono">?</kbd> or <kbd className="inline-flex items-center justify-center h-4 px-1.5 rounded border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] text-[10px] font-mono">Esc</kbd> to close
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Inner component that uses keyboard shortcuts context ──────

function AgencyCommandCenterInner() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeOption>('month');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [showPDFPreview, setShowPDFPreview] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [showAgentConfig, setShowAgentConfig] = useState(false);

  const handleOpenPDFPreview = useCallback(() => {
    if (!metrics) return;
    setShowPDFPreview(true);
  }, [metrics]);

  const handleExportWord = useCallback(() => {
    if (!metrics) return;

    try {
      const dateRangeOpt = DATE_RANGE_OPTIONS.find((o) => o.value === dateRange)?.label || 'Month';
      const sections = buildPDFSections(metrics);

      exportToWord({
        title: 'Agency Command Center',
        subtitle: `${dateRangeOpt} Report — Generated ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`,
        sections,
        fileName: `agency-command-center-${dateRange}`,
      });
      toast.success('Dashboard exported as Word document');
    } catch (err) {
      console.error('[AgencyCommandCenter] Word export failed:', err);
      toast.error(`Failed to export Word: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [metrics, dateRange]);

  const handleExportCSV = useCallback(() => {
    if (!metrics) return;

    const rows: string[][] = [
      ['--- Revenue ---', ''],
      ['MRR', formatINR(metrics.revenue.mrr)],
      ['ARR', formatINR(metrics.revenue.arr)],
      ['Revenue Growth', `${metrics.revenue.revenueGrowth}%`],
      ['LTV', formatINR(metrics.revenue.ltv)],
      ['CAC', formatINR(metrics.revenue.cac)],
      ['LTV/CAC Ratio', `${metrics.revenue.ltvCacRatio}x`],
      ['', ''],
      ['--- Pipeline ---', ''],
      ['Total Value', formatINR(metrics.pipeline.totalValue)],
      ['Weighted Value', formatINR(metrics.pipeline.weightedValue)],
      ['Active Deals', String(metrics.pipeline.dealCount)],
      ['Avg Probability', `${metrics.pipeline.averageProbability}%`],
      ['Avg Sales Cycle', `${metrics.pipeline.averageSalesCycle} days`],
      ['', ''],
      ['--- Leads ---', ''],
      ['Total Leads', String(metrics.leads.totalLeads)],
      ['New This Month', String(metrics.leads.newLeadsThisMonth)],
      ['Conversion Rate', `${metrics.leads.conversionRate}%`],
      ['Avg Response Time', `${metrics.leads.averageResponseTime}h`],
      ['', ''],
      ['--- Deals ---', ''],
      ['Active Deals', String(metrics.deals.activeDeals)],
      ['Closed Won', String(metrics.deals.closedWon)],
      ['Closed Lost', String(metrics.deals.closedLost)],
      ['Win Rate', `${metrics.deals.winRate}%`],
      ['Avg Deal Size', formatINR(metrics.deals.averageDealSize)],
      ['Deals Closing This Month', String(metrics.deals.dealsClosingThisMonth)],
      ['Overdue Deals', String(metrics.deals.overdueDeals)],
      ['', ''],
      ['--- Activities ---', ''],
      ['Activities This Week', String(metrics.activities.activitiesThisWeek)],
      ['Calls Made', String(metrics.activities.callsMade)],
      ['Emails Sent', String(metrics.activities.emailsSent)],
      ['Meetings Held', String(metrics.activities.meetingsHeld)],
      ['Tasks Completed', String(metrics.activities.tasksCompleted)],
      ['Pending Tasks', String(metrics.activities.pendingTasks)],
      ['', ''],
      ['--- Agent Health ---', ''],
      ['Active Agents', `${metrics.agentHealth.activeAgents}/${metrics.agentHealth.totalAgents}`],
      ['Avg Success Rate', `${metrics.agentHealth.averageSuccessRate}%`],
      ['Avg Response Time', `${metrics.agentHealth.averageResponseTime}ms`],
      ['Top Performer', metrics.agentHealth.topPerformingAgent],
      ['', ''],
      ['--- Cost Tracking ---', ''],
      ['Total Cost (USD)', formatUSD(metrics.costTracking.totalCostUsd)],
      ['Total Cost (INR)', formatINR(metrics.costTracking.totalCostInr)],
      ['Budget Utilization', `${metrics.costTracking.budgetUtilization}%`],
      ['', ''],
      ['--- Learning ---', ''],
      ['Tasks Completed', String(metrics.learning.totalTasksCompleted)],
      ['Quality Score', `${metrics.learning.averageQualityScore}/100`],
      ['Improvement Rate', `+${metrics.learning.improvementRate}%`],
      ['Accuracy Rate', `${metrics.learning.accuracyRate}%`],
    ];

    exportToCSV({
      headers: ['Metric', 'Value'],
      rows,
      fileName: 'agency-command-center',
    });
    toast.success('Dashboard exported as CSV');
  }, [metrics]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const dashboardMetrics = await generateDashboardMetrics(dateRange);

      setMetrics(dashboardMetrics);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  /* eslint-disable react-hooks/set-state-in-effect -- loadData is async; setLoading/setError calls happen before await which is safe */
  useEffect(() => {
    loadData();
  }, [loadData]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(loadData, 60_000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Keyboard shortcuts registered via context
  const noModalOpen = !showPDFPreview && !showShortcutsHelp;

  // ?: Toggle shortcuts help
  useKeyboardShortcuts({
    id: KEYBOARD_SHORTCUTS[3].id,
    shortcut: KEYBOARD_SHORTCUTS[3],
    handler: () => {
      if (showShortcutsHelp) {
        setShowShortcutsHelp(false);
      } else if (!showPDFPreview) {
        setShowShortcutsHelp(true);
      }
    },
    priority: 10,
  });

  // Ctrl+P: Open PDF preview
  useKeyboardShortcuts({
    id: KEYBOARD_SHORTCUTS[0].id,
    shortcut: KEYBOARD_SHORTCUTS[0],
    handler: handleOpenPDFPreview,
    enabled: noModalOpen,
  });

  // Ctrl+Shift+W: Export Word
  useKeyboardShortcuts({
    id: KEYBOARD_SHORTCUTS[1].id,
    shortcut: KEYBOARD_SHORTCUTS[1],
    handler: handleExportWord,
    enabled: noModalOpen,
  });

  // Ctrl+S: Export CSV
  useKeyboardShortcuts({
    id: KEYBOARD_SHORTCUTS[2].id,
    shortcut: KEYBOARD_SHORTCUTS[2],
    handler: handleExportCSV,
    enabled: noModalOpen,
  });

  // Escape: Close modals
  useKeyboardShortcuts({
    id: KEYBOARD_SHORTCUTS[4].id,
    shortcut: KEYBOARD_SHORTCUTS[4],
    handler: () => {
      if (showPDFPreview) setShowPDFPreview(false);
      else if (showShortcutsHelp) setShowShortcutsHelp(false);
    },
    priority: 10,
  });

  if (loading && !metrics) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--oracle-border)] border-t-[var(--oracle-primary)] mx-auto mb-3" />
          <p className="text-[13px] text-[var(--oracle-text-muted)]">Loading Agency Command Center...</p>
        </div>
      </div>
    );
  }

  if (error && !metrics) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="oracle-glass rounded-2xl p-6 text-center max-w-md border border-[var(--oracle-error)]/20">
          <p className="text-[13px] text-[var(--oracle-error)] mb-3">{error}</p>
          <motion.button
            {...buttonTapProps}
            onClick={loadData}
            className="rounded-xl border border-[var(--oracle-border)] px-4 py-2 text-[12px] font-medium text-[var(--oracle-text-3)] transition-colors hover:bg-[var(--oracle-card-hover)]"
          >
            Retry
          </motion.button>
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* ── Header ── */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-[22px] font-bold text-[var(--oracle-text-1)] flex items-center gap-2">
                  🏢 Agency Command Center
                </h1>
                <p className="mt-1 text-[13px] text-[var(--oracle-text-3)]">
                  Real-time overview of your agency operations
                </p>
                {/* ── Date Range Filter ── */}
                <div className="flex items-center gap-1.5 mt-2">
                  {DATE_RANGE_OPTIONS.map((option) => (
                    <motion.button
                      key={option.value}
                      {...buttonTapProps}
                      onClick={() => setDateRange(option.value)}
                      className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all ${
                        dateRange === option.value
                          ? 'bg-[var(--oracle-primary)] text-white shadow-md'
                          : 'bg-[var(--oracle-surface-2)] text-[var(--oracle-text-muted)] hover:bg-[var(--oracle-surface-3)] hover:text-[var(--oracle-text-3)]'
                      }`}
                    >
                      <span>{option.icon}</span>
                      <span>{option.label}</span>
                    </motion.button>
                  ))}
                </div>
                <p className="mt-0.5 text-[11px] text-[var(--oracle-text-muted)]">
                  Last refreshed: {lastRefresh.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <motion.button
                  {...buttonTapProps}
                  onClick={handleOpenPDFPreview}
                  title="Ctrl+P"
                  className="group relative flex items-center justify-center gap-2 rounded-xl border border-[var(--oracle-border)] px-4 py-2.5 text-[13px] font-medium text-[var(--oracle-text-3)] transition-colors hover:bg-[var(--oracle-card-hover)]"
                >
                  📄 Export PDF
                  <kbd className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap inline-flex items-center rounded border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-1.5 py-0.5 text-[9px] font-mono text-[var(--oracle-text-muted)] shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                    Ctrl+P
                  </kbd>
                </motion.button>
                <motion.button
                  {...buttonTapProps}
                  onClick={handleExportWord}
                  title="Ctrl+Shift+W"
                  className="group relative flex items-center justify-center gap-2 rounded-xl border border-[var(--oracle-border)] px-4 py-2.5 text-[13px] font-medium text-[var(--oracle-text-3)] transition-colors hover:bg-[var(--oracle-card-hover)]"
                >
                  📝 Export Word
                  <kbd className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap inline-flex items-center rounded border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-1.5 py-0.5 text-[9px] font-mono text-[var(--oracle-text-muted)] shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                    Ctrl+Shift+W
                  </kbd>
                </motion.button>
                <motion.button
                  {...buttonTapProps}
                  onClick={handleExportCSV}
                  title="Ctrl+S"
                  className="group relative flex items-center justify-center gap-2 rounded-xl border border-[var(--oracle-border)] px-4 py-2.5 text-[13px] font-medium text-[var(--oracle-text-3)] transition-colors hover:bg-[var(--oracle-card-hover)]"
                >
                  📥 Export CSV
                  <kbd className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap inline-flex items-center rounded border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-1.5 py-0.5 text-[9px] font-mono text-[var(--oracle-text-muted)] shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                    Ctrl+S
                  </kbd>
                </motion.button>
                <motion.button
                  {...buttonTapProps}
                  onClick={() => loadData()}
                  disabled={loading}
                  className="flex items-center justify-center gap-2 rounded-xl oracle-gradient-bg px-4 py-2.5 text-[13px] font-semibold text-white transition-all disabled:opacity-50"
                >
                  {loading ? 'Refreshing...' : '🔄 Refresh'}
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* ── Top Row: Key Revenue Metrics ── */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard
                title="MRR"
                value={formatINR(metrics.revenue.mrr)}
                subtitle={`ARR: ${formatINR(metrics.revenue.arr)}`}
                icon="💰"
                trend={metrics.revenue.revenueGrowth >= 0 ? 'up' : 'down'}
                color="var(--oracle-success)"
              />
              <MetricCard
                title="Pipeline"
                value={formatINR(metrics.pipeline.totalValue)}
                subtitle={`Weighted: ${formatINR(metrics.pipeline.weightedValue)}`}
                icon="📊"
                color="var(--oracle-primary-l)"
              />
              <MetricCard
                title="Active Deals"
                value={metrics.deals.activeDeals}
                subtitle={`Win Rate: ${metrics.deals.winRate}%`}
                icon="💼"
                color="var(--oracle-primary-l)"
              />
              <MetricCard
                title="Total Leads"
                value={metrics.leads.totalLeads}
                subtitle={`${metrics.leads.newLeadsThisMonth} new this month`}
                icon="🎯"
                color="var(--oracle-primary-l)"
              />
            </div>
          </motion.div>

          {/* ── Second Row: Key Health Metrics ── */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard
                title="LTV/CAC Ratio"
                value={`${metrics.revenue.ltvCacRatio}x`}
                subtitle={`LTV: ${formatINR(metrics.revenue.ltv)}`}
                icon="📈"
                color="var(--oracle-primary-l)"
              />
              <MetricCard
                title="Agent Success"
                value={`${metrics.agentHealth.averageSuccessRate}%`}
                subtitle={`${metrics.agentHealth.activeAgents} active agents`}
                icon="🤖"
                color={metrics.agentHealth.averageSuccessRate >= 80 ? 'var(--oracle-success)' : 'var(--oracle-warning)'}
              />
              <MetricCard
                title="Total Cost"
                value={formatUSD(metrics.costTracking.totalCostUsd)}
                subtitle={`Budget: ${metrics.costTracking.budgetUtilization}%`}
                icon="💵"
                color={metrics.costTracking.budgetUtilization < 80 ? 'var(--oracle-success)' : 'var(--oracle-warning)'}
              />
              <MetricCard
                title="Quality Score"
                value={`${metrics.learning.averageQualityScore}/100`}
                subtitle={`${metrics.learning.totalTasksCompleted} tasks`}
                icon="📚"
                color={metrics.learning.averageQualityScore >= 70 ? 'var(--oracle-success)' : 'var(--oracle-warning)'}
              />
            </div>
          </motion.div>

          {/* ── Charts Row ── */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <PipelineStageChart stageBreakdown={metrics.pipeline.stageBreakdown} />
              <RevenueForecastChart monthlyForecast={metrics.pipeline.forecast.monthlyForecast} />
            </div>
          </motion.div>

          {/* ── Detail Cards Row ── */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <PipelineCard metrics={metrics.pipeline} />
              <LeadsCard metrics={metrics.leads} />
              <DealsCard metrics={metrics.deals} />
            </div>
          </motion.div>

          {/* ── Operations Row ── */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <ActivitiesCard metrics={metrics.activities} />
              <AgentHealthCard metrics={metrics.agentHealth} />
              <LearningCard metrics={metrics.learning} />
            </div>
          </motion.div>

          {/* ── Systems Row ── */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <ToolHealthCard metrics={metrics.toolHealth} />
              <MemoryHealthCard metrics={metrics.memoryHealth} />
              <CostTrackingCard metrics={metrics.costTracking} />
            </div>
          </motion.div>

          {/* ── Cost Trend Row ── */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
            <CostTrendChart costTrend={metrics.costTracking.costTrend} />
          </motion.div>

          {/* ── Agent Provider Config ── */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
            <div className="oracle-glass rounded-2xl overflow-hidden">
              <button
                onClick={() => setShowAgentConfig(!showAgentConfig)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-[var(--oracle-surface-2)]/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">⚙️</span>
                  <div className="text-left">
                    <h3 className="text-[15px] font-bold text-[var(--oracle-text-1)]">Agent Provider Configuration</h3>
                    <p className="text-[11px] text-[var(--oracle-text-muted)]">Configure default AI providers and models per agent</p>
                  </div>
                </div>
                <motion.span
                  animate={{ rotate: showAgentConfig ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-[var(--oracle-text-muted)] text-sm"
                >
                  ▼
                </motion.span>
              </button>
              <AnimatePresence>
                {showAgentConfig && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 border-t border-[var(--oracle-border)]/50">
                      <AgentProviderConfigPanel className="mt-4" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* ── Footer ── */}
          <div className="text-center pt-2 pb-4">
            <p className="text-[11px] text-[var(--oracle-text-muted)]">
              Auto-refreshes every 60s
            </p>
          </div>
        </div>
      </div>

      {/* ── PDF Preview Modal ── */}
      {showPDFPreview && metrics && (
        <PDFPreviewModal
          metrics={metrics}
          dateRange={dateRange}
          onClose={() => setShowPDFPreview(false)}
        />
      )}

      {/* ── Shortcuts Help Modal ── */}
      {showShortcutsHelp && (
        <ShortcutsHelpModal onClose={() => setShowShortcutsHelp(false)} />
      )}
    </div>
  );
}

// ─── Exported component ──────

export function AgencyCommandCenter() {
  return <AgencyCommandCenterInner />;
}
