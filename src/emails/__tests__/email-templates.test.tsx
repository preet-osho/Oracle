import { describe, it, expect } from 'vitest';
import { render } from '@react-email/render';
import { PasswordResetEmail } from '../password-reset';
import { InvitationEmail } from '../invitation';
import { InvoiceEmail } from '../invoice';
import { WeeklyReportEmail } from '../weekly-report';
import { BaseLayout } from '../base-layout';

// render() returns a Promise<string>, so all tests that call it must be async.

// ─── Base Layout ────────────────────────

describe('BaseLayout', () => {
  it('renders preview text', async () => {
    const html = await render(
      BaseLayout({ previewText: 'Test preview', children: null }),
    );
    expect(html).toContain('Test preview');
  });

  it('renders Oracle branding', async () => {
    const html = await render(
      BaseLayout({ previewText: 'Test', children: null }),
    );
    expect(html).toContain('Oracle');
    expect(html).toContain('Digital Agency Platform');
  });

  it('renders footer with current year', async () => {
    const html = await render(
      BaseLayout({ previewText: 'Test', children: null }),
    );
    const year = new Date().getFullYear().toString();
    expect(html).toContain(year);
    expect(html).toContain('Privacy Policy');
    expect(html).toContain('Unsubscribe');
  });
});

// ─── Password Reset ─────────────────────

describe('PasswordResetEmail', () => {
  it('renders reset URL', async () => {
    const html = await render(
      PasswordResetEmail({
        resetUrl: 'https://oracle.in/auth/reset?token=abc123',
      }),
    );
    expect(html).toContain('https://oracle.in/auth/reset?token=abc123');
  });

  it('renders default expiry of 60 minutes', async () => {
    const html = await render(
      PasswordResetEmail({
        resetUrl: 'https://oracle.in/auth/reset?token=abc123',
      }),
    );
    expect(html).toMatch(/60[\s\S]*minutes/);
  });

  it('renders custom expiry', async () => {
    const html = await render(
      PasswordResetEmail({
        resetUrl: 'https://oracle.in/auth/reset?token=abc123',
        expiryMinutes: 30,
      }),
    );
    expect(html).toMatch(/30[\s\S]*minutes/);
  });

  it('renders requestedBy when provided', async () => {
    const html = await render(
      PasswordResetEmail({
        resetUrl: 'https://oracle.in/auth/reset?token=abc123',
        requestedBy: 'user@example.com',
      }),
    );
    expect(html).toContain('user@example.com');
  });

  it('renders security note about ignoring email', async () => {
    const html = await render(
      PasswordResetEmail({
        resetUrl: 'https://oracle.in/auth/reset?token=abc123',
      }),
    );
    expect(html).toContain('safely ignore');
  });
});

// ─── Invitation ─────────────────────────

describe('InvitationEmail', () => {
  it('renders inviter name and org name', async () => {
    const html = await render(
      InvitationEmail({
        inviteUrl: 'https://oracle.in/auth/invite?token=xyz',
        inviterName: 'Ravi Kumar',
        orgName: 'Acme Corp',
      }),
    );
    expect(html).toContain('Ravi Kumar');
    expect(html).toContain('Acme Corp');
  });

  it('renders invite URL in button', async () => {
    const html = await render(
      InvitationEmail({
        inviteUrl: 'https://oracle.in/auth/invite?token=xyz',
        inviterName: 'Ravi',
        orgName: 'Acme',
      }),
    );
    expect(html).toContain('https://oracle.in/auth/invite?token=xyz');
  });

  it('renders default role as member', async () => {
    const html = await render(
      InvitationEmail({
        inviteUrl: 'https://oracle.in/auth/invite?token=xyz',
        inviterName: 'Ravi',
        orgName: 'Acme',
      }),
    );
    expect(html).toContain('member');
  });

  it('renders custom role', async () => {
    const html = await render(
      InvitationEmail({
        inviteUrl: 'https://oracle.in/auth/invite?token=xyz',
        inviterName: 'Ravi',
        orgName: 'Acme',
        role: 'admin',
      }),
    );
    expect(html).toContain('admin');
  });

  it('renders feature list', async () => {
    const html = await render(
      InvitationEmail({
        inviteUrl: 'https://oracle.in/auth/invite?token=xyz',
        inviterName: 'Ravi',
        orgName: 'Acme',
      }),
    );
    expect(html).toContain('AI-powered client task management');
    expect(html).toContain('Automated proposal');
  });

  it('renders custom expiry', async () => {
    const html = await render(
      InvitationEmail({
        inviteUrl: 'https://oracle.in/auth/invite?token=xyz',
        inviterName: 'Ravi',
        orgName: 'Acme',
        expiryDays: 14,
      }),
    );
    expect(html).toMatch(/14[\s\S]*days/);
  });
});

