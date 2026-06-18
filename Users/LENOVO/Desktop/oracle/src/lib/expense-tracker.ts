// ═══════════════════════════════════════
// ORACLE — Expense Tracker
// Project cost tracking · Category budgets · Expense reporting
// ═══════════════════════════════════════

// ─── Types ─────────────────────────────

export type ExpenseCategory = 
  | 'software'
  | 'tools'
  | 'freelancer'
  | 'marketing'
  | 'infrastructure'
  | 'travel'
  | 'education'
  | 'other';

export interface Expense {
  id: string;
  projectId?: string;
  clientName: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  date: number;
  recurring: boolean;
  notes?: string;
  createdAt: number;
}

export interface ExpenseSummary {
  total: number;
  byCategory: Record<ExpenseCategory, number>;
  byClient: Record<string, number>;
  monthlyAverage: number;
  recurringTotal: number;
  topCategory: ExpenseCategory;
  topClient: string;
}

export const EXPENSE_CATEGORIES: { id: ExpenseCategory; label: string; icon: string }[] = [
  { id: 'software', label: 'Software', icon: '💻' },
  { id: 'tools', label: 'Tools', icon: '🔧' },
  { id: 'freelancer', label: 'Freelancer', icon: '👤' },
  { id: 'marketing', label: 'Marketing', icon: '📢' },
  { id: 'infrastructure', label: 'Infrastructure', icon: '☁️' },
  { id: 'travel', label: 'Travel', icon: '✈️' },
  { id: 'education', label: 'Education', icon: '📚' },
  { id: 'other', label: 'Other', icon: '📦' },
];

// ─── Local Storage ─────────────────────

const EXPENSES_KEY = 'oracle_expenses';

export function loadExpenses(): Expense[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(EXPENSES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveExpenses(expenses: Expense[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses));
}

export function addExpense(expense: Omit<Expense, 'id' | 'createdAt'>): Expense {
  const full: Expense = {
    ...expense,
    id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now(),
  };
  const expenses = loadExpenses();
  expenses.unshift(full);
  saveExpenses(expenses.slice(0, 1000));
  return full;
}

export function deleteExpense(id: string): void {
  const expenses = loadExpenses().filter((e) => e.id !== id);
  saveExpenses(expenses);
}

export function updateExpense(id: string, updates: Partial<Omit<Expense, 'id' | 'createdAt'>>): Expense | null {
  const expenses = loadExpenses();
  const index = expenses.findIndex((e) => e.id === id);
  if (index === -1) return null;
  const updated = { ...expenses[index], ...updates };
  expenses[index] = updated;
  saveExpenses(expenses);
  return updated;
}

export function getExpensesByProject(projectId: string): Expense[] {
  return loadExpenses().filter((e) => e.projectId === projectId);
}

export function getExpensesByClient(clientName: string): Expense[] {
  return loadExpenses().filter((e) => e.clientName === clientName);
}

// ─── Summary & Analytics ───────────────

export function getExpenseSummary(expenses?: Expense[]): ExpenseSummary {
  const all = expenses || loadExpenses();
  const now = Date.now();
  const threeMonthsAgo = now - 90 * 24 * 60 * 60 * 1000;

  const total = all.reduce((s, e) => s + e.amount, 0);
  const byCategory = {} as Record<ExpenseCategory, number>;
  const byClient: Record<string, number> = {};

  for (const e of all) {
    byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
    byClient[e.clientName] = (byClient[e.clientName] || 0) + e.amount;
  }

  const recentExpenses = all.filter((e) => e.date >= threeMonthsAgo);
  const monthlyAverage = recentExpenses.length > 0
    ? recentExpenses.reduce((s, e) => s + e.amount, 0) / 3
    : 0;

  const recurringTotal = all.filter((e) => e.recurring).reduce((s, e) => s + e.amount, 0);

  const topCategory = (Object.entries(byCategory) as [ExpenseCategory, number][])
    .sort(([, a], [, b]) => b - a)[0]?.[0] || 'other';

  const topClient = Object.entries(byClient)
    .sort(([, a], [, b]) => b - a)[0]?.[0] || 'N/A';

  return {
    total: Math.round(total),
    byCategory: byCategory as Record<ExpenseCategory, number>,
    byClient,
    monthlyAverage: Math.round(monthlyAverage),
    recurringTotal: Math.round(recurringTotal),
    topCategory,
    topClient,
  };
}

// ─── Seeding ─────────────────────────

const EXPENSES_SEEDED_KEY = 'oracle_expenses_seeded';

export function seedExpensesIfEmpty(seedData: Omit<Expense, 'id' | 'createdAt'>[]): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (localStorage.getItem(EXPENSES_SEEDED_KEY)) return false;
    const existing = loadExpenses();
    if (existing.length > 0) return false;
    const seeded = seedData.map((item) => ({
      ...item,
      id: `exp-seed-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: item.date,
    }));
    saveExpenses(seeded);
    localStorage.setItem(EXPENSES_SEEDED_KEY, '1');
    return true;
  } catch {
    return false;
  }
}

// ─── Formatting ────────────────────────

export function formatExpenseReport(expenses: Expense[]): string {
  const summary = getExpenseSummary(expenses);
  let text = `EXPENSE REPORT\n`;
  text += `${'═'.repeat(40)}\n\n`;
  text += `Total Expenses: ₹${summary.total.toLocaleString('en-IN')}\n`;
  text += `Monthly Average: ₹${summary.monthlyAverage.toLocaleString('en-IN')}\n`;
  text += `Recurring: ₹${summary.recurringTotal.toLocaleString('en-IN')}\n\n`;
  
  text += `BY CATEGORY\n`;
  text += `${'─'.repeat(30)}\n`;
  for (const [cat, amount] of Object.entries(summary.byCategory).sort(([, a], [, b]) => b - a)) {
    text += `${cat}: ₹${amount.toLocaleString('en-IN')}\n`;
  }

  text += `\nBY CLIENT\n`;
  text += `${'─'.repeat(30)}\n`;
  for (const [client, amount] of Object.entries(summary.byClient).sort(([, a], [, b]) => b - a)) {
    text += `${client}: ₹${amount.toLocaleString('en-IN')}\n`;
  }

  return text;
}
