import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createContact,
  updateContact,
  deleteContact,
  getAllContacts,
  getContactById,
  getContactsByType,
  searchContacts,
  convertLeadToProspect,
  convertProspectToClient,
  createDeal,
  updateDeal,
  moveDealToStage,
  deleteDeal,
  getAllDeals,
  getDealById,
  getDealsByStage,
  getDealsByContact,
  getActiveDeals,
  createActivity,
  completeActivity,
  getActivitiesByContact,
  scoreDeal,
  getPipelineMetrics,
  generateForecast,
  getCRMDashboard,
  importLeadAsContact,
  type CRMContact,
  type CRMDeal,
  type PipelineStage,
} from './crm';

// ═══════════════════════════════════════
// Mock localStorage
// ═══════════════════════════════════════

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] || null,
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

// ═══════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════

function makeContact(overrides: Partial<CRMContact> = {}): Omit<CRMContact, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    type: 'lead',
    name: 'Test Contact',
    email: 'test@example.com',
    phone: '+919876543210',
    company: 'Test Company',
    industry: 'Technology',
    city: 'Mumbai',
    source: 'Google Maps',
    tags: ['test'],
    notes: 'Test notes',
    ...overrides,
  };
}

function makeDeal(overrides: Partial<CRMDeal> = {}): Omit<CRMDeal, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    contactId: 'test-contact-id',
    contactName: 'Test Contact',
    companyName: 'Test Company',
    title: 'SEO Package',
    value: 50000,
    currency: 'INR',
    stage: 'lead',
    priority: 'medium',
    probability: 25,
    expectedCloseDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
    services: ['SEO'],
    notes: 'Test deal',
    ...overrides,
  };
}

// ═══════════════════════════════════════
// Contact Management Tests
// ═══════════════════════════════════════

