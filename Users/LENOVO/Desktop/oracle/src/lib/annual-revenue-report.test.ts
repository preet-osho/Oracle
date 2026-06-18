import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateAnnualReport,
  formatAnnualReportAsText,
} from './annual-revenue-report';

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
});

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
});
