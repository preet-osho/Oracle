// ═══════════════════════════════════════
// ORACLE — localStorage → Server Migration
// Two migrations:
//   1. API Keys: oracle_byok_keys → user_api_keys table (automatic)
//   2. Data: localStorage entities → Supabase tables (user-triggered via banner)
// ═══════════════════════════════════════

import { userApiKeysApi } from '@/lib/user-api-keys';
import { NeverStopRouter } from '@/lib/router';
import { projectsApi, memoriesApi, knowledgeDocsApi, timeEntriesApi, proposalsApi, customPromptsApi, favouritesApi } from '@/lib/api';

// ═══════════════════════════════════════
// SECTION 1: API Key Migration (Automatic)
// ═══════════════════════════════════════

const KEY_MIGRATION_FLAG = 'oracle_keys_migrated_to_server';

export function isKeyMigrationComplete(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return localStorage.getItem(KEY_MIGRATION_FLAG) === 'true';
  } catch {
    return true;
  }
}

export function countLegacyKeys(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const keys = NeverStopRouter.getAllKeys();
    return Object.keys(keys).length;
  } catch {
    return 0;
  }
}

export async function migrateKeysToServer(): Promise<{ success: boolean; migrated: number; failed: number; skipped: number; errors: string[] }> {
  if (typeof window === 'undefined') {
    return { success: false, migrated: 0, failed: 0, skipped: 0, errors: ['Server-side migration not supported'] };
  }

  if (isKeyMigrationComplete()) {
    return { success: true, migrated: 0, failed: 0, skipped: 0, errors: [] };
  }

  const legacyKeys = NeverStopRouter.getAllKeys();
  const providerIds = Object.keys(legacyKeys);

  if (providerIds.length === 0) {
    localStorage.setItem(KEY_MIGRATION_FLAG, 'true');
    return { success: true, migrated: 0, failed: 0, skipped: 0, errors: [] };
  }

  let migrated = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const providerId of providerIds) {
    const key = legacyKeys[providerId];
    if (!key || key.length < 8) {
      failed++;
      errors.push(`${providerId}: key too short or empty`);
      continue;
    }
    try {
      await userApiKeysApi.save(providerId, key);
      migrated++;
    } catch (err) {
      failed++;
      errors.push(`${providerId}: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  }

  // Only clean up if ALL keys migrated; otherwise remove only successful ones
  if (failed === 0 && migrated > 0) {
    localStorage.setItem(KEY_MIGRATION_FLAG, 'true');
    try { localStorage.removeItem('oracle_byok_keys'); } catch { /* ignore */ }
  } else if (migrated > 0 && failed > 0) {
    for (const providerId of providerIds) {
      const key = legacyKeys[providerId];
      if (key && key.length >= 8 && !errors.some((e) => e.startsWith(providerId))) {
        NeverStopRouter.removeKey(providerId);
      }
    }
  }

  return { success: failed === 0, migrated, failed, skipped: 0, errors };
}

// ═══════════════════════════════════════
// SECTION 2: Data Migration (User-triggered via MigrationBanner)
// ═══════════════════════════════════════

export interface MigrationResult {
  projects: number;
  timeEntries: number;
  memories: number;
  knowledgeDocs: number;
  proposals: number;
  customPrompts: number;
  favourites: number;
  errors: string[];
}

type ProgressCallback = (step: string, current: number, total: number) => void;

const DATA_MIGRATION_KEYS = [
  'oracle_projects',
  'oracle_time_entries',
  'oracle_memories',
  'oracle_knowledge_docs',
  'oracle_proposals',
  'oracle_custom_prompts',
  'oracle_favourites',
];

const DATA_MIGRATION_FLAG = 'oracle-migration-done';

/**
 * Check if there's any legacy data in localStorage that needs migration.
 */
export function hasLocalStorageData(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return DATA_MIGRATION_KEYS.some((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return false;
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.length > 0 : !!parsed;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

/**
 * Migrate all localStorage entities to Supabase tables.
 * Reports progress via callback. Returns MigrationResult.
 */
export async function migrateLocalStorageToSupabase(onProgress: ProgressCallback): Promise<MigrationResult> {
  const result: MigrationResult = {
    projects: 0, timeEntries: 0, memories: 0, knowledgeDocs: 0,
    proposals: 0, customPrompts: 0, favourites: 0, errors: [],
  };

  let step = 0;
  const totalSteps = 7; // projects, knowledge docs, memories, time entries, proposals, prompts, favourites

  // 1. Projects → Supabase
  step++;
  onProgress('projects', step, totalSteps);
  try {
    const raw = localStorage.getItem('oracle_projects');
    if (raw) {
      const projects = JSON.parse(raw);
      if (Array.isArray(projects)) {
        for (const p of projects) {
          try {
            await projectsApi.create({
              client_name: p.clientName || p.client_name || 'Unknown',
              industry: p.industry || '',
              sector: p.sector || '',
              service: p.service || '',
              status: p.status || 'Active',
              value: p.value || '',
              city: p.city || '',
              notes: p.notes || '',
              requirements: p.requirements || [],
              contact_name: p.contact_name || '',
              contact_phone: p.contact_phone || '',
              contact_email: p.contact_email || '',
              tags: p.tags || [],
              total_hours: p.total_hours || 0,
              invoice_total: p.invoice_total || 0,
              deadline: p.deadline,
            });
            result.projects++;
          } catch (err) {
            result.errors.push(`Project "${p.clientName || 'unknown'}": ${err instanceof Error ? err.message : 'failed'}`);
          }
        }
      }
    }
  } catch (err) {
    result.errors.push(`Projects migration: ${err instanceof Error ? err.message : 'failed'}`);
  }

  // 2. Knowledge Docs → Supabase
  step++;
  onProgress('knowledgeDocs', step, totalSteps);
  try {
    const raw = localStorage.getItem('oracle_knowledge_docs');
    if (raw) {
      const docs = JSON.parse(raw);
      if (Array.isArray(docs)) {
        for (const d of docs) {
          try {
            await knowledgeDocsApi.create({
              name: d.name || 'Untitled',
              content: d.content || '',
            });
            result.knowledgeDocs++;
          } catch (err) {
            result.errors.push(`Doc "${d.name || 'unknown'}": ${err instanceof Error ? err.message : 'failed'}`);
          }
        }
      }
    }
  } catch (err) {
    result.errors.push(`Docs migration: ${err instanceof Error ? err.message : 'failed'}`);
  }

  // 3. Memories → Supabase
  step++;
  onProgress('memories', step, totalSteps);
  try {
    const raw = localStorage.getItem('oracle_memories');
    if (raw) {
      const memories = JSON.parse(raw);
      if (Array.isArray(memories)) {
        for (const m of memories) {
          try {
            const projectId = m.projectId || m.project_id;
            if (projectId) {
              await memoriesApi.create({
                client_id: projectId,
                content: m.content || '',
                category: m.category || 'general',
                importance: m.importance || 2,
              });
              result.memories++;
            }
          } catch (err) {
            result.errors.push(`Memory: ${err instanceof Error ? err.message : 'failed'}`);
          }
        }
      }
    }
  } catch (err) {
    result.errors.push(`Memories migration: ${err instanceof Error ? err.message : 'failed'}`);
  }

  // 4. Time Entries → Supabase
  step++;
  onProgress('timeEntries', step, totalSteps);
  try {
    const raw = localStorage.getItem('oracle_time_entries');
    if (raw) {
      const entries = JSON.parse(raw);
      if (Array.isArray(entries)) {
        for (const t of entries) {
          try {
            const clientId = t.clientId || t.client_id;
            if (clientId) {
              await timeEntriesApi.create({
                client_id: clientId,
                description: t.description || '',
                hours: t.hours || 0,
                rate: t.rate || 0,
                date: t.date || Date.now(),
                billable: t.billable !== false,
              });
              result.timeEntries++;
            }
          } catch (err) {
            result.errors.push(`Time entry: ${err instanceof Error ? err.message : 'failed'}`);
          }
        }
      }
    }
  } catch (err) {
    result.errors.push(`Time entries migration: ${err instanceof Error ? err.message : 'failed'}`);
  }

  // 5. Proposals → Supabase
  step++;
  onProgress('proposals', step, totalSteps);
  try {
    const raw = localStorage.getItem('oracle_proposals');
    if (raw) {
      const proposals = JSON.parse(raw);
      if (Array.isArray(proposals)) {
        for (const p of proposals) {
          try {
            await proposalsApi.create({
              brief: p.brief || '',
              domain: p.domain || 'general',
              output: p.output || '',
            });
            result.proposals++;
          } catch (err) {
            result.errors.push(`Proposal: ${err instanceof Error ? err.message : 'failed'}`);
          }
        }
      }
    }
  } catch (err) {
    result.errors.push(`Proposals migration: ${err instanceof Error ? err.message : 'failed'}`);
  }

  // 6. Custom Prompts → Supabase
  step++;
  onProgress('customPrompts', step, totalSteps);
  try {
    const raw = localStorage.getItem('oracle_custom_prompts');
    if (raw) {
      const prompts = JSON.parse(raw);
      if (Array.isArray(prompts)) {
        for (const p of prompts) {
          try {
            await customPromptsApi.create({
              title: p.title || '',
              category: p.category || 'general',
              domain: p.domain || 'general',
              difficulty: p.difficulty || 'medium',
              time_estimate: p.time_estimate || '',
              tools: p.tools || [],
              description: p.description || '',
              prompt: p.prompt || '',
            });
            result.customPrompts++;
          } catch (err) {
            result.errors.push(`Prompt "${p.title || 'unknown'}": ${err instanceof Error ? err.message : 'failed'}`);
          }
        }
      }
    }
  } catch (err) {
    result.errors.push(`Prompts migration: ${err instanceof Error ? err.message : 'failed'}`);
  }

  // 7. Favourites → Supabase
  step++;
  onProgress('favourites', step, totalSteps);
  try {
    const raw = localStorage.getItem('oracle_favourites');
    if (raw) {
      const favourites = JSON.parse(raw);
      if (Array.isArray(favourites)) {
        for (const f of favourites) {
          try {
            const promptId = f.promptId || f.prompt_id || f;
            if (typeof promptId === 'string') {
              await favouritesApi.add(promptId);
              result.favourites++;
            }
          } catch (err) {
            result.errors.push(`Favourite: ${err instanceof Error ? err.message : 'failed'}`);
          }
        }
      }
    }
  } catch (err) {
    result.errors.push(`Favourites migration: ${err instanceof Error ? err.message : 'failed'}`);
  }

  return result;
}

/**
 * Clear all legacy localStorage data after successful migration.
 */
export function clearLocalStorageAfterMigration(): void {
  if (typeof window === 'undefined') return;
  try {
    for (const key of DATA_MIGRATION_KEYS) {
      localStorage.removeItem(key);
    }
    // Also clear the old API keys since they've been migrated to server
    localStorage.removeItem('oracle_byok_keys');
    localStorage.setItem(DATA_MIGRATION_FLAG, 'true');
  } catch {
    // Ignore
  }
}
