'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Command } from 'cmdk';
import { PROVIDERS } from '@/data/providers';
import { AGENCY_DOMAINS } from '@/data/domains';
import { NeverStopRouter } from '@/lib/router';
import { QUICK_ACTIONS, ORACLE_TABS, type OracleTab } from '@/styles/design-tokens';

// ─── Command Palette ───────────────────

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onNavigate?: (tab: OracleTab) => void;
}

export function CommandPalette({ open, onClose, onNavigate }: CommandPaletteProps) {
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setSearch('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  if (!open) return null;

  const configuredProviders = Object.keys(NeverStopRouter.getAllKeys());

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-[560px] oracle-glass oracle-card-shadow rounded-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <Command shouldFilter className="[&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-[var(--oracle-text-muted)]">
          {/* ── Search Input ── */}
          <div className="flex items-center gap-3 border-b border-[var(--oracle-border)] px-4 py-3">
            <span className="text-[var(--oracle-text-muted)]">🔍</span>
            <Command.Input
              ref={inputRef}
              value={search}
              onValueChange={setSearch}
              placeholder="Search commands, prompts, domains..."
              className="flex-1 bg-transparent text-[15px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none"
            />
            <kbd className="rounded bg-[var(--oracle-surface-2)] px-1.5 py-0.5 text-[11px] font-mono text-[var(--oracle-text-muted)] border border-[var(--oracle-border)]">
              esc
            </kbd>
          </div>

          <div className="max-h-[400px] overflow-y-auto p-2">
            {/* ── Quick Actions ── */}
            <Command.Group heading="⚡ Quick Actions">
              {QUICK_ACTIONS.map((action) => (
                <Command.Item
                  key={action.id}
                  value={action.label}
                  onSelect={() => {
                    onClose();
                    if (onNavigate) onNavigate('agent');
                  }}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 cursor-pointer transition-colors data-[selected=true]:bg-[var(--oracle-card-hover)]"
                >
                  <span className="text-lg">{action.emoji}</span>
                  <span className="text-[14px] text-[var(--oracle-text-2)]">{action.label}</span>
                </Command.Item>
              ))}
            </Command.Group>

            {/* ── Navigation ── */}
            <Command.Group heading="🚀 Go to">
              {ORACLE_TABS.map((tab) => (
                <Command.Item
                  key={tab.id}
                  value={`go to ${tab.label}`}
                  onSelect={() => {
                    onClose();
                    if (onNavigate) onNavigate(tab.id);
                  }}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 cursor-pointer transition-colors data-[selected=true]:bg-[var(--oracle-card-hover)]"
                >
                  <span className="text-lg">{tab.emoji}</span>
                  <span className="text-[14px] text-[var(--oracle-text-2)]">{tab.label}</span>
                </Command.Item>
              ))}
            </Command.Group>

            {/* ── Domains ── */}
            <Command.Group heading="🧩 Domains">
              {AGENCY_DOMAINS.map((domain) => (
                <Command.Item
                  key={domain.id}
                  value={domain.name}
                  onSelect={() => {
                    onClose();
                    if (onNavigate) onNavigate('agent');
                  }}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 cursor-pointer transition-colors data-[selected=true]:bg-[var(--oracle-card-hover)]"
                >
                  <span className="text-lg">{domain.emoji}</span>
                  <span className="text-[14px] text-[var(--oracle-text-2)]">{domain.name}</span>
                  <span className="ml-auto rounded-full bg-[var(--oracle-surface-2)] px-2 py-0.5 text-[10px] text-[var(--oracle-text-muted)]">
                    {domain.category}
                  </span>
                </Command.Item>
              ))}
            </Command.Group>

            {/* ── Provider Keys ── */}
            <Command.Group heading="🔑 Provider Keys">
              {PROVIDERS.map((provider) => {
                const hasKey = configuredProviders.includes(provider.id);
                return (
                  <Command.Item
                    key={provider.id}
                    value={`${provider.name} key`}
                    onSelect={() => {
                      onClose();
                      if (onNavigate) onNavigate('settings');
                    }}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 cursor-pointer transition-colors data-[selected=true]:bg-[var(--oracle-card-hover)]"
                  >
                    <span
                      className={`oracle-status-dot ${hasKey ? 'oracle-status-ok' : 'oracle-status-idle'}`}
                    />
                    <span className="text-[14px] text-[var(--oracle-text-2)]">{provider.name}</span>
                    <span className="ml-auto text-[11px] text-[var(--oracle-text-muted)]">
                      {hasKey ? '✓ configured' : 'not set'}
                    </span>
                  </Command.Item>
                );
              })}
            </Command.Group>

            {/* ── Empty State ── */}
            <Command.Empty className="py-8 text-center text-[14px] text-[var(--oracle-text-muted)]">
              No results for &ldquo;{search}&rdquo;
            </Command.Empty>
          </div>
        </Command>
      </div>
    </div>
  );
}
