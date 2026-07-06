'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { motionVariants, transitions, cardHoverProps, buttonTapProps } from '@/styles/design-tokens';
import type { Lead } from '@/types';
import { DEFAULT_LEAD_TEMPLATES } from '@/data/lead-templates';
import { fetchWithTimeout, TIMEOUT_QUICK_MS } from '@/lib/fetch-utils';
import toast from 'react-hot-toast';
import { TOAST_DEFAULTS } from '@/lib/toast-config';
import { copyToClipboard } from '@/lib/utils';

// ─── API Helpers ─────────────────────

/** Convert snake_case API row → camelCase Lead */
function rowToLead(row: Record<string, unknown>): Lead {
  return {
    id: row.id as string,
    businessName: row.business_name as string,
    phone: row.phone as string,
    email: row.email as string,
    website: row.website as string,
    googleMapsUrl: row.google_maps_url as string,
    rating: row.rating as number,
    reviewCount: row.review_count as number,
    address: row.address as string,
    city: row.city as string,
    category: row.category as string,
    industry: row.industry as string,
    triggerCriterion: row.trigger_criterion as string,
    status: row.status as Lead['status'],
    channel: (row.channel as Lead['channel']) || undefined,
    personalisedMessage: row.personalised_message as string || undefined,
    notes: row.notes as string,
    source: row.source as Lead['source'],
    assignedTo: row.assigned_to as string || undefined,
    followUpDate: (row.follow_up_date as string) || undefined,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

/** Convert camelCase Lead → snake_case for API */
function leadToRow(lead: Partial<Lead>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (lead.businessName !== undefined) row.business_name = lead.businessName;
  if (lead.phone !== undefined) row.phone = lead.phone;
  if (lead.email !== undefined) row.email = lead.email;
  if (lead.website !== undefined) row.website = lead.website;
  if (lead.googleMapsUrl !== undefined) row.google_maps_url = lead.googleMapsUrl;
  if (lead.rating !== undefined) row.rating = lead.rating;
  if (lead.reviewCount !== undefined) row.review_count = lead.reviewCount;
  if (lead.address !== undefined) row.address = lead.address;
  if (lead.city !== undefined) row.city = lead.city;
  if (lead.category !== undefined) row.category = lead.category;
  if (lead.industry !== undefined) row.industry = lead.industry;
  if (lead.triggerCriterion !== undefined) row.trigger_criterion = lead.triggerCriterion;
  if (lead.status !== undefined) row.status = lead.status;
  if (lead.channel !== undefined) row.channel = lead.channel;
  if (lead.personalisedMessage !== undefined) row.personalised_message = lead.personalisedMessage;
  if (lead.notes !== undefined) row.notes = lead.notes;
  if (lead.source !== undefined) row.source = lead.source;
  if (lead.assignedTo !== undefined) row.assigned_to = lead.assignedTo;
  if (lead.followUpDate !== undefined) row.follow_up_date = lead.followUpDate;
  return row;
}

// ─── Lead Generation Workflows ────────

const LEAD_WORKFLOWS = [
  {
    id: 'google-maps',
    name: 'Google Maps Lead Mining',
    emoji: '📍',
    color: '#3b82f6',
    description: 'Search Google Maps for businesses without websites, low ratings, or outdated profiles',
    categories: ['Restaurant', 'Dental Clinic', 'Salon', 'Gym', 'Coaching Centre', 'Real Estate Agent', 'Chartered Accountant', 'Interior Designer', 'Boutique', 'Jewellery Shop'],
    criteria: [
      'No website listed in Google Maps profile',
      'Website listed but loads to a parked domain',
      'Rating below 3.8 stars with 10+ reviews',
      'Last reviewed more than 6 months ago',
      'Profile photo is very low quality or missing',
    ],
    estimatedTime: '2-4 hours per city',
  },
  {
    id: 'website-audit',
    name: 'Website Quality Analysis',
    emoji: '🔍',
    color: '#10b981',
    description: 'Find businesses with poor websites that need upgrading',
    criteria: [
      'Page load time > 4 seconds',
      'Not mobile responsive (breaks at <768px)',
      'No SSL certificate (http not https)',
      'Copyright year < 2023',
      'Contact form broken',
      'No Google Analytics',
      'No WhatsApp button',
    ],
    estimatedTime: '3-5 hours per batch',
  },
  {
    id: 'funded-startups',
    name: 'Funded Startup Prospecting',
    emoji: '🚀',
    color: '#f59e0b',
    description: 'Target recently funded startups (seed/Series A) that need marketing help',
    criteria: [
      'Raised ₹50L to ₹5Cr (seed/Series A)',
      'Consumer-facing (B2C or B2B2C)',
      'Less than 3 years old',
      'Based in Tier 1-2 Indian city',
    ],
    estimatedTime: '2-3 hours',
  },
  {
    id: 'social-listening',
    name: 'Social Listening Lead Gen',
    emoji: '👂',
    color: '#8b5cf6',
    description: 'Find business owners expressing pain on Reddit, LinkedIn, Quora',
    criteria: [
      'Reddit: "need website", "digital marketing help"',
      'LinkedIn: "looking for agency", "ads not converting"',
      'Quora: "best SEO company India"',
      'IndiaMART: buyer requests for web design',
    ],
    estimatedTime: '1-2 hours',
  },
  {
    id: 'job-listings',
    name: 'Job Listing Intelligence',
    emoji: '💼',
    color: '#ec4899',
    description: 'Companies hiring for digital marketing roles = they have budget but no agency',
    criteria: [
      'Hiring "Digital Marketing Manager" or "SEO Specialist"',
      'Company size 20-500 employees',
      'Salary range ₹4L-15L/year',
      'Job posted 3-14 days ago',
    ],
    estimatedTime: '1-2 hours',
  },
];

// ─── Status Config ─────────────────────

const STATUS_COLORS: Record<string, string> = {
  New: 'var(--oracle-info)',
  Contacted: 'var(--oracle-warning)',
  Responded: 'var(--oracle-success)',
  Hot: 'var(--oracle-error)',
  Warm: 'var(--oracle-warning)',
  Cold: 'var(--oracle-text-muted)',
  Converted: 'var(--oracle-success)',
  Lost: 'var(--oracle-error)',
};

const STATUS_EMOJIS: Record<string, string> = {
  New: '🆕',
  Contacted: '📤',
  Responded: '💬',
  Hot: '🔥',
  Warm: '🌡️',
  Cold: '❄️',
  Converted: '✅',
  Lost: '❌',
};

// ─── Sample Leads Data ─────────────────

// ─── LeadsTab Component ───────────────

export function LeadsTab({ onAskOracle }: { onAskOracle?: (prompt: string) => void }) {
  const [activeView, setActiveView] = useState<'workflows' | 'tracker' | 'followups'>('tracker');
  const [leads, setLeads] = useState<Lead[]>(() =>
    DEFAULT_LEAD_TEMPLATES.map((t) => ({ ...t, id: `template-${t.businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, createdAt: Date.now(), updatedAt: Date.now() }))
  );
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterSource, setFilterSource] = useState('All');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddLead, setShowAddLead] = useState(false);
  const [, setShowFollowUp] = useState<string | null>(null);

  // Seed default leads on first load, then fetch leads
  useEffect(() => {
    let cancelled = false;
    async function loadLeads() {
      try {
        // Try seed endpoint first — inserts defaults if user has none
        const seedRes = await fetchWithTimeout('/api/leads/seed', { method: 'POST', timeoutMs: TIMEOUT_QUICK_MS });
        if (seedRes.ok) {
          const { leads } = await seedRes.json();
          if (!cancelled && Array.isArray(leads) && leads.length > 0) {
            setLeads(leads.map(rowToLead));
            return;
          }
        }
        // Fallback to regular fetch if seed fails
        const fetchRes = await fetchWithTimeout('/api/leads', { timeoutMs: TIMEOUT_QUICK_MS });
        if (!cancelled && fetchRes.ok) {
          const rows = await fetchRes.json();
          if (Array.isArray(rows) && rows.length > 0) {
            setLeads(rows.map(rowToLead));
          }
        }
      } catch {
        // Keep template data as fallback
      }
    }
    loadLeads();
    return () => { cancelled = true; };
  }, []);

  const filteredLeads = useMemo(() => {
    let result = leads;
    if (filterStatus !== 'All') result = result.filter((l) => l.status === filterStatus);
    if (filterSource !== 'All') result = result.filter((l) => l.source === filterSource);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) => l.businessName.toLowerCase().includes(q) || l.city.toLowerCase().includes(q) || l.category.toLowerCase().includes(q)
      );
    }
    return result;
  }, [leads, filterStatus, filterSource, search]);

  const stats = useMemo(() => {
    const total = leads.length;
    const hot = leads.filter((l) => l.status === 'Hot').length;
    const responded = leads.filter((l) => l.status === 'Responded').length;
    const converted = leads.filter((l) => l.status === 'Converted').length;
    return { total, hot, responded, converted };
  }, [leads]);

  const updateLeadStatus = useCallback(async (id: string, status: Lead['status']) => {
    setLeads((prev) => prev.map((l) => l.id === id ? { ...l, status, updatedAt: Date.now() } : l));
    try {
      await fetchWithTimeout(`/api/leads/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
        timeoutMs: TIMEOUT_QUICK_MS,
      });
    } catch { /* optimistic update already applied */ }
  }, []);

  const deleteLead = useCallback(async (id: string) => {
    setLeads((prev) => prev.filter((l) => l.id !== id));
    try {
      await fetchWithTimeout(`/api/leads/${id}`, { method: 'DELETE', timeoutMs: TIMEOUT_QUICK_MS });
    } catch { /* optimistic update already applied */ }
  }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-6xl">
          {/* Header */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-[22px] font-bold text-[var(--oracle-text-1)]">🎯 Lead Generation</h1>
              <p className="mt-1 text-[13px] text-[var(--oracle-text-3)]">Find, track, and convert potential clients</p>
            </div>
            <div className="flex items-center gap-2">
              <motion.button {...buttonTapProps} onClick={() => setShowAddLead(true)} className="rounded-xl oracle-gradient-bg px-4 py-2 text-[13px] font-semibold text-white transition-all">
                + Add Lead
              </motion.button>
            </div>
          </motion.div>

          {/* View Tabs */}
          <div className="mb-4 flex gap-2">
            {[
              { id: 'tracker' as const, label: '📋 Lead Tracker', count: leads.length },
              { id: 'workflows' as const, label: '⚡ Generation Workflows', count: LEAD_WORKFLOWS.length },
              { id: 'followups' as const, label: '📅 Follow-ups', count: leads.filter((l) => l.followUpDate).length },
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
                {tab.label} ({tab.count})
              </motion.button>
            ))}
          </div>

          {/* Stats Row */}
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: 'Total Leads', value: stats.total, icon: '📋', color: 'var(--oracle-info)' },
              { label: 'Hot Leads', value: stats.hot, icon: '🔥', color: 'var(--oracle-error)' },
              { label: 'Responded', value: stats.responded, icon: '💬', color: 'var(--oracle-success)' },
              { label: 'Converted', value: stats.converted, icon: '✅', color: 'var(--oracle-primary-l)' },
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
          {activeView === 'tracker' && (
            <LeadsTracker
              leads={filteredLeads}
              search={search}
              filterStatus={filterStatus}
              filterSource={filterSource}
              expandedId={expandedId}
              onSearch={setSearch}
              onFilterStatus={setFilterStatus}
              onFilterSource={setFilterSource}
              onToggleExpand={(id) => setExpandedId(expandedId === id ? null : id)}
              onUpdateStatus={updateLeadStatus}
              onDelete={deleteLead}
              onAskOracle={onAskOracle}
              onFollowUp={(id) => setShowFollowUp(id)}
            />
          )}

          {activeView === 'workflows' && (
            <LeadWorkflows onAskOracle={onAskOracle} />
          )}

          {activeView === 'followups' && (
            <FollowUpManager leads={leads} onAskOracle={onAskOracle} />
          )}

          {/* Add Lead Modal */}
          <AnimatePresence>
            {showAddLead && (
              <AddLeadModal
                onClose={() => setShowAddLead(false)}
                onSave={async (lead) => {
                  const newLead: Lead = { ...lead, id: crypto.randomUUID(), createdAt: Date.now(), updatedAt: Date.now() };
                  setLeads((prev) => [newLead, ...prev]);
                  setShowAddLead(false);
                  try {
                    const res = await fetchWithTimeout('/api/leads', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(leadToRow(newLead)),
                      timeoutMs: TIMEOUT_QUICK_MS,
                    });
                    if (res.ok) {
                      const saved = await res.json();
                      setLeads((prev) => prev.map((l) => l.id === newLead.id ? rowToLead(saved) : l));
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

// ─── Leads Tracker ────────────────────

function LeadsTracker({
  leads, search, filterStatus, filterSource, expandedId,
  onSearch, onFilterStatus, onFilterSource, onToggleExpand,
  onUpdateStatus, onDelete, onAskOracle, onFollowUp,
}: {
  leads: Lead[];
  search: string;
  filterStatus: string;
  filterSource: string;
  expandedId: string | null;
  onSearch: (s: string) => void;
  onFilterStatus: (s: string) => void;
  onFilterSource: (s: string) => void;
  onToggleExpand: (id: string) => void;
  onUpdateStatus: (id: string, status: Lead['status']) => void;
  onDelete: (id: string) => void;
  onAskOracle?: (prompt: string) => void;
  onFollowUp: (id: string) => void;
}) {
  return (
    <>
      {/* Search & Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--oracle-text-muted)]">🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search leads by name, city, or category..."
            className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] py-2.5 pl-9 pr-4 text-[13px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)]"
          />
        </div>
        <select value={filterStatus} onChange={(e) => onFilterStatus(e.target.value)} className="rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[12px] text-[var(--oracle-text-2)] outline-none">
          {['All', 'New', 'Contacted', 'Responded', 'Hot', 'Warm', 'Cold', 'Converted', 'Lost'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterSource} onChange={(e) => onFilterSource(e.target.value)} className="rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[12px] text-[var(--oracle-text-2)] outline-none">
          {['All', 'Google Maps', 'Website Audit', 'Funded Startup', 'Social Listening', 'Job Listing', 'Manual'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Lead Cards */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {leads.map((lead) => (
            <motion.div key={lead.id} layout variants={motionVariants.fadeUp} initial="initial" animate="animate" exit="exit" transition={transitions.smooth} {...cardHoverProps}>
              <div className={`oracle-glass rounded-2xl p-4 transition-all ${expandedId === lead.id ? 'ring-1 ring-[var(--oracle-primary)]/30' : 'hover:border-[var(--oracle-border-strong)]'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 cursor-pointer" onClick={() => onToggleExpand(lead.id)}>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[15px] font-bold text-[var(--oracle-text-1)]">{lead.businessName}</h3>
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: `${STATUS_COLORS[lead.status]}20`, color: STATUS_COLORS[lead.status] }}>
                        {STATUS_EMOJIS[lead.status]} {lead.status}
                      </span>
                      <span className="rounded-full bg-[var(--oracle-surface-2)] px-2 py-0.5 text-[10px] text-[var(--oracle-text-muted)]">
                        {lead.source}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-[12px] text-[var(--oracle-text-3)]">
                      <span>{lead.city}</span>
                      <span>· {lead.category}</span>
                      {lead.rating > 0 && <span>⭐ {lead.rating} ({lead.reviewCount} reviews)</span>}
                      {lead.phone && <span>📞 {lead.phone}</span>}
                    </div>
                    <p className="mt-1 text-[11px] text-[var(--oracle-text-muted)]">{lead.triggerCriterion}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <motion.button {...buttonTapProps} onClick={() => onAskOracle?.(`Analyze lead: ${lead.businessName} in ${lead.city}. Industry: ${lead.industry}. Help me craft a personalised pitch.`)} className="rounded-lg px-2 py-1 text-[11px] text-[var(--oracle-text-muted)] hover:bg-[var(--oracle-card-hover)]" title="Ask Oracle">⚡</motion.button>
                    <motion.button {...buttonTapProps} onClick={() => onFollowUp(lead.id)} className="rounded-lg px-2 py-1 text-[11px] text-[var(--oracle-text-muted)] hover:bg-[var(--oracle-card-hover)]" title="Follow Up">📅</motion.button>
                    <motion.button {...buttonTapProps} onClick={() => onDelete(lead.id)} className="rounded-lg px-2 py-1 text-[11px] text-[var(--oracle-text-muted)] hover:text-[var(--oracle-error)]" title="Delete">🗑</motion.button>
                  </div>
                </div>

                {/* Expanded Details */}
                <AnimatePresence>
                  {expandedId === lead.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={transitions.smooth} className="overflow-hidden">
                      <div className="mt-4 space-y-3 border-t border-[var(--oracle-border)] pt-4">
                        {/* Contact Info */}
                        <div className="grid grid-cols-2 gap-3 text-[12px]">
                          <div><span className="text-[var(--oracle-text-muted)]">Phone:</span> <span className="text-[var(--oracle-text-2)]">{lead.phone || 'N/A'}</span></div>
                          <div><span className="text-[var(--oracle-text-muted)]">Email:</span> <span className="text-[var(--oracle-text-2)]">{lead.email || 'N/A'}</span></div>
                          <div><span className="text-[var(--oracle-text-muted)]">Website:</span> <span className="text-[var(--oracle-text-2)]">{lead.website || 'None'}</span></div>
                          <div><span className="text-[var(--oracle-text-muted)]">Address:</span> <span className="text-[var(--oracle-text-2)]">{lead.address}</span></div>
                        </div>

                        {/* Notes */}
                        {lead.notes && (
                          <div className="rounded-xl bg-[var(--oracle-surface-2)] p-3">
                            <h4 className="mb-1 text-[11px] font-semibold text-[var(--oracle-text-muted)]">Notes</h4>
                            <p className="text-[12px] text-[var(--oracle-text-2)]">{lead.notes}</p>
                          </div>
                        )}

                        {/* Personalised Message */}
                        {lead.personalisedMessage && (
                          <div className="rounded-xl bg-[var(--oracle-primary)]/5 border border-[var(--oracle-primary)]/20 p-3">
                            <h4 className="mb-1 text-[11px] font-semibold text-[var(--oracle-primary-l)]">Personalised Message</h4>
                            <p className="text-[12px] text-[var(--oracle-text-2)]">{lead.personalisedMessage}</p>
                            <button onClick={() => copyToClipboard(lead.personalisedMessage || '').then((ok) => ok ? toast.success('📋 Message copied', TOAST_DEFAULTS) : toast.error('❌ Clipboard access denied', TOAST_DEFAULTS))} className="mt-2 text-[10px] text-[var(--oracle-primary-l)] underline">📋 Copy message</button>
                          </div>
                        )}

                        {/* Status Update */}
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-[var(--oracle-text-muted)]">Update status:</span>
                          {(['New', 'Contacted', 'Responded', 'Hot', 'Warm', 'Cold', 'Converted', 'Lost'] as const).map((s) => (
                            <button key={s} onClick={() => onUpdateStatus(lead.id, s)} className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-all ${lead.status === s ? 'ring-1' : 'hover:opacity-80'}`} style={{ backgroundColor: `${STATUS_COLORS[s]}20`, color: STATUS_COLORS[s] }}>
                              {STATUS_EMOJIS[s]} {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {leads.length === 0 && (
        <div className="py-12 text-center text-[var(--oracle-text-muted)]">
          <p className="text-[40px]">🎯</p>
          <p className="mt-2 text-[14px]">No leads found. Try adjusting your filters or add a new lead.</p>
        </div>
      )}
    </>
  );
}

// ─── Lead Workflows ───────────────────

function LeadWorkflows({ onAskOracle }: { onAskOracle?: (prompt: string) => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {LEAD_WORKFLOWS.map((wf) => (
        <motion.div key={wf.id} variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} {...cardHoverProps}>
          <div className="oracle-glass rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${wf.color}20` }}>
                <span className="text-lg">{wf.emoji}</span>
              </div>
              <div className="flex-1">
                <h3 className="text-[15px] font-bold text-[var(--oracle-text-1)]">{wf.name}</h3>
                <p className="mt-0.5 text-[12px] text-[var(--oracle-text-3)]">{wf.description}</p>
              </div>
              <span className="text-[11px] text-[var(--oracle-text-muted)]">⏱ {wf.estimatedTime}</span>
            </div>

            {/* Criteria */}
            <div className="mt-3">
              <button onClick={() => setExpandedId(expandedId === wf.id ? null : wf.id)} className="text-[11px] text-[var(--oracle-primary-l)] underline">
                {expandedId === wf.id ? 'Hide criteria' : `View ${wf.criteria.length} qualification criteria`}
              </button>
              <AnimatePresence>
                {expandedId === wf.id && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="mt-2 space-y-1">
                      {wf.criteria.map((c, i) => (
                        <div key={i} className="flex items-start gap-2 text-[11px] text-[var(--oracle-text-2)]">
                          <span className="mt-0.5 text-[var(--oracle-success)]">✓</span>
                          <span>{c}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Actions */}
            <div className="mt-3 flex items-center gap-2">
              <motion.button
                {...buttonTapProps}
                onClick={() => onAskOracle?.(`Run lead generation workflow: ${wf.name}. Generate a personalised prompt to find leads using this method. Include specific search queries and qualification criteria.`)}
                className="flex items-center gap-1.5 rounded-lg oracle-gradient-bg px-3 py-1.5 text-[12px] font-semibold text-white transition-all"
              >
                ⚡ Run Workflow
              </motion.button>
              <motion.button
                {...buttonTapProps}
                onClick={() => onAskOracle?.(`Generate a personalised outreach message template for ${wf.name} leads. Make it sound human, not salesy. Write in natural Hinglish.`)}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--oracle-border)] px-3 py-1.5 text-[12px] font-medium text-[var(--oracle-text-3)] transition-colors hover:border-[var(--oracle-border-strong)]"
              >
                ✍️ Generate Template
              </motion.button>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Follow-Up Manager ────────────────

function FollowUpManager({ leads, onAskOracle }: { leads: Lead[]; onAskOracle?: (prompt: string) => void }) {
  const followUpLeads = useMemo(() => {
    return leads
      .filter((l) => l.followUpDate || l.status === 'Hot' || l.status === 'Warm')
      .sort((a, b) => {
        const dateA = a.followUpDate ? new Date(a.followUpDate).getTime() : a.updatedAt;
        const dateB = b.followUpDate ? new Date(b.followUpDate).getTime() : b.updatedAt;
        return dateA - dateB;
      });
  }, [leads]);

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-3">
      {followUpLeads.length === 0 ? (
        <div className="py-12 text-center text-[var(--oracle-text-muted)]">
          <p className="text-[40px]">📅</p>
          <p className="mt-2 text-[14px]">No follow-ups scheduled. Mark leads as Hot or Warm to track follow-ups.</p>
        </div>
      ) : (
        followUpLeads.map((lead) => {
          const isOverdue = lead.followUpDate && lead.followUpDate < today;
          const isToday = lead.followUpDate === today;
          return (
            <motion.div key={lead.id} variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
              <div className={`oracle-glass rounded-xl p-4 ${isOverdue ? 'border border-[var(--oracle-error)]/30' : isToday ? 'border border-[var(--oracle-warning)]/30' : ''}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-[14px] font-bold text-[var(--oracle-text-1)]">{lead.businessName}</h3>
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: `${STATUS_COLORS[lead.status]}20`, color: STATUS_COLORS[lead.status] }}>
                        {lead.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[12px] text-[var(--oracle-text-3)]">{lead.city} · {lead.category}</p>
                  </div>
                  <div className="text-right">
                    {lead.followUpDate && (
                      <p className={`text-[12px] font-medium ${isOverdue ? 'text-[var(--oracle-error)]' : isToday ? 'text-[var(--oracle-warning)]' : 'text-[var(--oracle-text-3)]'}`}>
                        {isOverdue ? `⚠ Overdue since ${lead.followUpDate}` : isToday ? '📅 Due today' : `📅 ${lead.followUpDate}`}
                      </p>
                    )}
                    {lead.channel && <p className="text-[11px] text-[var(--oracle-text-muted)]">via {lead.channel}</p>}
                  </div>
                </div>
                {lead.personalisedMessage && (
                  <p className="mt-2 text-[11px] text-[var(--oracle-text-muted)] line-clamp-2">{lead.personalisedMessage}</p>
                )}
                <div className="mt-2 flex gap-2">
                  <motion.button {...buttonTapProps} onClick={() => onAskOracle?.(`Write a follow-up message for ${lead.businessName}. They are ${lead.status}. Previous contact was via ${lead.channel || 'unknown'}. Make it helpful, not salesy.`)} className="rounded-lg bg-[var(--oracle-success)]/10 px-3 py-1.5 text-[11px] font-medium text-[var(--oracle-success)] hover:bg-[var(--oracle-success)]/20 transition-colors">
                    ✍️ Write Follow-up
                  </motion.button>
                  {lead.phone && (
                    <a href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-[var(--oracle-success)]/10 px-3 py-1.5 text-[11px] font-medium text-[var(--oracle-success)] hover:bg-[var(--oracle-success)]/20 transition-colors">
                      💬 WhatsApp
                    </a>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })
      )}
    </div>
  );
}

// ─── Add Lead Modal ───────────────────

function AddLeadModal({ onClose, onSave }: { onClose: () => void; onSave: (lead: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>) => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [category, setCategory] = useState('');
  const [industry, setIndustry] = useState('');
  const [source, setSource] = useState<Lead['source']>('Manual');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const handleSave = () => {
    if (!name.trim()) { setError('Business name is required.'); return; }
    onSave({
      businessName: name.trim(),
      phone, email, website,
      googleMapsUrl: '',
      rating: 0, reviewCount: 0,
      address: address.trim(), city, category, industry,
      triggerCriterion: 'Manual entry',
      status: 'New',
      source,
      notes,
    });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="oracle-glass oracle-card-shadow w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-[17px] font-bold text-[var(--oracle-text-1)]">+ Add New Lead</h3>
        {error && <p className="mb-3 rounded-lg bg-[var(--oracle-error)]/10 px-3 py-2 text-[12px] text-[var(--oracle-error)]">{error}</p>}
        <div className="space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Business Name *" className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[13px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)]" />
          <div className="flex gap-3">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" className="flex-1 rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[13px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none" />
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="flex-1 rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[13px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none" />
          </div>
          <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="Website (if any)" className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[13px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none" />
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address" className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[13px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none" />
          <div className="flex gap-3">
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className="flex-1 rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[13px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none" />
            <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" className="flex-1 rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[13px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none" />
          </div>
          <div className="flex gap-3">
            <input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Industry" className="flex-1 rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[13px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none" />
            <select value={source} onChange={(e) => setSource(e.target.value as Lead['source'])} className="flex-1 rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[12px] text-[var(--oracle-text-2)] outline-none">
              {['Google Maps', 'Website Audit', 'Funded Startup', 'Social Listening', 'Job Listing', 'Manual'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes..." rows={3} className="w-full resize-none rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[12px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none" />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <motion.button {...buttonTapProps} onClick={onClose} className="rounded-lg px-4 py-2 text-[13px] text-[var(--oracle-text-3)] hover:bg-[var(--oracle-card-hover)]">Cancel</motion.button>
          <motion.button {...buttonTapProps} onClick={handleSave} className="rounded-lg oracle-gradient-bg px-4 py-2 text-[13px] font-semibold text-white">Add Lead</motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
