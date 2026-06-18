// ═══════════════════════════════════════
// ORACLE — Router State Store (Zustand)
// ═══════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SelectedModel, UsageRecord } from '@/types';
import { NeverStopRouter } from '@/lib/router';
import { userApiKeysApi, type ApiKeyInfo } from '@/lib/user-api-keys';

// ─── Types ─────────────────────────────

export type ProviderStatus = 'idle' | 'active' | 'ok' | 'fail' | 'rate_limited';

interface McpEnabled {
  gmail: boolean;
  calendar: boolean;
  drive: boolean;
}

interface RouterState {
  // Keys (server-side storage — values are masked previews, not real keys)
  byokKeys: Record<string, string>;
  configuredProviders: string[];
  loadKeysFromServer: () => Promise<void>;
  setByokKey: (providerId: string, key: string) => Promise<void>;
  removeByokKey: (providerId: string) => Promise<void>;
  _initialized: boolean;

  // Model selection
  selectedModel: SelectedModel;
  setSelectedModel: (provider: string, model: string) => void;

  // Auto routing
  autoRoute: boolean;
  toggleAutoRoute: () => void;

  // Provider statuses
  providerStatuses: Record<string, ProviderStatus>;
  updateProviderStatus: (providerId: string, status: ProviderStatus) => void;

  // Cost tracking
  totalCostUSD: number;
  totalCostINR: number;
  addCost: (usd: number, inr: number) => void;
  resetCosts: () => void;

  // Usage history
  usageHistory: UsageRecord[];
  addUsageRecord: (record: UsageRecord) => void;

  // MCP
  mcpEnabled: McpEnabled;
  toggleMcp: (service: keyof McpEnabled) => void;

  // Streaming
  streamingEnabled: boolean;
  toggleStreaming: () => void;

  // Temperature
  temperature: number;
  setTemperature: (temp: number) => void;

  // Onboarding
  onboardingCompleted: boolean;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
}

// ─── Store ─────────────────────────────

export const useRouterStore = create<RouterState>()(
  persist(
    (set, get) => ({
      // Keys — server-side storage (keys never leave the server)
      byokKeys: {},
      configuredProviders: [],
      _initialized: false,

      loadKeysFromServer: async () => {
        try {
          const keys: ApiKeyInfo[] = await userApiKeysApi.list();
          const byokKeys: Record<string, string> = {};
          const configuredProviders: string[] = [];
          for (const k of keys) {
            if (k.is_active) {
              byokKeys[k.provider_id] = k.key_preview;
              configuredProviders.push(k.provider_id);
            }
          }
          set({ byokKeys, configuredProviders, _initialized: true });
        } catch {
          // Not authenticated or server error — fall back to empty
          set({ byokKeys: {}, configuredProviders: [], _initialized: true });
        }
      },

      setByokKey: async (providerId: string, key: string) => {
        try {
          await userApiKeysApi.save(providerId, key);
          await get().loadKeysFromServer();
        } catch {
          // Fall back to local-only (will work until page refresh)
          NeverStopRouter.setKey(providerId, key);
          set({ byokKeys: NeverStopRouter.getAllKeys() });
        }
      },

      removeByokKey: async (providerId: string) => {
        try {
          await userApiKeysApi.remove(providerId);
          await get().loadKeysFromServer();
        } catch {
          NeverStopRouter.removeKey(providerId);
          set({ byokKeys: NeverStopRouter.getAllKeys() });
        }
      },

      // Model selection
      selectedModel: { providerId: 'groq', modelId: 'llama-3.3-70b-versatile' },

      setSelectedModel: (provider: string, model: string) => {
        set({ selectedModel: { providerId: provider, modelId: model } });
      },

      // Auto routing
      autoRoute: true,

      toggleAutoRoute: () => {
        set((state) => ({ autoRoute: !state.autoRoute }));
      },

      // Provider statuses
      providerStatuses: {},

      updateProviderStatus: (providerId: string, status: ProviderStatus) => {
        set((state) => ({
          providerStatuses: { ...state.providerStatuses, [providerId]: status },
        }));
      },

      // Cost tracking
      totalCostUSD: 0,
      totalCostINR: 0,

      addCost: (usd: number, inr: number) => {
        set((state) => ({
          totalCostUSD: Math.round((state.totalCostUSD + usd) * 10000) / 10000,
          totalCostINR: Math.round((state.totalCostINR + inr) * 100) / 100,
        }));
      },

      resetCosts: () => {
        set({ totalCostUSD: 0, totalCostINR: 0 });
      },

      // Usage history (keep last 100)
      usageHistory: [],

      addUsageRecord: (record: UsageRecord) => {
        set((state) => ({
          usageHistory: [record, ...state.usageHistory].slice(0, 100),
        }));
      },

      // MCP
      mcpEnabled: { gmail: false, calendar: false, drive: false },

      toggleMcp: (service: keyof McpEnabled) => {
        set((state) => ({
          mcpEnabled: {
            ...state.mcpEnabled,
            [service]: !state.mcpEnabled[service],
          },
        }));
      },

      // Streaming
      streamingEnabled: true,

      toggleStreaming: () => {
        set((state) => ({ streamingEnabled: !state.streamingEnabled }));
      },

      // Temperature
      temperature: 0.7,

      setTemperature: (temp: number) => {
        set({ temperature: Math.max(0, Math.min(1, temp)) });
      },

      // Onboarding
      onboardingCompleted: false,

      completeOnboarding: () => {
        set({ onboardingCompleted: true });
      },

      resetOnboarding: () => {
        set({ onboardingCompleted: false });
      },
    }),
    {
      name: 'oracle-router-store',
      partialize: (state) => ({
        selectedModel: state.selectedModel,
        mcpEnabled: state.mcpEnabled,
        streamingEnabled: state.streamingEnabled,
        autoRoute: state.autoRoute,
        temperature: state.temperature,
        onboardingCompleted: state.onboardingCompleted,
      }),
    }
  )
);
