'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TEST_CASES } from '@/data/test-cases';
import { motionVariants, transitions, cardHoverProps, buttonTapProps } from '@/styles/design-tokens';

// ─── Industry Emoji Map ───────────────
const INDUSTRY_EMOJI: Record<string, string> = {
  'D2C / Beauty': '🧴',
  'SaaS / Productivity': '💻',
  'Hospitality / F&B': '🍽️',
  'Manufacturing / B2B': '🏭',
  'Education / EdTech': '📚',
  'Healthcare / Dental': '🦷',
  'Real Estate / PropTech': '🏠',
};

// ─── TestCasesTab ─────────────────────
export function TestCasesTab({ onAskQuestion }: { onAskQuestion?: (q: string) => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-6xl">
          {/* Header */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} className="mb-6">
            <h1 className="text-[22px] font-bold text-[var(--oracle-text-1)]">🧪 Test Cases</h1>
            <p className="mt-1 text-[13px] text-[var(--oracle-text-3)]">8 real client scenarios to test ORACLE&apos;s capabilities across industries</p>
          </motion.div>

          {/* Card Grid */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {TEST_CASES.map((tc) => (
              <motion.div
                key={tc.id}
                layout
                variants={motionVariants.fadeUp}
                initial="initial"
                animate="animate"
                transition={transitions.smooth}
                {...cardHoverProps}
              >
                <div
                  onClick={() => setExpandedId(expandedId === tc.id ? null : tc.id)}
                  className={`oracle-glass cursor-pointer rounded-2xl p-4 transition-all duration-200 hover:border-[var(--oracle-border-strong)] ${expandedId === tc.id ? 'ring-1 ring-[var(--oracle-primary)]/30 md:col-span-2 lg:col-span-4' : ''}`}
                >
                  {/* Collapsed Card */}
                  <div className="flex items-start gap-3">
                    <span className="text-3xl">{INDUSTRY_EMOJI[tc.industry] || '🏢'}</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[15px] font-bold text-[var(--oracle-text-1)]">{tc.clientName}</h3>
                      <p className="mt-0.5 text-[12px] text-[var(--oracle-text-3)]">{tc.city}</p>
                      <span className="mt-2 inline-block rounded-full bg-[var(--oracle-surface-2)] px-2 py-0.5 text-[10px] font-medium text-[var(--oracle-text-muted)]">
                        {tc.industry}
                      </span>
                    </div>
                    <span className="text-[var(--oracle-text-muted)] text-[12px]">{expandedId === tc.id ? '▲' : '▼'}</span>
                  </div>

                  {/* Expanded Detail */}
                  <AnimatePresence>
                    {expandedId === tc.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={transitions.smooth}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 space-y-4 border-t border-[var(--oracle-border)] pt-4">
                          {/* Brief */}
                          <div>
                            <h4 className="mb-1 text-[13px] font-semibold text-[var(--oracle-text-1)]">Client Brief</h4>
                            <p className="text-[13px] leading-relaxed text-[var(--oracle-text-2)]">{tc.brief}</p>
                          </div>

                          {/* Requirements */}
                          <div>
                            <h4 className="mb-2 text-[13px] font-semibold text-[var(--oracle-text-1)]">Requirements</h4>
                            <div className="space-y-1.5">
                              {tc.requirements.map((req, i) => (
                                <label key={i} className="flex items-start gap-2 text-[12px] text-[var(--oracle-text-2)] cursor-pointer">
                                  <input type="checkbox" className="mt-0.5 accent-[var(--oracle-primary)]" readOnly />
                                  {req}
                                </label>
                              ))}
                            </div>
                          </div>

                          {/* Contact */}
                          <div className="rounded-xl bg-[var(--oracle-surface-2)] p-3">
                            <h4 className="mb-1 text-[12px] font-semibold text-[var(--oracle-text-1)]">Contact</h4>
                            <p className="text-[12px] text-[var(--oracle-text-3)]">
                              {tc.contact.name} · {tc.contact.designation} · {tc.contact.email} · {tc.contact.phone}
                            </p>
                          </div>

                          {/* Test Questions */}
                          <div>
                            <h4 className="mb-2 text-[13px] font-semibold text-[var(--oracle-text-1)]">Test Questions</h4>
                            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                              {tc.testQuestions.map((q, i) => (
                                <motion.button
                                  key={i}
                                  {...buttonTapProps}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onAskQuestion?.(q);
                                  }}
                                  className="flex items-start gap-2 rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-card)] p-3 text-left text-[12px] text-[var(--oracle-text-2)] transition-all hover:border-[var(--oracle-primary)]/50 hover:bg-[var(--oracle-card-hover)]"
                                >
                                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full oracle-gradient-bg text-[10px] font-bold text-white">
                                    {i + 1}
                                  </span>
                                  <span>{q}</span>
                                </motion.button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Comparison Table */}
          <div className="mt-8">
            <h2 className="mb-4 text-[17px] font-bold text-[var(--oracle-text-1)]">📊 Quick Comparison</h2>
            <div className="oracle-glass rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-[var(--oracle-border)] bg-[var(--oracle-surface-2)]">
                      <th className="px-4 py-3 text-left font-semibold text-[var(--oracle-text-1)]">Client</th>
                      <th className="px-4 py-3 text-left font-semibold text-[var(--oracle-text-1)]">Industry</th>
                      <th className="px-4 py-3 text-left font-semibold text-[var(--oracle-text-1)]">City</th>
                      <th className="px-4 py-3 text-left font-semibold text-[var(--oracle-text-1)]">Primary Need</th>
                      <th className="px-4 py-3 text-left font-semibold text-[var(--oracle-text-1)]">Requirements</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TEST_CASES.map((tc) => (
                      <tr
                        key={tc.id}
                        onClick={() => setExpandedId(tc.id)}
                        className="border-b border-[var(--oracle-border)] last:border-0 cursor-pointer hover:bg-[var(--oracle-card-hover)] transition-colors"
                      >
                        <td className="px-4 py-3 font-medium text-[var(--oracle-text-1)]">
                          <span className="mr-2">{INDUSTRY_EMOJI[tc.industry] || '🏢'}</span>
                          {tc.clientName}
                        </td>
                        <td className="px-4 py-3 text-[var(--oracle-text-3)]">{tc.industry}</td>
                        <td className="px-4 py-3 text-[var(--oracle-text-3)]">{tc.city}</td>
                        <td className="max-w-[200px] truncate px-4 py-3 text-[var(--oracle-text-2)]">
                          {tc.requirements[0]}
                        </td>
                        <td className="px-4 py-3 text-[var(--oracle-text-muted)]">{tc.requirements.length} items</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
