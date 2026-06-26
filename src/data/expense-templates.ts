import type { Expense, ExpenseCategory } from '@/lib/expense-tracker';

// ─── Seed Data ──────────────────────────
// Realistic Indian agency expenses spread across the current year

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const year = new Date().getFullYear();

/** Helper: date N months ago from now */
function monthsAgo(n: number, day = 15): number {
  return new Date(year, new Date().getMonth() - n, day).getTime();
}

export const DEFAULT_EXPENSE_TEMPLATES: Omit<Expense, 'id' | 'createdAt'>[] = [
  // ── Software (recurring) ──
  {
    clientName: 'Agency',
    description: 'Claude.ai Pro Subscription',
    amount: 1575,
    category: 'software',
    date: monthsAgo(0),
    recurring: true,
    notes: 'AI assistant for content and code generation',
  },
  {
    clientName: 'Agency',
    description: 'Canva Pro (Teams)',
    amount: 3999,
    category: 'software',
    date: monthsAgo(0),
    recurring: true,
    notes: 'Design tool for social media and client deliverables',
  },
  {
    clientName: 'Agency',
    description: 'Notion Team Plan',
    amount: 2400,
    category: 'software',
    date: monthsAgo(0),
    recurring: true,
    notes: 'Project management and client wikis',
  },
  {
    clientName: 'Agency',
    description: 'Google Workspace',
    amount: 1380,
    category: 'software',
    date: monthsAgo(0),
    recurring: true,
    notes: 'Email, docs, drive — 5 seats',
  },

  // ── Tools (recurring) ──
  {
    clientName: 'Agency',
    description: 'SEMrush Pro',
    amount: 9990,
    category: 'tools',
    date: monthsAgo(0),
    recurring: true,
    notes: 'SEO research and rank tracking',
  },
  {
    clientName: 'Agency',
    description: 'Ahrefs Lite',
    amount: 7200,
    category: 'tools',
    date: monthsAgo(1),
    recurring: true,
    notes: 'Backlink analysis and keyword research',
  },
  {
    clientName: 'Agency',
    description: 'Vercel Pro',
    amount: 1680,
    category: 'tools',
    date: monthsAgo(0),
    recurring: true,
    notes: 'Hosting for client projects',
  },
  {
    clientName: 'Agency',
    description: 'Screaming Frog License',
    amount: 4500,
    category: 'tools',
    date: monthsAgo(5),
    recurring: false,
    notes: 'Annual SEO crawler license',
  },

  // ── Infrastructure ──
  {
    clientName: 'Agency',
    description: 'AWS EC2 + RDS',
    amount: 3200,
    category: 'infrastructure',
    date: monthsAgo(0),
    recurring: true,
    notes: 'Cloud hosting for client apps',
  },
  {
    clientName: 'Agency',
    description: 'Supabase Pro',
    amount: 2100,
    category: 'infrastructure',
    date: monthsAgo(0),
    recurring: true,
    notes: 'Database for SaaS projects',
  },

  // ── Freelancer (project-based) ──
  {
    clientName: 'Spice Garden Restaurant',
    description: 'Logo design — Priya (freelancer)',
    amount: 5000,
    category: 'freelancer',
    date: monthsAgo(3),
    recurring: false,
  },
  {
    clientName: 'Smile Dental Clinic',
    description: 'Video editing — Raj (freelancer)',
    amount: 8000,
    category: 'freelancer',
    date: monthsAgo(2),
    recurring: false,
  },
  {
    clientName: 'FitZone Gym',
    description: 'Copywriting — Ananya (freelancer)',
    amount: 6000,
    category: 'freelancer',
    date: monthsAgo(1),
    recurring: false,
  },

  // ── Marketing ──
  {
    clientName: 'Agency',
    description: 'LinkedIn Ads — lead gen campaign',
    amount: 12000,
    category: 'marketing',
    date: monthsAgo(2),
    recurring: false,
    notes: 'Generated 15 warm leads',
  },
  {
    clientName: 'Agency',
    description: 'Google Ads — agency website',
    amount: 8000,
    category: 'marketing',
    date: monthsAgo(1),
    recurring: false,
  },
  {
    clientName: 'Agency',
    description: 'WhatsApp Business API',
    amount: 2500,
    category: 'marketing',
    date: monthsAgo(0),
    recurring: true,
    notes: 'Bulk messaging for lead outreach',
  },

  // ── Education ──
  {
    clientName: 'Agency',
    description: 'Advanced SEO Course — Ubersuggest',
    amount: 4999,
    category: 'education',
    date: monthsAgo(4),
    recurring: false,
  },
  {
    clientName: 'Agency',
    description: 'Next.js Masterclass',
    amount: 2999,
    category: 'education',
    date: monthsAgo(3),
    recurring: false,
  },

  // ── Travel ──
  {
    clientName: 'TechNova Solutions',
    description: 'Client meeting — flight to Bangalore',
    amount: 6500,
    category: 'travel',
    date: monthsAgo(2),
    recurring: false,
  },
  {
    clientName: 'Elegant Boutique',
    description: 'Client meeting — cab to Juhu',
    amount: 800,
    category: 'travel',
    date: monthsAgo(1),
    recurring: false,
  },

  // ── Other ──
  {
    clientName: 'Agency',
    description: 'Business card printing — 500 cards',
    amount: 1200,
    category: 'other',
    date: monthsAgo(5),
    recurring: false,
  },
  {
    clientName: 'Agency',
    description: 'Coworking space — monthly',
    amount: 5000,
    category: 'other',
    date: monthsAgo(0),
    recurring: true,
  },
];
