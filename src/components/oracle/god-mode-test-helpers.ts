import type { GodModeMessageEntry, GodModeToggleEntry, NormalMessageEntry } from '@/lib/god-mode-metrics';

// ─── Mock Data ─────────────────────────────

export const MOCK_GOD_MODE_METRICS = {
  totalToggles: 5,
  totalMessages: 12,
  totalTokens: 48000,
  avgQuality: 0.85,
  successfulMessages: 10,
  agentBreakdown: {
    researcher: { count: 8, successCount: 7, totalTokens: 32000, avgQuality: 0.88 },
  } as Record<string, { count: number; successCount: number; totalTokens: number; avgQuality: number }>,
  providerBreakdown: {
    openai: { count: 8, successCount: 7, totalTokens: 32000, avgQuality: 0.88 },
  } as Record<string, { count: number; successCount: number; totalTokens: number; avgQuality: number }>,
  scoredMessages: [
    { id: 'test-1', timestamp: Date.now(), agentType: 'researcher', provider: 'openai', model: 'gpt-4o', tokensUsed: 5000, wasSuccessful: true, qualityScore: 0.9 },
    { id: 'test-2', timestamp: Date.now() - 1000, agentType: 'researcher', provider: 'anthropic', model: 'claude-sonnet', tokensUsed: 3000, wasSuccessful: true, qualityScore: 0.85 },
  ] as import('@/lib/god-mode-metrics').GodModeMessageEntry[],
  qualityDistribution: [
    { range: '0-25%', count: 0 },
    { range: '25-50%', count: 0 },
    { range: '50-75%', count: 1 },
    { range: '75-100%', count: 1 },
  ],
  agentQualityDistribution: {
    researcher: [
      { range: '0-25%', count: 0 },
      { range: '25-50%', count: 0 },
      { range: '50-75%', count: 1 },
      { range: '75-100%', count: 1 },
    ],
  },
  providerQualityDistribution: {
    openai: [
      { range: '0-25%', count: 0 },
      { range: '25-50%', count: 0 },
      { range: '50-75%', count: 1 },
      { range: '75-100%', count: 0 },
    ],
    anthropic: [
      { range: '0-25%', count: 0 },
      { range: '25-50%', count: 0 },
      { range: '50-75%', count: 0 },
      { range: '75-100%', count: 1 },
    ],
  },
};

export const MOCK_GOD_MODE_COST_ANALYSIS = {
  avgTokensGodMode: 4000,
  avgTokensNormal: 2500,
  overheadPercent: 60,
  totalGodModeTokens: 48000,
  godModeMessageCount: 12,
};

export const MOCK_GOD_MODE_TIMELINE_DATA = [
  { date: '07/20', godModeTokens: 8000, normalTokens: 4000, godModeMessages: 2, normalMessages: 3 },
  { date: '07/21', godModeTokens: 12000, normalTokens: 6000, godModeMessages: 3, normalMessages: 4 },
];

// ─── Message Fixtures ─────────────────────

export const MOCK_GOD_MODE_MESSAGES: GodModeMessageEntry[] = [
  { id: 'test-1', timestamp: Date.now(), agentType: 'researcher', provider: 'openai', model: 'gpt-4o', tokensUsed: 5000, wasSuccessful: true, qualityScore: 0.9 },
  { id: 'test-2', timestamp: Date.now() - 1000, agentType: 'researcher', provider: 'anthropic', model: 'claude-sonnet', tokensUsed: 3000, wasSuccessful: true, qualityScore: 0.85 },
];

export const MOCK_NORMAL_MESSAGES: NormalMessageEntry[] = [
  { id: 'norm-1', timestamp: Date.now(), agentType: 'writer', tokensUsed: 3000, wasSuccessful: true },
  { id: 'norm-2', timestamp: Date.now() - 2000, agentType: 'analyst', tokensUsed: 2000, wasSuccessful: true },
];

export const MOCK_GOD_MODE_TOGGLES: GodModeToggleEntry[] = [
  { id: 'toggle-1', timestamp: Date.now(), enabled: true, agentType: 'researcher' },
  { id: 'toggle-2', timestamp: Date.now() - 5000, enabled: false, agentType: 'writer' },
];

// ─── Disabled Metrics (for non-export tests) ──

export const MOCK_GOD_MODE_METRICS_DISABLED = {
  ...MOCK_GOD_MODE_METRICS,
  totalToggles: 0,
};
