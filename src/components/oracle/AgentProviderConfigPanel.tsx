'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import {
  AGENT_REGISTRY,
  getAllAgentNames,
  getAgentsByCategory,
  getAllCategories,
  type AgentName,
  type AgentMetadata,
} from '@/lib/agents/registry';

// ─── Available providers and models ───

const PROVIDERS = [
  { id: 'openai', label: 'OpenAI', icon: '🟢' },
  { id: 'anthropic', label: 'Anthropic', icon: '🟣' },
  { id: 'groq', label: 'Groq', icon: '⚡' },
  { id: 'google', label: 'Google AI', icon: '🔵' },
];

const MODELS: Record<string, { id: string; label: string }[]> = {
  openai: [
    { id: 'gpt-4o', label: 'GPT-4o' },
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { id: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  ],
  anthropic: [
    { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
    { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
    { id: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
  ],
  groq: [
    { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
    { id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
    { id: 'gemma2-9b-it', label: 'Gemma 2 9B' },
  ],
  google: [
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
  ],
};

const TIER_BADGE_COLORS: Record<string, React.CSSProperties> = {
  premium: {
    backgroundColor: 'color-mix(in srgb, var(--oracle-primary) 15%, transparent)',
    color: 'var(--oracle-primary-l)',
    borderColor: 'color-mix(in srgb, var(--oracle-primary) 25%, transparent)',
  },
  standard: {
    backgroundColor: 'color-mix(in srgb, var(--oracle-success) 15%, transparent)',
    color: 'var(--oracle-success)',
    borderColor: 'color-mix(in srgb, var(--oracle-success) 25%, transparent)',
  },
};

// ─── Types ────────────────────────────

interface AgentOverride {
  providerId?: string;
  modelId?: string;
}

interface AgentProviderConfigPanelProps {
  className?: string;
}

// ─── Sub-Components ───────────────────

function ProviderIcon({ providerId }: { providerId?: string }) {
  const provider = PROVIDERS.find((p) => p.id === providerId);
  return (
    <span className="text-sm" title={provider?.label}>
      {provider?.icon || '🤖'}
    </span>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const colors = TIER_BADGE_COLORS[tier] || TIER_BADGE_COLORS.standard;
  return (
    <span
      className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize"
      style={colors}
    >
      {tier}
    </span>
  );
}

function ProviderSelect({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="rounded-lg border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-2 py-1.5 text-[11px] text-[var(--oracle-text-3)] transition-colors hover:border-[var(--oracle-primary)] focus:border-[var(--oracle-primary)] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <option value="">Auto-select</option>
      {PROVIDERS.map((p) => (
        <option key={p.id} value={p.id}>
          {p.icon} {p.label}
        </option>
      ))}
    </select>
  );
}

function ModelSelect({
  providerId,
  value,
  onChange,
  disabled,
}: {
  providerId?: string;
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}) {
  const models = providerId ? MODELS[providerId] || [] : [];
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled || !providerId}
      className="rounded-lg border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-2 py-1.5 text-[11px] text-[var(--oracle-text-3)] transition-colors hover:border-[var(--oracle-primary)] focus:border-[var(--oracle-primary)] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <option value="">{providerId ? 'Auto-select' : 'Select provider first'}</option>
      {models.map((m) => (
        <option key={m.id} value={m.id}>
          {m.label}
        </option>
      ))}
    </select>
  );
}

function AgentRow({
  agentName,
  metadata,
  override,
  onOverrideChange,
}: {
  agentName: string;
  metadata: AgentMetadata;
  override: AgentOverride;
  onOverrideChange: (override: AgentOverride) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const effectiveProvider = override.providerId ?? metadata.defaultProviderId;
  const effectiveModel = override.modelId ?? metadata.defaultModelId;
  const hasOverride = override.providerId !== undefined || override.modelId !== undefined;

  return (
    <div
      className={`oracle-glass rounded-xl overflow-hidden transition-all duration-200 ${
        hasOverride ? 'ring-1 ring-[var(--oracle-primary)]/30' : ''
      }`}
    >
      {/* Header Row */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[var(--oracle-surface-2)]/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <ProviderIcon providerId={effectiveProvider} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-[var(--oracle-text-1)] truncate">
              {agentName}
            </span>
            <TierBadge tier={metadata.defaultTier} />
            {hasOverride && (
              <span className="inline-flex items-center rounded-full bg-[var(--oracle-primary)]/15 px-2 py-0.5 text-[9px] font-semibold text-[var(--oracle-primary)]">
                OVERRIDDEN
              </span>
            )}
          </div>
          <p className="text-[11px] text-[var(--oracle-text-muted)] truncate mt-0.5">
            {metadata.description}
          </p>
        </div>
        <div className="text-right text-[11px] text-[var(--oracle-text-muted)] shrink-0">
          {effectiveProvider && effectiveModel ? (
            <span className="font-mono">{effectiveProvider}/{effectiveModel}</span>
          ) : (
            <span className="italic">Router auto-select</span>
          )}
        </div>
        <motion.span
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-[var(--oracle-text-muted)] text-xs shrink-0"
        >
          ▼
        </motion.span>
      </div>

      {/* Expanded Details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 border-t border-[var(--oracle-border)]/50">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Registry Defaults */}
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold text-[var(--oracle-text-muted)] uppercase tracking-wider">
                    Registry Defaults
                  </p>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-[var(--oracle-text-muted)]">Provider</span>
                      <span className="text-[11px] font-medium text-[var(--oracle-text-3)]">
                        {metadata.defaultProviderId || (
                          <span className="italic text-[var(--oracle-text-muted)]">None</span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-[var(--oracle-text-muted)]">Model</span>
                      <span className="text-[11px] font-medium text-[var(--oracle-text-3)]">
                        {metadata.defaultModelId || (
                          <span className="italic text-[var(--oracle-text-muted)]">None</span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-[var(--oracle-text-muted)]">Category</span>
                      <span className="text-[11px] font-medium text-[var(--oracle-text-3)] capitalize">
                        {metadata.category}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Override Controls */}
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold text-[var(--oracle-text-muted)] uppercase tracking-wider">
                    Override Settings
                  </p>
                  <div className="space-y-2">
                    <div>
                      <label className="text-[10px] text-[var(--oracle-text-muted)] mb-1 block">
                        Provider Override
                      </label>
                      <ProviderSelect
                        value={override.providerId ?? ''}
                        onChange={(val) =>
                          onOverrideChange({
                            providerId: val || undefined,
                            modelId: override.modelId,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[var(--oracle-text-muted)] mb-1 block">
                        Model Override
                      </label>
                      <ModelSelect
                        providerId={override.providerId ?? metadata.defaultProviderId}
                        value={override.modelId ?? ''}
                        onChange={(val) =>
                          onOverrideChange({
                            providerId: override.providerId,
                            modelId: val || undefined,
                          })
                        }
                      />
                    </div>
                  </div>
                  {hasOverride && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOverrideChange({});
                      }}
                      className="text-[10px] text-[var(--oracle-error)] hover:text-[var(--oracle-error)]/80 font-medium mt-1"
                    >
                      Reset to defaults
                    </button>
                  )}
                </div>
              </div>

              {/* Task Focus */}
              <div className="mt-3 pt-2 border-t border-[var(--oracle-border)]/30">
                <p className="text-[10px] text-[var(--oracle-text-muted)]">
                  <span className="font-semibold">Task focus:</span>{' '}
                  {metadata.taskFocus}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Component ───────────────────

export function AgentProviderConfigPanel({ className }: AgentProviderConfigPanelProps) {
  const [overrides, setOverrides] = useState<Record<string, AgentOverride>>({});
  const [filter, setFilter] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const agentNames = useMemo(() => getAllAgentNames(), []);
  const categories = useMemo(() => getAllCategories(), []);

  const filteredAgents = useMemo(() => {
    let names = agentNames;
    if (selectedCategory !== 'all') {
      names = getAgentsByCategory(selectedCategory);
    }
    if (filter) {
      const lower = filter.toLowerCase();
      names = names.filter((name) => {
        const meta = AGENT_REGISTRY[name as AgentName];
        return (
          name.toLowerCase().includes(lower) ||
          meta.description.toLowerCase().includes(lower) ||
          meta.category.toLowerCase().includes(lower)
        );
      });
    }
    return names;
  }, [agentNames, selectedCategory, filter]);

  const handleOverrideChange = useCallback((agentName: string, override: AgentOverride) => {
    setOverrides((prev) => ({
      ...prev,
      [agentName]: override,
    }));
  }, []);

  const overrideCount = Object.keys(overrides).length;

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[16px] font-bold text-[var(--oracle-text-1)] flex items-center gap-2">
            ⚙️ Agent Provider Configuration
          </h2>
          <p className="text-[12px] text-[var(--oracle-text-muted)] mt-0.5">
            Configure default AI providers and models for each agent
          </p>
        </div>
        {overrideCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[var(--oracle-primary)] font-medium">
              {overrideCount} override{overrideCount !== 1 ? 's' : ''} active
            </span>
            <button
              onClick={() => setOverrides({})}
              className="text-[10px] text-[var(--oracle-error)] hover:text-[var(--oracle-error)]/80 font-medium"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search agents..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full rounded-lg border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2 text-[12px] text-[var(--oracle-text-3)] placeholder:text-[var(--oracle-text-muted)] transition-colors focus:border-[var(--oracle-primary)] focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all ${
              selectedCategory === 'all'
                ? 'bg-[var(--oracle-primary)] text-white'
                : 'bg-[var(--oracle-surface-2)] text-[var(--oracle-text-muted)] hover:bg-[var(--oracle-surface-3)] hover:text-[var(--oracle-text-3)]'
            }`}
          >
            All ({agentNames.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-medium capitalize transition-all ${
                selectedCategory === cat
                  ? 'bg-[var(--oracle-primary)] text-white'
                  : 'bg-[var(--oracle-surface-2)] text-[var(--oracle-text-muted)] hover:bg-[var(--oracle-surface-3)] hover:text-[var(--oracle-text-3)]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Agent List */}
      <div className="space-y-2">
        {filteredAgents.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-[13px] text-[var(--oracle-text-muted)]">
              No agents match your filter criteria
            </p>
          </div>
        ) : (
          filteredAgents.map((name) => (
            <AgentRow
              key={name}
              agentName={name}
              metadata={AGENT_REGISTRY[name as AgentName]}
              override={overrides[name] || {}}
              onOverrideChange={(o) => handleOverrideChange(name, o)}
            />
          ))
        )}
      </div>

      {/* Summary */}
      <div className="mt-4 pt-3 border-t border-[var(--oracle-border)]">
        <div className="flex items-center justify-between text-[11px] text-[var(--oracle-text-muted)]">
          <span>
            Showing {filteredAgents.length} of {agentNames.length} agents
          </span>
          <span>
            {agentNames.filter((n) => AGENT_REGISTRY[n as AgentName].defaultProviderId).length} with registry defaults
          </span>
        </div>
      </div>
    </div>
  );
}
