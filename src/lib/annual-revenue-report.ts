// ═══════════════════════════════════════
// ORACLE — Annual Revenue Report
// Yearly summary generation · Revenue breakdown · Financial insights
// ═══════════════════════════════════════

// ─── Types ─────────────────────────────

export interface AnnualReport {
  year: number;
  generatedAt: number;
  revenue: RevenueSummary;
  expenses: ExpenseSummary;
  profitability: ProfitabilitySummary;
  clients: ClientSummary;
  monthly: MonthlyBreakdown[];
  insights: string[];
}

export interface RevenueSummary {
  totalINR: number;
  totalUSD: number;
  byService: Record<string, number>;
  byClient: Record<string, number>;
  byMonth: number[];
  growth?: number; // % vs previous year
  topClient: string;
  topService: string;
  averageProjectValue: number;
}

export interface ExpenseSummary {
  totalINR: number;
  byCategory: Record<string, number>;
  recurringMonthly: number;
  costPerClient: number;
}

export interface ProfitabilitySummary {
  grossProfit: number;
  grossMargin: number;
  netProfit: number;
  netMargin: number;
  mostProfitableService: string;
  leastProfitableService: string;
}

export interface ClientSummary {
  totalClients: number;
  newClients: number;
  lostClients: number;
  retentionRate: number;
  averageLifetimeValue: number;
  repeatRate: number;
}

export interface MonthlyBreakdown {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
  clients: number;
}

// ─── Report Generator ──────────────────

