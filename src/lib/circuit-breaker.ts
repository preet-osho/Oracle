// ═══════════════════════════════════════
// ORACLE — Circuit Breaker (Supabase-Backed)
// Persists state to Supabase so it survives serverless cold starts.
// In-memory Map is the fast path; Supabase is the durable store.
// ═══════════════════════════════════════

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createLogger } from '@/lib/logger';

const log = createLogger('CircuitBreaker');

// ─── Types ────────────────────────────

type CircuitState = 'closed' | 'open' | 'half-open';

interface ProviderCircuit {
  state: CircuitState;
  consecutiveFailures: number;
  lastFailureAt: number | null;
  lastSuccessAt: number | null;
  openedAt: number | null;
  /** Timestamp when this entry was last loaded/saved — prevents stale writes */
  updatedAt: number;
}

// ─── Configuration ────────────────────

/** Number of consecutive failures before opening the circuit */
const FAILURE_THRESHOLD = 3;

/** How long to wait before trying again (ms) — 5 minutes */
const OPEN_DURATION_MS = 5 * 60 * 1000;

/** Maximum number of providers that can be circuit-broken simultaneously */
const MAX_OPEN_CIRCUITS = 5;

// ─── Supabase Client (lazy singleton) ─

let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  supabaseClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return supabaseClient;
}

// ─── In-Memory Cache ──────────────────

const circuits = new Map<string, ProviderCircuit>();

/** Whether we've loaded initial state from Supabase */
let loaded = false;

/** Whether a load is currently in progress (prevents parallel loads) */
let loading = false;

/**
 * Load all circuit states from Supabase into memory.
 * Called lazily on first access. Non-blocking after initial load.
 */
async function loadFromSupabase(): Promise<void> {
  if (loaded || loading) return;
  loading = true;

  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      log.info('Circuit breaker: Supabase not configured, using in-memory only');
      loaded = true;
      return;
    }

    const { data, error } = await supabase
      .from('circuit_breakers')
      .select('*');

    if (error) {
      log.warn('Failed to load circuit breaker state', { error: error.message });
      loaded = true; // Don't retry on every request — treat as empty
      return;
    }

    if (data) {
      for (const row of data) {
        circuits.set(row.provider_id, {
          state: row.state as CircuitState,
          consecutiveFailures: row.consecutive_failures,
          lastFailureAt: row.last_failure_at,
          lastSuccessAt: row.last_success_at,
          openedAt: row.opened_at,
          updatedAt: row.updated_at,
        });
      }
      log.info(`Loaded ${data.length} circuit breaker states from Supabase`);
    }

    loaded = true;
  } catch (err) {
    log.error('Circuit breaker load exception', {
      error: err instanceof Error ? err.message : 'Unknown',
    });
    loaded = true;
  } finally {
    loading = false;
  }
}

/**
 * Persist a circuit state to Supabase (fire-and-forget).
 * Errors are logged but never block the caller.
 */
async function persistToSupabase(providerId: string, circuit: ProviderCircuit): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const { error } = await supabase.from('circuit_breakers').upsert(
      {
        provider_id: providerId,
        state: circuit.state,
        consecutive_failures: circuit.consecutiveFailures,
        last_failure_at: circuit.lastFailureAt,
        last_success_at: circuit.lastSuccessAt,
        opened_at: circuit.openedAt,
        updated_at: Date.now(),
      },
      { onConflict: 'provider_id' }
    );

    if (error) {
      log.warn('Failed to persist circuit breaker state', {
        providerId,
        error: error.message,
      });
    }
  } catch (err) {
    log.error('Circuit breaker persist exception', {
      providerId,
      error: err instanceof Error ? err.message : 'Unknown',
    });
  }
}

/**
 * Delete a circuit from Supabase (fire-and-forget).
 * Used when manually resetting a circuit.
 */
async function deleteFromSupabase(providerId: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const { error } = await supabase
      .from('circuit_breakers')
      .delete()
      .eq('provider_id', providerId);

    if (error) {
      log.warn('Failed to delete circuit breaker state', {
        providerId,
        error: error.message,
      });
    }
  } catch (err) {
    log.error('Circuit breaker delete exception', {
      providerId,
      error: err instanceof Error ? err.message : 'Unknown',
    });
  }
}

// ─── Internal Helpers ─────────────────

function getOrCreate(providerId: string): ProviderCircuit {
  let circuit = circuits.get(providerId);
  if (!circuit) {
    circuit = {
      state: 'closed',
      consecutiveFailures: 0,
      lastFailureAt: null,
      lastSuccessAt: null,
      openedAt: null,
      updatedAt: Date.now(),
    };
    circuits.set(providerId, circuit);
  }
  return circuit;
}

// ─── Public API ───────────────────────

/**
 * Initialize the circuit breaker by loading state from Supabase.
 * Call this once at startup (e.g., in the chat route handler).
 * Subsequent calls are no-ops.
 */
export async function initCircuitBreaker(): Promise<void> {
  await loadFromSupabase();
}

/**
 * Record a successful request to a provider.
 * Resets the failure counter and closes the circuit if it was half-open.
 */
