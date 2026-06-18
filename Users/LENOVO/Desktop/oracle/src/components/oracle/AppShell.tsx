'use client';

import React, { useEffect, useState, useCallback, lazy, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ThemeProvider } from 'next-themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from './Header';
import { CommandPalette } from './CommandPalette';
import { ChatPanel } from './ChatPanel';
import { Sidebar } from './Sidebar';
import { MigrationBanner } from './MigrationBanner';
import { NotificationPanel } from './NotificationPanel';
import { motionVariants, transitions, TAB_METADATA } from '@/styles/design-tokens';
import { useRouterStore } from '@/stores/router.store';
import { isKeyMigrationComplete, countLegacyKeys, migrateKeysToServer } from '@/lib/migrate-localstorage';
import toast from 'react-hot-toast';
import { ORACLE_TABS, isValidTab, type OracleTab } from '@/styles/design-tokens';
import { OnboardingWizard } from './OnboardingWizard';
import { SkipNav } from './SkipNav';
import { OfflineBanner } from './OfflineBanner';

// ─── Lazy Load Tabs ───────────────────
const PromptsTab = lazy(() => import('./PromptsTab').then((m) => ({ default: m.PromptsTab })));
const TestCasesTab = lazy(() => import('./TestCasesTab').then((m) => ({ default: m.TestCasesTab })));
const WorkflowsTab = lazy(() => import('./WorkflowsTab').then((m) => ({ default: m.WorkflowsTab })));
const ProjectsTab = lazy(() => import('./ProjectsTab').then((m) => ({ default: m.ProjectsTab })));
const RoadmapTab = lazy(() => import('./RoadmapTab').then((m) => ({ default: m.RoadmapTab })));
const ConfigTab = lazy(() => import('./ConfigTab').then((m) => ({ default: m.ConfigTab })));
const AnalyticsTab = lazy(() => import('./AnalyticsTab').then((m) => ({ default: m.AnalyticsTab })));
const QualityTab = lazy(() => import('./QualityTab').then((m) => ({ default: m.QualityTab })));
const MemoryExtractor = lazy(() => import('./MemoryExtractor').then((m) => ({ default: m.MemoryExtractor })));
const OrchestratorPanel = lazy(() => import('./OrchestratorPanel').then((m) => ({ default: m.OrchestratorPanel })));
const LeadsTab = lazy(() => import('./LeadsTab').then((m) => ({ default: m.LeadsTab })));
const BusinessTab = lazy(() => import('./BusinessTab').then((m) => ({ default: m.BusinessTab })));
const AeoGeoTab = lazy(() => import('./AeoGeoTab').then((m) => ({ default: m.AeoGeoTab })));
const ScopeChangeManager = lazy(() => import('./ScopeApproval').then((m) => ({ default: m.ScopeChangeManager })));
const ApprovalWorkflow = lazy(() => import('./ScopeApproval').then((m) => ({ default: m.ApprovalWorkflow })));
const PaymentFollowUpManager = lazy(() => import('./PaymentFollowup').then((m) => ({ default: m.PaymentFollowUpManager })));
const ProfitabilityTab = lazy(() => import('./ProfitabilityTab').then((m) => ({ default: m.ProfitabilityTab })));
const ProviderHealthPanel = lazy(() => import('./ProviderHealthPanel').then((m) => ({ default: m.ProviderHealthPanel })));
const ProactiveInsightsPanel = lazy(() => import('./ProactiveInsightsPanel').then((m) => ({ default: m.ProactiveInsightsPanel })));
const SatisfactionTrackerPanel = lazy(() => import('./SatisfactionTrackerPanel').then((m) => ({ default: m.SatisfactionTrackerPanel })));
const BrandAssetsPanel = lazy(() => import('./BrandAssetsPanel').then((m) => ({ default: m.BrandAssetsPanel })));
const IntelligenceReportsPanel = lazy(() => import('./IntelligenceReportsPanel').then((m) => ({ default: m.IntelligenceReportsPanel })));
const ImageGenerationTab = lazy(() => import('./ImageGenerationTab').then((m) => ({ default: m.ImageGenerationTab })));
const WhatsAppCampaignTab = lazy(() => import('./WhatsAppCampaignTab').then((m) => ({ default: m.WhatsAppCampaignTab })));
const VoiceAgentTab = lazy(() => import('./VoiceAgentTab').then((m) => ({ default: m.VoiceAgentTab })));
const ChatbotBuilderTab = lazy(() => import('./ChatbotBuilderTab').then((m) => ({ default: m.ChatbotBuilderTab })));
const CollaborationTab = lazy(() => import('./CollaborationTab').then((m) => ({ default: m.CollaborationTab })));
const RazorpayPaymentsTab = lazy(() => import('./RazorpayPaymentsTab').then((m) => ({ default: m.RazorpayPaymentsTab })));
const RateLimitDashboard = lazy(() => import('./RateLimitDashboard').then((m) => ({ default: m.RateLimitDashboard })));
const PerformanceDashboard = lazy(() => import('./PerformanceDashboard').then((m) => ({ default: m.PerformanceDashboard })));
const MultiClientOrchestrator = lazy(() => import('./MultiClientOrchestrator').then((m) => ({ default: m.MultiClientOrchestrator })));

