'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouterStore } from '@/stores/router.store';
import { ORACLE_TABS, type OracleTab } from '@/styles/design-tokens';
import { NeverStopRouter } from '@/lib/router';
import { useNotificationCount } from '@/components/oracle/NotificationPanel';
import { useUser, useLogout } from '@/lib/supabase/hooks';
import { fetchWithTimeout, TIMEOUT_QUICK_MS } from '@/lib/fetch-utils';

// ─── Header Props ──────────────────────

interface HeaderProps {
  activeTab: OracleTab;
  onTabChange: (tab: OracleTab) => void;
  onCommandOpen: () => void;
  onNotificationsOpen?: () => void;
}

// ─── Header Component ──────────────────

export function Header({ activeTab, onTabChange, onCommandOpen, onNotificationsOpen }: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const { totalCostINR, mcpEnabled, providerStatuses } = useRouterStore();
  const unreadCount = useNotificationCount();
  const { user } = useUser();
  const logout = useLogout();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Emergency stop state
  const [emergencyStop, setEmergencyStop] = useState({ active: false, reason: null as string | null });
  const [emergencyLoading, setEmergencyLoading] = useState(false);

  // Fetch emergency stop status on mount
  useEffect(() => {
    fetchWithTimeout('/api/emergency-stop', { timeoutMs: TIMEOUT_QUICK_MS }).then(r => r.ok ? r.json() : null).then(data => {
      if (data) setEmergencyStop({ active: data.active, reason: data.reason });
    }).catch(() => {});
  }, []);

  const toggleEmergencyStop = useCallback(async () => {
    // Confirm before activating (deactivating is safe — no confirmation needed)
    if (!emergencyStop.active) {
      const confirmed = window.confirm(
        'Activate Emergency Stop?\n\nThis will immediately pause ALL AI agent executions across the system.'
      );
      if (!confirmed) return;
    }

    setEmergencyLoading(true);
    try {
      const action = emergencyStop.active ? 'deactivate' : 'activate';
      const res = await fetchWithTimeout('/api/emergency-stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason: action === 'activate' ? 'Manual activation from UI' : undefined }),
        timeoutMs: TIMEOUT_QUICK_MS,
      });
      if (res.ok) {
        const data = await res.json();
        setEmergencyStop({ active: data.status.active, reason: data.status.reason });
      }
    } catch {}
    setEmergencyLoading(false);
  }, [emergencyStop.active]);

  const configuredProviders = Object.keys(NeverStopRouter.getAllKeys());
  const allProviderIds = ['openai', 'anthropic', 'groq', 'google', 'openrouter', 'cerebras', 'together', 'mistral', 'cohere', 'perplexity'];

  return (
    <header className="sticky top-0 z-40 flex items-center border-b border-[var(--oracle-border)] bg-[var(--oracle-bg)]/80 backdrop-blur-xl" role="banner">
      {/* ── Left: Logo ── */}
      <div className="flex items-center gap-2.5 pl-4 pr-4 md:pr-6 shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg oracle-gradient-bg oracle-glow">
          <span className="text-sm" aria-hidden="true">⚡</span>
        </div>
        <div className="flex flex-col">
          <span className="oracle-gradient-text text-[16px] font-black leading-tight tracking-tight">
            ORACLE
          </span>
          <span className="font-mono text-[9px] text-[var(--oracle-text-muted)] leading-tight tracking-wider hidden sm:block">
            Universal Agency Intelligence
          </span>
        </div>
      </div>

      {/* ── Center: Tab Navigation ── */}
      <nav className="flex-1 flex items-center gap-0.5 overflow-x-auto px-2 scrollbar-none" role="navigation" aria-label="Main navigation">
        {ORACLE_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
              className={`
                relative flex items-center gap-1.5 whitespace-nowrap rounded-lg transition-all duration-200
                min-h-[44px] px-2 py-2 sm:px-3
                ${isActive
                  ? 'font-bold text-[var(--oracle-text-1)]'
                  : 'font-medium text-[var(--oracle-text-3)] hover:text-[var(--oracle-text-2)] hover:bg-[var(--oracle-card-hover)]'
                }
              `}
            >
              <span className="text-sm">{tab.emoji}</span>
              <span className="hidden md:inline text-[13px]">{tab.label}</span>
              {isActive && (
                <motion.span
                  className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-[var(--oracle-primary)]"
                  layoutId="activeTab"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* ── Right: Controls ── */}
      <div className="flex items-center gap-2 pr-2 md:pr-4 shrink-0">
        {/* MCP Toggles */}
        <div className="hidden md:flex items-center gap-1">
          {(['gmail', 'calendar', 'drive'] as const).map((service) => (
            <button
              key={service}
              aria-label={`MCP ${service}: ${mcpEnabled[service] ? 'connected' : 'disconnected'}`}
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-all border min-h-[32px] ${
                mcpEnabled[service]
                  ? 'bg-[var(--oracle-success)]/10 border-[var(--oracle-success)]/30 text-[var(--oracle-success)]'
                  : 'bg-transparent border-[var(--oracle-border)] text-[var(--oracle-text-muted)]'
              }`}
            >
              <span className={`oracle-status-dot ${mcpEnabled[service] ? 'oracle-status-ok' : 'oracle-status-idle'}`} aria-hidden="true" />
              {service.charAt(0).toUpperCase() + service.slice(1)}
            </button>
          ))}
        </div>

        {/* Provider Status Dots */}
        <div className="hidden lg:flex items-center gap-1.5">
          {allProviderIds.map((pid) => {
            const hasKey = configuredProviders.includes(pid);
            const status = hasKey ? (providerStatuses[pid] || 'ok') : 'idle';
            const abbr: Record<string, string> = {
              openai: 'OAI', anthropic: 'ANT', groq: 'G', google: 'Gem', openrouter: 'OR',
              cerebras: 'CBR', together: 'T', mistral: 'M', cohere: 'C', perplexity: 'PX',
            };
            return (
              <div
                key={pid}
                className="flex items-center gap-1 rounded bg-[var(--oracle-surface-2)] px-1.5 py-0.5"
                title={`${pid}: ${status}`}
                aria-label={`${pid} provider: ${status}`}
              >
                <span className={`oracle-status-dot ${
                  status === 'ok' ? 'oracle-status-ok' :
                  status === 'fail' ? 'oracle-status-fail' :
                  status === 'rate_limited' ? 'oracle-status-rate' :
                  'oracle-status-idle'
                }`} aria-hidden="true" />
                <span className="text-[9px] font-mono text-[var(--oracle-text-muted)]">
                  {abbr[pid] || pid.slice(0, 3)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Cmd+K Button */}
        <button
          onClick={onCommandOpen}
          aria-label="Open command palette (Ctrl+K)"
          className="flex items-center gap-1 rounded-lg border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-2 py-1 text-[11px] font-mono text-[var(--oracle-text-3)] hover:border-[var(--oracle-border-strong)] transition-colors min-h-[36px]"
        >
          ⌘K
        </button>

        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--oracle-text-3)] hover:bg-[var(--oracle-card-hover)] transition-colors"
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>

        {/* Notifications Bell */}
        <button
          onClick={onNotificationsOpen || onCommandOpen}
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-[var(--oracle-text-3)] hover:bg-[var(--oracle-card-hover)] transition-colors"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--oracle-error)] px-1 text-[9px] font-bold text-white">
              {unreadCount}
            </span>
          )}
        </button>

        {/* Emergency Stop Button */}
        <button
          onClick={toggleEmergencyStop}
          disabled={emergencyLoading}
          className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold transition-all min-h-[36px] ${
            emergencyStop.active
              ? 'bg-[var(--oracle-error)]/20 border border-[var(--oracle-error)]/40 text-[var(--oracle-error)] animate-pulse'
              : 'border border-[var(--oracle-border)] text-[var(--oracle-text-muted)] hover:border-[var(--oracle-error)]/40 hover:text-[var(--oracle-error)]'
          }`}
          aria-label={emergencyStop.active ? 'Emergency stop active — click to deactivate' : 'Activate emergency stop'}
          title={emergencyStop.active ? `Emergency stop active: ${emergencyStop.reason || 'No reason'}` : 'Emergency stop — pauses all AI agent executions'}
        >
          <span className="text-sm">{emergencyStop.active ? '🛑' : '⏹'}</span>
          <span className="hidden sm:inline">{emergencyStop.active ? 'STOPPED' : 'Stop'}</span>
        </button>

        {/* Cost Display */}
        <div className="text-[11px] font-mono text-[var(--oracle-text-muted)] tabular-nums hidden sm:block" aria-label={`Total cost: ₹${totalCostINR.toFixed(2)}`}>
          ₹{totalCostINR.toFixed(2)}
        </div>

        {/* User Menu */}
        {user && (
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen((p) => !p)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--oracle-primary)]/20 text-[12px] font-bold text-[var(--oracle-primary-l)] hover:bg-[var(--oracle-primary)]/30 transition-colors"
              aria-label="User menu"
              aria-expanded={userMenuOpen}
            >
              {user.email?.charAt(0).toUpperCase() || '?'}
            </button>
            <AnimatePresence>
              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full z-50 mt-1 w-56 rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-bg)] shadow-xl"
                  >
                    <div className="p-3 border-b border-[var(--oracle-border)]">
                      <p className="text-[12px] font-medium text-[var(--oracle-text-1)] truncate">{user.email}</p>
                      <p className="text-[10px] text-[var(--oracle-text-muted)]">Signed in</p>
                    </div>
                    <div className="p-1">
                      <button
                        onClick={() => { setUserMenuOpen(false); logout(); }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[12px] text-[var(--oracle-error)] hover:bg-[var(--oracle-card-hover)] transition-colors"
                      >
                        Sign out
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </header>
  );
}
