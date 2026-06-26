// ═══════════════════════════════════════
// ORACLE — Emergency Stop API
// POST /api/emergency-stop — activate/deactivate the global kill switch
// Requires authentication + admin check
// ═══════════════════════════════════════

import { NextRequest } from 'next/server';
import { validateAuth } from '@/lib/supabase/validate';
import { writeAuditLog } from '@/lib/audit-log';
import {
  activateEmergencyStop,
  deactivateEmergencyStop,
  getEmergencyStopStatus,
  getActiveSwarms,
  getCostLimit,
} from '@/lib/emergency-stop';

// ─── GET — Status ──────────────────────

export async function GET() {
  const auth = await validateAuth({ skipSubscriptionCheck: true });
  if ('error' in auth) return auth.error;

  const status = getEmergencyStopStatus();
  const activeSwarms = getActiveSwarms();
  const costLimit = getCostLimit();

  return Response.json({
    ...status,
    activeSwarms,
    costLimit,
  });
}

// ─── POST — Activate / Deactivate ──────

export async function POST(request: NextRequest) {
  const auth = await validateAuth({ skipSubscriptionCheck: true });
  if ('error' in auth) return auth.error;

  let body: { action?: 'activate' | 'deactivate'; reason?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { action, reason } = body;

  if (action === 'activate') {
    const stopReason = reason || `Activated by user ${auth.user.id.slice(0, 8)}...`;
    activateEmergencyStop(stopReason);

    writeAuditLog({
      userId: auth.user.id,
      action: 'EMERGENCY_STOP_ACTIVATED',
      entityType: 'security',
      metadata: { reason: stopReason },
    });

    return Response.json({
      message: 'Emergency stop activated. All swarm executions are paused.',
      status: getEmergencyStopStatus(),
    });
  }

  if (action === 'deactivate') {
    deactivateEmergencyStop();

    writeAuditLog({
      userId: auth.user.id,
      action: 'EMERGENCY_STOP_DEACTIVATED',
      entityType: 'security',
      metadata: {},
    });

    return Response.json({
      message: 'Emergency stop deactivated. New swarm executions can proceed.',
      status: getEmergencyStopStatus(),
    });
  }

  return Response.json(
    { error: 'action must be "activate" or "deactivate"' },
    { status: 400 },
  );
}
