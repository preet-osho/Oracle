// ═══════════════════════════════════════
// ORACLE — Analytics: Provider Health API
// GET /api/analytics/health — real-time provider health dashboard data
// ═══════════════════════════════════════

import { NextRequest } from 'next/server';
import { validateAuth } from '@/lib/supabase/validate';
import { getHealthOverview, getProviderHealthTimeline } from '@/lib/provider-health-server';

export async function GET(request: NextRequest) {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;

  const { searchParams } = request.nextUrl;
  const providerId = searchParams.get('provider');
  const hours = parseInt(searchParams.get('hours') || '24', 10);

  if (providerId) {
    // Get timeline for a specific provider
    const timeline = await getProviderHealthTimeline(providerId, Math.min(hours, 168));
    return Response.json({ timeline });
  }

  // Get full health overview
  const overview = await getHealthOverview();
  return Response.json(overview);
}
