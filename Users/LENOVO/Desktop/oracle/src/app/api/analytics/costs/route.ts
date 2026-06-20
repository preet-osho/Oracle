// ═══════════════════════════════════════
// ORACLE — Analytics: Cost Tracking API
// GET /api/analytics/costs — cost overview and daily breakdown
// ═══════════════════════════════════════

import { NextRequest } from 'next/server';
import { validateAuth } from '@/lib/supabase/validate';
import { getCostOverview, getDailyCosts, getCostByProvider } from '@/lib/cost-tracker';

export async function GET(request: NextRequest) {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;

  const userId = auth.user.id;
  const { searchParams } = request.nextUrl;
  const view = searchParams.get('view') || 'overview';
  const days = parseInt(searchParams.get('days') || '30', 10);

  switch (view) {
    case 'daily': {
      const daily = await getDailyCosts(userId, Math.min(days, 90));
      return Response.json({ daily });
    }

    case 'by-provider': {
      const byProvider = await getCostByProvider(userId, Math.min(days, 90));
      return Response.json({ byProvider });
    }

    case 'overview':
    default: {
      const overview = await getCostOverview(userId);
      return Response.json(overview);
    }
  }
}
