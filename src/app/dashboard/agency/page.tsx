import type { Metadata } from 'next';
import { AgencyCommandCenter } from '@/components/oracle/AgencyCommandCenter';

export const metadata: Metadata = {
  title: 'Agency Command Center',
  description: 'Real-time overview of your agency operations, pipeline, leads, deals, and agent health.',
};

export default function AgencyDashboardPage() {
  return (
    <div className="h-screen bg-[var(--oracle-bg)]">
      <AgencyCommandCenter />
    </div>
  );
}
