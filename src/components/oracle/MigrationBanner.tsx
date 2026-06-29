'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { hasLocalStorageData, migrateLocalStorageToSupabase, clearLocalStorageAfterMigration, type MigrationResult } from '@/lib/migrate-localstorage';
import { buttonTapProps } from '@/styles/design-tokens';

type MigrationStep = 'idle' | 'detecting' | 'ready' | 'migrating' | 'done' | 'error';

const STEP_LABELS: Record<string, string> = {
  projects: '📁 Projects',
  timeEntries: '⏱ Time Entries',
  memories: '🧠 Memories',
  knowledgeDocs: '📄 Knowledge Docs',
  proposals: '🎯 Proposals',
  customPrompts: '📖 Custom Prompts',
  favourites: '⭐ Favourites',
};

export function MigrationBanner() {
  const [step, setStep] = useState<MigrationStep>('idle');
  const [hasData, setHasData] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if migration already done or dismissed
    const migrated = localStorage.getItem('oracle-migration-done');
    if (migrated === 'true') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDismissed(true);
      return;
    }
    const data = hasLocalStorageData();
     
    setHasData(data);
     
    if (data) setStep('ready');
  }, []);

  const handleMigrate = useCallback(async () => {
    setStep('migrating');
    try {
      const migrationResult = await migrateLocalStorageToSupabase((step, current, total) => {
        setCurrentStep(step);
        setProgress({ current, total });
      });
      setResult(migrationResult);
      setStep('done');
      clearLocalStorageAfterMigration();
      localStorage.setItem('oracle-migration-done', 'true');
    } catch (err) {
      setResult({
        projects: 0, timeEntries: 0, memories: 0, knowledgeDocs: 0,
        proposals: 0, customPrompts: 0, favourites: 0,
        errors: [err instanceof Error ? err.message : 'Migration failed'],
      });
      setStep('error');
    }
  }, []);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    localStorage.setItem('oracle-migration-done', 'true');
  }, []);

  if (dismissed || !hasData) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="mx-4 mt-4 rounded-2xl border border-[var(--oracle-border)] bg-[var(--oracle-card)] p-4 backdrop-blur-xl"
      >
        {/* ── Ready State ── */}
        {step === 'ready' && (
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <p className="text-[14px] font-semibold text-[var(--oracle-text-1)]">
                🔄 Data Migration Available
              </p>
              <p className="mt-1 text-[12px] text-[var(--oracle-text-3)]">
                You have existing data in local storage. Migrate it to the database so it persists across devices and sessions.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <motion.button
                {...buttonTapProps}
                onClick={handleDismiss}
                className="rounded-lg px-3 py-2 text-[12px] text-[var(--oracle-text-muted)] hover:bg-[var(--oracle-card-hover)] transition-colors"
              >
                Skip
              </motion.button>
              <motion.button
                {...buttonTapProps}
                onClick={handleMigrate}
                className="rounded-lg oracle-gradient-bg px-4 py-2 text-[12px] font-semibold text-white transition-all"
              >
                ⚡ Migrate Now
              </motion.button>
            </div>
          </div>
        )}

        {/* ── Migrating State ── */}
        {step === 'migrating' && (
          <div>
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-semibold text-[var(--oracle-text-1)]">
                🔄 Migrating data...
              </p>
              <span className="text-[11px] text-[var(--oracle-text-muted)] font-mono">
                {progress.total > 0 ? `${progress.current}/${progress.total}` : ''}
              </span>
            </div>
            {currentStep && (
              <p className="mt-1 text-[12px] text-[var(--oracle-text-3)]">
                {STEP_LABELS[currentStep] || currentStep}
              </p>
            )}
            {progress.total > 0 && (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--oracle-surface-2)]">
                <motion.div
                  className="h-full rounded-full bg-[var(--oracle-primary)]"
                  animate={{ width: `${(progress.current / progress.total) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            )}
          </div>
        )}

        {/* ── Done State ── */}
        {step === 'done' && result && (
          <div>
            <p className="text-[13px] font-semibold text-[var(--oracle-success)]">
              ✅ Migration Complete!
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {result.projects > 0 && <MigratedCount label="Projects" count={result.projects} />}
              {result.timeEntries > 0 && <MigratedCount label="Time Entries" count={result.timeEntries} />}
              {result.memories > 0 && <MigratedCount label="Memories" count={result.memories} />}
              {result.knowledgeDocs > 0 && <MigratedCount label="Docs" count={result.knowledgeDocs} />}
              {result.proposals > 0 && <MigratedCount label="Proposals" count={result.proposals} />}
              {result.customPrompts > 0 && <MigratedCount label="Prompts" count={result.customPrompts} />}
              {result.favourites > 0 && <MigratedCount label="Favourites" count={result.favourites} />}
            </div>
            {result.errors.length > 0 && (
              <p className="mt-2 text-[11px] text-[var(--oracle-warning)]">
                {result.errors.length} items failed to migrate. Check console for details.
              </p>
            )}
            <p className="mt-2 text-[11px] text-[var(--oracle-text-muted)]">
              Local storage data has been cleared. Refresh to start using the database.
            </p>
          </div>
        )}

        {/* ── Error State ── */}
        {step === 'error' && result && (
          <div>
            <p className="text-[13px] font-semibold text-[var(--oracle-error)]">
              ❌ Migration Failed
            </p>
            {result.errors.map((err, i) => (
              <p key={i} className="mt-1 text-[11px] text-[var(--oracle-text-muted)]">{err}</p>
            ))}
            <p className="mt-2 text-[12px] text-[var(--oracle-text-3)]">
              Make sure your Supabase connection is configured and the database tables exist.
            </p>
            <div className="mt-2 flex gap-2">
              <motion.button
                {...buttonTapProps}
                onClick={handleMigrate}
                className="rounded-lg border border-[var(--oracle-border)] px-3 py-1.5 text-[12px] text-[var(--oracle-text-3)] hover:bg-[var(--oracle-card-hover)]"
              >
                🔄 Retry
              </motion.button>
              <motion.button
                {...buttonTapProps}
                onClick={handleDismiss}
                className="rounded-lg px-3 py-1.5 text-[12px] text-[var(--oracle-text-muted)] hover:bg-[var(--oracle-card-hover)]"
              >
                Dismiss
              </motion.button>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Helper: Migrated Count ────────────
function MigratedCount({ label, count }: { label: string; count: number }) {
  return (
    <div className="rounded-lg bg-[var(--oracle-surface-2)] px-2 py-1.5 text-center">
      <p className="text-[14px] font-bold text-[var(--oracle-text-1)]">{count}</p>
      <p className="text-[10px] text-[var(--oracle-text-muted)]">{label}</p>
    </div>
  );
}
