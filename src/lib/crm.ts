// ═══════════════════════════════════════
// ORACLE — CRM System
// Lead/Prospect/Client Management · Pipeline · Deal Scoring · Forecasting
// ═══════════════════════════════════════

import { nanoid } from 'nanoid';
import { createLogger } from '@/lib/logger';
import { getStored, setStored } from '@/lib/storage-utils';
import type { Lead } from '@/types';

const log = createLogger('CRM');

// ─── Types ─────────────────────────────

export type PipelineStage =
  | 'lead'
  | 'qualified'
  | 'proposal'
  | 'negotiation'
  | 'closed-won'
  | 'closed-lost';

export type DealPriority = 'low' | 'medium' | 'high' | 'urgent';

export type ContactType = 'lead' | 'prospect' | 'client' | 'partner';

export interface CRMContact {
  id: string;
  type: ContactType;
  name: string;
  email: string;
  phone: string;
  company: string;
  industry: string;
  city: string;
  website?: string;
  linkedinUrl?: string;
  source: string;
  tags: string[];
  notes: string;
  assignedTo?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CRMDeal {
  id: string;
  contactId: string;
  contactName: string;
  companyName: string;
  title: string;
  value: number;
  currency: 'INR';
  stage: PipelineStage;
  priority: DealPriority;
  probability: number; // 0-100
  expectedCloseDate: number;
  actualCloseDate?: number;
  services: string[];
  notes: string;
  lossReason?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CRMActivity {
  id: string;
  contactId: string;
  dealId?: string;
  type: 'call' | 'email' | 'meeting' | 'note' | 'task' | 'whatsapp';
  title: string;
  description: string;
  outcome?: string;
  scheduledAt?: number;
  completedAt?: number;
  createdAt: number;
}

export interface PipelineMetrics {
  stage: PipelineStage;
  count: number;
  totalValue: number;
  weightedValue: number;
  avgProbability: number;
}

export interface ForecastResult {
  totalPipeline: number;
  weightedPipeline: number;
  closedWon: number;
  closedLost: number;
  winRate: number;
  avgDealSize: number;
  avgSalesCycleDays: number;
  forecastByStage: PipelineMetrics[];
  monthlyForecast: { month: string; forecast: number; actual: number }[];
}

export interface DealScore {
  dealId: string;
  score: number; // 0-100
  factors: {
    budgetFit: number;
    urgencyFit: number;
    painSeverity: number;
    engagementLevel: number;
    authorityAccess: number;
    fitScore: number;
  };
  recommendation: string;
}

// ─── Storage Keys ──────────────────────

const CRM_CONTACTS_KEY = 'oracle_crm_contacts';
const CRM_DEALS_KEY = 'oracle_crm_deals';
const CRM_ACTIVITIES_KEY = 'oracle_crm_activities';

// ─── Contact Management ────────────────

export function getAllContacts(): CRMContact[] {
  return getStored<CRMContact>(CRM_CONTACTS_KEY);
}

export function getContactById(id: string): CRMContact | undefined {
  return getAllContacts().find((c) => c.id === id);
}

export function getContactsByType(type: ContactType): CRMContact[] {
  return getAllContacts().filter((c) => c.type === type);
}

export function searchContacts(query: string): CRMContact[] {
  const lower = query.toLowerCase();
  return getAllContacts().filter(
    (c) =>
      c.name.toLowerCase().includes(lower) ||
      c.company.toLowerCase().includes(lower) ||
      c.email.toLowerCase().includes(lower) ||
      c.phone.includes(query) ||
      c.industry.toLowerCase().includes(lower) ||
      c.tags.some((t) => t.toLowerCase().includes(lower)),
  );
}

export function createContact(
  data: Omit<CRMContact, 'id' | 'createdAt' | 'updatedAt'>,
): CRMContact {
  const contacts = getAllContacts();
  const contact: CRMContact = {
    ...data,
    id: nanoid(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  contacts.push(contact);
  setStored(CRM_CONTACTS_KEY, contacts);
  log.info('Contact created', { id: contact.id, name: contact.name, type: contact.type });
  return contact;
}

export function updateContact(
  id: string,
  updates: Partial<Omit<CRMContact, 'id' | 'createdAt'>>,
): CRMContact | null {
  const contacts = getAllContacts();
  const index = contacts.findIndex((c) => c.id === id);
  if (index === -1) return null;

  contacts[index] = { ...contacts[index], ...updates, updatedAt: Date.now() };
  setStored(CRM_CONTACTS_KEY, contacts);
  log.info('Contact updated', { id });
  return contacts[index];
}

export function deleteContact(id: string): boolean {
  const contacts = getAllContacts();
  const filtered = contacts.filter((c) => c.id !== id);
  if (filtered.length === contacts.length) return false;
  setStored(CRM_CONTACTS_KEY, filtered);
  log.info('Contact deleted', { id });
  return true;
}

export function convertLeadToProspect(leadId: string): CRMContact | null {
  const contacts = getAllContacts();
  const contact = contacts.find((c) => c.id === leadId);
  if (!contact) return null;

  contact.type = 'prospect';
  contact.updatedAt = Date.now();
  setStored(CRM_CONTACTS_KEY, contacts);
  log.info('Lead converted to prospect', { id: leadId });
  return contact;
}

export function convertProspectToClient(prospectId: string): CRMContact | null {
  const contacts = getAllContacts();
  const contact = contacts.find((c) => c.id === prospectId);
  if (!contact) return null;

  contact.type = 'client';
  contact.updatedAt = Date.now();
  setStored(CRM_CONTACTS_KEY, contacts);
  log.info('Prospect converted to client', { id: prospectId });
  return contact;
}

// ─── Deal Management ───────────────────

export function getAllDeals(): CRMDeal[] {
  return getStored<CRMDeal>(CRM_DEALS_KEY);
}

export function getDealById(id: string): CRMDeal | undefined {
  return getAllDeals().find((d) => d.id === id);
}

export function getDealsByStage(stage: PipelineStage): CRMDeal[] {
  return getAllDeals().filter((d) => d.stage === stage);
}

export function getDealsByContact(contactId: string): CRMDeal[] {
  return getAllDeals().filter((d) => d.contactId === contactId);
}

export function getActiveDeals(): CRMDeal[] {
  return getAllDeals().filter(
    (d) => d.stage !== 'closed-won' && d.stage !== 'closed-lost',
  );
}

export function createDeal(
  data: Omit<CRMDeal, 'id' | 'createdAt' | 'updatedAt'>,
): CRMDeal {
  const deals = getAllDeals();
  const deal: CRMDeal = {
    ...data,
    id: nanoid(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  deals.push(deal);
  setStored(CRM_DEALS_KEY, deals);
  log.info('Deal created', { id: deal.id, title: deal.title, value: deal.value });
  return deal;
}

export function updateDeal(
  id: string,
  updates: Partial<Omit<CRMDeal, 'id' | 'createdAt'>>,
): CRMDeal | null {
  const deals = getAllDeals();
  const index = deals.findIndex((d) => d.id === id);
  if (index === -1) return null;

  deals[index] = { ...deals[index], ...updates, updatedAt: Date.now() };
  setStored(CRM_DEALS_KEY, deals);
  log.info('Deal updated', { id, stage: updates.stage });
  return deals[index];
}

export function moveDealToStage(
  dealId: string,
  newStage: PipelineStage,
): CRMDeal | null {
  const deal = getDealById(dealId);
  if (!deal) return null;

  const updates: Partial<CRMDeal> = { stage: newStage };

  // Auto-set close date
  if (newStage === 'closed-won' || newStage === 'closed-lost') {
    updates.actualCloseDate = Date.now();
  }

  return updateDeal(dealId, updates);
}

export function deleteDeal(id: string): boolean {
  const deals = getAllDeals();
  const filtered = deals.filter((d) => d.id !== id);
  if (filtered.length === deals.length) return false;
  setStored(CRM_DEALS_KEY, filtered);
  log.info('Deal deleted', { id });
  return true;
}

// ─── Activity Management ───────────────

export function getAllActivities(): CRMActivity[] {
  return getStored<CRMActivity>(CRM_ACTIVITIES_KEY);
}

export function getActivitiesByContact(contactId: string): CRMActivity[] {
  return getAllActivities()
    .filter((a) => a.contactId === contactId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function getActivitiesByDeal(dealId: string): CRMActivity[] {
  return getAllActivities()
    .filter((a) => a.dealId === dealId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function createActivity(
  data: Omit<CRMActivity, 'id' | 'createdAt'>,
): CRMActivity {
  const activities = getAllActivities();
  const activity: CRMActivity = {
    ...data,
    id: nanoid(),
    createdAt: Date.now(),
  };
  activities.push(activity);
  setStored(CRM_ACTIVITIES_KEY, activities);
  return activity;
}

export function completeActivity(
  id: string,
  outcome: string,
): CRMActivity | null {
  const activities = getAllActivities();
  const index = activities.findIndex((a) => a.id === id);
  if (index === -1) return null;

  activities[index].completedAt = Date.now();
  activities[index].outcome = outcome;
  setStored(CRM_ACTIVITIES_KEY, activities);
  return activities[index];
}

// ─── Deal Scoring ──────────────────────

export function scoreDeal(deal: CRMDeal): DealScore {
  const factors: DealScore['factors'] = {
    budgetFit: 0,
    urgencyFit: 0,
    painSeverity: 0,
    engagementLevel: 0,
    authorityAccess: 0,
    fitScore: 0,
  };

  // Budget fit (based on deal value relative to typical deal sizes)
  if (deal.value >= 100000) factors.budgetFit = 10;
  else if (deal.value >= 50000) factors.budgetFit = 8;
  else if (deal.value >= 25000) factors.budgetFit = 6;
  else if (deal.value >= 10000) factors.budgetFit = 4;
  else factors.budgetFit = 2;

  // Urgency fit (based on expected close date)
  const daysUntilClose = Math.max(0, (deal.expectedCloseDate - Date.now()) / (1000 * 60 * 60 * 24));
  if (daysUntilClose <= 7) factors.urgencyFit = 10;
  else if (daysUntilClose <= 14) factors.urgencyFit = 8;
  else if (daysUntilClose <= 30) factors.urgencyFit = 6;
  else if (daysUntilClose <= 60) factors.urgencyFit = 4;
  else factors.urgencyFit = 2;

  // Pain severity (based on services requested)
  const highPainServices = ['seo', 'paid ads', 'lead generation', 'automation'];
  const hasHighPain = deal.services.some((s) =>
    highPainServices.some((hp) => s.toLowerCase().includes(hp)),
  );
  factors.painSeverity = hasHighPain ? 8 : 5;

  // Engagement level (based on activities)
  const activities = getActivitiesByDeal(deal.id);
  const recentActivities = activities.filter(
    (a) => Date.now() - a.createdAt < 7 * 24 * 60 * 60 * 1000,
  );
  if (recentActivities.length >= 5) factors.engagementLevel = 10;
  else if (recentActivities.length >= 3) factors.engagementLevel = 7;
  else if (recentActivities.length >= 1) factors.engagementLevel = 4;
  else factors.engagementLevel = 1;

  // Authority access (assume mid-level unless specified)
  factors.authorityAccess = 6;

  // Fit score (combination of industry and service match)
  const highFitIndustries = ['saas', 'ecommerce', 'healthcare', 'education', 'realestate'];
  const isHighFit = highFitIndustries.some((i) =>
    deal.companyName.toLowerCase().includes(i) ||
    deal.services.some((s) => s.toLowerCase().includes(i)),
  );
  factors.fitScore = isHighFit ? 8 : 5;

  // Calculate overall score
  const weights = {
    budgetFit: 0.2,
    urgencyFit: 0.15,
    painSeverity: 0.2,
    engagementLevel: 0.2,
    authorityAccess: 0.1,
    fitScore: 0.15,
  };

  const score = Math.round(
    factors.budgetFit * weights.budgetFit * 10 +
    factors.urgencyFit * weights.urgencyFit * 10 +
    factors.painSeverity * weights.painSeverity * 10 +
    factors.engagementLevel * weights.engagementLevel * 10 +
    factors.authorityAccess * weights.authorityAccess * 10 +
    factors.fitScore * weights.fitScore * 10,
  );

  let recommendation: string;
  if (score >= 80) recommendation = 'High priority — close this week';
  else if (score >= 60) recommendation = 'Strong potential — follow up within 3 days';
  else if (score >= 40) recommendation = 'Moderate potential — nurture with content';
  else recommendation = 'Low priority — revisit in 2 weeks';

  return { dealId: deal.id, score, factors, recommendation };
}

// ─── Pipeline Metrics ──────────────────

export function getPipelineMetrics(): PipelineMetrics[] {
  const deals = getAllDeals();
  const stages: PipelineStage[] = [
    'lead', 'qualified', 'proposal', 'negotiation', 'closed-won', 'closed-lost',
  ];

  return stages.map((stage) => {
    const stageDeals = deals.filter((d) => d.stage === stage);
    const totalValue = stageDeals.reduce((sum, d) => sum + d.value, 0);
    const avgProbability =
      stageDeals.length > 0
        ? stageDeals.reduce((sum, d) => sum + d.probability, 0) / stageDeals.length
        : 0;

    return {
      stage,
      count: stageDeals.length,
      totalValue,
      weightedValue: Math.round(totalValue * (avgProbability / 100)),
      avgProbability: Math.round(avgProbability),
    };
  });
}

// ─── Forecasting ───────────────────────

export function generateForecast(): ForecastResult {
  const deals = getAllDeals();
  const pipeline = getPipelineMetrics();

  const activeDeals = deals.filter(
    (d) => d.stage !== 'closed-won' && d.stage !== 'closed-lost',
  );
  const wonDeals = deals.filter((d) => d.stage === 'closed-won');
  const lostDeals = deals.filter((d) => d.stage === 'closed-lost');

  const totalPipeline = activeDeals.reduce((sum, d) => sum + d.value, 0);
  const weightedPipeline = activeDeals.reduce(
    (sum, d) => sum + Math.round(d.value * (d.probability / 100)),
    0,
  );
  const closedWon = wonDeals.reduce((sum, d) => sum + d.value, 0);
  const closedLost = lostDeals.reduce((sum, d) => sum + d.value, 0);

  const totalClosed = wonDeals.length + lostDeals.length;
  const winRate = totalClosed > 0 ? Math.round((wonDeals.length / totalClosed) * 100) : 0;

  const avgDealSize =
    wonDeals.length > 0
      ? Math.round(closedWon / wonDeals.length)
      : 0;

  // Calculate average sales cycle
  const closedWithDates = wonDeals.filter((d) => d.actualCloseDate);
  const avgSalesCycleDays =
    closedWithDates.length > 0
      ? Math.round(
          closedWithDates.reduce(
            (sum, d) => sum + (d.actualCloseDate! - d.createdAt) / (1000 * 60 * 60 * 24),
            0,
          ) / closedWithDates.length,
        )
      : 0;

  // Monthly forecast (next 3 months)
  const monthlyForecast = generateMonthlyForecast(activeDeals);

  return {
    totalPipeline,
    weightedPipeline,
    closedWon,
    closedLost,
    winRate,
    avgDealSize,
    avgSalesCycleDays,
    forecastByStage: pipeline,
    monthlyForecast,
  };
}

function generateMonthlyForecast(
  activeDeals: CRMDeal[],
): { month: string; forecast: number; actual: number }[] {
  const months = [];
  const now = new Date();

  for (let i = 0; i < 3; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const monthLabel = date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

    // Forecast based on deals expected to close this month
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    const forecast = activeDeals
      .filter((d) => {
        const closeDate = new Date(d.expectedCloseDate);
        return closeDate >= date && closeDate <= monthEnd;
      })
      .reduce((sum, d) => sum + Math.round(d.value * (d.probability / 100)), 0);

    months.push({
      month: monthLabel,
      forecast,
      actual: i === 0 ? forecast : 0, // Only current month has actuals
    });
  }

  return months;
}

// ─── Import from Lead ──────────────────

export function importLeadAsContact(lead: Lead): CRMContact {
  return createContact({
    type: 'lead',
    name: lead.businessName,
    email: lead.email,
    phone: lead.phone,
    company: lead.businessName,
    industry: lead.industry,
    city: lead.city,
    website: lead.website,
    source: lead.source,
    tags: [lead.category, lead.status],
    notes: lead.notes,
  });
}

// ─── Dashboard Summary ─────────────────

export interface CRMDashboard {
  totalContacts: number;
  contactsByType: Record<ContactType, number>;
  activeDeals: number;
  totalPipelineValue: number;
  weightedPipelineValue: number;
  dealsClosingThisMonth: number;
  winRate: number;
  recentActivities: CRMActivity[];
  topDeals: CRMDeal[];
  overdueTasks: CRMActivity[];
}

export function getCRMDashboard(): CRMDashboard {
  const contacts = getAllContacts();
  const deals = getAllDeals();
  const activities = getAllActivities();

  const contactsByType: Record<ContactType, number> = {
    lead: 0,
    prospect: 0,
    client: 0,
    partner: 0,
  };
  contacts.forEach((c) => {
    contactsByType[c.type]++;
  });

  const activeDeals = deals.filter(
    (d) => d.stage !== 'closed-won' && d.stage !== 'closed-lost',
  );

  const now = Date.now();
  const monthEnd = new Date();
  monthEnd.setMonth(monthEnd.getMonth() + 1);
  monthEnd.setDate(0);

  const dealsClosingThisMonth = activeDeals.filter(
    (d) => d.expectedCloseDate <= monthEnd.getTime(),
  ).length;

  const wonDeals = deals.filter((d) => d.stage === 'closed-won');
  const lostDeals = deals.filter((d) => d.stage === 'closed-lost');
  const totalClosed = wonDeals.length + lostDeals.length;
  const winRate = totalClosed > 0 ? Math.round((wonDeals.length / totalClosed) * 100) : 0;

  // Recent activities (last 7 days)
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const recentActivities = activities
    .filter((a) => a.createdAt > weekAgo)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 10);

  // Top deals by value
  const topDeals = [...activeDeals].sort((a, b) => b.value - a.value).slice(0, 5);

  // Overdue tasks (scheduled but not completed)
  const overdueTasks = activities.filter(
    (a) => a.scheduledAt && a.scheduledAt < now && !a.completedAt,
  );

  return {
    totalContacts: contacts.length,
    contactsByType,
    activeDeals: activeDeals.length,
    totalPipelineValue: activeDeals.reduce((sum, d) => sum + d.value, 0),
    weightedPipelineValue: activeDeals.reduce(
      (sum, d) => sum + Math.round(d.value * (d.probability / 100)),
      0,
    ),
    dealsClosingThisMonth,
    winRate,
    recentActivities,
    topDeals,
    overdueTasks,
  };
}