export function recordSuccess(providerId: string): void {
  // Fire-and-forget: ensure loaded, then persist
  loadFromSupabase().catch(() => {});

  const circuit = getOrCreate(providerId);
  circuit.consecutiveFailures = 0;
  circuit.lastSuccessAt = Date.now();
  circuit.updatedAt = Date.now();

  if (circuit.state === 'half-open') {
    log.info('Circuit breaker closed — provider recovered', { providerId });
    circuit.state = 'closed';
    circuit.openedAt = null;
  }

  persistToSupabase(providerId, circuit).catch(() => {});
}

/**
 * Record a failed request to a provider.
 * Opens the circuit after FAILURE_THRESHOLD consecutive failures.
 */
export function recordFailure(providerId: string): void {
  // Fire-and-forget: ensure loaded, then persist
  loadFromSupabase().catch(() => {});

  const circuit = getOrCreate(providerId);
  circuit.consecutiveFailures++;
  circuit.lastFailureAt = Date.now();
  circuit.updatedAt = Date.now();

  if (circuit.state === 'half-open') {
    // Failed again during half-open — re-open
    log.warn('Circuit breaker re-opened — provider still failing', {
      providerId,
      failures: circuit.consecutiveFailures,
    });
    circuit.state = 'open';
    circuit.openedAt = Date.now();
    persistToSupabase(providerId, circuit).catch(() => {});
    return;
  }

  if (circuit.consecutiveFailures >= FAILURE_THRESHOLD) {
    // Count currently open circuits
    let openCount = 0;
    for (const entry of circuits.values()) {
      if (entry.state === 'open') openCount++;
    }

    // Don't open if we'd exceed the max — we need some providers available
    if (openCount >= MAX_OPEN_CIRCUITS) {
      log.warn('Circuit breaker threshold reached but max open circuits limit — keeping provider available', {
        providerId,
        openCount,
        maxOpen: MAX_OPEN_CIRCUITS,
      });
      return;
    }

    log.warn('Circuit breaker opened — provider skipped temporarily', {
      providerId,
      failures: circuit.consecutiveFailures,
      cooldownMs: OPEN_DURATION_MS,
    });
    circuit.state = 'open';
    circuit.openedAt = Date.now();
    persistToSupabase(providerId, circuit).catch(() => {});
  }
}

/**
 * Check if a provider is available (circuit is not open, or cooldown has elapsed).
 * Returns true if the provider should be tried.
 */
export function isAvailable(providerId: string): boolean {
  // Fire-and-forget: ensure loaded (doesn't block)
  loadFromSupabase().catch(() => {});

  const circuit = circuits.get(providerId);
  if (!circuit) return true; // No circuit = never failed = available

  if (circuit.state === 'closed') return true;

  if (circuit.state === 'open') {
    // Check if cooldown has elapsed
    if (circuit.openedAt && Date.now() - circuit.openedAt >= OPEN_DURATION_MS) {
      // Transition to half-open — allow one trial request
      log.info('Circuit breaker half-open — allowing trial request', { providerId });
      circuit.state = 'half-open';
      circuit.updatedAt = Date.now();
      persistToSupabase(providerId, circuit).catch(() => {});
      return true;
    }
    return false; // Still in cooldown
  }

  if (circuit.state === 'half-open') {
    return true; // Allow the trial request
  }

  return true;
}

/**
 * Get the status of all provider circuits (for monitoring/debugging).
 */
export function getCircuitStatus(): Array<{
  providerId: string;
  state: CircuitState;
  consecutiveFailures: number;
  lastFailureAt: number | null;
  lastSuccessAt: number | null;
  cooldownRemainingMs: number | null;
}> {
  const result: Array<{
    providerId: string;
    state: CircuitState;
    consecutiveFailures: number;
    lastFailureAt: number | null;
    lastSuccessAt: number | null;
    cooldownRemainingMs: number | null;
  }> = [];

  for (const [providerId, circuit] of circuits) {
    let cooldownRemainingMs: number | null = null;
    if (circuit.state === 'open' && circuit.openedAt) {
      const elapsed = Date.now() - circuit.openedAt;
      cooldownRemainingMs = Math.max(0, OPEN_DURATION_MS - elapsed);
    }

    result.push({
      providerId,
      state: circuit.state,
      consecutiveFailures: circuit.consecutiveFailures,
      lastFailureAt: circuit.lastFailureAt,
      lastSuccessAt: circuit.lastSuccessAt,
      cooldownRemainingMs,
    });
  }

  return result.sort((a, b) => b.consecutiveFailures - a.consecutiveFailures);
}

/**
 * Manually reset a provider's circuit (e.g., after admin intervention).
 */
export function resetCircuit(providerId: string): void {
  circuits.delete(providerId);
  deleteFromSupabase(providerId).catch(() => {});
  log.info('Circuit breaker manually reset', { providerId });
}

/**
 * Get the list of currently unavailable providers (circuit open).
 */
export function getUnavailableProviders(): string[] {
  const unavailable: string[] = [];
  for (const [providerId] of circuits) {
    if (!isAvailable(providerId)) {
      unavailable.push(providerId);
    }
  }
  return unavailable;
}
