'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { motionVariants, transitions, buttonTapProps, cardHoverProps } from '@/styles/design-tokens';
import toast from 'react-hot-toast';
import { TOAST_DEFAULTS } from '@/lib/toast-config';

// ─── AEO/GEO Types ────────────────────

interface AEOAudit {
  id: string;
  brandName: string;
  domain: string;
  industry: string;
  chatgptMentioned: boolean;
  chatgptSentiment: 'Positive' | 'Neutral' | 'Negative' | 'Not Found';
  perplexityMentioned: boolean;
  perplexitySentiment: 'Positive' | 'Neutral' | 'Negative' | 'Not Found';
  geminiMentioned: boolean;
  geminiSentiment: 'Positive' | 'Neutral' | 'Negative' | 'Not Found';
  overallScore: number;
  recommendations: string[];
  createdAt: number;
}

interface GEOStrategy {
  id: string;
  name: string;
  description: string;
  platform: 'ChatGPT' | 'Perplexity' | 'Gemini' | 'All';
  tactics: string[];
  expectedImpact: 'High' | 'Medium' | 'Low';
  effort: 'Low' | 'Medium' | 'High';
  timeline: string;
  status: 'Planned' | 'In Progress' | 'Completed';
}

// ─── Default GEO Strategies ───────────

const DEFAULT_STRATEGIES: GEOStrategy[] = [
  {
    id: 'strat-1',
    name: 'Structured Data Markup',
    description: 'Add Schema.org JSON-LD markup to client website for better AI citation',
    platform: 'All',
    tactics: ['Add FAQ schema', 'Add Organization schema', 'Add LocalBusiness schema', 'Add Review/Rating schema'],
    expectedImpact: 'High',
    effort: 'Low',
    timeline: '1-2 days',
    status: 'Planned',
  },
  {
    id: 'strat-2',
    name: 'Citation-Worthy Content',
    description: 'Create authoritative content that AI models will cite as a source',
    platform: 'All',
    tactics: ['Original research & data', 'Expert quotes & interviews', 'Industry benchmarks', 'Tool comparisons'],
    expectedImpact: 'High',
    effort: 'High',
    timeline: '2-4 weeks',
    status: 'Planned',
  },
  {
    id: 'strat-3',
    name: 'Perplexity Citations',
    description: 'Optimise content to be cited in Perplexity AI answers',
    platform: 'Perplexity',
    tactics: ['Write definitive guides', 'Use clear headings & structure', 'Include data tables', 'Cite credible sources'],
    expectedImpact: 'Medium',
    effort: 'Medium',
    timeline: '1-2 weeks',
    status: 'Planned',
  },
  {
    id: 'strat-4',
    name: 'ChatGPT Plugin/GPT Listing',
    description: 'Create a GPT or Plugin for client brand visibility in ChatGPT',
    platform: 'ChatGPT',
    tactics: ['Build custom GPT', 'Brand-specific knowledge base', 'Promote GPT listing', 'Monitor usage analytics'],
    expectedImpact: 'High',
    effort: 'Medium',
    timeline: '1-2 weeks',
    status: 'Planned',
  },
  {
    id: 'strat-5',
    name: 'NotebookLM Content',
    description: 'Create NotebookLM notebooks for client expertise positioning',
    platform: 'Gemini',
    tactics: ['Upload client content', 'Create podcast from content', 'Share publicly', 'Monitor citations'],
    expectedImpact: 'Medium',
    effort: 'Low',
    timeline: '2-3 days',
    status: 'Planned',
  },
  {
    id: 'strat-6',
    name: 'Topical Authority Building',
    description: 'Become the only source AI cites for specific topics in client domain',
    platform: 'All',
    tactics: ['Deep-dive content clusters', 'Original research publishing', 'Expert network building', 'Consistent posting cadence'],
    expectedImpact: 'High',
    effort: 'High',
    timeline: '3-6 months',
    status: 'Planned',
  },
  {
    id: 'strat-7',
    name: 'AI-Friendly Content Structure',
    description: 'Restructure existing content for optimal AI readability and citation',
    platform: 'All',
    tactics: ['Add clear definitions', 'Use bullet points & lists', 'Include comparison tables', 'Write concise summaries'],
    expectedImpact: 'Medium',
    effort: 'Low',
    timeline: '1 week',
    status: 'Planned',
  },
];