describe('CRM Contact Management', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('createContact', () => {
    it('creates a contact with correct fields', () => {
      const contact = createContact(makeContact());
      expect(contact).toHaveProperty('id');
      expect(contact.name).toBe('Test Contact');
      expect(contact.email).toBe('test@example.com');
      expect(contact.type).toBe('lead');
      expect(contact.createdAt).toBeDefined();
      expect(contact.updatedAt).toBeDefined();
    });

    it('generates unique IDs', () => {
      const contact1 = createContact(makeContact({ name: 'Contact 1' }));
      const contact2 = createContact(makeContact({ name: 'Contact 2' }));
      expect(contact1.id).not.toBe(contact2.id);
    });
  });

  describe('getAllContacts', () => {
    it('returns empty array when no contacts', () => {
      expect(getAllContacts()).toEqual([]);
    });

    it('returns all contacts', () => {
      createContact(makeContact({ name: 'Contact 1' }));
      createContact(makeContact({ name: 'Contact 2' }));
      const contacts = getAllContacts();
      expect(contacts).toHaveLength(2);
    });
  });

  describe('getContactById', () => {
    it('returns contact by ID', () => {
      const created = createContact(makeContact());
      const found = getContactById(created.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it('returns undefined for non-existent ID', () => {
      expect(getContactById('non-existent')).toBeUndefined();
    });
  });

  describe('getContactsByType', () => {
    it('filters contacts by type', () => {
      createContact(makeContact({ type: 'lead' }));
      createContact(makeContact({ type: 'client' }));
      createContact(makeContact({ type: 'lead' }));

      const leads = getContactsByType('lead');
      expect(leads).toHaveLength(2);
      expect(leads.every(c => c.type === 'lead')).toBe(true);
    });
  });

  describe('searchContacts', () => {
    it('searches by name', () => {
      createContact(makeContact({ name: 'John Doe' }));
      createContact(makeContact({ name: 'Jane Smith' }));

      const results = searchContacts('John');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('John Doe');
    });

    it('searches by company', () => {
      createContact(makeContact({ company: 'Acme Corp' }));
      createContact(makeContact({ company: 'Beta Inc' }));

      const results = searchContacts('Acme');
      expect(results).toHaveLength(1);
    });

    it('searches by email', () => {
      createContact(makeContact({ email: 'john@acme.com' }));
      createContact(makeContact({ email: 'jane@beta.com' }));

      const results = searchContacts('acme.com');
      expect(results).toHaveLength(1);
    });

    it('searches by industry', () => {
      createContact(makeContact({ industry: 'Healthcare' }));
      createContact(makeContact({ industry: 'Technology' }));

      const results = searchContacts('Healthcare');
      expect(results).toHaveLength(1);
    });

    it('returns empty for no matches', () => {
      createContact(makeContact());
      expect(searchContacts('xyz')).toEqual([]);
    });
  });

  describe('updateContact', () => {
    it('updates contact fields', () => {
      const contact = createContact(makeContact());
      const updated = updateContact(contact.id, { name: 'Updated Name' });
      expect(updated).toBeDefined();
      expect(updated?.name).toBe('Updated Name');
    });

    it('returns null for non-existent ID', () => {
      expect(updateContact('non-existent', { name: 'Test' })).toBeNull();
    });
  });

  describe('deleteContact', () => {
    it('deletes a contact', () => {
      const contact = createContact(makeContact());
      expect(deleteContact(contact.id)).toBe(true);
      expect(getContactById(contact.id)).toBeUndefined();
    });

    it('returns false for non-existent ID', () => {
      expect(deleteContact('non-existent')).toBe(false);
    });
  });

  describe('convertLeadToProspect', () => {
    it('converts lead type to prospect', () => {
      const lead = createContact(makeContact({ type: 'lead' }));
      const prospect = convertLeadToProspect(lead.id);
      expect(prospect?.type).toBe('prospect');
    });
  });

  describe('convertProspectToClient', () => {
    it('converts prospect type to client', () => {
      const prospect = createContact(makeContact({ type: 'prospect' }));
      const client = convertProspectToClient(prospect.id);
      expect(client?.type).toBe('client');
    });
  });
});

// ═══════════════════════════════════════
// Deal Management Tests
// ═══════════════════════════════════════

describe('CRM Deal Management', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('createDeal', () => {
    it('creates a deal with correct fields', () => {
      const deal = createDeal(makeDeal());
      expect(deal).toHaveProperty('id');
      expect(deal.title).toBe('SEO Package');
      expect(deal.value).toBe(50000);
      expect(deal.currency).toBe('INR');
      expect(deal.stage).toBe('lead');
    });
  });

  describe('getDealsByStage', () => {
    it('filters deals by stage', () => {
      createDeal(makeDeal({ stage: 'lead' }));
      createDeal(makeDeal({ stage: 'proposal' }));
      createDeal(makeDeal({ stage: 'lead' }));

      const leadDeals = getDealsByStage('lead');
      expect(leadDeals).toHaveLength(2);
    });
  });

  describe('getActiveDeals', () => {
    it('excludes closed-won and closed-lost deals', () => {
      createDeal(makeDeal({ stage: 'lead' }));
      createDeal(makeDeal({ stage: 'proposal' }));
      createDeal(makeDeal({ stage: 'closed-won' }));
      createDeal(makeDeal({ stage: 'closed-lost' }));

      const active = getActiveDeals();
      expect(active).toHaveLength(2);
    });
  });

  describe('moveDealToStage', () => {
    it('moves deal to new stage', () => {
      const deal = createDeal(makeDeal());
      const updated = moveDealToStage(deal.id, 'proposal');
      expect(updated?.stage).toBe('proposal');
    });

    it('sets actualCloseDate for closed stages', () => {
      const deal = createDeal(makeDeal());
      const closed = moveDealToStage(deal.id, 'closed-won');
      expect(closed?.actualCloseDate).toBeDefined();
    });
  });

  describe('deleteDeal', () => {
    it('deletes a deal', () => {
      const deal = createDeal(makeDeal());
      expect(deleteDeal(deal.id)).toBe(true);
      expect(getDealById(deal.id)).toBeUndefined();
    });
  });
});

// ═══════════════════════════════════════
// Activity Management Tests
// ═══════════════════════════════════════

describe('CRM Activity Management', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('createActivity', () => {
    it('creates an activity', () => {
      const activity = createActivity({
        contactId: 'contact-1',
        type: 'call',
        title: 'Follow-up call',
        description: 'Discuss proposal',
      });
      expect(activity).toHaveProperty('id');
      expect(activity.type).toBe('call');
    });
  });

  describe('getActivitiesByContact', () => {
    it('returns activities for a contact', () => {
      createActivity({ contactId: 'c1', type: 'call', title: 'Call 1', description: '' });
      createActivity({ contactId: 'c2', type: 'email', title: 'Email 1', description: '' });
      createActivity({ contactId: 'c1', type: 'meeting', title: 'Meeting 1', description: '' });

      const activities = getActivitiesByContact('c1');
      expect(activities).toHaveLength(2);
    });
  });

  describe('completeActivity', () => {
    it('marks activity as completed', () => {
      const activity = createActivity({
        contactId: 'c1',
        type: 'call',
        title: 'Call',
        description: '',
      });
      const completed = completeActivity(activity.id, 'Client interested');
      expect(completed?.completedAt).toBeDefined();
      expect(completed?.outcome).toBe('Client interested');
    });
  });
});

