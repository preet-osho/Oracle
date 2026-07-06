'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { motionVariants, transitions, buttonTapProps } from '@/styles/design-tokens';
import { AGENCY_DOMAINS } from '@/data/domains';
import toast from 'react-hot-toast';
import { TOAST_DEFAULTS } from '@/lib/toast-config';
import { proposalsApi } from '@/lib/api';
import { ROADMAP_GENERATION_PROMPT } from '@/lib/system-prompt';
import { csrfHeaders } from '@/lib/csrf';
import { exportProposalToPDF, exportProposalToWord } from '@/lib/proposal-pdf';
import { FeatureGate, UpgradePrompt } from './FeatureGate';
import { fetchWithTimeout, TIMEOUT_STREAMING_MS } from '@/lib/fetch-utils';
import { copyToClipboard } from '@/lib/utils';

// ─── Types ────────────────────────────
interface Proposal {
  id: string;
  brief: string;
  domain: string;
  output: string;
  createdAt: number;
}

async function loadProposals(): Promise<Proposal[]> {
  try {
    const rows = await proposalsApi.list();
    return rows.map((r) => ({
      id: r.id,
      brief: r.brief,
      domain: r.domain,
      output: r.output,
      createdAt: r.created_at,
    }));   } catch { toast.error('❌ Failed to load proposals', TOAST_DEFAULTS); return []; }
}

const DOMAIN_LIST = AGENCY_DOMAINS.map((d) => d.name).sort();