// ─── Invoice ────────────────────────────

describe('InvoiceEmail', () => {
  const sampleItems = [
    { description: 'Website Design', quantity: 1, unitPrice: 50000, amount: 50000 },
    { description: 'SEO Optimization', quantity: 1, unitPrice: 15000, amount: 15000 },
  ];

  it('renders invoice number', async () => {
    const html = await render(
      InvoiceEmail({
        invoiceNumber: 'INV-2026-001',
        clientName: 'Acme Corp',
        clientEmail: 'acme@example.com',
        items: sampleItems,
        subtotal: 65000,
        total: 65000,
      }),
    );
    expect(html).toContain('INV-2026-001');
    expect(html).toContain('Acme Corp');
  });

  it('renders line items', async () => {
    const html = await render(
      InvoiceEmail({
        invoiceNumber: 'INV-2026-001',
        clientName: 'Acme Corp',
        clientEmail: 'acme@example.com',
        items: sampleItems,
        subtotal: 65000,
        total: 65000,
      }),
    );
    expect(html).toContain('Website Design');
    expect(html).toContain('SEO Optimization');
  });

  it('renders totals with INR formatting', async () => {
    const html = await render(
      InvoiceEmail({
        invoiceNumber: 'INV-2026-001',
        clientName: 'Acme Corp',
        clientEmail: 'acme@example.com',
        items: sampleItems,
        subtotal: 65000,
        total: 65000,
      }),
    );
    expect(html).toContain('₹65,000.00');
  });

  it('renders tax when provided', async () => {
    const html = await render(
      InvoiceEmail({
        invoiceNumber: 'INV-2026-001',
        clientName: 'Acme Corp',
        clientEmail: 'acme@example.com',
        items: sampleItems,
        subtotal: 65000,
        tax: 11700,
        taxRate: 18,
        total: 76700,
      }),
    );
    expect(html).toContain('18%');
    expect(html).toContain('₹11,700.00');
  });

  it('renders discount when provided', async () => {
    const html = await render(
      InvoiceEmail({
        invoiceNumber: 'INV-2026-001',
        clientName: 'Acme Corp',
        clientEmail: 'acme@example.com',
        items: sampleItems,
        subtotal: 65000,
        discount: 5000,
        total: 60000,
      }),
    );
    expect(html).toContain('Discount');
    expect(html).toMatch(/-[\s\S]*₹5,000\.00/);
  });

  it('renders payment button when paymentUrl provided', async () => {
    const html = await render(
      InvoiceEmail({
        invoiceNumber: 'INV-2026-001',
        clientName: 'Acme Corp',
        clientEmail: 'acme@example.com',
        items: sampleItems,
        subtotal: 65000,
        total: 65000,
        paymentUrl: 'https://oracle.in/pay/inv-001',
      }),
    );
    expect(html).toContain('https://oracle.in/pay/inv-001');
    expect(html).toContain('Pay Now');
  });

  it('renders notes when provided', async () => {
    const html = await render(
      InvoiceEmail({
        invoiceNumber: 'INV-2026-001',
        clientName: 'Acme Corp',
        clientEmail: 'acme@example.com',
        items: sampleItems,
        subtotal: 65000,
        total: 65000,
        notes: 'Payment due via bank transfer',
      }),
    );
    expect(html).toContain('Payment due via bank transfer');
  });
});

