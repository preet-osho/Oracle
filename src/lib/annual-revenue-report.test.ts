import { describe, it, expect } from 'vitest';
import {
  generateAnnualReport,
  formatAnnualReportAsText,
  type AnnualReport,
} from './annual-revenue-report';

// ─── generateAnnualReport Tests ────────

describe('generateAnnualReport', () => {
  const invoices = [
    { clientName: 'Acme', amount: 50000, service: 'SEO', date: new Date(2026, 0, 15).getTime(), status: 'Paid' },
    { clientName: 'Acme', amount: 30000, service: 'Google Ads', date: new Date(2026, 2, 10).getTime(), status: 'Paid' },
    { clientName: 'Beta Corp', amount: 40000, service: 'SEO', date: new Date(2026, 5, 20).getTime(), status: 'Sent' },
  ];

  const expenses = [
    { category: 'software', amount: 5000, date: new Date(2026, 0, 1).getTime() },
    { category: 'freelancer', amount: 10000, date: new Date(2026, 3, 15).getTime(), clientName: 'Acme' },
  ];

  const clients = [
    { name: 'Acme', createdAt: new Date(2025, 6, 1).getTime(), totalRevenue: 80000, active: true },
    { name: 'Beta Corp', createdAt: new Date(2026, 4, 1).getTime(), totalRevenue: 40000, active: true },
  ];

  it('generates report for given year', () => {
    const report = generateAnnualReport(2026, invoices, expenses, clients);
    expect(report.year).toBe(2026);
    expect(report.revenue.totalINR).toBe(120000);
    expect(report.revenue.byService['SEO']).toBe(90000);
    expect(report.revenue.byService['Google Ads']).toBe(30000);
  });

  it('calculates expenses correctly', () => {
    const report = generateAnnualReport(2026, invoices, expenses, clients);
    expect(report.expenses.totalINR).toBe(15000);
  });

  it('identifies top client', () => {
    const report = generateAnnualReport(2026, invoices, expenses, clients);
    expect(report.revenue.topClient).toBe('Acme');
  });

  it('identifies top service', () => {
    const report = generateAnnualReport(2026, invoices, expenses, clients);
    expect(report.revenue.topService).toBe('SEO');
  });

  it('calculates profitability', () => {
    const report = generateAnnualReport(2026, invoices, expenses, clients);
    expect(report.profitability.grossProfit).toBe(105000);
    expect(report.profitability.grossMargin).toBeGreaterThan(0);
  });

  it('counts clients correctly', () => {
    const report = generateAnnualReport(2026, invoices, expenses, clients);
    expect(report.clients.totalClients).toBe(2);
    expect(report.clients.newClients).toBe(1);
  });

  it('has monthly breakdown for 12 months', () => {
    const report = generateAnnualReport(2026, invoices, expenses, clients);
    expect(report.monthly).toHaveLength(12);
  });

  it('generates insights', () => {
    const report = generateAnnualReport(2026, invoices, expenses, clients);
    expect(report.insights.length).toBeGreaterThan(0);
  });

  // ── Edge Cases ──

  it('excludes Draft invoices', () => {
    const draftInvoices = [
      { clientName: 'Ghost', amount: 99999, service: 'Dev', date: new Date(2026, 6, 1).getTime(), status: 'Draft' },
      { clientName: 'Real', amount: 1000, service: 'Dev', date: new Date(2026, 6, 1).getTime(), status: 'Paid' },
    ];
    const report = generateAnnualReport(2026, draftInvoices, [], []);
    expect(report.revenue.totalINR).toBe(1000);
  });

  it('excludes invoices from other years', () => {
    const mixed = [
      { clientName: 'Old', amount: 50000, service: 'SEO', date: new Date(2025, 6, 1).getTime(), status: 'Paid' },
      { clientName: 'New', amount: 20000, service: 'SEO', date: new Date(2026, 6, 1).getTime(), status: 'Paid' },
    ];
    const report = generateAnnualReport(2026, mixed, [], []);
    expect(report.revenue.totalINR).toBe(20000);
  });

  it('excludes expenses from other years', () => {
    const mixed = [
      { category: 'software', amount: 5000, date: new Date(2025, 0, 1).getTime() },
      { category: 'tools', amount: 3000, date: new Date(2026, 0, 1).getTime() },
    ];
    const report = generateAnnualReport(2026, [], mixed, []);
    expect(report.expenses.totalINR).toBe(3000);
  });

  it('handles empty data gracefully', () => {
    const report = generateAnnualReport(2026, [], [], []);
    expect(report.revenue.totalINR).toBe(0);
    expect(report.revenue.totalUSD).toBe(0);
    expect(report.revenue.topClient).toBe('N/A');
    expect(report.revenue.topService).toBe('N/A');
    expect(report.revenue.averageProjectValue).toBe(0);
    expect(report.expenses.totalINR).toBe(0);
    expect(report.expenses.costPerClient).toBe(0);
    expect(report.profitability.grossProfit).toBe(0);
    expect(report.profitability.grossMargin).toBe(0);
    expect(report.profitability.mostProfitableService).toBe('N/A');
    expect(report.profitability.leastProfitableService).toBe('N/A');
    expect(report.clients.totalClients).toBe(0);
    expect(report.clients.retentionRate).toBe(0);
    expect(report.clients.averageLifetimeValue).toBe(0);
    expect(report.clients.repeatRate).toBe(0);
  });

  it('calculates USD conversion', () => {
    const report = generateAnnualReport(2026, invoices, expenses, clients);
    expect(report.revenue.totalUSD).toBeCloseTo(120000 / 84, 10);
  });

  it('calculates average project value', () => {
    const report = generateAnnualReport(2026, invoices, expenses, clients);
    // 120000 / 3 = 40000
    expect(report.revenue.averageProjectValue).toBe(40000);
  });

  it('counts lost clients (inactive, created before year)', () => {
    const clientList = [
      { name: 'Lost', createdAt: new Date(2024, 0, 1).getTime(), totalRevenue: 10000, active: false },
      { name: 'Active', createdAt: new Date(2026, 0, 1).getTime(), totalRevenue: 20000, active: true },
    ];
    const report = generateAnnualReport(2026, [], [], clientList);
    expect(report.clients.lostClients).toBe(1);
    expect(report.clients.retentionRate).toBe(50);
  });

  it('calculates repeat rate when clients have multiple invoices', () => {
    const multiInvoices = [
      { clientName: 'Loyal', amount: 10000, service: 'SEO', date: new Date(2026, 1, 1).getTime(), status: 'Paid' },
      { clientName: 'Loyal', amount: 15000, service: 'SEO', date: new Date(2026, 6, 1).getTime(), status: 'Paid' },
      { clientName: 'OneTime', amount: 5000, service: 'Dev', date: new Date(2026, 3, 1).getTime(), status: 'Paid' },
    ];
    const clientList = [
      { name: 'Loyal', createdAt: new Date(2025, 0, 1).getTime(), totalRevenue: 25000, active: true },
      { name: 'OneTime', createdAt: new Date(2026, 0, 1).getTime(), totalRevenue: 5000, active: true },
    ];
    const report = generateAnnualReport(2026, multiInvoices, [], clientList);
    // Loyal has 2 invoices, OneTime has 1 → 1/2 = 50% repeat rate
    expect(report.clients.repeatRate).toBe(50);
  });

  it('distributes expenses proportionally for service profitability', () => {
    const report = generateAnnualReport(2026, invoices, expenses, clients);
    // Both services should have proportional cost allocation
    expect(report.profitability.mostProfitableService).toBeDefined();
    expect(report.profitability.leastProfitableService).toBeDefined();
  });

  it('calculates recurring monthly from software+tools expenses', () => {
    const toolExpenses = [
      { category: 'software', amount: 1200, date: new Date(2026, 0, 1).getTime() },
      { category: 'tools', amount: 2400, date: new Date(2026, 3, 1).getTime() },
      { category: 'rent', amount: 5000, date: new Date(2026, 0, 1).getTime() },
    ];
    const report = generateAnnualReport(2026, [], toolExpenses, []);
    // (1200 + 2400) / 12 = 300
    expect(report.expenses.recurringMonthly).toBe(300);
  });

  it('calculates cost per unique client', () => {
    const report = generateAnnualReport(2026, invoices, expenses, clients);
    // 15000 / 2 unique clients = 7500
    expect(report.expenses.costPerClient).toBe(7500);
  });

  it('generates churn insight when clients lost', () => {
    const clientList = [
      { name: 'Churned', createdAt: new Date(2024, 0, 1).getTime(), totalRevenue: 5000, active: false },
      { name: 'Active', createdAt: new Date(2025, 0, 1).getTime(), totalRevenue: 10000, active: true },
    ];
    const report = generateAnnualReport(2026, invoices, expenses, clientList);
    const churnInsight = report.insights.find((i) => i.includes('churned'));
    expect(churnInsight).toBeDefined();
  });

  it('generates high margin insight when gross margin > 30%', () => {
    // High revenue, low expenses → >30% margin
    const highRev = [
      { clientName: 'Big', amount: 1000000, service: 'Consulting', date: new Date(2026, 0, 1).getTime(), status: 'Paid' },
    ];
    const lowExp = [
      { category: 'software', amount: 1000, date: new Date(2026, 0, 1).getTime() },
    ];
    const report = generateAnnualReport(2026, highRev, lowExp, []);
    const healthyInsight = report.insights.find((i) => i.includes('Healthy'));
    expect(healthyInsight).toBeDefined();
  });

  it('generates low margin insight when gross margin is 0-30%', () => {
    // Moderate revenue, high expenses → <30% margin
    const modRev = [
      { clientName: 'Mod', amount: 10000, service: 'Dev', date: new Date(2026, 0, 1).getTime(), status: 'Paid' },
    ];
    const highExp = [
      { category: 'freelancer', amount: 8000, date: new Date(2026, 0, 1).getTime() },
    ];
    const report = generateAnnualReport(2026, modRev, highExp, []);
    const lowInsight = report.insights.find((i) => i.includes('below the 30% target'));
    expect(lowInsight).toBeDefined();
  });

  it('generates repeat rate insight when > 50%', () => {
    const multiInvoices = [
      { clientName: 'Loyal', amount: 10000, service: 'SEO', date: new Date(2026, 1, 1).getTime(), status: 'Paid' },
      { clientName: 'Loyal', amount: 15000, service: 'SEO', date: new Date(2026, 6, 1).getTime(), status: 'Paid' },
      { clientName: 'Loyal', amount: 5000, service: 'SEO', date: new Date(2026, 9, 1).getTime(), status: 'Paid' },
    ];
    const clientList = [
      { name: 'Loyal', createdAt: new Date(2025, 0, 1).getTime(), totalRevenue: 30000, active: true },
    ];
    const report = generateAnnualReport(2026, multiInvoices, [], clientList);
    const repeatInsight = report.insights.find((i) => i.includes('repeat rate'));
    expect(repeatInsight).toBeDefined();
  });

  it('monthly breakdown distributes revenue across correct months', () => {
    const report = generateAnnualReport(2026, invoices, expenses, clients);
    // Invoice 1: Jan (month 0) = 50000
    expect(report.monthly[0].revenue).toBe(50000);
    // Invoice 2: Mar (month 2) = 30000
    expect(report.monthly[2].revenue).toBe(30000);
    // Invoice 3: Jun (month 5) = 40000
    expect(report.monthly[5].revenue).toBe(40000);
    // Other months should be 0
    expect(report.monthly[1].revenue).toBe(0);
    expect(report.monthly[3].revenue).toBe(0);
  });

  it('monthly profit is revenue minus expenses', () => {
    const report = generateAnnualReport(2026, invoices, expenses, clients);
    // Jan: revenue 50000, expense 5000 → profit 45000
    expect(report.monthly[0].profit).toBe(45000);
  });

  it('monthly clients counts unique clients per month', () => {
    const report = generateAnnualReport(2026, invoices, expenses, clients);
    // Jan: only Acme → 1
    expect(report.monthly[0].clients).toBe(1);
    // Jun: only Beta Corp → 1
    expect(report.monthly[5].clients).toBe(1);
  });

  it('netMargin equals grossMargin in simplified model', () => {
    const report = generateAnnualReport(2026, invoices, expenses, clients);
    expect(report.profitability.netMargin).toBe(report.profitability.grossMargin);
    expect(report.profitability.netProfit).toBe(report.profitability.grossProfit);
  });

  it('generatedAt is a recent timestamp', () => {
    const before = Date.now();
    const report = generateAnnualReport(2026, [], [], []);
    const after = Date.now();
    expect(report.generatedAt).toBeGreaterThanOrEqual(before);
    expect(report.generatedAt).toBeLessThanOrEqual(after);
  });

  it('handles single invoice for most/least profitable service', () => {
    const single = [
      { clientName: 'Solo', amount: 10000, service: 'OnlyService', date: new Date(2026, 0, 1).getTime(), status: 'Paid' },
    ];
    const report = generateAnnualReport(2026, single, [], []);
    expect(report.profitability.mostProfitableService).toBe('OnlyService');
    expect(report.profitability.leastProfitableService).toBe('OnlyService');
  });
});

