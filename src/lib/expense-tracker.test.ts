import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadExpenses,
  saveExpenses,
  addExpense,
  deleteExpense,
  updateExpense,
  getExpensesByProject,
  getExpensesByClient,
  getExpenseSummary,
  seedExpensesIfEmpty,
  formatExpenseReport,
  EXPENSE_CATEGORIES,
  type Expense,
  type ExpenseCategory,
} from './expense-tracker';

const EXPENSES_KEY = 'oracle_expenses';
const EXPENSES_SEEDED_KEY = 'oracle_expenses_seeded';

function makeExpense(overrides: Partial<Omit<Expense, 'id' | 'createdAt'>> = {}): Omit<Expense, 'id' | 'createdAt'> {
  return {
    clientName: 'Test Client',
    description: 'Test expense',
    amount: 1500,
    category: 'software' as ExpenseCategory,
    date: Date.now(),
    recurring: false,
    ...overrides,
  };
}

describe('EXPENSE_CATEGORIES', () => {
  it('has 8 categories', () => {
    expect(EXPENSE_CATEGORIES).toHaveLength(8);
  });

  it('each category has id, label, and icon', () => {
    for (const cat of EXPENSE_CATEGORIES) {
      expect(cat.id).toBeTruthy();
      expect(cat.label).toBeTruthy();
      expect(cat.icon).toBeTruthy();
    }
  });
});

describe('loadExpenses / saveExpenses', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads empty array when no data', () => {
    expect(loadExpenses()).toEqual([]);
  });

  it('saves and loads expenses', () => {
    const expenses: Expense[] = [
      { id: 'exp-1', clientName: 'A', description: 'desc', amount: 100, category: 'tools', date: Date.now(), recurring: false, createdAt: Date.now() },
    ];
    saveExpenses(expenses);
    expect(loadExpenses()).toHaveLength(1);
    expect(loadExpenses()[0].id).toBe('exp-1');
  });
});

describe('addExpense', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates an expense with id and createdAt', () => {
    const result = addExpense(makeExpense());
    expect(result.id).toContain('exp-');
    expect(result.createdAt).toBeGreaterThan(0);
    expect(result.clientName).toBe('Test Client');
  });

  it('prepends new expenses (newest first)', () => {
    addExpense(makeExpense({ description: 'First' }));
    addExpense(makeExpense({ description: 'Second' }));
    const loaded = loadExpenses();
    expect(loaded[0].description).toBe('Second');
    expect(loaded[1].description).toBe('First');
  });

  it('caps storage at 1000 entries', () => {
    for (let i = 0; i < 1010; i++) {
      addExpense(makeExpense({ description: `Expense ${i}` }));
    }
    expect(loadExpenses()).toHaveLength(1000);
  });
});

describe('deleteExpense', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('removes expense by id', () => {
    const added = addExpense(makeExpense());
    addExpense(makeExpense({ description: 'Keep' }));
    deleteExpense(added.id);
    const loaded = loadExpenses();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].description).toBe('Keep');
  });
});

describe('updateExpense', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('updates fields of an existing expense', () => {
    const added = addExpense(makeExpense({ description: 'Original', amount: 1000 }));
    const updated = updateExpense(added.id, { description: 'Updated', amount: 2500 });
    expect(updated).not.toBeNull();
    expect(updated!.description).toBe('Updated');
    expect(updated!.amount).toBe(2500);
    expect(updated!.id).toBe(added.id);
  });

  it('returns null for non-existent id', () => {
    addExpense(makeExpense());
    const result = updateExpense('non-existent-id', { description: 'Nope' });
    expect(result).toBeNull();
  });

  it('persists changes to localStorage', () => {
    const added = addExpense(makeExpense({ description: 'Before' }));
    updateExpense(added.id, { description: 'After' });
    const loaded = loadExpenses();
    expect(loaded[0].description).toBe('After');
  });

  it('can update category', () => {
    const added = addExpense(makeExpense({ category: 'software' }));
    const updated = updateExpense(added.id, { category: 'marketing' });
    expect(updated!.category).toBe('marketing');
  });

  it('can update recurring flag', () => {
    const added = addExpense(makeExpense({ recurring: false }));
    const updated = updateExpense(added.id, { recurring: true });
    expect(updated!.recurring).toBe(true);
  });

  it('preserves id and createdAt', () => {
    const added = addExpense(makeExpense());
    const originalId = added.id;
    const originalCreatedAt = added.createdAt;
    const updated = updateExpense(added.id, { description: 'Changed' });
    expect(updated!.id).toBe(originalId);
    expect(updated!.createdAt).toBe(originalCreatedAt);
  });

  it('does not affect other expenses', () => {
    const first = addExpense(makeExpense({ description: 'First' }));
    const second = addExpense(makeExpense({ description: 'Second' }));
    updateExpense(first.id, { description: 'First Updated' });
    const loaded = loadExpenses();
    const secondAfter = loaded.find((e) => e.id === second.id);
    expect(secondAfter!.description).toBe('Second');
  });
});

describe('getExpensesByProject', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('filters by projectId', () => {
    addExpense(makeExpense({ projectId: 'proj-1', description: 'A' }));
    addExpense(makeExpense({ projectId: 'proj-2', description: 'B' }));
    addExpense(makeExpense({ projectId: 'proj-1', description: 'C' }));
    const result = getExpensesByProject('proj-1');
    expect(result).toHaveLength(2);
  });

  it('returns empty for unknown projectId', () => {
    addExpense(makeExpense({ projectId: 'proj-1' }));
    expect(getExpensesByProject('proj-999')).toHaveLength(0);
  });

  it('skips expenses with no projectId', () => {
    addExpense(makeExpense({ projectId: 'proj-1', description: 'Has project' }));
    addExpense(makeExpense({ description: 'No project' }));
    expect(getExpensesByProject('proj-1')).toHaveLength(1);
  });
});