// ═══════════════════════════════════════
// Deal Scoring Tests
// ═══════════════════════════════════════

describe('CRM Deal Scoring', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('scoreDeal', () => {
    it('returns a score between 0 and 100', () => {
      const deal = createDeal(makeDeal({ value: 100000 }));
      const score = scoreDeal(deal);
      expect(score.score).toBeGreaterThanOrEqual(0);
      expect(score.score).toBeLessThanOrEqual(100);
    });

    it('returns factors object', () => {
      const deal = createDeal(makeDeal());
      const score = scoreDeal(deal);
      expect(score.factors).toHaveProperty('budgetFit');
      expect(score.factors).toHaveProperty('urgencyFit');
      expect(score.factors).toHaveProperty('painSeverity');
      expect(score.factors).toHaveProperty('engagementLevel');
      expect(score.factors).toHaveProperty('authorityAccess');
      expect(score.factors).toHaveProperty('fitScore');
    });

    it('returns recommendation', () => {
      const deal = createDeal(makeDeal());
      const score = scoreDeal(deal);
      expect(typeof score.recommendation).toBe('string');
      expect(score.recommendation.length).toBeGreaterThan(0);
    });

    it('high-value deals score higher on budget', () => {
      const highValue = createDeal(makeDeal({ value: 200000 }));
      const lowValue = createDeal(makeDeal({ value: 5000 }));
      const highScore = scoreDeal(highValue);
      const lowScore = scoreDeal(lowValue);
      expect(highScore.factors.budgetFit).toBeGreaterThan(lowScore.factors.budgetFit);
    });
  });
});

// ═══════════════════════════════════════
// Pipeline Metrics Tests
// ═══════════════════════════════════════

describe('CRM Pipeline Metrics', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('getPipelineMetrics', () => {
    it('returns metrics for all 6 stages', () => {
      const metrics = getPipelineMetrics();
      expect(metrics).toHaveLength(6);
      const stages = metrics.map(m => m.stage);
      expect(stages).toContain('lead');
      expect(stages).toContain('qualified');
      expect(stages).toContain('proposal');
      expect(stages).toContain('negotiation');
      expect(stages).toContain('closed-won');
      expect(stages).toContain('closed-lost');
    });

    it('calculates total value correctly', () => {
      createDeal(makeDeal({ stage: 'lead', value: 50000 }));
      createDeal(makeDeal({ stage: 'lead', value: 30000 }));

      const metrics = getPipelineMetrics();
      const leadMetrics = metrics.find(m => m.stage === 'lead');
      expect(leadMetrics?.totalValue).toBe(80000);
      expect(leadMetrics?.count).toBe(2);
    });
  });
});

// ═══════════════════════════════════════
// Forecasting Tests
// ═══════════════════════════════════════

describe('CRM Forecasting', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('generateForecast', () => {
    it('returns forecast with required fields', () => {
      const forecast = generateForecast();
      expect(forecast).toHaveProperty('totalPipeline');
      expect(forecast).toHaveProperty('weightedPipeline');
      expect(forecast).toHaveProperty('closedWon');
      expect(forecast).toHaveProperty('closedLost');
      expect(forecast).toHaveProperty('winRate');
      expect(forecast).toHaveProperty('avgDealSize');
      expect(forecast).toHaveProperty('forecastByStage');
    });

    it('calculates win rate', () => {
      createDeal(makeDeal({ stage: 'closed-won', value: 100000 }));
      createDeal(makeDeal({ stage: 'closed-won', value: 50000 }));
      createDeal(makeDeal({ stage: 'closed-lost', value: 30000 }));

      const forecast = generateForecast();
      expect(forecast.winRate).toBe(67); // 2 won / 3 total
    });
  });
});

// ═══════════════════════════════════════
// Dashboard Tests
// ═══════════════════════════════════════

describe('CRM Dashboard', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('getCRMDashboard', () => {
    it('returns dashboard with required fields', () => {
      const dashboard = getCRMDashboard();
      expect(dashboard).toHaveProperty('totalContacts');
      expect(dashboard).toHaveProperty('contactsByType');
      expect(dashboard).toHaveProperty('activeDeals');
      expect(dashboard).toHaveProperty('totalPipelineValue');
      expect(dashboard).toHaveProperty('winRate');
    });

    it('counts contacts by type correctly', () => {
      createContact(makeContact({ type: 'lead' }));
      createContact(makeContact({ type: 'lead' }));
      createContact(makeContact({ type: 'client' }));

      const dashboard = getCRMDashboard();
      expect(dashboard.contactsByType.lead).toBe(2);
      expect(dashboard.contactsByType.client).toBe(1);
    });
  });
});