export function generateAnnualReport(
  year: number,
  invoices: Array<{ clientName: string; amount: number; service: string; date: number; status: string }>,
  expenses: Array<{ category: string; amount: number; date: number; clientName?: string }>,
  clients: Array<{ name: string; createdAt: number; totalRevenue: number; active: boolean }>
): AnnualReport {
  const yearStart = new Date(year, 0, 1).getTime();
  const yearEnd = new Date(year, 11, 31, 23, 59, 59).getTime();

  // Filter to this year
  const yearInvoices = invoices.filter((i) => i.date >= yearStart && i.date <= yearEnd && i.status !== 'Draft');
  const yearExpenses = expenses.filter((e) => e.date >= yearStart && e.date <= yearEnd);

  // Revenue
  const totalRevenue = yearInvoices.reduce((s, i) => s + i.amount, 0);

  const byService: Record<string, number> = {};
  const byClient: Record<string, number> = {};
  for (const inv of yearInvoices) {
    byService[inv.service] = (byService[inv.service] || 0) + inv.amount;
    byClient[inv.clientName] = (byClient[inv.clientName] || 0) + inv.amount;
  }

  const byMonth: number[] = [];
  for (let m = 0; m < 12; m++) {
    const monthStart = new Date(year, m, 1).getTime();
    const monthEnd = new Date(year, m + 1, 0, 23, 59, 59).getTime();
    byMonth.push(yearInvoices.filter((i) => i.date >= monthStart && i.date <= monthEnd).reduce((s, i) => s + i.amount, 0));
  }

  const topClient = Object.entries(byClient).sort(([, a], [, b]) => b - a)[0]?.[0] || 'N/A';
  const topService = Object.entries(byService).sort(([, a], [, b]) => b - a)[0]?.[0] || 'N/A';
  const averageProjectValue = yearInvoices.length > 0 ? totalRevenue / yearInvoices.length : 0;

  // Expenses
  const totalExpenses = yearExpenses.reduce((s, e) => s + e.amount, 0);
  const byCategory: Record<string, number> = {};
  for (const exp of yearExpenses) {
    byCategory[exp.category] = (byCategory[exp.category] || 0) + exp.amount;
  }
  const recurringMonthly = yearExpenses.filter((e) => e.category === 'software' || e.category === 'tools').reduce((s, e) => s + e.amount, 0) / 12;
  const uniqueClients = new Set(yearInvoices.map((i) => i.clientName));
  const costPerClient = uniqueClients.size > 0 ? totalExpenses / uniqueClients.size : 0;

  // Profitability
  const grossProfit = totalRevenue - totalExpenses;
  const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  const netProfit = grossProfit; // Simplified — full model would deduct overhead

  const serviceProfit: Record<string, { revenue: number; estimatedCost: number }> = {};
  for (const inv of yearInvoices) {
    const existing = serviceProfit[inv.service] || { revenue: 0, estimatedCost: 0 };
    existing.revenue += inv.amount;
    serviceProfit[inv.service] = existing;
  }
  // Distribute expenses proportionally
  for (const [, data] of Object.entries(serviceProfit)) {
    data.estimatedCost = totalRevenue > 0 ? (data.revenue / totalRevenue) * totalExpenses : 0;
  }

  const serviceMargins = Object.entries(serviceProfit).map(([service, data]) => ({
    service,
    margin: data.revenue > 0 ? ((data.revenue - data.estimatedCost) / data.revenue) * 100 : 0,
  }));

  const mostProfitableService = serviceMargins.sort((a, b) => b.margin - a.margin)[0]?.service || 'N/A';
  const leastProfitableService = serviceMargins.sort((a, b) => a.margin - b.margin)[0]?.service || 'N/A';

  // Clients
  const yearClients = clients.filter((c) => c.createdAt >= yearStart && c.createdAt <= yearEnd);
  const activeClients = clients.filter((c) => c.active);
  const lostClients = clients.filter((c) => !c.active && c.createdAt < yearStart);
  const retentionRate = clients.length > 0 ? (activeClients.length / clients.length) * 100 : 0;
  const avgLTV = clients.length > 0 ? clients.reduce((s, c) => s + c.totalRevenue, 0) / clients.length : 0;
  const repeatClients = yearInvoices.reduce((acc, i) => { acc[i.clientName] = (acc[i.clientName] || 0) + 1; return acc; }, {} as Record<string, number>);
  const repeatRate = uniqueClients.size > 0 ? (Object.values(repeatClients).filter((c) => c > 1).length / uniqueClients.size) * 100 : 0;

  // Monthly breakdown
  const monthly: MonthlyBreakdown[] = [];
  for (let m = 0; m < 12; m++) {
    const monthStart = new Date(year, m, 1).getTime();
    const monthEnd = new Date(year, m + 1, 0, 23, 59, 59).getTime();
    const monthRevenue = yearInvoices.filter((i) => i.date >= monthStart && i.date <= monthEnd).reduce((s, i) => s + i.amount, 0);
    const monthExpenses = yearExpenses.filter((e) => e.date >= monthStart && e.date <= monthEnd).reduce((s, e) => s + e.amount, 0);
    monthly.push({
      month: new Date(year, m).toLocaleString('en-IN', { month: 'short' }),
      revenue: monthRevenue,
      expenses: monthExpenses,
      profit: monthRevenue - monthExpenses,
      clients: new Set(yearInvoices.filter((i) => i.date >= monthStart && i.date <= monthEnd).map((i) => i.clientName)).size,
    });
  }

  // Insights
  const insights: string[] = [];
  if (totalRevenue > 0) {
    insights.push(`Total revenue for ${year}: ₹${totalRevenue.toLocaleString('en-IN')}.`);
  }
  if (topClient !== 'N/A') {
    insights.push(`Top client: ${topClient} contributed ₹${(byClient[topClient] || 0).toLocaleString('en-IN')}.`);
  }
  if (grossMargin > 30) {
    insights.push(`Healthy gross margin of ${grossMargin.toFixed(1)}%. Keep up the good work!`);
  } else if (grossMargin > 0) {
    insights.push(`Gross margin of ${grossMargin.toFixed(1)}% is below the 30% target. Consider optimising costs.`);
  }
  if (repeatRate > 50) {
    insights.push(`Excellent ${repeatRate.toFixed(0)}% client repeat rate. Strong relationships!`);
  }
  if (lostClients.length > 0) {
    insights.push(`${lostClients.length} client(s) churned. Review exit reasons to improve retention.`);
  }

  return {
    year,
    generatedAt: Date.now(),
    revenue: {
      totalINR: totalRevenue,
      totalUSD: totalRevenue / 84,
      byService,
      byClient,
      byMonth,
      topClient,
      topService,
      averageProjectValue: Math.round(averageProjectValue),
    },
    expenses: {
      totalINR: totalExpenses,
      byCategory,
      recurringMonthly: Math.round(recurringMonthly),
      costPerClient: Math.round(costPerClient),
    },
    profitability: {
      grossProfit: Math.round(grossProfit),
      grossMargin: Math.round(grossMargin * 10) / 10,
      netProfit: Math.round(netProfit),
      netMargin: Math.round(grossMargin * 10) / 10,
      mostProfitableService,
      leastProfitableService,
    },
    clients: {
      totalClients: clients.length,
      newClients: yearClients.length,
      lostClients: lostClients.length,
      retentionRate: Math.round(retentionRate * 10) / 10,
      averageLifetimeValue: Math.round(avgLTV),
      repeatRate: Math.round(repeatRate * 10) / 10,
    },
    monthly,
    insights,
  };
}