// ─── Weekly Report ──────────────────────

describe('WeeklyReportEmail', () => {
  const sampleMetrics = [
    { label: 'Tasks Completed', value: '24', change: '+12%', positive: true },
    { label: 'Active Clients', value: '8', change: '+2' },
  ];

  const sampleClients = [
    {
      clientName: 'Acme Corp',
      tasksCompleted: 6,
      tasksPending: 2,
      revenue: 45000,
      status: 'on-track' as const,
    },
    {
      clientName: 'Beta Inc',
      tasksCompleted: 3,
      tasksPending: 5,
      revenue: 12000,
      status: 'at-risk' as const,
    },
  ];

  it('renders week label and recipient name', async () => {
    const html = await render(
      WeeklyReportEmail({
        weekLabel: 'June 30 – July 6, 2026',
        recipientName: 'Ravi Kumar',
        metrics: sampleMetrics,
        clients: sampleClients,
        totalRevenue: 57000,
      }),
    );
    expect(html).toContain('June 30 – July 6, 2026');
    expect(html).toContain('Ravi Kumar');
  });

  it('renders total revenue with INR formatting', async () => {
    const html = await render(
      WeeklyReportEmail({
        weekLabel: 'Week 27',
        recipientName: 'Ravi',
        metrics: sampleMetrics,
        clients: sampleClients,
        totalRevenue: 57000,
      }),
    );
    expect(html).toContain('₹57,000');
  });

  it('renders revenue change when provided', async () => {
    const html = await render(
      WeeklyReportEmail({
        weekLabel: 'Week 27',
        recipientName: 'Ravi',
        metrics: sampleMetrics,
        clients: sampleClients,
        totalRevenue: 57000,
        revenueChange: '+18%',
      }),
    );
    expect(html).toContain('+18%');
  });

  it('renders metrics', async () => {
    const html = await render(
      WeeklyReportEmail({
        weekLabel: 'Week 27',
        recipientName: 'Ravi',
        metrics: sampleMetrics,
        clients: sampleClients,
        totalRevenue: 57000,
      }),
    );
    expect(html).toContain('Tasks Completed');
    expect(html).toContain('24');
  });

  it('renders client summaries with status emojis', async () => {
    const html = await render(
      WeeklyReportEmail({
        weekLabel: 'Week 27',
        recipientName: 'Ravi',
        metrics: sampleMetrics,
        clients: sampleClients,
        totalRevenue: 57000,
      }),
    );
    expect(html).toContain('Acme Corp');
    expect(html).toContain('Beta Inc');
    expect(html).toContain('🟢');
    expect(html).toContain('🟡');
  });

  it('renders action items', async () => {
    const html = await render(
      WeeklyReportEmail({
        weekLabel: 'Week 27',
        recipientName: 'Ravi',
        metrics: sampleMetrics,
        clients: sampleClients,
        totalRevenue: 57000,
        actionItems: ['Follow up with Beta Inc on pending tasks', 'Send Q3 proposal to Acme Corp'],
      }),
    );
    expect(html).toContain('Follow up with Beta Inc');
    expect(html).toContain('Send Q3 proposal');
  });

  it('renders new leads and pending invoices', async () => {
    const html = await render(
      WeeklyReportEmail({
        weekLabel: 'Week 27',
        recipientName: 'Ravi',
        metrics: sampleMetrics,
        clients: sampleClients,
        totalRevenue: 57000,
        newLeads: 5,
        pendingInvoices: 3,
      }),
    );
    expect(html).toContain('new leads');
    expect(html).toContain('pending invoice');
  });

  it('renders dashboard link when provided', async () => {
    const html = await render(
      WeeklyReportEmail({
        weekLabel: 'Week 27',
        recipientName: 'Ravi',
        metrics: sampleMetrics,
        clients: sampleClients,
        totalRevenue: 57000,
        dashboardUrl: 'https://oracle.in/dashboard',
      }),
    );
    expect(html).toContain('https://oracle.in/dashboard');
  });
});
