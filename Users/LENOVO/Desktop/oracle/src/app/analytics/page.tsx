// ═══════════════════════════════════════
// ORACLE — Analytics Dashboard Page
// Server-side cost tracking + real-time provider health
// ═══════════════════════════════════════

'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ProviderHealthDashboard from '@/components/oracle/ProviderHealthDashboard';
import CostDashboard from '@/components/oracle/CostDashboard';

// ─── Page ─────────────────────────────

export default function AnalyticsPage() {
  const [tab, setTab] = useState('health');

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* ── Header ── */}
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Analytics</h1>
          <p className="text-sm text-zinc-500">
            Real-time provider health monitoring and server-side cost tracking
          </p>
        </div>

        {/* ── Tabs ── */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-zinc-900 border border-white/10">
            <TabsTrigger value="health" className="data-[state=active]:bg-zinc-800">
              🏥 Provider Health
            </TabsTrigger>
            <TabsTrigger value="costs" className="data-[state=active]:bg-zinc-800">
              💰 Cost Tracking
            </TabsTrigger>
          </TabsList>

          <TabsContent value="health" className="mt-6">
            <ProviderHealthDashboard />
          </TabsContent>

          <TabsContent value="costs" className="mt-6">
            <CostDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
