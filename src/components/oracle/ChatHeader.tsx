'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { transitions, buttonTapProps } from '@/styles/design-tokens';
import type { PlanId } from '@/lib/subscription';
import { AGENT_TYPES, AGENT_GROUPS, PROJECT_STATUS_COLORS, type AgentType, type ProjectSummary, type ConversationSummary } from './agent-config';
import { useSubscriptionState, TierBadge, getRequiredPlanForAgent, TierTooltip, UpgradeModal } from './FeatureGate';
import { hasAgentAccess } from '@/lib/subscription';

interface ChatHeaderProps {
  title: string;
  agentType: string;
  projects: ProjectSummary[];
  selectedProjectId: string | null;
  showAgentSelector: boolean;
  showConversationList: boolean;
  showProjectSelector: boolean;
  conversations: ConversationSummary[];
  onToggleAgentSelector: () => void;
  onToggleConversationList: () => void;
  onToggleProjectSelector: () => void;
  onSelectAgent: (type: AgentType) => void;
  onSelectProject: (id: string | null) => void;
  onSelectConversation: (id: string) => void;
  onExportPDF: () => void;
  onExportWord: () => void;
  messageCount: number;
  onNewChat: () => void;
  onDeleteConversation: (id: string) => void;
}

export function ChatHeader({
  title, agentType, projects, selectedProjectId, showAgentSelector, showConversationList,
  showProjectSelector, conversations, onToggleAgentSelector, onToggleConversationList,
  onToggleProjectSelector, onSelectAgent, onSelectProject, onSelectConversation,
  onExportPDF, onExportWord, messageCount,
  onNewChat, onDeleteConversation,
}: ChatHeaderProps) {
  const agentInfo = AGENT_TYPES.find((a) => a.id === agentType) || AGENT_TYPES[0];
  const { plan } = useSubscriptionState();
  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const [projectSearch, setProjectSearch] = useState('');
  const projectSearchRef = useRef<HTMLInputElement>(null);
  const [upgradeModal, setUpgradeModal] = useState<{ open: boolean; agentName?: string; requiredPlan: PlanId }>({
    open: false,
    requiredPlan: 'pro',
  });

  useEffect(() => {
    if (showProjectSelector) {
      setProjectSearch('');
      const timer = setTimeout(() => projectSearchRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [showProjectSelector]);

  const filteredProjects = projectSearch.trim()
    ? projects.filter((p) => {
        const q = projectSearch.toLowerCase();
        return p.clientName.toLowerCase().includes(q) || p.industry.toLowerCase().includes(q) || p.service.toLowerCase().includes(q);
      })
    : projects;

  return (
    <div className="relative flex items-center border-b border-[var(--oracle-border)] bg-[var(--oracle-bg)]/60 backdrop-blur-xl px-3 sm:px-4 py-2 gap-1 sm:gap-2">
      {/* Conversation List Dropdown */}
      <div className="relative">
        <button
          onClick={onToggleConversationList}
          className="flex items-center gap-1.5 sm:gap-2 rounded-lg px-2 sm:px-3 py-1.5 text-[12px] sm:text-[13px] font-medium text-[var(--oracle-text-2)] hover:bg-[var(--oracle-card-hover)] transition-colors min-h-[36px]"
          aria-label="Toggle conversation list"
        >
          💬 <span className="max-w-[120px] sm:max-w-[200px] truncate">{title}</span>
          <span className="text-[10px] text-[var(--oracle-text-muted)]">▾</span>
        </button>
        <AnimatePresence>
          {showConversationList && (
            <>
              <div className="fixed inset-0 z-40" onClick={onToggleConversationList} />
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={transitions.snappy}
                className="absolute left-0 top-full z-50 mt-1 w-72 max-h-80 overflow-hidden rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-bg)] shadow-xl"
              >
                <div className="p-2 border-b border-[var(--oracle-border)]">
                  <button
                    onClick={onNewChat}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium text-[var(--oracle-primary-l)] hover:bg-[var(--oracle-card-hover)] transition-colors"
                  >
                    + New Chat
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto p-2">
                  {conversations.length === 0 ? (
                    <p className="px-3 py-4 text-center text-[12px] text-[var(--oracle-text-muted)]">No conversations yet</p>
                  ) : (
                    conversations.map((c) => (
                      <div
                        key={c.id}
                        className="group flex items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-[var(--oracle-card-hover)]"
                      >
                        <button
                          onClick={() => onSelectConversation(c.id)}
                          className="flex-1 min-w-0 text-left"
                        >
                          <span className="block truncate text-[12px] font-medium text-[var(--oracle-text-2)]">{c.title}</span>
                          <span className="text-[10px] text-[var(--oracle-text-muted)]">
                            {c.messageCount} messages · {new Date(c.updatedAt).toLocaleDateString()}
                          </span>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onDeleteConversation(c.id); }}
                          className="opacity-0 group-hover:opacity-100 text-[var(--oracle-text-muted)] hover:text-[var(--oracle-error)] text-[11px] transition-opacity"
                          aria-label={`Delete ${c.title}`}
                        >
                          🗑
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Project Selector */}
      <div className="relative">
        <button
          onClick={onToggleProjectSelector}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--oracle-border)] px-2 py-1 text-[11px] font-medium text-[var(--oracle-text-3)] hover:bg-[var(--oracle-card-hover)] transition-colors min-h-[36px]"
          aria-label="Select project for memory context"
        >
          <span>📁</span>
          <span className="hidden sm:inline max-w-[100px] truncate">{selectedProject ? selectedProject.clientName : 'All Projects'}</span>
          <span className="text-[9px] text-[var(--oracle-text-muted)]">▾</span>
        </button>
        <AnimatePresence>
          {showProjectSelector && (
            <>
              <div className="fixed inset-0 z-40" onClick={onToggleProjectSelector} />
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={transitions.snappy}
                className="absolute left-1/2 top-full z-50 mt-1 -translate-x-1/2 w-64 max-h-80 overflow-hidden rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-bg)] shadow-xl"
              >
                <div className="p-2 border-b border-[var(--oracle-border)]">
                  <p className="px-2 py-1 text-[10px] font-semibold text-[var(--oracle-text-muted)] uppercase tracking-wider">Memory Context</p>
                </div>
                <div className="p-2 border-b border-[var(--oracle-border)]">
                  <input
                    ref={projectSearchRef}
                    type="text"
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                    placeholder="Search projects..."
                    className="w-full rounded-lg border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2 text-[12px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)]"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="max-h-64 overflow-y-auto p-2">
                  <button
                    onClick={() => onSelectProject(null)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors ${
                      !selectedProjectId ? 'bg-[var(--oracle-primary)]/10' : 'hover:bg-[var(--oracle-card-hover)]'
                    }`}
                  >
                    <span className="text-base">🌐</span>
                    <div>
                      <span className="block text-[12px] font-medium text-[var(--oracle-text-2)]">All Projects</span>
                      <span className="text-[10px] text-[var(--oracle-text-muted)]">No project-specific memories</span>
                    </div>
                  </button>
                  {filteredProjects.length === 0 ? (
                    <p className="px-3 py-4 text-center text-[12px] text-[var(--oracle-text-muted)]">{projects.length === 0 ? 'No projects yet' : 'No projects match your search'}</p>
                  ) : (
                    filteredProjects.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => onSelectProject(p.id)}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors ${
                          selectedProjectId === p.id ? 'bg-[var(--oracle-primary)]/10' : 'hover:bg-[var(--oracle-card-hover)]'
                        }`}
                      >
                        <span className="text-base">📁</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="inline-block h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: PROJECT_STATUS_COLORS[p.status] }} />
                            <span className="truncate text-[12px] font-medium text-[var(--oracle-text-2)]">{p.clientName}</span>
                          </div>
                          <span className="ml-3.5 text-[10px] text-[var(--oracle-text-muted)]">{p.industry} · {p.service}{p.memoryCount > 0 ? ` · ${p.memoryCount} ${p.memoryCount === 1 ? 'memory' : 'memories'}` : ''}</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
                {selectedProjectId && (
                  <div className="border-t border-[var(--oracle-border)] p-2">
                    <p className="px-2 text-[10px] text-[var(--oracle-success)]">✓ Project memories loaded into context</p>
                  </div>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Agent Type Selector */}
      <div className="relative">
        <button
          onClick={onToggleAgentSelector}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--oracle-border)] px-2 py-1 text-[11px] font-medium text-[var(--oracle-text-3)] hover:bg-[var(--oracle-card-hover)] transition-colors min-h-[36px]"
          aria-label="Select agent type"
        >
          <span>{agentInfo.emoji}</span>
          <span className="hidden sm:inline">{agentInfo.label}</span>
          <span className="text-[9px] text-[var(--oracle-text-muted)]">▾</span>
        </button>
        <AnimatePresence>
          {showAgentSelector && (
            <>
              <div className="fixed inset-0 z-40" onClick={onToggleAgentSelector} />
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={transitions.snappy}
                className="absolute right-0 top-full z-50 mt-1 w-64 rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-bg)] shadow-xl"
              >
                <div className="p-2 max-h-96 overflow-y-auto">
                  {AGENT_GROUPS.map((group) => {
                    const groupAgents = AGENT_TYPES.filter((a) => a.group === group);
                    if (groupAgents.length === 0) return null;
                    return (
                      <div key={group} className="mb-1 last:mb-0">
                        <p className="px-3 pt-1.5 pb-1 text-[9px] font-semibold uppercase tracking-wider text-[var(--oracle-text-muted)]">
                          {group === 'Core' ? '⚡ Core Agents' : '🎯 Specialist Agents'}
                        </p>
                        {groupAgents.map((a) => {
                          const allowed = hasAgentAccess(plan, a.id);
                          const requiredPlan = allowed ? null : getRequiredPlanForAgent(a.id);
                          return (
                            <button
                              key={a.id}
                              onClick={() => {
                                if (allowed) {
                                  onSelectAgent(a.id);
                                } else if (requiredPlan) {
                                  setUpgradeModal({ open: true, agentName: a.label, requiredPlan });
                                }
                              }}
                              aria-disabled={!allowed}
                              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors ${
                                agentType === a.id
                                  ? 'bg-[var(--oracle-primary)]/10'
                                  : allowed
                                    ? 'hover:bg-[var(--oracle-card-hover)]'
                                    : 'opacity-50 cursor-not-allowed'
                              }`}
                            >
                              <span className="text-base">{a.emoji}</span>
                              <div className="flex-1 min-w-0">
                                <span className="block text-[12px] font-medium text-[var(--oracle-text-2)]">{a.label}</span>
                                <span className="text-[10px] text-[var(--oracle-text-muted)]">{a.description}</span>
                              </div>
                              {!allowed && requiredPlan && (
                                <TierTooltip requiredPlan={requiredPlan}>
                                  <div className="flex items-center gap-1.5 flex-shrink-0">
                                    <span className="text-[12px]">🔒</span>
                                    <TierBadge plan={requiredPlan} compact />
                                  </div>
                                </TierTooltip>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Upgrade Modal */}
      <UpgradeModal
        open={upgradeModal.open}
        onOpenChange={(open) => setUpgradeModal((prev) => ({ ...prev, open }))}
        requiredPlan={upgradeModal.requiredPlan}
        agentLabel={upgradeModal.agentName}
      />

      {/* Export buttons */}
      {messageCount > 0 && (
        <div className="ml-auto flex items-center gap-1">
          <motion.button {...buttonTapProps} onClick={onExportPDF} className="flex items-center gap-1 rounded-lg border border-[var(--oracle-border)] px-2 py-1 text-[11px] text-[var(--oracle-text-muted)] hover:bg-[var(--oracle-card-hover)] hover:text-[var(--oracle-text-3)] transition-colors">
            📄 PDF
          </motion.button>
          <motion.button {...buttonTapProps} onClick={onExportWord} className="flex items-center gap-1 rounded-lg border border-[var(--oracle-border)] px-2 py-1 text-[11px] text-[var(--oracle-text-muted)] hover:bg-[var(--oracle-card-hover)] hover:text-[var(--oracle-text-3)] transition-colors">
            📝 Word
          </motion.button>
        </div>
      )}
    </div>
  );
}
