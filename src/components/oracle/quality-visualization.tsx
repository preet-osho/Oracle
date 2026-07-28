'use client';

import React from 'react';
import { QUALITY_BUCKET_COLORS } from '@/lib/god-mode-metrics';


// ─── QualityDistributionBreakdown ──────

export function QualityDistributionBreakdown({ data, label }: { data: Record<string, { range: string; count: number }[]>; label: string }) {
  const entries = Object.entries(data);
  if (entries.length === 0) return null;
  const headingId = `quality-dist-${label.replace(/[^a-z0-9]/gi, '-').toLowerCase().replace(/^-+|-+$/g, '')}-heading`;
  return (
    <div className="mt-4" role="figure" aria-labelledby={headingId}>
      <h4 id={headingId} className="text-[12px] font-semibold text-[var(--oracle-text-2)] mb-2">{label}</h4>
      <div className="space-y-3">
        {entries
          .sort((a, b) => b[1].reduce((s, bucket) => s + bucket.count, 0) - a[1].reduce((s, bucket) => s + bucket.count, 0))
          .map(([name, buckets]) => {
            const totalCount = buckets.reduce((s, b) => s + b.count, 0);
            if (totalCount === 0) return null;
            const maxCount = Math.max(...buckets.map((b) => b.count), 1);
            return (
              <div key={name} className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-[var(--oracle-text-1)] capitalize min-w-[70px]">{name}</span>
                <div className="flex items-end gap-1 flex-1 h-[30px]">
                  {buckets.map((b, bi) => {
                    const heightPercent = (b.count / maxCount) * 100;
                    return (
                      <div key={b.range} className="flex-1 flex flex-col items-center">
                        <div className="w-full rounded-t bg-[var(--oracle-surface-2)] overflow-hidden" style={{ height: '24px' }}>
                          <div
                            data-testid="histogram-bar"
                            role="img"
                            aria-label={`${b.range}: ${b.count} score${b.count !== 1 ? 's' : ''}`}
                            className="w-full rounded-t transition-all duration-300"
                            style={{ height: `${heightPercent}%`, backgroundColor: QUALITY_BUCKET_COLORS[bi] }}
                          />
                        </div>
                        {b.count > 0 && <span data-testid="bucket-count" className="text-[8px] text-[var(--oracle-text-muted)]">{b.count}</span>}
                      </div>
                    );
                  })}
                </div>
                <span className="text-[9px] text-[var(--oracle-text-muted)] min-w-[30px] text-right">{totalCount}</span>
              </div>
            );
          })}
      </div>
    </div>
  );
}
