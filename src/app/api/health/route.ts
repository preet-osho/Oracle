// ═══════════════════════════════════════
// ORACLE — Health Check Endpoint
// GET /api/health — public, no auth required
// Returns system status for uptime monitoring
// ═══════════════════════════════════════

import { getEmergencyStopStatus } from '@/lib/emergency-stop';
import { createClient } from '@supabase/supabase-js';
import { getUnavailableProviders, getCircuitStatus } from '@/lib/circuit-breaker';

export async function GET() {
  const checks: Record<string, { status: string; latencyMs?: number; [key: string]: unknown }> = {};
  let overallStatus: 'healthy' | 'degraded' | 'down' = 'healthy';

  // 1. Supabase connectivity
  const dbStart = Date.now();
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      const supabase = createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { error } = await supabase.from('conversations').select('id').limit(1);
      checks.database = {
        status: error ? 'error' : 'ok',
        latencyMs: Date.now() - dbStart,
      };
      if (error) overallStatus = 'degraded';
    } else {
      checks.database = { status: 'not_configured' };
      overallStatus = 'degraded';
    }
  } catch {
    checks.database = { status: 'error', latencyMs: Date.now() - dbStart };
    overallStatus = 'down';
  }

  // 2. Encryption key availability
  checks.encryption = {
    status: process.env.API_KEY_ENCRYPTION_KEY ? 'ok' : 'not_configured',
  };

  // 3. Emergency stop status
  const emergencyStatus = getEmergencyStopStatus();
  checks.emergencyStop = {
    status: emergencyStatus.active ? 'active' : 'ok',
  };
  if (emergencyStatus.active) overallStatus = 'degraded';

  // 4. Provider availability (check if any keys are configured server-side)
  checks.providers = {
    status: process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY ? 'configured' : 'byok_only',
  };

  // 5. Circuit breaker status
  const unavailable = getUnavailableProviders();
  const circuits = getCircuitStatus();
  const openCircuits = circuits.filter((c) => c.state === 'open').length;
  checks.circuitBreaker = {
    status: openCircuits > 0 ? 'degraded' : 'ok',
    open: openCircuits,
    unavailable,
  };
  if (openCircuits > 0) overallStatus = 'degraded';

  return Response.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: '2.3.0',
    checks,
  });
}