// ─── formatAnnualReportAsText Tests ────

describe('formatAnnualReportAsText', () => {
  it('formats report as readable text', () => {
    const report = generateAnnualReport(2026, [
      { clientName: 'Acme', amount: 50000, service: 'SEO', date: Date.now(), status: 'Paid' },
    ], [
      { category: 'software', amount: 5000, date: Date.now() },
    ], [
      { name: 'Acme', createdAt: Date.now(), totalRevenue: 50000, active: true },
    ]);
    const text = formatAnnualReportAsText(report);
    expect(text).toContain('ANNUAL REVENUE REPORT');
    expect(text).toContain('REVENUE SUMMARY');
    expect(text).toContain('EXPENSE SUMMARY');
    expect(text).toContain('₹50,000');
  });

  it('includes profitability section', () => {
    const report = generateAnnualReport(2026, [
      { clientName: 'Acme', amount: 10000, service: 'SEO', date: Date.now(), status: 'Paid' },
    ], [], []);
    const text = formatAnnualReportAsText(report);
    expect(text).toContain('PROFITABILITY');
    expect(text).toContain('Gross Profit');
    expect(text).toContain('Gross Margin');
    expect(text).toContain('Most Profitable');
  });

  it('includes client summary section', () => {
    const report = generateAnnualReport(2026, [], [], [
      { name: 'Acme', createdAt: Date.now(), totalRevenue: 50000, active: true },
    ]);
    const text = formatAnnualReportAsText(report);
    expect(text).toContain('CLIENT SUMMARY');
    expect(text).toContain('Total Clients: 1');
    expect(text).toContain('Retention Rate');
    expect(text).toContain('Repeat Rate');
  });

  it('includes monthly breakdown for all 12 months', () => {
    const report = generateAnnualReport(2026, [], [], []);
    const text = formatAnnualReportAsText(report);
    expect(text).toContain('MONTHLY BREAKDOWN');
    // All 12 month abbreviations should appear
    for (const m of ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']) {
      expect(text).toContain(m);
    }
  });

  it('includes insights when present', () => {
    const report = generateAnnualReport(2026, [
      { clientName: 'Acme', amount: 50000, service: 'SEO', date: Date.now(), status: 'Paid' },
    ], [], [
      { name: 'Acme', createdAt: Date.now(), totalRevenue: 50000, active: true },
    ]);
    const text = formatAnnualReportAsText(report);
    if (report.insights.length > 0) {
      expect(text).toContain('INSIGHTS');
      expect(text).toContain('•');
    }
  });

  it('omits insights section when none present', () => {
    const report = generateAnnualReport(2026, [], [], []);
    const text = formatAnnualReportAsText(report);
    // Empty data should produce no insights
    expect(text).not.toContain('INSIGHTS');
  });

  it('uses the report year in header', () => {
    const report = generateAnnualReport(2025, [], [], []);
    const text = formatAnnualReportAsText(report);
    expect(text).toContain('2025');
  });
});