describe('getExpensesByClient', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('filters by clientName', () => {
    addExpense(makeExpense({ clientName: 'Alice' }));
    addExpense(makeExpense({ clientName: 'Bob' }));
    addExpense(makeExpense({ clientName: 'Alice' }));
    expect(getExpensesByClient('Alice')).toHaveLength(2);
    expect(getExpensesByClient('Bob')).toHaveLength(1);
  });
});

describe('getExpenseSummary', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns monthlyAverage 0 when all expenses are older than 3 months', () => {
    const threeMonthsAgo = Date.now() - 91 * 24 * 60 * 60 * 1000;
    const expenses: Expense[] = [
      { id: '1', clientName: 'A', description: 'd', amount: 600, category: 'software', date: threeMonthsAgo, recurring: false, createdAt: threeMonthsAgo },
    ];
    const summary = getExpenseSummary(expenses);
    expect(summary.monthlyAverage).toBe(0);
  });

  it('returns zero summary for empty data', () => {
    const summary = getExpenseSummary([]);
    expect(summary.total).toBe(0);
    expect(summary.topCategory).toBe('other');
    expect(summary.topClient).toBe('N/A');
    expect(summary.monthlyAverage).toBe(0);
  });

  it('calculates totals and categories correctly', () => {
    const expenses: Expense[] = [
      { id: '1', clientName: 'A', description: 'd', amount: 1000, category: 'software', date: Date.now(), recurring: true, createdAt: Date.now() },
      { id: '2', clientName: 'B', description: 'd', amount: 500, category: 'tools', date: Date.now(), recurring: false, createdAt: Date.now() },
      { id: '3', clientName: 'A', description: 'd', amount: 300, category: 'software', date: Date.now(), recurring: true, createdAt: Date.now() },
    ];
    const summary = getExpenseSummary(expenses);
    expect(summary.total).toBe(1800);
    expect(summary.byCategory.software).toBe(1300);
    expect(summary.byCategory.tools).toBe(500);
    expect(summary.topCategory).toBe('software');
    expect(summary.topClient).toBe('A');
    expect(summary.recurringTotal).toBe(1300);
  });

  it('computes monthly average from recent expenses', () => {
    const now = Date.now();
    const expenses: Expense[] = [
      { id: '1', clientName: 'A', description: 'd', amount: 900, category: 'software', date: now, recurring: false, createdAt: now },
    ];
    const summary = getExpenseSummary(expenses);
    // 900 / 3 months = 300
    expect(summary.monthlyAverage).toBe(300);
  });
});

describe('seedExpensesIfEmpty', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('seeds expenses from template data on empty storage', () => {
    const templates = [
      makeExpense({ description: 'Template A', clientName: 'Client1' }),
      makeExpense({ description: 'Template B', clientName: 'Client2' }),
    ];
    const result = seedExpensesIfEmpty(templates);
    expect(result).toBe(true);
    const loaded = loadExpenses();
    expect(loaded).toHaveLength(2);
    expect(loaded[0].description).toBe('Template A');
    // id should start with 'exp-seed-'
    expect(loaded[0].id).toContain('exp-seed-');
    // createdAt should be set from date
    expect(loaded[0].createdAt).toBe(loaded[0].date);
  });

  it('sets the seeded flag in localStorage', () => {
    seedExpensesIfEmpty([makeExpense()]);
    expect(localStorage.getItem(EXPENSES_SEEDED_KEY)).toBe('1');
  });

  it('returns false if already seeded (flag present)', () => {
    localStorage.setItem(EXPENSES_SEEDED_KEY, '1');
    const result = seedExpensesIfEmpty([makeExpense()]);
    expect(result).toBe(false);
    expect(loadExpenses()).toHaveLength(0);
  });

  it('returns false if expenses already exist (no flag)', () => {
    addExpense(makeExpense({ description: 'Existing' }));
    const result = seedExpensesIfEmpty([makeExpense({ description: 'New' })]);
    expect(result).toBe(false);
    const loaded = loadExpenses();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].description).toBe('Existing');
  });

  it('does not overwrite existing expenses', () => {
    addExpense(makeExpense({ description: 'Original' }));
    seedExpensesIfEmpty([makeExpense({ description: 'Should Not Appear' })]);
    const loaded = loadExpenses();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].description).toBe('Original');
  });

  it('seeds empty array without error', () => {
    const result = seedExpensesIfEmpty([]);
    expect(result).toBe(true);
    expect(loadExpenses()).toHaveLength(0);
  });
});

describe('formatExpenseReport', () => {
  it('returns formatted text for empty expenses', () => {
    const text = formatExpenseReport([]);
    expect(text).toContain('EXPENSE REPORT');
    expect(text).toContain('Total Expenses: ₹0');
  });

  it('formats expenses with categories and clients', () => {
    const expenses: Expense[] = [
      { id: '1', clientName: 'Alice', description: 'Software', amount: 2000, category: 'software', date: Date.now(), recurring: true, createdAt: Date.now() },
      { id: '2', clientName: 'Bob', description: 'Travel', amount: 500, category: 'travel', date: Date.now(), recurring: false, createdAt: Date.now() },
    ];
    const text = formatExpenseReport(expenses);
    expect(text).toContain('Total Expenses: ₹2,500');
    expect(text).toContain('Recurring: ₹2,000');
    expect(text).toContain('software');
    expect(text).toContain('travel');
    expect(text).toContain('Alice');
    expect(text).toContain('Bob');
  });
});