// ─── Formatting ────────────────────────

export function formatAnnualReportAsText(report: AnnualReport): string {
  let text = `ANNUAL REVENUE REPORT — ${report.year}\n`;
  text += `${'═'.repeat(50)}\n\n`;

  text += `REVENUE SUMMARY\n`;
  text += `${'─'.repeat(30)}\n`;
  text += `Total Revenue: ₹${report.revenue.totalINR.toLocaleString('en-IN')}\n`;
  text += `Top Client: ${report.revenue.topClient}\n`;
  text += `Top Service: ${report.revenue.topService}\n`;
  text += `Avg Project Value: ₹${report.revenue.averageProjectValue.toLocaleString('en-IN')}\n\n`;

  text += `EXPENSE SUMMARY\n`;
  text += `${'─'.repeat(30)}\n`;
  text += `Total Expenses: ₹${report.expenses.totalINR.toLocaleString('en-IN')}\n`;
  text += `Recurring Monthly: ₹${report.expenses.recurringMonthly.toLocaleString('en-IN')}\n`;
  text += `Cost per Client: ₹${report.expenses.costPerClient.toLocaleString('en-IN')}\n\n`;

  text += `PROFITABILITY\n`;
  text += `${'─'.repeat(30)}\n`;
  text += `Gross Profit: ₹${report.profitability.grossProfit.toLocaleString('en-IN')}\n`;
  text += `Gross Margin: ${report.profitability.grossMargin}%\n`;
  text += `Most Profitable: ${report.profitability.mostProfitableService}\n\n`;

  text += `CLIENT SUMMARY\n`;
  text += `${'─'.repeat(30)}\n`;
  text += `Total Clients: ${report.clients.totalClients}\n`;
  text += `New Clients: ${report.clients.newClients}\n`;
  text += `Retention Rate: ${report.clients.retentionRate}%\n`;
  text += `Repeat Rate: ${report.clients.repeatRate}%\n\n`;

  text += `MONTHLY BREAKDOWN\n`;
  text += `${'─'.repeat(30)}\n`;
  for (const m of report.monthly) {
    text += `${m.month}: ₹${m.revenue.toLocaleString('en-IN')} revenue / ₹${m.profit.toLocaleString('en-IN')} profit\n`;
  }

  if (report.insights.length > 0) {
    text += `\nINSIGHTS\n${'─'.repeat(30)}\n`;
    for (const insight of report.insights) {
      text += `• ${insight}\n`;
    }
  }

  return text;
}
