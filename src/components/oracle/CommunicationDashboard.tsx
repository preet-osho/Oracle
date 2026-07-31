'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  getCommunicationStats,
  type CommunicationStats,
  type CommunicationHealthStatus,
} from '@/lib/communication-hub';
import { fetchWithTimeout, TIMEOUT_QUICK_MS } from '@/lib/fetch-utils';
import {
  getCommunications,
  getCommunicationStats as getLogStats,
  getPendingFollowUps,
  getChannelIcon,
  getSentimentIcon,
  type CommunicationEntry,
  type CommunicationChannel,
} from '@/lib/communication-log';
import {
  getDeliveryEvents,
  getDeliveryStats,
  clearTestEvents,
  cleanExpiredTestEvents,
  getTestEventTTL,
  setTestEventTTL,
  type DeliveryEvent,
  type DeliveryChannel,
  type DeliveryProvider,
  type DeliveryEventType,
} from '@/lib/delivery-events';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts';
import { copyToClipboard } from '@/lib/utils';
import { downloadBlob } from '@/lib/download-blob';

// ─── Types ─────────────────────────────

interface DashboardData {
  delivery: CommunicationStats;
  health: CommunicationHealthStatus;
  log: {
    total: number;
    outbound: number;
    inbound: number;
    channels: Record<CommunicationChannel, number>;
    sentimentBreakdown: Record<string, number>;
    pendingFollowUps: number;
  };
  recentEntries: CommunicationEntry[];
  pendingFollowUps: CommunicationEntry[];
  deliveryEvents: DeliveryEvent[];
  deliveryStats: { delivered: number; failed: number; pending: number; opened: number; clicked: number; totalEvents: number };
}

type DashboardTab = 'overview' | 'events';

type TimeRange = '24h' | '7d' | '30d' | 'all';

// ─── Helpers ───────────────────────────

function getTimeRangeMs(range: TimeRange): number {
  switch (range) {
    case '24h': return 24 * 60 * 60 * 1000;
    case '7d': return 7 * 24 * 60 * 60 * 1000;
    case '30d': return 30 * 24 * 60 * 60 * 1000;
    case 'all': return Infinity;
  }
}

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ─── Sub-Components ────────────────────

