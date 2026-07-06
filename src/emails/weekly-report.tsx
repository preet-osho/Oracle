import React from 'react';
import { Text, Section, Hr, Link } from '@react-email/components';
import { BaseLayout } from './base-layout';
import { formatCurrencyCompact, statusEmoji } from './utils';

export interface ReportMetric {
  label: string;
  value: string;
  change?: string; // e.g. "+12%" or "-3%"
  positive?: boolean;
}

export interface ReportClientSummary {
  clientName: string;
  tasksCompleted: number;
  tasksPending: number;
  revenue: number;
  status: 'on-track' | 'at-risk' | 'completed';
}

interface WeeklyReportProps {
  weekLabel: string; // e.g. "June 30 – July 6, 2026"
  recipientName: string;
  metrics: ReportMetric[];
  clients: ReportClientSummary[];
  totalRevenue: number;
  revenueChange?: string;
  newLeads?: number;
  pendingInvoices?: number;
  actionItems?: string[];
  dashboardUrl?: string;
  currency?: string;
}

/**
 * Weekly Report email template.
 * Sent every Monday morning with an overview of the past week's performance.
 */
export const WeeklyReportEmail: React.FC<WeeklyReportProps> = ({
  weekLabel,
  recipientName,
  metrics,
  clients,
  totalRevenue,
  revenueChange,
  newLeads,
  pendingInvoices,
  actionItems,
  dashboardUrl,
  currency = 'INR',
}) => (
  <BaseLayout previewText={`Weekly Report — ${weekLabel}`}>
    <Section>
      {/* Header */}
      <Text
        style={{
          fontSize: '22px',
          fontWeight: 600,
          color: '#fafafa',
          margin: '0 0 4px 0',
        }}
      >
        📊 Weekly Report
      </Text>
      <Text
        style={{
          fontSize: '14px',
          color: '#71717a',
          margin: '0 0 24px 0',
        }}
      >
        {weekLabel} · Prepared for {recipientName}
      </Text>

      {/* Revenue Highlight */}
      <Section
        style={{
          background: 'linear-gradient(135deg, #1a1033, #2d1b69)',
          borderRadius: '12px',
          padding: '24px',
          textAlign: 'center' as const,
          marginBottom: '24px',
        }}
      >
        <Text
          style={{
            fontSize: '12px',
            color: '#a78bfa',
            textTransform: 'uppercase' as const,
            letterSpacing: '0.1em',
            margin: '0 0 4px 0',
          }}
        >
          Weekly Revenue
        </Text>
        <Text
          style={{
            fontSize: '32px',
            fontWeight: 700,
            color: '#fafafa',
            margin: '0 0 4px 0',
          }}
        >
          {formatCurrencyCompact(totalRevenue, currency)}
        </Text>
        {revenueChange && (
          <Text
            style={{
              fontSize: '14px',
              color: revenueChange.startsWith('+') ? '#22c55e' : '#ef4444',
              margin: 0,
            }}
          >
            {revenueChange.startsWith('+') ? '↑' : '↓'} {revenueChange} vs last week
          </Text>
        )}
      </Section>

      {/* Key Metrics Grid */}
      <Text
        style={{
          fontSize: '13px',
          color: '#52525b',
          textTransform: 'uppercase' as const,
          letterSpacing: '0.05em',
          margin: '0 0 12px 0',
        }}
      >
        Key Metrics
      </Text>
      <Section
        style={{
          backgroundColor: '#18181b',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '24px',
        }}
      >
        {metrics.map((metric, index) => (
          <Text
            key={index}
            style={{
              fontSize: '14px',
              color: '#a1a1aa',
              margin: '0 0 8px 0',
              lineHeight: '1.4',
            }}
          >
            <span style={{ display: 'inline-block', width: '50%' }}>{metric.label}</span>
            <span
              style={{
                display: 'inline-block',
                width: '30%',
                textAlign: 'right' as const,
                color: '#e4e4e7',
                fontWeight: 600,
              }}
            >
              {metric.value}
            </span>
            {metric.change && (
              <span
                style={{
                  display: 'inline-block',
                  width: '20%',
                  textAlign: 'right' as const,
                  fontSize: '13px',
                  color: metric.positive !== false ? '#22c55e' : '#ef4444',
                }}
              >
                {metric.change}
              </span>
            )}
          </Text>
        ))}
      </Section>

      {/* Client Performance */}
      {clients.length > 0 && (
        <>
          <Text
            style={{
              fontSize: '13px',
              color: '#52525b',
              textTransform: 'uppercase' as const,
              letterSpacing: '0.05em',
              margin: '0 0 12px 0',
            }}
          >
            Client Performance
          </Text>
          <Section
            style={{
              backgroundColor: '#18181b',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '24px',
            }}
          >
            {clients.map((client, index) => (
              <Text
                key={index}
                style={{
                  fontSize: '14px',
                  color: '#a1a1aa',
                  margin: '0 0 8px 0',
                  lineHeight: '1.4',
                }}
              >
                {statusEmoji(client.status)}{' '}
                <strong style={{ color: '#e4e4e7' }}>{client.clientName}</strong>
                <br />
                <span style={{ paddingLeft: '24px', fontSize: '13px', color: '#71717a' }}>
                  {client.tasksCompleted} done · {client.tasksPending} pending ·{' '}
                  {formatCurrencyCompact(client.revenue, currency)}
                </span>
              </Text>
            ))}
          </Section>
        </>
      )}

      {/* Highlights */}
      <Section style={{ marginBottom: '24px' }}>
        {newLeads !== undefined && (
          <Text
            style={{
              fontSize: '14px',
              color: '#a1a1aa',
              margin: '0 0 4px 0',
            }}
          >
            🎯 <strong style={{ color: '#e4e4e7' }}>{newLeads}</strong> new leads generated
          </Text>
        )}
        {pendingInvoices !== undefined && pendingInvoices > 0 && (
          <Text
            style={{
              fontSize: '14px',
              color: '#a1a1aa',
              margin: '0 0 4px 0',
            }}
          >
            🧾{' '}
            <strong style={{ color: '#e4e4e7' }}>{pendingInvoices}</strong> pending invoice
            {pendingInvoices > 1 ? 's' : ''} awaiting payment
          </Text>
        )}
      </Section>

      {/* Action Items */}
      {actionItems && actionItems.length > 0 && (
        <>
          <Hr
            style={{
              border: 'none',
              borderTop: '1px solid #27272a',
              margin: '0 0 16px 0',
            }}
          />
          <Text
            style={{
              fontSize: '13px',
              color: '#52525b',
              textTransform: 'uppercase' as const,
              letterSpacing: '0.05em',
              margin: '0 0 12px 0',
            }}
          >
            Action Items
          </Text>
          <Section
            style={{
              backgroundColor: '#1c1917',
              borderRadius: '8px',
              padding: '16px',
              borderLeft: '3px solid #f59e0b',
              marginBottom: '16px',
            }}
          >
            {actionItems.map((item, index) => (
              <Text
                key={index}
                style={{
                  fontSize: '14px',
                  color: '#a1a1aa',
                  margin: '0 0 6px 0',
                  lineHeight: '1.4',
                }}
              >
                • {item}
              </Text>
            ))}
          </Section>
        </>
      )}

      {/* Dashboard Link */}
      {dashboardUrl && (
        <Text
          style={{
            fontSize: '14px',
            color: '#71717a',
            textAlign: 'center' as const,
            margin: '16px 0 0 0',
          }}
        >
          View full details in your{' '}
          <Link
            href={dashboardUrl}
            style={{ color: '#a855f7', textDecoration: 'underline' }}
          >
            Oracle Dashboard
          </Link>
        </Text>
      )}
    </Section>
  </BaseLayout>
);

export default WeeklyReportEmail;