const SENTIMENT_COLORS: Record<string, string> = {
  Positive: 'var(--oracle-success)',
  Neutral: 'var(--oracle-info)',
  Negative: 'var(--oracle-error)',
  'Not Found': 'var(--oracle-text-muted)',
};

const IMPACT_COLORS: Record<string, string> = {
  High: 'var(--oracle-success)',
  Medium: 'var(--oracle-warning)',
  Low: 'var(--oracle-text-muted)',
};

// ─── AEO/GEO Tab ──────────────────────

export function AeoGeoTab({ onAskOracle }: { onAskOracle?: (prompt: string) => void }) {
  const [activeView, setActiveView] = useState<'audit' | 'strategies' | 'checker'>('audit');
  const [audits, setAudits] = useState<AEOAudit[]>([]);
  const [strategies, setStrategies] = useState<GEOStrategy[]>(DEFAULT_STRATEGIES);
  const [showAuditForm, setShowAuditForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const stats = {
    auditsRun: audits.length,
    avgScore: audits.length > 0 ? Math.round(audits.reduce((s, a) => s + a.overallScore, 0) / audits.length) : 0,
    strategiesPlanned: strategies.filter((s) => s.status === 'Planned').length,
    strategiesCompleted: strategies.filter((s) => s.status === 'Completed').length,
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-6xl">
          {/* Header */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-[22px] font-bold text-[var(--oracle-text-1)]">🤖 AEO / GEO Optimisation</h1>
              <p className="mt-1 text-[13px] text-[var(--oracle-text-3)]">Optimise for AI chatbot citations — the future of search (2026)</p>
            </div>
            <motion.button {...buttonTapProps} onClick={() => setShowAuditForm(true)} className="rounded-xl oracle-gradient-bg px-4 py-2 text-[13px] font-semibold text-white transition-all">
              + New AI Audit
            </motion.button>
          </motion.div>

          {/* View Tabs */}
          <div className="mb-4 flex gap-2">
            {[
              { id: 'audit' as const, label: '🔍 AI Visibility Audit' },
              { id: 'strategies' as const, label: '📋 GEO Strategies' },
              { id: 'checker' as const, label: '💡 AI Readiness Checker' },
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
              { label: 'Audits Run', value: stats.auditsRun, icon: '🔍', color: 'var(--oracle-primary-l)' },
              { label: 'Avg AI Score', value: `${stats.avgScore}/100`, icon: '📊', color: stats.avgScore >= 70 ? 'var(--oracle-success)' : 'var(--oracle-warning)' },
              { label: 'Strategies Planned', value: stats.strategiesPlanned, icon: '📋', color: 'var(--oracle-info)' },
              { label: 'Completed', value: stats.strategiesCompleted, icon: '✅', color: 'var(--oracle-success)' },
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
          {activeView === 'audit' && (
            <AEOAuditView
              audits={audits}
              expandedId={expandedId}
              onToggleExpand={(id) => setExpandedId(expandedId === id ? null : id)}
              onAddAudit={(audit) => setAudits((prev) => [audit, ...prev])}
              showForm={showAuditForm}
              onShowForm={setShowAuditForm}
              onAskOracle={onAskOracle}
            />
          )}

          {activeView === 'strategies' && (
            <GEOStrategiesView
              strategies={strategies}
              expandedId={expandedId}
              onToggleExpand={(id) => setExpandedId(expandedId === id ? null : id)}
              onUpdateStrategy={(id, updates) =>
                setStrategies((prev) => prev.map((s) => s.id === id ? { ...s, ...updates } : s))
              }
              onAskOracle={onAskOracle}
            />
          )}

          {activeView === 'checker' && (
            <AIReadinessChecker />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── AEO Audit View ───────────────────

function AEOAuditView({ audits, expandedId, onToggleExpand, onAddAudit, showForm, onShowForm, onAskOracle }: {
  audits: AEOAudit[];
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
  onAddAudit: (audit: AEOAudit) => void;
  showForm: boolean;
  onShowForm: (show: boolean) => void;
  onAskOracle?: (prompt: string) => void;
}) {
  return (
    <div className="space-y-4">
      {audits.length === 0 ? (
        <div className="oracle-glass rounded-2xl p-8 text-center">
          <p className="text-[40px] mb-3">🤖</p>
          <h3 className="text-[16px] font-bold text-[var(--oracle-text-1)] mb-2">No AI Visibility Audits Yet</h3>
          <p className="text-[13px] text-[var(--oracle-text-3)] max-w-md mx-auto">
            Run an audit to check if ChatGPT, Perplexity, and Gemini mention your client&apos;s brand.
            This is the new SEO — being cited by AI models.
          </p>
          <motion.button {...buttonTapProps} onClick={() => onShowForm(true)} className="mt-4 rounded-xl oracle-gradient-bg px-4 py-2 text-[13px] font-semibold text-white">
            🔍 Run First Audit
          </motion.button>
        </div>
      ) : (
        <div className="space-y-3">
          {audits.map((audit) => (
            <motion.div key={audit.id} variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} {...cardHoverProps}>
              <div className={`oracle-glass rounded-2xl p-4 transition-all ${expandedId === audit.id ? 'ring-1 ring-[var(--oracle-primary)]/30' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 cursor-pointer" onClick={() => onToggleExpand(audit.id)}>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[15px] font-bold text-[var(--oracle-text-1)]">{audit.brandName}</h3>
                      <span className="text-[11px] text-[var(--oracle-text-muted)]">{audit.domain}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-4">
                      {[
                        { label: 'ChatGPT', mentioned: audit.chatgptMentioned, sentiment: audit.chatgptSentiment },
                        { label: 'Perplexity', mentioned: audit.perplexityMentioned, sentiment: audit.perplexitySentiment },
                        { label: 'Gemini', mentioned: audit.geminiMentioned, sentiment: audit.geminiSentiment },
                      ].map((ai) => (
                        <div key={ai.label} className="flex items-center gap-1.5">
                          <span className="text-[11px] text-[var(--oracle-text-muted)]">{ai.label}:</span>
                          {ai.mentioned ? (
                            <span className="text-[10px] font-semibold" style={{ color: SENTIMENT_COLORS[ai.sentiment] }}>✓ {ai.sentiment}</span>
                          ) : (
                            <span className="text-[10px] text-[var(--oracle-error)]">✗ Not Found</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[20px] font-bold" style={{ color: audit.overallScore >= 70 ? 'var(--oracle-success)' : audit.overallScore >= 40 ? 'var(--oracle-warning)' : 'var(--oracle-error)' }}>
                      {audit.overallScore}/100
                    </div>
                    <p className="text-[10px] text-[var(--oracle-text-muted)]">AI Score</p>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedId === audit.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={transitions.smooth} className="overflow-hidden">
                      <div className="mt-4 space-y-3 border-t border-[var(--oracle-border)] pt-4">
                        <h4 className="text-[12px] font-semibold text-[var(--oracle-text-1)]">💡 Recommendations</h4>
                        <div className="space-y-1.5">
                          {audit.recommendations.map((rec, i) => (
                            <div key={i} className="flex items-start gap-2 rounded-lg bg-[var(--oracle-surface-2)] px-3 py-2 text-[12px] text-[var(--oracle-text-2)]">
                              <span className="mt-0.5 text-[var(--oracle-primary-l)]">→</span>
                              {rec}
                            </div>
                          ))}
                        </div>
                        <motion.button {...buttonTapProps} onClick={() => onAskOracle?.(`Based on the AEO audit for ${audit.brandName}, create a detailed 30-day action plan to improve AI visibility across ChatGPT, Perplexity, and Gemini. Include specific content, technical, and PR tactics.`)} className="rounded-lg oracle-gradient-bg px-3 py-1.5 text-[11px] font-semibold text-white">
                          ⚡ Generate Action Plan
                        </motion.button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {showForm && (
        <AuditForm
          onSave={(audit) => { onAddAudit(audit); onShowForm(false); }}
          onClose={() => onShowForm(false)}
        />
      )}
    </div>
  );
}

function AuditForm({ onSave, onClose }: { onSave: (audit: AEOAudit) => void; onClose: () => void }) {
  const [brandName, setBrandName] = useState('');
  const [domain, setDomain] = useState('');
  const [industry, setIndustry] = useState('');
  const [error, setError] = useState('');

  // Deterministic scoring based on domain/brand characteristics
  const computeAuditScore = (bName: string, dName: string, ind: string): { score: number; chatgpt: boolean; chatgptSent: AEOAudit['chatgptSentiment']; perplexity: boolean; perplexitySent: AEOAudit['perplexitySentiment']; gemini: boolean; geminiSent: AEOAudit['geminiSentiment']; recs: string[] } => {
    // Simple hash for deterministic results
    const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; } return Math.abs(h); };
    const seed = hash(bName + dName);
    const base = (seed % 35) + 25; // 25-60 base score
    const hasSchema = dName.includes('.') && !dName.endsWith('.in');
    const brandLen = bName.length > 6;
    const indBonus = ind.toLowerCase().includes('tech') || ind.toLowerCase().includes('digital') ? 15 : ind.trim() ? 8 : 0;
    const score = Math.min(base + indBonus + (brandLen ? 5 : 0) + (hasSchema ? 10 : 0), 95);
    const sentiment = (s: number): AEOAudit['chatgptSentiment'] => s >= 70 ? 'Positive' : s >= 40 ? 'Neutral' : 'Not Found';
    const chatgptScore = score + ((seed >> 4) % 20) - 10;
    const perpScore = score + ((seed >> 8) % 20) - 15;
    const gemScore = score + ((seed >> 12) % 20) - 12;
    const recs = [
      `Add Schema.org structured data to ${dName} for better AI citation`,
      `Create authoritative content clusters around key ${ind || 'industry'} topics`,
      `Build backlinks from high-authority ${ind || 'industry'} publications`,
      `Add FAQ sections targeting common AI-searched questions`,
      `Create a brand-specific knowledge base for AI model training`,
      `Publish original research or data that AI models will reference`,
    ];
    return {
      score,
      chatgpt: chatgptScore >= 35, chatgptSent: sentiment(chatgptScore),
      perplexity: perpScore >= 40, perplexitySent: sentiment(perpScore),
      gemini: gemScore >= 38, geminiSent: sentiment(gemScore),
      recs,
    };
  };

  const handleSave = () => {
    if (!brandName.trim() || !domain.trim()) { setError('Brand name and domain are required.'); return; }
    const audit = computeAuditScore(brandName.trim(), domain.trim(), industry.trim());
    onSave({
      id: crypto.randomUUID(), brandName: brandName.trim(), domain: domain.trim(), industry: industry.trim() || 'Digital Agency',
      chatgptMentioned: audit.chatgpt, chatgptSentiment: audit.chatgptSent,
      perplexityMentioned: audit.perplexity, perplexitySentiment: audit.perplexitySent,
      geminiMentioned: audit.gemini, geminiSentiment: audit.geminiSent,
      overallScore: audit.score, recommendations: audit.recs, createdAt: Date.now(),
    });
    toast.success('✅ AEO audit created', TOAST_DEFAULTS);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="oracle-glass oracle-card-shadow w-full max-w-lg rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-[17px] font-bold text-[var(--oracle-text-1)]">🔍 AI Visibility Audit</h3>
        {error && <p className="mb-3 rounded-lg bg-[var(--oracle-error)]/10 px-3 py-2 text-[12px] text-[var(--oracle-error)]">{error}</p>}
        <div className="space-y-3">
          <input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Brand / Business Name *" className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[13px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)]" />
          <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="Website Domain (e.g. example.com) *" className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[13px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)]" />
          <input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Industry (e.g. Healthcare, Real Estate)" className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[13px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)]" />
          <p className="text-[11px] text-[var(--oracle-text-muted)]">This will generate a simulated audit. For real-time checks, use Perplexity to search &quot;{brandName}&quot; and note the results.</p>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <motion.button {...buttonTapProps} onClick={onClose} className="rounded-lg px-4 py-2 text-[13px] text-[var(--oracle-text-3)] hover:bg-[var(--oracle-card-hover)]">Cancel</motion.button>
          <motion.button {...buttonTapProps} onClick={handleSave} className="rounded-lg oracle-gradient-bg px-4 py-2 text-[13px] font-semibold text-white">Run Audit</motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── GEO Strategies View ──────────────

function GEOStrategiesView({ strategies, expandedId, onToggleExpand, onUpdateStrategy, onAskOracle }: {
  strategies: GEOStrategy[];
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
  onUpdateStrategy: (id: string, updates: Partial<GEOStrategy>) => void;
  onAskOracle?: (prompt: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="oracle-glass rounded-2xl p-5">
        <h3 className="mb-3 text-[15px] font-bold text-[var(--oracle-text-1)]">📋 GEO Optimization Strategies</h3>
        <p className="mb-4 text-[12px] text-[var(--oracle-text-3)]">Strategies to get your clients cited by AI models like ChatGPT, Perplexity, and Gemini.</p>

        <div className="space-y-2">
          {strategies.map((strat) => (
            <motion.div key={strat.id} {...cardHoverProps}>
              <div className={`rounded-xl border border-[var(--oracle-border)] p-3 transition-all ${expandedId === strat.id ? 'ring-1 ring-[var(--oracle-primary)]/30 bg-[var(--oracle-surface-2)]' : 'hover:border-[var(--oracle-border-strong)]'}`}>
                <div className="flex items-start justify-between cursor-pointer" onClick={() => onToggleExpand(strat.id)}>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-semibold text-[var(--oracle-text-1)]">{strat.name}</span>
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: `${IMPACT_COLORS[strat.expectedImpact]}20`, color: IMPACT_COLORS[strat.expectedImpact] }}>{strat.expectedImpact} Impact</span>
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[var(--oracle-surface-2)] text-[var(--oracle-text-muted)]">{strat.platform}</span>
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: `${strat.status === 'Completed' ? 'var(--oracle-success)' : strat.status === 'In Progress' ? 'var(--oracle-info)' : 'var(--oracle-text-muted)'}20`, color: strat.status === 'Completed' ? 'var(--oracle-success)' : strat.status === 'In Progress' ? 'var(--oracle-info)' : 'var(--oracle-text-muted)' }}>{strat.status}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-[var(--oracle-text-3)]">{strat.description}</p>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedId === strat.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={transitions.smooth} className="overflow-hidden">
                      <div className="mt-3 space-y-3 border-t border-[var(--oracle-border)] pt-3">
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div><span className="text-[var(--oracle-text-muted)]">Effort:</span> <span className="text-[var(--oracle-text-2)]">{strat.effort}</span></div>
                          <div><span className="text-[var(--oracle-text-muted)]">Timeline:</span> <span className="text-[var(--oracle-text-2)]">{strat.timeline}</span></div>
                        </div>
                        <div>
                          <span className="text-[11px] font-medium text-[var(--oracle-text-muted)]">Key Tactics:</span>
                          <div className="mt-1 space-y-1">
                            {strat.tactics.map((tactic, i) => (
                              <div key={i} className="flex items-center gap-2 text-[11px] text-[var(--oracle-text-2)]">
                                <span className="text-[var(--oracle-primary-l)]">•</span>
                                {tactic}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-[var(--oracle-text-muted)]">Status:</span>
                          {(['Planned', 'In Progress', 'Completed'] as const).map((s) => (
                            <button key={s} onClick={() => onUpdateStrategy(strat.id, { status: s })} className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-all ${strat.status === s ? 'ring-1' : 'hover:opacity-80'}`} style={{ backgroundColor: `${s === 'Completed' ? 'var(--oracle-success)' : s === 'In Progress' ? 'var(--oracle-info)' : 'var(--oracle-text-muted)'}20`, color: s === 'Completed' ? 'var(--oracle-success)' : s === 'In Progress' ? 'var(--oracle-info)' : 'var(--oracle-text-muted)' }}>
                              {s}
                            </button>
                          ))}
                        </div>
                        <motion.button {...buttonTapProps} onClick={() => onAskOracle?.(`Expand the GEO strategy "${strat.name}" into a detailed implementation plan with specific tasks, timelines, and content templates. Focus on Indian market.`)} className="rounded-lg oracle-gradient-bg px-3 py-1.5 text-[11px] font-semibold text-white">
                          ⚡ Expand Strategy
                        </motion.button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── AI Readiness Checker ─────────────

function AIReadinessChecker() {
  const [checks] = useState([
    { category: 'Structured Data', items: [
      { name: 'Schema.org JSON-LD markup', score: 0, description: 'Add structured data for products, services, FAQs, and reviews' },
      { name: 'Open Graph meta tags', score: 0, description: 'Add og:title, og:description, og:image for better AI parsing' },
      { name: 'Canonical URLs', score: 0, description: 'Ensure canonical tags are present to avoid duplicate content' },
    ]},
    { category: 'Content Quality', items: [
      { name: 'Authoritative content', score: 0, description: 'Content that AI models want to cite as a source' },
      { name: 'Clear definitions & explanations', score: 0, description: 'AI models prefer content with clear, definitional language' },
      { name: 'Data & statistics', score: 0, description: 'Original data, surveys, and benchmarks get cited more' },
      { name: 'FAQ sections', score: 0, description: 'Question-answer format matches how people search with AI' },
    ]},
    { category: 'Technical', items: [
      { name: 'Fast page load speed', score: 0, description: 'AI crawlers prefer fast, accessible pages' },
      { name: 'Mobile responsive', score: 0, description: 'Essential for all content to be parseable by AI' },
      { name: 'Clean HTML structure', score: 0, description: 'Semantic HTML5 with proper heading hierarchy' },
      { name: 'Sitemap.xml present', score: 0, description: 'Helps AI discover all pages' },
    ]},
    { category: 'Brand Authority', items: [
      { name: 'Consistent NAP across web', score: 0, description: 'Name, Address, Phone consistent everywhere' },
      { name: 'Industry expertise content', score: 0, description: 'Content demonstrating deep domain knowledge' },
      { name: 'Expert author bios', score: 0, description: 'Named experts with credentials get more AI citations' },
      { name: 'Backlinks from authoritative sources', score: 0, description: 'Links from trusted sites increase citation likelihood' },
    ]},
  ]);

  return (
    <div className="space-y-4">
      <div className="oracle-glass rounded-2xl p-5">
        <h3 className="mb-3 text-[15px] font-bold text-[var(--oracle-text-1)]">💡 AI Readiness Checklist</h3>
        <p className="mb-4 text-[12px] text-[var(--oracle-text-3)]">Check these items to optimise client websites for AI model citation.</p>

        <div className="space-y-5">
          {checks.map((category) => (
            <div key={category.category}>
              <h4 className="mb-2 text-[13px] font-semibold text-[var(--oracle-text-1)]">{category.category}</h4>
              <div className="space-y-1.5">
                {category.items.map((item) => (
                  <label key={item.name} className="flex items-start gap-3 rounded-xl bg-[var(--oracle-surface-2)] p-3 cursor-pointer hover:bg-[var(--oracle-card-hover)] transition-colors">
                    <input type="checkbox" className="mt-0.5 accent-[var(--oracle-primary)]" />
                    <div className="flex-1">
                      <span className="text-[12px] font-medium text-[var(--oracle-text-2)]">{item.name}</span>
                      <p className="text-[11px] text-[var(--oracle-text-muted)]">{item.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