function MetricCard({
  title, value, subtitle, icon, color = 'text-zinc-100',
}: {
  title: string; value: string | number; subtitle?: string; icon: string; color?: string;
}) {
  return (
    <Card className="border-white/10 bg-white/5 hover:bg-white/8 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-zinc-500 mb-1">{title}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            {subtitle && <p className="text-xs text-zinc-500 mt-1">{subtitle}</p>}
          </div>
          <span className="text-lg">{icon}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function HealthBadge({ status }: { status: 'healthy' | 'degraded' | 'down' }) {
  const config = {
    healthy: { label: 'Healthy', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
    degraded: { label: 'Degraded', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
    down: { label: 'Down', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
  };
  const { label, color } = config[status];
  return <Badge className={`text-[10px] ${color}`}>{label}</Badge>;
}

function ProviderCard({
  title, icon, status, details,
}: {
  title: string; icon: string; status: 'healthy' | 'degraded' | 'down'; details: string[];
}) {
  return (
    <Card className="border-white/10 bg-white/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-zinc-300 flex items-center gap-2">
          {icon} {title}
          <HealthBadge status={status} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1.5">
          {details.map((detail, i) => (
            <div key={i} className="flex items-center justify-between py-1">
              <span className="text-xs text-zinc-400">{detail.split(':')[0]}</span>
              <span className="text-xs text-zinc-300">{detail.split(':')[1]?.trim() || ''}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ChannelBreakdownCard({
  channels, total,
}: {
  channels: Record<string, number>; total: number;
}) {
  const channelEntries = Object.entries(channels).sort((a, b) => b[1] - a[1]);
  const channelColors: Record<string, string> = {
    email: 'bg-indigo-500',
    whatsapp: 'bg-emerald-500',
    phone: 'bg-amber-500',
    linkedin: 'bg-sky-500',
    meeting: 'bg-pink-500',
    'in-person': 'bg-violet-500',
    other: 'bg-zinc-500',
  };

  return (
    <Card className="border-white/10 bg-white/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-zinc-300">📡 Channel Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        {channelEntries.length === 0 ? (
          <p className="text-xs text-zinc-500">No communication data yet</p>
        ) : (
          <div className="space-y-2">
            {channelEntries.map(([channel, count]) => {
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={channel}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-zinc-400">
                      {getChannelIcon(channel as CommunicationChannel)} {channel}
                    </span>
                    <span className="text-xs text-zinc-300">{count} ({pct}%)</span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${channelColors[channel] || 'bg-zinc-500'} rounded-full transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SentimentCard({
  sentimentBreakdown, total,
}: {
  sentimentBreakdown: Record<string, number>; total: number;
}) {
  const sentimentColors: Record<string, string> = {
    positive: 'bg-emerald-500',
    neutral: 'bg-zinc-500',
    negative: 'bg-red-500',
  };

  return (
    <Card className="border-white/10 bg-white/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-zinc-300">💬 Sentiment Analysis</CardTitle>
      </CardHeader>
      <CardContent>
        {Object.keys(sentimentBreakdown).length === 0 ? (
          <p className="text-xs text-zinc-500">No sentiment data yet</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(sentimentBreakdown)
              .sort((a, b) => b[1] - a[1])
              .map(([sentiment, count]) => {
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={sentiment}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-zinc-400">
                        {getSentimentIcon(sentiment)} {sentiment}
                      </span>
                      <span className="text-xs text-zinc-300">{count} ({pct}%)</span>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${sentimentColors[sentiment] || 'bg-zinc-500'} rounded-full transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RecentActivityCard({ entries }: { entries: CommunicationEntry[] }) {
  return (
    <Card className="border-white/10 bg-white/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-zinc-300">🕐 Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-xs text-zinc-500">No recent activity</p>
        ) : (
          <div className="space-y-2">
            {entries.slice(0, 8).map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-2 py-1.5 border-b border-white/5 last:border-0"
              >
                <span className="text-sm mt-0.5">{getChannelIcon(entry.channel)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-zinc-300 truncate">
                      {entry.subject}
                    </span>
                    <span className="text-[10px] text-zinc-600">
                      {formatTimeAgo(entry.timestamp)}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 truncate">{entry.summary}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px]">
                    {entry.direction === 'outbound' ? '↗️' : '↙️'}
                  </span>
                  <span className="text-[10px]">{getSentimentIcon(entry.sentiment)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FollowUpsCard({ entries }: { entries: CommunicationEntry[] }) {
  return (
    <Card className="border-white/10 bg-white/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-zinc-300 flex items-center gap-2">
          🔔 Pending Follow-ups
          {entries.length > 0 && (
            <Badge className="text-[10px] bg-amber-500/20 text-amber-300 border-amber-500/30">
              {entries.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-xs text-zinc-500">All caught up! 🎉</p>
        ) : (
          <div className="space-y-2">
            {entries.slice(0, 5).map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-2 py-1.5 border-b border-white/5 last:border-0"
              >
                <span className="text-sm mt-0.5">{getChannelIcon(entry.channel)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-zinc-300 truncate">
                      {entry.clientName}
                    </span>
                    <span className="text-[10px] text-zinc-600">
                      {entry.followUpDate ? new Date(entry.followUpDate).toLocaleDateString() : 'No date'}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 truncate">{entry.subject}</p>
                </div>
                <span className="text-[10px]">⏰</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Delivery Rates Card ───────────────

function DeliveryRatesCard({ stats }: { stats: DashboardData['deliveryStats'] }) {
  const total = stats.totalEvents;
  const deliveryRate = total > 0 ? Math.round((stats.delivered / total) * 100) : 0;
  const openRate = stats.delivered > 0 ? Math.round((stats.opened / stats.delivered) * 100) : 0;
  const clickRate = stats.delivered > 0 ? Math.round((stats.clicked / stats.delivered) * 100) : 0;
  const bounceRate = total > 0 ? Math.round((stats.failed / total) * 100) : 0;

  const rates = [
    { label: 'Delivery Rate', value: deliveryRate, color: 'text-emerald-400', barColor: 'bg-emerald-500', icon: '📬' },
    { label: 'Open Rate', value: openRate, color: 'text-violet-400', barColor: 'bg-violet-500', icon: '👁️' },
    { label: 'Click Rate', value: clickRate, color: 'text-pink-400', barColor: 'bg-pink-500', icon: '🖱️' },
    { label: 'Bounce Rate', value: bounceRate, color: 'text-red-400', barColor: 'bg-red-500', icon: '↩️' },
  ];

  return (
    <Card className="border-white/10 bg-white/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-zinc-300 flex items-center gap-2">
          📈 Delivery Rates
          {total > 0 && (
            <Badge className="text-[10px] bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
              {total} events
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="text-xs text-zinc-500">No delivery events yet. Rates will appear as webhooks are received.</p>
        ) : (
          <div className="space-y-3">
            {rates.map((rate) => (
              <div key={rate.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-zinc-400">
                    {rate.icon} {rate.label}
                  </span>
                  <span className={`text-xs font-medium ${rate.color}`}>{rate.value}%</span>
                </div>
                <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${rate.barColor} rounded-full transition-all duration-500`}
                    style={{ width: `${rate.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Delivery Rate Trend Chart ───────

function DeliveryRateTrendChart({ events }: { events: DeliveryEvent[] }) {
  const chartData = React.useMemo(() => {
    if (events.length === 0) return [];

    // eslint-disable-next-line react-hooks/purity -- Date.now() is stable within a render cycle
    const now = Date.now();
    const hoursToShow = 48;
    const bucketMs = 60 * 60 * 1000;

    // Create buckets with tracking for delivered and total per channel
    const buckets: Array<{
      time: string;
      emailDelivered: number;
      emailTotal: number;
      whatsappDelivered: number;
      whatsappTotal: number;
      timestamp: number;
    }> = [];

    for (let i = hoursToShow - 1; i >= 0; i--) {
      const bucketStart = now - (i + 1) * bucketMs;
      const date = new Date(bucketStart);
      buckets.push({
        time: `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:00`,
        emailDelivered: 0,
        emailTotal: 0,
        whatsappDelivered: 0,
        whatsappTotal: 0,
        timestamp: bucketStart,
      });
    }

    // Fill buckets
    for (const event of events) {
      const bucketIndex = Math.floor((now - event.receivedAt) / bucketMs);
      const arrayIndex = hoursToShow - 1 - bucketIndex;
      if (arrayIndex >= 0 && arrayIndex < buckets.length) {
        if (event.channel === 'email') {
          buckets[arrayIndex].emailTotal++;
          if (event.eventType.endsWith('.delivered')) buckets[arrayIndex].emailDelivered++;
        }
        if (event.channel === 'whatsapp') {
          buckets[arrayIndex].whatsappTotal++;
          if (event.eventType.endsWith('.delivered')) buckets[arrayIndex].whatsappDelivered++;
        }
      }
    }

    // Compute rates and label filtering
    return buckets.map((b, i) => ({
      time: i % 4 === 0 ? b.time : '',
      emailRate: b.emailTotal > 0 ? Math.round((b.emailDelivered / b.emailTotal) * 100) : null,
      whatsappRate: b.whatsappTotal > 0 ? Math.round((b.whatsappDelivered / b.whatsappTotal) * 100) : null,
    }));
  }, [events]);

  if (events.length === 0) {
    return (
      <Card className="border-white/10 bg-white/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-zinc-300">📉 Delivery Rate Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-zinc-500">No events to chart yet. Rates will appear as webhooks are received.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-white/10 bg-white/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-zinc-300">📉 Delivery Rate Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: '#52525b' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.05)' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#52525b' }}
                axisLine={false}
                tickLine={false}
                domain={[0, 100]}
                tickFormatter={(v: number) => `${v}%`}
              />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: '#18181b',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  fontSize: '11px',
                }}
                labelStyle={{ color: '#a1a1aa' }}
                formatter={(value, name) => [
                  typeof value === 'number' ? `${value}%` : 'N/A',
                  name === 'emailRate' ? '📧 Email' : '💬 WhatsApp',
                ]}
              />
              <Legend
                wrapperStyle={{ fontSize: '11px' }}
                iconType="circle"
                iconSize={6}
                formatter={(value: string) => value === 'emailRate' ? '📧 Email' : '💬 WhatsApp'}
              />
              <Line
                type="monotone"
                dataKey="emailRate"
                name="emailRate"
                stroke="#6366f1"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="whatsappRate"
                name="whatsappRate"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Delivery Trend Chart ─────────────

function DeliveryTrendChart({ events }: { events: DeliveryEvent[] }) {
  // Aggregate events into hourly buckets for the last 7 days
  const chartData = React.useMemo(() => {
    if (events.length === 0) return [];

    // eslint-disable-next-line react-hooks/purity -- Date.now() is stable within a render cycle
    const now = Date.now();
    const hoursToShow = 48; // Show last 48 hours
    const bucketMs = 60 * 60 * 1000; // 1 hour buckets

    // Create empty buckets
    const buckets: Array<{ time: string; email: number; whatsapp: number; timestamp: number }> = [];
    for (let i = hoursToShow - 1; i >= 0; i--) {
      const bucketStart = now - (i + 1) * bucketMs;
      const date = new Date(bucketStart);
      buckets.push({
        time: `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:00`,
        email: 0,
        whatsapp: 0,
        timestamp: bucketStart,
      });
    }

    // Fill buckets with event counts
    for (const event of events) {
      const bucketIndex = Math.floor((now - event.receivedAt) / bucketMs);
      const arrayIndex = hoursToShow - 1 - bucketIndex;
      if (arrayIndex >= 0 && arrayIndex < buckets.length) {
        if (event.channel === 'email') buckets[arrayIndex].email++;
        if (event.channel === 'whatsapp') buckets[arrayIndex].whatsapp++;
      }
    }

    // Show every 4th label to avoid overcrowding
    return buckets.map((b, i) => ({
      ...b,
      time: i % 4 === 0 ? b.time : '',
    }));
  }, [events]);

  if (events.length === 0) {
    return (
      <Card className="border-white/10 bg-white/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-zinc-300">📈 Delivery Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-zinc-500">No events to chart yet. Events will appear as webhooks are received.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-white/10 bg-white/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-zinc-300">📈 Delivery Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: '#52525b' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.05)' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#52525b' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: '#18181b',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  fontSize: '11px',
                }}
                labelStyle={{ color: '#a1a1aa' }}
              />
              <Legend
                wrapperStyle={{ fontSize: '11px' }}
                iconType="circle"
                iconSize={6}
              />
              <Area
                type="monotone"
                dataKey="email"
                name="📧 Email"
                stroke="#6366f1"
                fill="#6366f1"
                fillOpacity={0.15}
                strokeWidth={1.5}
              />
              <Area
                type="monotone"
                dataKey="whatsapp"
                name="💬 WhatsApp"
                stroke="#10b981"
                fill="#10b981"
                fillOpacity={0.15}
                strokeWidth={1.5}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Delivery Event Helpers ────────────

function getEventStatusBadge(eventType: DeliveryEventType): { label: string; color: string } {
  if (eventType.endsWith('.delivered')) return { label: 'Delivered', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
  if (eventType.endsWith('.failed') || eventType.endsWith('.bounced') || eventType.endsWith('.undelivered')) return { label: 'Failed', color: 'bg-red-500/20 text-red-300 border-red-500/30' };
  if (eventType.endsWith('.sent') || eventType.endsWith('.queued') || eventType.endsWith('.scheduled')) return { label: 'Sent', color: 'bg-sky-500/20 text-sky-300 border-sky-500/30' };
  if (eventType.includes('opened')) return { label: 'Opened', color: 'bg-violet-500/20 text-violet-300 border-violet-500/30' };
  if (eventType.includes('clicked')) return { label: 'Clicked', color: 'bg-pink-500/20 text-pink-300 border-pink-500/30' };
  if (eventType.includes('delivery_delayed')) return { label: 'Delayed', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
  if (eventType.includes('complained')) return { label: 'Complaint', color: 'bg-red-500/20 text-red-300 border-red-500/30' };
  if (eventType.includes('read')) return { label: 'Read', color: 'bg-violet-500/20 text-violet-300 border-violet-500/30' };
  return { label: eventType.split('.').pop() || eventType, color: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30' };
}

function getEventChannelIcon(channel: DeliveryChannel): string {
  return channel === 'email' ? '📧' : '💬';
}

function getProviderBadge(provider: DeliveryProvider): { label: string; color: string } {
  if (provider === 'resend') return { label: 'Resend', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' };
  return { label: 'Twilio', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
}

// ─── Copy Event JSON Button ──────────

function CopyJsonButton({ event }: { event: DeliveryEvent }) {
  const [copied, setCopied] = React.useState(false);
  const [copyError, setCopyError] = React.useState(false);

  const handleCopy = React.useCallback(async () => {
    const json = JSON.stringify(event, null, 2);
    const ok = await copyToClipboard(json);
    if (ok) {
      setCopied(true);
      setCopyError(false);
      setTimeout(() => setCopied(false), 1500);
    } else {
      setCopyError(true);
      setTimeout(() => setCopyError(false), 2000);
    }
  }, [event]);

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-md border border-white/10 text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-colors"
      title="Copy event data as JSON"
      aria-label="Copy event JSON"
    >
      {copied ? (
        <>
          <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-emerald-400">Copied!</span>
        </>
      ) : copyError ? (
        <>
          <svg className="w-3.5 h-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-red-400">Failed</span>
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
          </svg>
          <span>Copy JSON</span>
        </>
      )}
    </button>
  );
}

// ─── Download Event JSON Button ────

function DownloadJsonButton({ event }: { event: DeliveryEvent }) {
  const [downloading, setDownloading] = React.useState(false);

  const handleDownload = React.useCallback(async () => {
    setDownloading(true);
    // Yield to allow the spinner to render before heavy serialization
    await new Promise((r) => setTimeout(r, 0));
    try {
      const json = JSON.stringify(event, null, 2);
      downloadBlob(json, `delivery-event-${event.id.slice(0, 16)}.json`, 'application/json');
    } finally {
      setDownloading(false);
    }
  }, [event]);

  return (
    <button
      onClick={handleDownload}
      disabled={downloading}
      className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-md border border-white/10 text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      title="Download event data as JSON file"
      aria-label="Download event JSON"
    >
      {downloading ? (
        <>
          <div className="h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-white/30 border-t-white" />
          <span>Generating…</span>
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span>Download JSON</span>
        </>
      )}
    </button>
  );
}

// ─── Helpers for collapsible metadata ──

function isCollapsibleValue(value: unknown): boolean {
  if (value === null || value === undefined || typeof value !== 'object') return false;
  const json = JSON.stringify(value);
  return json.length > 60 || Array.isArray(value);
}

// ─── Delivery Event Detail Modal ──────

function DeliveryEventModal({ event, onClose }: { event: DeliveryEvent; onClose: () => void }) {
  const statusBadge = getEventStatusBadge(event.eventType);
  const providerBadge = getProviderBadge(event.provider);
  const metadataEntries = Object.entries(event.metadata).filter(([, v]) => v !== undefined && v !== null);
  const [expandedKeys, setExpandedKeys] = React.useState<Set<string>>(() => {
    // Expand small values by default, collapse large/nested ones
    const initial = new Set<string>();
    for (const [key, value] of metadataEntries) {
      if (!isCollapsibleValue(value)) initial.add(key);
    }
    return initial;
  });

  const toggleKey = React.useCallback((key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  // Close on Escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Delivery event details"
    >
      <div
        className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-lg mx-4 max-h-[80vh] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <span className="text-lg">{getEventChannelIcon(event.channel)}</span>
            <div>
              <div className="flex items-center gap-2">
                <Badge className={`text-[10px] ${statusBadge.color}`}>{statusBadge.label}</Badge>
                <Badge className={`text-[10px] ${providerBadge.color}`}>{providerBadge.label}</Badge>
                {event.metadata?.testEvent === true && (
                  <Badge className="text-[10px] bg-amber-500/20 text-amber-300 border-amber-500/30">TEST</Badge>
                )}
              </div>
              <p className="text-xs text-zinc-500 mt-1">{event.eventType}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors p-1"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 space-y-4 overflow-y-auto max-h-[calc(80vh-80px)]">
          {/* Core Fields */}
          <div className="space-y-3">
            <DetailRow label="Event ID" value={event.id} mono copyable />
            <DetailRow label="Message ID" value={event.messageId} mono copyable />
            <DetailRow label="Channel" value={`${getEventChannelIcon(event.channel)} ${event.channel}`} />
            <DetailRow label="Provider" value={event.provider} />
            {event.recipient && <DetailRow label="Recipient" value={event.recipient} />}
            {event.sender && <DetailRow label="Sender" value={event.sender} />}
            {event.subject && <DetailRow label="Subject" value={event.subject} />}
            {event.errorCode && <DetailRow label="Error Code" value={event.errorCode} error />}
            {event.errorMessage && <DetailRow label="Error Message" value={event.errorMessage} error />}
            <DetailRow label="Received At" value={new Date(event.receivedAt).toLocaleString()} />
            <DetailRow label="Time Ago" value={formatTimeAgo(event.receivedAt)} />
          </div>

          {/* Metadata */}
          {metadataEntries.length > 0 && (
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Metadata</p>
              <div className="bg-zinc-800/50 rounded-lg p-3 space-y-2">
                {metadataEntries.map(([key, value]) => {
                  const isCollapsible = isCollapsibleValue(value);
                  const isExpanded = expandedKeys.has(key);
                  return (
                    <div key={key} className="flex flex-col gap-1">
                      <div className="flex items-start gap-2">
                        {isCollapsible ? (
                          <button
                            onClick={() => toggleKey(key)}
                            className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors shrink-0 min-w-[100px] text-left"
                            aria-expanded={isExpanded}
                          >
                            <svg
                              className={`w-3 h-3 text-zinc-600 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                            <span className="font-medium">{key}</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-zinc-500 shrink-0 min-w-[100px]">
                            {key}
                          </span>
                        )}
                        {isCollapsible && !isExpanded && typeof value === 'object' && value !== null && (
                          <span className="text-[10px] text-zinc-600 font-mono mt-0.5 truncate">
                            {Array.isArray(value) ? `(${value.length} items)` : `(${Object.keys(value as Record<string, unknown>).length} keys)`}
                          </span>
                        )}
                      </div>
                      {(!isCollapsible || isExpanded) && (
                        <div className="flex-1 min-w-0 pl-0">
                          <JsonHighlight value={value} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/5 flex justify-end gap-2">
          <CopyJsonButton event={event} />
          <DownloadJsonButton event={event} />
          <Button variant="outline" size="sm" onClick={onClose} className="text-[11px]">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono, error, copyable }: { label: string; value: string; mono?: boolean; error?: boolean; copyable?: boolean }) {
  const [copied, setCopied] = React.useState(false);
  const [copyError, setCopyError] = React.useState(false);

  const handleCopy = React.useCallback(async () => {
    const ok = await copyToClipboard(value);
    if (ok) {
      setCopied(true);
      setCopyError(false);
      setTimeout(() => setCopied(false), 1500);
    } else {
      setCopyError(true);
      setTimeout(() => setCopyError(false), 2000);
    }
  }, [value]);

  return (
    <div className="flex items-start gap-3">
      <span className="text-[11px] text-zinc-500 shrink-0 min-w-[100px] pt-0.5">{label}</span>
      <span className={`text-[11px] break-all ${error ? 'text-red-400' : 'text-zinc-300'} ${mono ? 'font-mono text-[10px]' : ''}`}>
        {value}
      </span>
      {copyable && (
        <button
          onClick={handleCopy}
          className="shrink-0 text-zinc-600 hover:text-zinc-300 transition-colors p-0.5"
          title="Copy to clipboard"
          aria-label={`Copy ${label}`}
        >
          {copied ? (
            <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : copyError ? (
            <svg className="w-3.5 h-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}

// ─── JSON Syntax Highlighter ───────────

function JsonHighlight({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="text-zinc-500 italic">null</span>;
  }
  if (typeof value !== 'object') {
    return <span className="text-[11px] text-zinc-300 break-all">{String(value)}</span>;
  }

  const json = JSON.stringify(value, null, 2);

  // Tokenize: strings (keys & values), numbers, booleans, null, punctuation
  const tokens: React.ReactNode[] = [];
  let i = 0;
  const chars = json;

  while (i < chars.length) {
    if (chars[i] === '"') {
      // Find closing quote, handling escaped quotes
      let j = i + 1;
      while (j < chars.length) {
        if (chars[j] === '\\') { j += 2; continue; }
        if (chars[j] === '"') break;
        j++;
      }
      const str = chars.slice(i, j + 1);
      const inner = str.slice(1, -1);

      // Peek ahead: if followed by `:` it's a key
      const rest = chars.slice(j + 1).trimStart();
      const isKey = rest.startsWith(':');

      tokens.push(
        <span key={i} className={isKey ? 'text-sky-400' : 'text-emerald-400'}>
          {str}
        </span>
      );
      i = j + 1;
    } else if (chars[i] === '-' || (chars[i] >= '0' && chars[i] <= '9')) {
      let j = i + 1;
      while (j < chars.length && ((chars[j] >= '0' && chars[j] <= '9') || chars[j] === '.' || chars[j] === '-' || chars[j] === 'e' || chars[j] === 'E' || chars[j] === '+')) {
        j++;
      }
      tokens.push(
        <span key={i} className="text-amber-400">
          {chars.slice(i, j)}
        </span>
      );
      i = j;
    } else if (chars.slice(i, i + 4) === 'true') {
      tokens.push(<span key={i} className="text-violet-400">true</span>);
      i += 4;
    } else if (chars.slice(i, i + 5) === 'false') {
      tokens.push(<span key={i} className="text-violet-400">false</span>);
      i += 5;
    } else if (chars.slice(i, i + 4) === 'null') {
      tokens.push(<span key={i} className="text-zinc-500 italic">null</span>);
      i += 4;
    } else {
      // Punctuation: {, }, [, ], ,, :
      tokens.push(
        <span key={i} className="text-zinc-600">
          {chars[i]}
        </span>
      );
      i++;
    }
  }

  return (
    <pre className="text-[11px] font-mono whitespace-pre-wrap break-all m-0 p-0 bg-transparent">
      <code>{tokens}</code>
    </pre>
  );
}

// ─── CSV Export Helper ──────────────

function downloadCsv(events: DeliveryEvent[]) {
  if (events.length === 0) return;

  const headers = ['ID', 'Received At', 'Channel', 'Provider', 'Event Type', 'Message ID', 'Recipient', 'Sender', 'Subject', 'Error Code', 'Error Message'];
  
  const rows = events.map((e) => [
    e.id,
    new Date(e.receivedAt).toISOString(),
    e.channel,
    e.provider,
    e.eventType,
    e.messageId,
    e.recipient || '',
    e.sender || '',
    e.subject || '',
    e.errorCode || '',
    e.errorMessage || '',
  ]);

  // Escape CSV values (handle commas, quotes, newlines)
  const escape = (val: string) => {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const csv = [headers.join(','), ...rows.map((row) => row.map(escape).join(','))].join('\n');
  downloadBlob(csv, `delivery-events-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8;');
}

async function downloadPdf(events: DeliveryEvent[]) {
  if (events.length === 0) return;

  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF('l', 'mm', 'a4'); // landscape for wider tables
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // ─── Title ──
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Delivery Events Report', margin, y);
  y += 8;

  // ─── Subtitle / metadata ──
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  const dateStr = new Date().toLocaleString();
  doc.text(`Generated: ${dateStr}  |  Total events: ${events.length}`, margin, y);
  y += 10;

  // ─── Summary stats ──
  const emailCount = events.filter((e) => e.channel === 'email').length;
  const whatsappCount = events.filter((e) => e.channel === 'whatsapp').length;
  const deliveredCount = events.filter((e) => e.eventType.endsWith('.delivered')).length;
  const failedCount = events.filter((e) => e.eventType.endsWith('.failed') || e.eventType.endsWith('.bounced')).length;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('Summary', margin, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Email: ${emailCount}  |  WhatsApp: ${whatsappCount}  |  Delivered: ${deliveredCount}  |  Failed: ${failedCount}`, margin, y);
  y += 10;

  // ─── Table ──
  const headers = ['Time', 'Channel', 'Provider', 'Event Type', 'Recipient', 'Sender', 'Subject', 'Error'];
  const colWidths = [40, 22, 22, 38, 50, 45, 45, 50];
  const totalColWidth = colWidths.reduce((a, b) => a + b, 0);
  // Scale colWidths to fit content width
  const scale = contentWidth / totalColWidth;
  const scaledColWidths = colWidths.map((w) => w * scale);

  // Draw header row
  doc.setFillColor(40, 40, 50);
  doc.rect(margin, y, contentWidth, 7, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  let x = margin + 2;
  for (const header of headers) {
    doc.text(header, x, y + 5);
    x += scaledColWidths[headers.indexOf(header)];
  }
  y += 7;

  // Draw data rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  const rowHeight = 6;
  const maxCharsPerCol = scaledColWidths.map((w) => Math.floor(w / 1.8));

  for (let i = 0; i < events.length; i++) {
    const event = events[i];

    // Page break check
    if (y + rowHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
      // Re-draw header on new page
      doc.setFillColor(40, 40, 50);
      doc.rect(margin, y, contentWidth, 7, 'F');
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      x = margin + 2;
      for (const header of headers) {
        doc.text(header, x, y + 5);
        x += scaledColWidths[headers.indexOf(header)];
      }
      y += 7;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
    }

    // Alternate row shading
    if (i % 2 === 0) {
      doc.setFillColor(245, 245, 250);
      doc.rect(margin, y, contentWidth, rowHeight, 'F');
    }

    const truncate = (val: string, maxLen: number) => (val.length > maxLen ? val.slice(0, maxLen - 1) + '\u2026' : val);
    const values = [
      new Date(event.receivedAt).toLocaleString(),
      event.channel,
      event.provider,
      event.eventType,
      event.recipient || '',
      event.sender || '',
      event.subject || '',
      event.errorMessage || event.errorCode || '',
    ];

    doc.setTextColor(30, 30, 30);
    x = margin + 2;
    for (let col = 0; col < values.length; col++) {
      doc.text(truncate(values[col], maxCharsPerCol[col]), x, y + 4.5);
      x += scaledColWidths[col];
    }

    y += rowHeight;
  }

  // ─── Footer ──
  doc.setFontSize(7);
  doc.setTextColor(160, 160, 160);
  doc.text(
    `Oracle Communication Hub \u2022 ${events.length} events exported`,
    margin,
    pageHeight - 8
  );

  await doc.save(`delivery-events-${new Date().toISOString().slice(0, 10)}.pdf`);
}

function downloadJsonArray(events: DeliveryEvent[], filename: string) {
  if (events.length === 0) return;
  downloadBlob(JSON.stringify(events, null, 2), filename, 'application/json');
}

/** Shared hook for async export actions with loading spinner state. */
function useExportAction() {
  const [generating, setGenerating] = useState(false);

  const execute = async (action: () => void | Promise<void>) => {
    setGenerating(true);
    try {
      await new Promise((r) => setTimeout(r, 0)); // yield for spinner to render
      await action();
    } finally {
      setGenerating(false);
    }
  };

  return { generating, execute } as const;
}

/** Renders the shared loading spinner UI used by all export buttons. */
function GeneratingSpinner() {
  return (
    <>
      <div className="h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-white/30 border-t-white" />
      <span>Generating\u2026</span>
    </>
  );
}

// ─── Delivery Events Tab ───────────────

function DeliveryEventsTab({ events, stats, onRefresh }: { events: DeliveryEvent[]; stats: DashboardData['deliveryStats']; onRefresh?: () => void }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState<'all' | DeliveryChannel>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'delivered' | 'failed' | 'pending' | 'opened' | 'clicked'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [hideTestEvents, setHideTestEvents] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<DeliveryEvent | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const csvExport = useExportAction();
  const pdfExport = useExportAction();
  const selectedJsonExport = useExportAction();
  const [ttlMs, setTtlMs] = useState(() => getTestEventTTL());
  const testCount = events.filter((e) => e.metadata?.testEvent === true).length;

  // ─── Multi-select helpers ──
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredEvents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEvents.map((e) => e.id)));
    }
  };


  // Filter events
  const filteredEvents = events.filter((event) => {
    // Test event filter
    if (hideTestEvents && event.metadata?.testEvent === true) return false;

    // Channel filter
    if (channelFilter !== 'all' && event.channel !== channelFilter) return false;

    // Status filter
    if (statusFilter !== 'all') {
      switch (statusFilter) {
        case 'delivered': if (!event.eventType.endsWith('.delivered')) return false; break;
        case 'failed': if (!event.eventType.endsWith('.failed') && !event.eventType.endsWith('.bounced') && !event.eventType.endsWith('.undelivered')) return false; break;
        case 'pending': if (!event.eventType.endsWith('.sent') && !event.eventType.endsWith('.queued') && !event.eventType.endsWith('.scheduled') && !event.eventType.endsWith('.delivery_delayed')) return false; break;
        case 'opened': if (!event.eventType.includes('opened')) return false; break;
        case 'clicked': if (!event.eventType.includes('clicked')) return false; break;
      }
    }

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        event.messageId.toLowerCase().includes(q) ||
        (event.recipient || '').toLowerCase().includes(q) ||
        (event.sender || '').toLowerCase().includes(q) ||
        (event.subject || '').toLowerCase().includes(q) ||
        event.eventType.toLowerCase().includes(q)
      );
    }

    return true;
  });

  // Events to export: selected if any, otherwise all filtered
  const exportEvents = selectedIds.size > 0
    ? filteredEvents.filter((e) => selectedIds.has(e.id))
    : filteredEvents;

  return (
    <div className="space-y-4">
      {/* ── Event Detail Modal ── */}
      {selectedEvent && (
        <DeliveryEventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}

      {/* ── Delivery Stats Summary ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricCard title="Total Events" value={stats.totalEvents} icon="📊" color="text-zinc-300" />
        <MetricCard title="Delivered" value={stats.delivered} icon="✅" color="text-emerald-400" />
        <MetricCard title="Failed" value={stats.failed} icon="❌" color="text-red-400" />
        <MetricCard title="Pending" value={stats.pending} icon="⏳" color="text-amber-400" />
        <MetricCard title="Opened" value={stats.opened} icon="👁️" color="text-violet-400" />
      </div>

      {/* ── Search and Filters ── */}
      <Card className="border-white/10 bg-white/5">
        <CardContent className="p-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {/* Search */}
            <div className="flex-1 w-full sm:w-auto">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search events by ID, recipient, sender, or subject..."
                className="w-full px-3 py-1.5 text-xs bg-zinc-800/50 border border-white/10 rounded-lg text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50"
              />
            </div>

            {/* Filter Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="text-[11px]"
            >
              {showFilters ? 'Hide Filters' : 'Filters'}
              {showFilters ? ' ▲' : ' ▼'}
            </Button>

            {/* Export CSV */}
            <button
              onClick={() => csvExport.execute(() => downloadCsv(exportEvents))}
              disabled={exportEvents.length === 0 || csvExport.generating}
              className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-md border border-white/10 text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Download filtered events as CSV"
              aria-label="Export events as CSV"
            >
              {csvExport.generating ? (
                <GeneratingSpinner />
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Export CSV</span>
                </>
              )}
            </button>

            {/* Export PDF */}
            <button
              onClick={() => pdfExport.execute(() => downloadPdf(exportEvents))}
              disabled={exportEvents.length === 0 || pdfExport.generating}
              className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-md border border-white/10 text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Download filtered events as PDF report"
              aria-label="Export events as PDF"
            >
              {pdfExport.generating ? (
                <GeneratingSpinner />
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <span>Export PDF</span>
                </>
              )}
            </button>

            {/* Download Selected as JSON */}
            {selectedIds.size > 0 && (
              <button
                onClick={() => selectedJsonExport.execute(() => downloadJsonArray(exportEvents, `delivery-events-selected-${new Date().toISOString().slice(0, 10)}.json`))}
                disabled={selectedJsonExport.generating}
                className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-md border border-blue-500/30 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title={`Download ${selectedIds.size} selected events as JSON`}
                aria-label="Download selected events as JSON"
              >
                {selectedJsonExport.generating ? (
                  <GeneratingSpinner />
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>Download Selected ({exportEvents.length})</span>
                  </>
                )}
              </button>
            )}

            {/* Select All / Clear */}
            <button
              onClick={toggleSelectAll}
              className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded-md border transition-colors ${selectedIds.size > 0 && selectedIds.size < filteredEvents.length ? 'border-blue-500/30 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10' : 'border-white/10 text-zinc-400 hover:text-zinc-200 hover:bg-white/5'}`}
              title={selectedIds.size === filteredEvents.length ? 'Deselect all' : selectedIds.size > 0 ? `Clear ${selectedIds.size} selected` : 'Select all filtered events'}
              aria-label={selectedIds.size === filteredEvents.length ? 'Deselect all events' : selectedIds.size > 0 ? `Clear ${selectedIds.size} selected events` : 'Select all events'}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {selectedIds.size === filteredEvents.length && filteredEvents.length > 0 ? (
                  // All selected — checkmark circle
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                ) : selectedIds.size > 0 ? (
                  // Some selected — minus circle (indeterminate)
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H9m6 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                ) : (
                  // None selected — empty checkbox
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                )}
              </svg>
              <span>{selectedIds.size === 0 ? 'Select all' : selectedIds.size < filteredEvents.length ? `Clear (${selectedIds.size})` : 'Deselect all'}</span>
            </button>

            {/* Results Count */}
            <span className="text-[11px] text-zinc-500">
              {filteredEvents.length} of {events.length} events
            </span>
          </div>

          {/* Filter Chips */}
          {showFilters && (
            <div className="mt-3 pt-3 border-t border-white/5 space-y-3">
              {/* Channel Filter */}
              <div>
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Channel</p>
                <div className="flex gap-1.5">
                  {(['all', 'email', 'whatsapp'] as const).map((ch) => (
                    <button
                      key={ch}
                      onClick={() => setChannelFilter(ch)}
                      className={`px-2 py-1 text-[10px] rounded-md transition-colors ${
                        channelFilter === ch
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                          : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
                      }`}
                    >
                      {ch === 'all' ? 'All' : ch === 'email' ? '📧 Email' : '💬 WhatsApp'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Test Events Filter */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Test Events</p>
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-zinc-500">TTL:</label>
                    <select
                      value={ttlMs}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setTtlMs(val);
                        setTestEventTTL(val);
                      }}
                      className="h-6 text-[10px] bg-zinc-800/50 border border-white/10 rounded px-1.5 text-zinc-300 focus:outline-none focus:border-indigo-500/50"
                    >
                      <option value={15 * 60 * 1000}>15m</option>
                      <option value={30 * 60 * 1000}>30m</option>
                      <option value={60 * 60 * 1000}>1h</option>
                      <option value={24 * 60 * 60 * 1000}>24h</option>
                    </select>
                    {testCount > 0 && (
                      <button
                        onClick={() => {
                          const removed = clearTestEvents();
                          if (removed > 0) onRefresh?.();
                        }}
                        className="text-[10px] text-red-400 hover:text-red-300 transition-colors"
                      >
                        Clear {testCount} test event{testCount !== 1 ? 's' : ''}
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setHideTestEvents(true)}
                    className={`px-2 py-1 text-[10px] rounded-md transition-colors ${
                      hideTestEvents
                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
                    }`}
                  >
                    Hide Test Events
                  </button>
                  <button
                    onClick={() => setHideTestEvents(false)}
                    className={`px-2 py-1 text-[10px] rounded-md transition-colors ${
                      !hideTestEvents
                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
                    }`}
                  >
                    Show All
                  </button>
                </div>
              </div>

              {/* Status Filter */}
              <div>
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Status</p>
                <div className="flex flex-wrap gap-1.5">
                  {(['all', 'delivered', 'failed', 'pending', 'opened', 'clicked'] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={`px-2 py-1 text-[10px] rounded-md transition-colors ${
                        statusFilter === status
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                          : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
                      }`}
                    >
                      {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Events List ── */}
      <Card className="border-white/10 bg-white/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-zinc-300">📋 Delivery Events</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredEvents.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-zinc-500">
                {events.length === 0 ? 'No delivery events yet. Events will appear here as webhooks are received.' : 'No events match your filters.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredEvents.slice(0, 50).map((event) => {
                const statusBadge = getEventStatusBadge(event.eventType);
                const providerBadge = getProviderBadge(event.provider);
                return (
                <div
                  key={event.id}
                  onClick={() => setSelectedEvent(event)}
                  className={`flex items-start gap-3 py-2 px-3 rounded-lg transition-colors border cursor-pointer ${selectedIds.has(event.id) ? 'bg-blue-500/10 border-blue-500/30' : 'bg-zinc-800/30 hover:bg-zinc-800/50 border-white/5'}`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedEvent(event); }}
                >
                  {/* Checkbox */}
                  <label className="flex items-center mt-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(event.id)}
                      onChange={() => toggleSelect(event.id)}
                      className="w-3.5 h-3.5 rounded border-zinc-600 text-blue-500 focus:ring-blue-500/50 bg-zinc-700 cursor-pointer"
                    />
                  </label>

                  {/* Channel Icon */}
                  <span className="text-sm mt-0.5 shrink-0">{getEventChannelIcon(event.channel)}</span>

                    {/* Event Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`text-[9px] ${statusBadge.color}`}>{statusBadge.label}</Badge>
                        <Badge className={`text-[9px] ${providerBadge.color}`}>{providerBadge.label}</Badge>
                        {event.metadata?.testEvent === true && (
                          <Badge className="text-[9px] bg-amber-500/20 text-amber-300 border-amber-500/30">TEST</Badge>
                        )}
                        <span className="text-[10px] text-zinc-600">{event.eventType}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-[11px]">
                        {event.recipient && (
                          <span className="text-zinc-400 truncate">
                            To: <span className="text-zinc-300">{event.recipient}</span>
                          </span>
                        )}
                        {event.subject && (
                          <span className="text-zinc-500 truncate hidden md:inline">
                            Subject: {event.subject}
                          </span>
                        )}
                      </div>
                      {(event.errorCode || event.errorMessage) && (
                        <p className="text-[10px] text-red-400/70 mt-1 truncate">
                          {event.errorCode ? `Error ${event.errorCode}` : ''} {event.errorMessage || ''}
                        </p>
                      )}
                    </div>

                    {/* Timestamp */}
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-zinc-600">{formatTimeAgo(event.receivedAt)}</p>
                      <p className="text-[9px] text-zinc-700 mt-0.5">
                        {new Date(event.receivedAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Batch Confirm Dialog ────────────

function BatchConfirmDialog({ batchSize, onConfirm, onCancel }: { batchSize: number; onConfirm: () => void; onCancel: () => void }) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label="Confirm batch injection"
    >
      <div
        className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-sm mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h3 className="text-sm font-medium text-zinc-100">Confirm Batch Injection</h3>
              <p className="text-xs text-zinc-500 mt-0.5">This action cannot be undone</p>
            </div>
          </div>
          <p className="text-xs text-zinc-400">
            You are about to inject <span className="text-amber-300 font-medium">{batchSize} test events</span> into the delivery log.{' '}
            {batchSize >= 50 && (
              <span className="text-red-400">This is a large batch and may affect dashboard performance.</span>
            )}
          </p>
        </div>
        <div className="px-5 py-3 border-t border-white/5 flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="text-[11px]"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            className="text-[11px] bg-amber-500 hover:bg-amber-600 text-white"
          >
            Inject {batchSize} Events
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────

export function CommunicationDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [sendingTest, setSendingTest] = useState(false);
  const [sendingBatch, setSendingBatch] = useState(false);
  const [batchSize, setBatchSize] = useState(20);
  const [showBatchConfirm, setShowBatchConfirm] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // ── Delivery stats from communication hub (localStorage) ──
      const deliveryStats = getCommunicationStats();

      // ── Provider health (via API to avoid bundling server-only packages) ──
      let healthData = { email: { resend: false, sendgrid: false, preferred: 'resend' }, whatsapp: { configured: false, fromNumber: '' } };
      try {
        const res = await fetchWithTimeout('/api/communication/send', { method: 'GET', timeoutMs: TIMEOUT_QUICK_MS });
        if (res.ok) healthData = await res.json();
      } catch { /* health check unavailable — show defaults */ }

      // ── Communication log entries (localStorage) ──
      const allEntries = getCommunications();
      const rangeMs = getTimeRangeMs(timeRange);
      const cutoff = Date.now() - rangeMs;
      const filteredEntries = timeRange === 'all' ? allEntries : allEntries.filter((e) => e.timestamp >= cutoff);
      const logStats = getLogStats(filteredEntries);

      // ── Pending follow-ups ──
      const pendingFollowUps = getPendingFollowUps();

      // ── Recent entries (most recent first) ──
      const recentEntries = [...filteredEntries]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 8);

      // ── Clean expired test events (TTL) ──
      cleanExpiredTestEvents();

      // ── Delivery events (webhook events) ──
      const deliveryEvents = getDeliveryEvents();
      const deliveryStatsData = getDeliveryStats();

      setData({
        delivery: deliveryStats,
        health: healthData,
        log: logStats,
        recentEntries,
        pendingFollowUps,
        deliveryEvents,
        deliveryStats: { ...deliveryStatsData.byStatus, totalEvents: deliveryStatsData.totalEvents },
      });

      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load communication data');
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  const executeBatch = useCallback(async (count: number) => {
    setSendingBatch(true);
    setShowBatchConfirm(false);
    try {
      await fetch('/api/webhooks/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ batch: true, count }) });
      await loadData();
    } catch {
      // Silently fail
    } finally {
      setSendingBatch(false);
    }
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(loadData, 60_000);
    return () => clearInterval(interval);
  }, [loadData]);

  if (loading && !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-300 mx-auto mb-3" />
          <p className="text-sm text-zinc-400">Loading Communication Hub...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <Card className="border-red-500/20 bg-red-500/5 max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-red-400 mb-3">{error}</p>
            <Button variant="outline" size="sm" onClick={loadData}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const emailHealthy = data.health.email.resend || data.health.email.sendgrid;
  const whatsappHealthy = data.health.whatsapp.configured;

  const overallProviderStatus = emailHealthy && whatsappHealthy
    ? 'healthy'
    : emailHealthy || whatsappHealthy
      ? 'degraded'
      : 'down';

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4 max-w-7xl mx-auto">
        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
              📡 Communication Hub
            </h2>
            <p className="text-sm text-zinc-500">
              Delivery stats, channel analytics, and provider health
            </p>
          </div>
          {/* Tab Switcher */}
          <div className="flex gap-1 bg-zinc-800/50 rounded-lg p-0.5">
            {([['overview', 'Overview'], ['events', 'Delivery Events']] as [DashboardTab, string][]).map(([tab, label]) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 text-[11px] rounded-md transition-colors ${
                  activeTab === tab
                    ? 'bg-zinc-700 text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 bg-zinc-800/50 rounded-lg p-0.5">
              {(['24h', '7d', '30d', 'all'] as TimeRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-2.5 py-1 text-[11px] rounded-md transition-colors ${
                    timeRange === range
                      ? 'bg-zinc-700 text-zinc-100'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {range === 'all' ? 'All' : range}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                setSendingTest(true);
                try {
                  await fetch('/api/webhooks/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
                  await loadData();
                } catch {
                  // Silently fail
                } finally {
                  setSendingTest(false);
                }
              }}
              disabled={sendingTest || loading}
              className="text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
            >
              {sendingTest ? '⏳ Sending...' : '🧪 Test'}
            </Button>
            <div className="flex items-center">
              <select
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value))}
                disabled={sendingBatch || loading}
                className="h-8 text-[11px] bg-zinc-800/50 border border-amber-500/30 border-r-0 rounded-l-md px-2 text-amber-300 focus:outline-none disabled:opacity-50"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (batchSize >= 20) {
                    setShowBatchConfirm(true);
                  } else {
                    executeBatch(batchSize);
                  }
                }}
                disabled={sendingBatch || loading}
                className="text-amber-400 border-amber-500/30 hover:bg-amber-500/10 rounded-l-none"
              >
                {sendingBatch ? '⏳ Injecting...' : `⚡ Batch`}
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
              {loading ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </div>

        {activeTab === 'overview' && (
          <>
            {/* ── Top Row: Key Metrics ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard
                title="Total Sent"
                value={data.delivery.totalSent}
                subtitle={`${data.delivery.failed} failed`}
                icon="📤"
                color="text-indigo-400"
              />
              <MetricCard
                title="Emails Sent"
                value={data.delivery.emailsSent}
                subtitle={`Preferred: ${data.health.email.preferred}`}
                icon="📧"
                color="text-sky-400"
              />
              <MetricCard
                title="WhatsApp Sent"
                value={data.delivery.whatsappSent}
                subtitle={data.health.whatsapp.fromNumber || 'Not configured'}
                icon="💬"
                color="text-emerald-400"
              />
              <MetricCard
                title="Pending Follow-ups"
                value={data.log.pendingFollowUps}
                subtitle={`${data.log.total} total entries`}
                icon="🔔"
                color="text-amber-400"
              />
            </div>

            {/* ── Middle Row: Provider Health + Channel Breakdown ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <ProviderCard
                title="Email Providers"
                icon="📧"
                status={emailHealthy ? 'healthy' : 'down'}
                details={[`Resend: ${data.health.email.resend ? '✅ Configured' : '❌ Not configured'}`, `SendGrid: ${data.health.email.sendgrid ? '✅ Configured' : '❌ Not configured'}`, `Preferred: ${data.health.email.preferred}`]}
              />
              <ProviderCard
                title="WhatsApp (Twilio)"
                icon="💬"
                status={whatsappHealthy ? 'healthy' : 'down'}
                details={[`Status: ${data.health.whatsapp.configured ? '✅ Configured' : '❌ Not configured'}`, `From: ${data.health.whatsapp.fromNumber || 'N/A'}`, `Overall: ${overallProviderStatus === 'healthy' ? '🟢' : overallProviderStatus === 'degraded' ? '🟡' : '🔴'} ${overallProviderStatus}`]}
              />
              <ChannelBreakdownCard channels={data.log.channels} total={data.log.total} />
            </div>

            {/* ── Delivery Trend + Rate Charts ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <DeliveryTrendChart events={data.deliveryEvents} />
              <DeliveryRateTrendChart events={data.deliveryEvents} />
            </div>

            {/* ── Delivery Rates + Sentiment + Activity ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <DeliveryRatesCard stats={data.deliveryStats} />
              <SentimentCard sentimentBreakdown={data.log.sentimentBreakdown} total={data.log.total} />
              <RecentActivityCard entries={data.recentEntries} />
            </div>

            {/* ── Follow-ups ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <FollowUpsCard entries={data.pendingFollowUps} />
            </div>
          </>
        )}

        {activeTab === 'events' && (
          <DeliveryEventsTab
            events={data.deliveryEvents}
            stats={data.deliveryStats}
            onRefresh={loadData}
          />
        )}

        {/* ── Batch Confirmation Dialog ── */}
        {showBatchConfirm && (
          <BatchConfirmDialog
            batchSize={batchSize}
            onConfirm={() => executeBatch(batchSize)}
            onCancel={() => setShowBatchConfirm(false)}
          />
        )}

        {/* ── Footer ── */}
        <div className="text-center pt-2 pb-4">
          <p className="text-[10px] text-zinc-600">
            Last refreshed: {lastRefresh.toLocaleTimeString()} · Auto-refreshes every 60s
          </p>
        </div>
      </div>
    </ScrollArea>
  );
}
