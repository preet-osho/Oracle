// ═══════════════════════════════════════
// ORACLE — Analytics: Circuit Breaker Status + Reset
// GET  /api/analytics/circuits — real-time circuit breaker dashboard data
// POST /api/analytics/circuits — manually reset a provider's circuit breaker
// ═══════════════════════════════════════

import { NextRequest } from 'next/server';
import { validateAuth } from '@/lib/supabase/validate';
import { getCircuitStatus, getUnavailableProviders, resetCircuit } from '@/lib/circuit-breaker';
import { writeAuditLog } from '@/lib/audit-log';

export async function GET() {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;

  const circuits = getCircuitStatus();
  const unavailable = getUnavailableProviders();

  return Response.json({
    circuits,
    unavailable,
    summary: {
      total: circuits.length,
      open: circuits.filter((c) => c.state === 'open').length,
      halfOpen: circuits.filter((c) => c.state === 'half-open').length,
      closed: circuits.filter((c) => c.state === 'closed').length,
    },
  });
}

export async function POST(request: NextRequest) {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;

  let body: { providerId?: string; provider?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const providerId = body.providerId || body.provider;
  if (!providerId || typeof providerId !== 'string') {
    return Response.json(
      { error: 'providerId is required (string)' },
      { status: 400 }
    );
  }

  // Audit log the admin action
  writeAuditLog({
    userId: auth.user.id,
    action: 'CIRCUIT_BREAKER_RESET',
    entityType: 'circuit_breaker',
    entityId: providerId,
    metadata: { providerId },
  });

  resetCircuit(providerId);

  return Response.json({
    success: true,
    providerId,
    circuits: getCircuitStatus(),
    unavailable: getUnavailableProviders(),
  });
}