// ─── RoadmapTab ───────────────────────
export function RoadmapTab({ onAskOracle }: { onAskOracle?: (prompt: string) => void }) {
  const [brief, setBrief] = useState('');
  const [domain, setDomain] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [output, setOutput] = useState('');
  const [history, setHistory] = useState<Proposal[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => { loadProposals().then(setHistory); }, []);

  const generateProposal = useCallback(async () => {
    if (!brief.trim()) return;
    setIsGenerating(true);
    setOutput('');

    const prompt = ROADMAP_GENERATION_PROMPT
      .replace('{{clientBrief}}', brief)
      .replace('{{domain}}', domain || 'General Digital Agency')
      .replace('{{budget}}', 'Not specified — determine from brief')
      .replace('{{timeline}}', '12 weeks standard');

    try {
      const res = await fetchWithTimeout('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], stream: true }),
        timeoutMs: TIMEOUT_STREAMING_MS,
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'AI request failed' }));
        throw new Error(errorData.error || `AI proxy error (${res.status})`);
      }
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value, { stream: true });
          for (const line of text.split('\n')) {
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') continue;
            try {
              const chunk = JSON.parse(jsonStr);
              if (chunk.chunk) {
                fullText += chunk.chunk;
                setOutput(fullText);
              }
            } catch { /* skip malformed SSE */ }
          }
        }
      }

      const saved = await proposalsApi.create({
        brief: brief.trim(),
        domain: domain || 'General',
        output: fullText,
      });
      const proposal: Proposal = {
        id: saved.id,
        brief: saved.brief,
        domain: saved.domain,
        output: saved.output,
        createdAt: saved.created_at,
      };
      setHistory((prev) => [proposal, ...prev].slice(0, 10));
    } catch (err) {
      setOutput(`Error: ${err instanceof Error ? err.message : 'Failed to generate proposal'}`);
    } finally {
      setIsGenerating(false);
    }
  }, [brief, domain]);

  const copyAll = useCallback(() => { copyToClipboard(output).then((ok) => ok ? toast.success('📋 Copied to clipboard', TOAST_DEFAULTS) : toast.error('❌ Clipboard access denied', TOAST_DEFAULTS)); }, [output]);

  const loadFromHistory = useCallback((p: Proposal) => {
    setBrief(p.brief);
    setDomain(p.domain);
    setOutput(p.output);
    setShowHistory(false);
  }, []);

  return (
    <FeatureGate feature="proposals" fallback={
      <div className="flex h-full flex-col items-center justify-center px-4">
        <UpgradePrompt requiredPlan="pro" feature="Proposals" />
      </div>
    }>
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-4xl">
          {/* Header */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-[22px] font-bold text-[var(--oracle-text-1)]">🎯 Roadmap & Proposals</h1>
              <p className="mt-1 text-[13px] text-[var(--oracle-text-3)]">Generate comprehensive client proposals with AI</p>
            </div>
            <motion.button {...buttonTapProps} onClick={() => setShowHistory(!showHistory)} className="rounded-lg border border-[var(--oracle-border)] px-3 py-1.5 text-[12px] text-[var(--oracle-text-3)] hover:bg-[var(--oracle-card-hover)] transition-colors">
              📋 History ({history.length})
            </motion.button>
          </motion.div>

          {/* Proposal History */}
          <AnimatePresence>
            {showHistory && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mb-4 overflow-hidden">
                <div className="oracle-glass rounded-2xl p-4">
                  <h3 className="mb-3 text-[13px] font-semibold text-[var(--oracle-text-1)]">Recent Proposals</h3>
                  {history.length === 0 ? (
                    <p className="text-[12px] text-[var(--oracle-text-muted)]">No proposals yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {history.map((p) => (
                        <button key={p.id} onClick={() => loadFromHistory(p)} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition-colors hover:bg-[var(--oracle-card-hover)]">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12px] font-medium text-[var(--oracle-text-2)]">{p.brief.substring(0, 80)}...</p>
                            <p className="text-[10px] text-[var(--oracle-text-muted)]">{p.domain} · {new Date(p.createdAt).toLocaleDateString()}</p>
                          </div>
                          <span className="ml-2 text-[var(--oracle-text-muted)]">→</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input Section */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
            <div className="oracle-glass rounded-2xl p-5">
              <textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder={`Paste a client brief here... 

Examples:
• "We're a D2C skincare brand doing 500 orders/month. Need help scaling to 2000 orders with Meta Ads and influencer marketing. Currently spending ₹1.5L/month with 1.8x ROAS."

• "Restaurant chain with 5 outlets in Delhi NCR. 70% orders from Zomato/Swiggy. Want to increase direct orders to 40%."

• "SaaS startup with 200 free users, 15 paid at ₹999/month. Need landing page redesign and content marketing to reach 1000 free users."`}
                rows={6}
                className="w-full resize-none rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-3 text-[13px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)] transition-colors"
              />
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                <select value={domain} onChange={(e) => setDomain(e.target.value)} className="flex-1 rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[12px] text-[var(--oracle-text-2)] outline-none focus:border-[var(--oracle-primary)]">
                  <option value="">Auto-detect domain</option>
                  {DOMAIN_LIST.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <motion.button
                  {...buttonTapProps}
                  onClick={generateProposal}
                  disabled={!brief.trim() || isGenerating}
                  className="flex items-center justify-center gap-2 rounded-xl oracle-gradient-bg px-6 py-2.5 text-[13px] font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isGenerating ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Generating...
                    </>
                  ) : (
                    '🎯 Generate Proposal'
                  )}
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* Output Section */}
          <AnimatePresence>
            {output && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={transitions.smooth} className="mt-6">
                <div className="oracle-glass rounded-2xl p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-[15px] font-bold text-[var(--oracle-text-1)]">Generated Proposal</h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      <motion.button {...buttonTapProps} onClick={copyAll} className="rounded-lg border border-[var(--oracle-border)] px-3 py-1.5 text-[11px] font-medium text-[var(--oracle-text-3)] hover:bg-[var(--oracle-card-hover)] transition-colors">
                        📋 Copy
                      </motion.button>
                      <motion.button {...buttonTapProps} onClick={() => { exportProposalToPDF(output, { domain, title: `Proposal — ${domain || 'Digital Agency'}` }); toast.success('✅ PDF exported', TOAST_DEFAULTS); }} className="rounded-lg border border-[var(--oracle-border)] px-3 py-1.5 text-[11px] font-medium text-[var(--oracle-text-3)] hover:bg-[var(--oracle-card-hover)] transition-colors">
                        📄 PDF
                      </motion.button>
                      <motion.button {...buttonTapProps} onClick={() => { exportProposalToWord(output, { domain, title: `Proposal — ${domain || 'Digital Agency'}` }); toast.success('✅ Word exported', TOAST_DEFAULTS); }} className="rounded-lg border border-[var(--oracle-border)] px-3 py-1.5 text-[11px] font-medium text-[var(--oracle-text-3)] hover:bg-[var(--oracle-card-hover)] transition-colors">
                        📝 Word
                      </motion.button>
                      <motion.button {...buttonTapProps} onClick={() => onAskOracle?.(brief)} className="rounded-lg border border-[var(--oracle-border)] px-3 py-1.5 text-[11px] font-medium text-[var(--oracle-text-3)] hover:bg-[var(--oracle-card-hover)] transition-colors">
                        ⚡ Agent
                      </motion.button>
                    </div>
                  </div>

                  {/* Rendered Output */}
                  <div className="prose prose-sm max-w-none text-[var(--oracle-text-2)]">
                    <ProposalRenderer content={output} />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
    </FeatureGate>
  );
}

// ─── Simple Markdown Renderer ─────────
function ProposalRenderer({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inTable = false;
  let tableRows: string[][] = [];
  let tableHeaders: string[] = [];

  const flushTable = () => {
    if (tableHeaders.length > 0) {
      elements.push(
        <div key={`table-${elements.length}`} className="my-4 overflow-x-auto rounded-xl border border-[var(--oracle-border)]">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-[var(--oracle-surface-2)]">
                {tableHeaders.map((h, i) => (
                  <th key={i} className="px-3 py-2 text-left font-semibold text-[var(--oracle-text-1)]">{h.trim()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, ri) => (
                <tr key={ri} className="border-t border-[var(--oracle-border)]">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 text-[var(--oracle-text-2)]">{cell.trim()}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    inTable = false;
    tableRows = [];
    tableHeaders = [];
  };

  lines.forEach((line, i) => {
    const trimmed = line.trim();

    // Table detection
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      if (!inTable) inTable = true;
      const cells = trimmed.split('|').filter((c) => c.trim() !== '');
      // Skip separator rows
      if (cells.every((c) => /^[\s\-:]+$/.test(c))) return;
      if (tableHeaders.length === 0) {
        tableHeaders = cells;
      } else {
        tableRows.push(cells);
      }
      return;
    } else if (inTable) {
      flushTable();
    }

    // Headers
    if (trimmed.startsWith('### ')) {
      elements.push(<h4 key={i} className="mt-6 mb-2 text-[15px] font-bold text-[var(--oracle-text-1)]">{trimmed.replace(/^###\s*/, '')}</h4>);
    } else if (trimmed.startsWith('## ')) {
      elements.push(<h3 key={i} className="mt-8 mb-3 text-[17px] font-bold text-[var(--oracle-text-1)]">{trimmed.replace(/^##\s*/, '')}</h3>);
    } else if (trimmed.startsWith('# ')) {
      elements.push(<h2 key={i} className="mt-8 mb-3 text-[20px] font-bold text-[var(--oracle-text-1)]">{trimmed.replace(/^#\s*/, '')}</h2>);
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      elements.push(
        <div key={i} className="flex items-start gap-2 py-0.5 text-[13px]">
          <span className="mt-1 text-[var(--oracle-primary-l)]">•</span>
          <span dangerouslySetInnerHTML={{ __html: formatInline(trimmed.replace(/^[\-\*]\s*/, '')) }} />
        </div>
      );
    } else if (/^\d+\.\s/.test(trimmed)) {
      const num = trimmed.match(/^(\d+)\.\s*/)?.[1] || '';
      const text = trimmed.replace(/^\d+\.\s*/, '');
      elements.push(
        <div key={i} className="flex items-start gap-2 py-0.5 text-[13px]">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--oracle-primary)]/10 text-[10px] font-bold text-[var(--oracle-primary-l)]">{num}</span>
          <span dangerouslySetInnerHTML={{ __html: formatInline(text) }} />
        </div>
      );
    } else if (trimmed === '---' || trimmed === '***') {
      elements.push(<hr key={i} className="my-4 border-[var(--oracle-border)]" />);
    } else if (trimmed === '') {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(<p key={i} className="py-1 text-[13px] leading-relaxed" dangerouslySetInnerHTML={{ __html: formatInline(trimmed) }} />);
    }
  });

  if (inTable) flushTable();

  return <>{elements}</>;
}

function formatInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-[var(--oracle-text-1)]">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="rounded bg-[var(--oracle-surface-2)] px-1 py-0.5 text-[11px] font-mono text-[var(--oracle-primary-l)]">$1</code>');
}