// ─── Tab Loading Fallback ─────────────
function TabFallback() {
  return (
    <div className="flex h-full items-center justify-center" role="status" aria-label="Loading">
      <div className="oracle-spinner">
        <div className="oracle-spinner-ring" />
        <span className="oracle-spinner-text">ORACLE</span>
      </div>
    </div>
  );
}

// ─── Query Client ──────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 1 },
  },
});

// ─── AppShell Component ────────────────

export function AppShell() {
  const [commandOpen, setCommandOpen] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  // Read tab from URL, default to 'agent'
  const rawTab = searchParams.get('tab');
  const activeTab: OracleTab = rawTab && isValidTab(rawTab) ? rawTab : 'agent';

  // Navigate by updating the URL search params
  const setActiveTab = useCallback((tab: OracleTab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.push(`?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);
  const [shortcutsHelp, setShortcutsHelp] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [sidebarProjects, setSidebarProjects] = useState<Array<{ id: string; clientName: string; industry: string; service: string; status: string; memoryCount: number }>>([]);
  const [sidebarQualityScore, setSidebarQualityScore] = useState(0);
  const [sidebarSelectedProjectId, setSidebarSelectedProjectId] = useState<string | null>(null);

  // ── Load API keys from server on mount (with localStorage migration) ──
  const { loadKeysFromServer, _initialized, onboardingCompleted, completeOnboarding } = useRouterStore();

  // ── Welcome banner state (shows after onboarding completes) ──
  const [showWelcome, setShowWelcome] = useState(false);
  const prevOnboardingRef = useRef(onboardingCompleted);

  useEffect(() => {
    const wasCompleted = prevOnboardingRef.current;
    prevOnboardingRef.current = onboardingCompleted;
    if (onboardingCompleted && !wasCompleted) {
      setShowWelcome(true);
      const timer = setTimeout(() => setShowWelcome(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [onboardingCompleted]);
  useEffect(() => {
    async function initKeys() {
      // First: migrate any legacy localStorage keys to server (one-time)
      if (!isKeyMigrationComplete() && countLegacyKeys() > 0) {
        try {
          const result = await migrateKeysToServer();
          if (result.migrated > 0 && result.failed === 0) {
            toast.success(`✅ Migrated ${result.migrated} API key(s) to secure storage`, { duration: 4000 });
          } else if (result.migrated > 0 && result.failed > 0) {
            toast(`⚠️ Migrated ${result.migrated} key(s), ${result.failed} failed — retry in Settings`, { duration: 6000 });
          } else if (result.failed > 0) {
            toast.error(`❌ Failed to migrate ${result.failed} key(s) — add them in Settings`, { duration: 6000 });
          }
        } catch (err) {
          console.warn('[ORACLE] Key migration failed:', err);
        }
      }
      // Then: load keys from server
      if (!_initialized) {
        await loadKeysFromServer();
      }
    }
    initKeys();
  }, [_initialized, loadKeysFromServer]);

  // ── Sync document.title on tab change ──
  useEffect(() => {
    const meta = TAB_METADATA[activeTab];
    if (meta) {
      document.title = `${meta.title} | ORACLE`;
    }
  }, [activeTab]);

  // ── Quick Action handler: dispatches event to ChatPanel ──
  const handleQuickAction = useCallback((prompt: string) => {
    window.dispatchEvent(new CustomEvent('oracle-quick-action', { detail: { prompt } }));
  }, []);

  // ── Listen for ChatPanel state updates to populate Sidebar ──
  useEffect(() => {
    const onProjectsUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.projects) setSidebarProjects(detail.projects);
    };
    const onQualityUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail?.score === 'number') setSidebarQualityScore(detail.score);
    };
    const onProjectSelect = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setSidebarSelectedProjectId(detail?.projectId ?? null);
    };
    window.addEventListener('oracle-projects-update', onProjectsUpdate);
    window.addEventListener('oracle-quality-update', onQualityUpdate);
    window.addEventListener('oracle-project-select', onProjectSelect);
    return () => {
      window.removeEventListener('oracle-projects-update', onProjectsUpdate);
      window.removeEventListener('oracle-quality-update', onQualityUpdate);
      window.removeEventListener('oracle-project-select', onProjectSelect);
    };
  }, []);

  // ── Global Keyboard Shortcuts ──
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key === 'k') {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
      }
      if (mod && e.key === 'j') {
        e.preventDefault();
        document.querySelector<HTMLTextAreaElement>('[data-chat-input]')?.focus();
      }
      if (mod && e.key === 'n') {
        e.preventDefault();
      }
      if (mod && e.key === '/') {
        e.preventDefault();
        setShortcutsHelp((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setCommandOpen(false);
        setShortcutsHelp(false);
        setNotificationsOpen(false);
      }
    },
    []
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'agent':
        return <ChatPanel onSidebarToggle={() => setSidebarOpen((p) => !p)} sidebarOpen={sidebarOpen} webSearchEnabled={webSearchEnabled} />;
      case 'prompts':
        return <PromptsTab onUsePrompt={() => setActiveTab('agent')} />;
      case 'test':
        return <TestCasesTab onAskQuestion={() => setActiveTab('agent')} />;
      case 'flows':
        return <WorkflowsTab onRunPrompt={() => setActiveTab('agent')} />;
      case 'projects':
        return <ProjectsTab onAskOracle={() => setActiveTab('agent')} />;
      case 'analytics':
        return <AnalyticsTab />;
      case 'roadmap':
        return <RoadmapTab onAskOracle={() => setActiveTab('agent')} />;
      case 'quality':
        return <QualityTab />;
      case 'memory':
        return <MemoryExtractor />;
      case 'leads':
        return <LeadsTab onAskOracle={() => setActiveTab('agent')} />;
      case 'business':
        return <BusinessTab onAskOracle={() => setActiveTab('agent')} />;
      case 'aeo-geo':
        return <AeoGeoTab onAskOracle={() => setActiveTab('agent')} />;
      case 'scope':
        return (
          <div className="flex h-full flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-4 py-6">
              <div className="mx-auto max-w-4xl">
                <ScopeChangeManager />
                <div className="mt-8">
                  <ApprovalWorkflow />
                </div>
              </div>
            </div>
          </div>
        );
      case 'payments':
        return (
          <div className="flex h-full flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-4 py-6">
              <div className="mx-auto max-w-4xl">
                <PaymentFollowUpManager />
              </div>
            </div>
          </div>
        );
      case 'orchestrator':
        return <OrchestratorPanel onAskOracle={() => setActiveTab('agent')} />;
      case 'profitability':
        return <ProfitabilityTab onAskOracle={() => setActiveTab('agent')} />;
      case 'provider-health':
        return (
          <div className="flex h-full flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-4 py-6">
              <div className="mx-auto max-w-4xl">
                <ProviderHealthPanel />
              </div>
            </div>
          </div>
        );
      case 'insights':
        return <ProactiveInsightsPanel />;
      case 'satisfaction':
        return <SatisfactionTrackerPanel />;
      case 'brand-assets':
        return <BrandAssetsPanel />;
      case 'intelligence':
        return <IntelligenceReportsPanel />;
      case 'image-gen':
        return <ImageGenerationTab />;
      case 'whatsapp-campaigns':
        return <WhatsAppCampaignTab />;
      case 'voice-agents':
        return <VoiceAgentTab />;
      case 'chatbot-builder':
        return <ChatbotBuilderTab />;
      case 'collaboration':
        return <CollaborationTab />;
      case 'razorpay':
        return <RazorpayPaymentsTab />;
      case 'rate-limit-audit':
        return <RateLimitDashboard />;
      case 'agent-performance':
        return <PerformanceDashboard />;
      case 'multi-client':
        return <MultiClientOrchestrator onAskOracle={(prompt?: string) => {
          if (prompt) {
            // Store prompt in localStorage so OrchestratorPanel picks it up on mount
            localStorage.setItem('orchestrator-last-task', prompt);
          }
          setActiveTab('orchestrator');
        }} />;
      case 'config':
      case 'settings':
        return <ConfigTab />;
      default:
        return null;
    }
  };

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange={false}
    >
      <QueryClientProvider client={queryClient}>
        {/* ── Onboarding Gate with fade transition ── */}
        <AnimatePresence mode="wait">
        {!onboardingCompleted ? (
          <motion.div
            key="onboarding"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex h-screen flex-col overflow-hidden bg-[var(--oracle-bg)]"
          >
            <div className="pointer-events-none fixed inset-0 oracle-bg-radial" aria-hidden="true" />
            <OnboardingWizard onComplete={completeOnboarding} />
          </motion.div>
        ) : (
          <motion.div
            key="app"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex h-screen flex-col overflow-hidden bg-[var(--oracle-bg)]">
            {/* ── Skip Navigation ── */}
            <SkipNav />

            {/* ── Background Radial Gradient ── */}
            <div className="pointer-events-none fixed inset-0 oracle-bg-radial" aria-hidden="true" />

            {/* ── Offline Banner ── */}
            <OfflineBanner />

            {/* ── Migration Banner ── */}
            <MigrationBanner />

            {/* ── Welcome Banner ── */}
            <AnimatePresence>
              {showWelcome && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="relative z-10 mx-4 mt-2 rounded-xl border border-[var(--oracle-success)]/30 bg-[var(--oracle-success)]/10 px-4 py-3 text-center"
                >
                  <p className="text-[13px] font-medium text-[var(--oracle-success)]">
                    👋 Welcome back! Your agency is all set up. Start chatting to see it in action.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Header ── */}
            <Header
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onCommandOpen={() => setCommandOpen(true)}
              onNotificationsOpen={() => setNotificationsOpen(true)}
            />

            {/* ── Main Content with animated tab switch ── */}
            <main id="main-content" className="relative flex-1 overflow-hidden" role="main">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  variants={motionVariants.tabContent}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={transitions.smooth}
                  className="h-full"
                >
                  <Suspense fallback={<TabFallback />}>
                    {renderTabContent()}
                  </Suspense>
                </motion.div>
              </AnimatePresence>
            </main>

            {/* ── Sidebar (Agent tab only) ── */}
            {activeTab === 'agent' && (
              <Sidebar
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                onQuickAction={handleQuickAction}
                selectedProjectId={sidebarSelectedProjectId}
                projects={sidebarProjects}
                qualityScore={sidebarQualityScore}
                webSearchEnabled={webSearchEnabled}
                onWebSearchToggle={() => setWebSearchEnabled((p) => { const next = !p; window.dispatchEvent(new CustomEvent('oracle-web-search-toggle', { detail: { enabled: next } })); return next; })}
              />
            )}

            {/* ── Notification Panel ── */}
            <NotificationPanel isOpen={notificationsOpen} onClose={() => setNotificationsOpen(false)} />

            {/* ── Command Palette ── */}
            <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} onNavigate={setActiveTab} />

            {/* ── Keyboard Shortcuts Help ── */}
            {shortcutsHelp && (
              <ShortcutsModal onClose={() => setShortcutsHelp(false)} />
            )}

            {/* ── Toast Notifications ── */}
            <Toaster
              position="bottom-right"
              toastOptions={{
                duration: 3000,
                style: {
                  background: 'var(--oracle-surface-2)',
                  color: 'var(--oracle-text-1)',
                  border: '1px solid var(--oracle-border)',
                  fontSize: '14px',
                },
              }}
            />
          </motion.div>
        )}
        </AnimatePresence>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

// ─── Shortcuts Modal ───────────────────

const SHORTCUTS = [
  { keys: '⌘ K', description: 'Open command palette' },
  { keys: '⌘ J', description: 'Focus chat input' },
  { keys: '⌘ N', description: 'New project' },
  { keys: '⌘ /', description: 'Show keyboard shortcuts' },
  { keys: '⌘ ⇧ C', description: 'Copy last response' },
  { keys: 'Esc', description: 'Close modals' },
];

function ShortcutsModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <motion.div
        className="oracle-glass oracle-card-shadow rounded-2xl p-6 w-80"
        onClick={(e) => e.stopPropagation()}
        variants={motionVariants.scaleIn}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={transitions.popSpring}
      >
        <h3 className="text-[17px] font-bold text-[var(--oracle-text-1)] mb-4">Keyboard Shortcuts</h3>
        <div className="space-y-3">
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="flex items-center justify-between">
              <span className="text-[14px] text-[var(--oracle-text-2)]">{s.description}</span>
              <kbd className="rounded-md bg-[var(--oracle-surface-2)] px-2 py-0.5 text-[12px] font-mono text-[var(--oracle-text-3)] border border-[var(--oracle-border)]">
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
