// ═══════════════════════════════════════
// ORACLE — Communication Hub Tests
// ═══════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ─────────────────────────────

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('./whatsapp', () => ({
  isWhatsAppConfigured: vi.fn(() => false),
  sendWhatsAppText: vi.fn(() => Promise.resolve({ success: true, messageId: 'wa_123' })),
  sendWhatsAppTemplate: vi.fn(() => Promise.resolve({ success: true, messageId: 'wa_tpl_456' })),
}));

vi.mock('./email', () => ({
  isEmailConfigured: vi.fn(() => false),
  sendEmail: vi.fn(() => Promise.resolve({ success: true, id: 'email_789' })),
}));

vi.mock('./message-logger', () => ({
  logMessage: vi.fn(() => Promise.resolve('log_123')),
  updateMessageStatus: vi.fn(() => Promise.resolve(true)),
  getMessageHistory: vi.fn(() => Promise.resolve([])),
  getMessageStats: vi.fn(() => Promise.resolve({ total: 0, byChannel: {}, byStatus: {}, byDirection: {} })),
}));

// ─── Import after mocks ────────────────

import { getChannelStatus } from './hub';
import { getTemplate, getTemplatesByCategory, getTemplatesByChannel, fillTemplate, extractVariables, validateTemplateVariables } from './templates';
import { DEFAULT_TEMPLATES } from './templates';
import type { MessageTemplate } from './types';

// ─── Channel Status ────────────────────

describe('Communication Hub', () => {
  describe('getChannelStatus', () => {
    it('returns channel availability', () => {
      const status = getChannelStatus();
      expect(status).toHaveProperty('whatsapp');
      expect(status).toHaveProperty('email');
      expect(typeof status.whatsapp).toBe('boolean');
      expect(typeof status.email).toBe('boolean');
    });
  });
});

// ─── Templates ─────────────────────────

describe('Message Templates', () => {
  describe('DEFAULT_TEMPLATES', () => {
    it('has at least 5 templates', () => {
      expect(DEFAULT_TEMPLATES.length).toBeGreaterThanOrEqual(5);
    });

    it('all templates have required fields', () => {
      for (const template of DEFAULT_TEMPLATES) {
        expect(template.id).toBeTruthy();
        expect(template.name).toBeTruthy();
        expect(template.body).toBeTruthy();
        expect(template.channel).toMatch(/^(whatsapp|email|both)$/);
        expect(template.language).toMatch(/^(en|hi|hinglish)$/);
        expect(Array.isArray(template.variables)).toBe(true);
      }
    });

    it('has templates for both WhatsApp and Email', () => {
      const whatsappTemplates = DEFAULT_TEMPLATES.filter((t) => t.channel === 'whatsapp');
      const emailTemplates = DEFAULT_TEMPLATES.filter((t) => t.channel === 'email');
      expect(whatsappTemplates.length).toBeGreaterThan(0);
      expect(emailTemplates.length).toBeGreaterThan(0);
    });

    it('has cold outreach, follow-up, and proposal templates', () => {
      const categories = DEFAULT_TEMPLATES.map((t) => t.category);
      expect(categories).toContain('cold-outreach');
      expect(categories).toContain('follow-up');
      expect(categories).toContain('proposal');
    });
  });

  describe('getTemplate', () => {
    it('finds template by ID', () => {
      const template = getTemplate('wa-cold-outreach-local');
      expect(template).toBeDefined();
      expect(template?.name).toBe('Local Business Cold Outreach');
    });

    it('returns undefined for unknown ID', () => {
      expect(getTemplate('nonexistent')).toBeUndefined();
    });
  });

  describe('getTemplatesByCategory', () => {
    it('filters by category', () => {
      const templates = getTemplatesByCategory('cold-outreach');
      expect(templates.length).toBeGreaterThan(0);
      for (const t of templates) {
        expect(t.category).toBe('cold-outreach');
      }
    });

    it('returns empty for unknown category', () => {
      const templates = getTemplatesByCategory('custom');
      expect(templates).toHaveLength(0);
    });
  });

  describe('getTemplatesByChannel', () => {
    it('filters by channel', () => {
      const whatsapp = getTemplatesByChannel('whatsapp');
      const email = getTemplatesByChannel('email');
      expect(whatsapp.length).toBeGreaterThan(0);
      expect(email.length).toBeGreaterThan(0);
    });
  });

  describe('fillTemplate', () => {
    it('replaces variables', () => {
      const result = fillTemplate('Hello {{name}}, your business is {{business}}', {
        name: 'Rahul',
        business: 'TechCorp',
      });
      expect(result).toBe('Hello Rahul, your business is TechCorp');
    });

    it('handles missing variables gracefully', () => {
      const result = fillTemplate('Hello {{name}}', {});
      expect(result).toBe('Hello {{name}}');
    });

    it('replaces multiple occurrences of same variable', () => {
      const result = fillTemplate('{{x}} and {{x}}', { x: 'yes' });
      expect(result).toBe('yes and yes');
    });
  });

  describe('extractVariables', () => {
    it('extracts variable names', () => {
      const vars = extractVariables('Hello {{name}}, your {{thing}} is ready');
      expect(vars).toContain('name');
      expect(vars).toContain('thing');
      expect(vars).toHaveLength(2);
    });

    it('returns empty array for no variables', () => {
      expect(extractVariables('Hello world')).toHaveLength(0);
    });

    it('deduplicates variables', () => {
      const vars = extractVariables('{{x}} and {{x}}');
      expect(vars).toEqual(['x']);
    });
  });

  describe('validateTemplateVariables', () => {
    it('passes when all variables provided', () => {
      const template = getTemplate('wa-cold-outreach-local')!;
      const variables: Record<string, string> = {};
      for (const v of template.variables) {
        variables[v] = 'test value';
      }
      const result = validateTemplateVariables(template, variables);
      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('fails when variables are missing', () => {
      const template = getTemplate('wa-cold-outreach-local')!;
      const result = validateTemplateVariables(template, {});
      expect(result.valid).toBe(false);
      expect(result.missing.length).toBeGreaterThan(0);
    });

    it('fails when variables are empty strings', () => {
      const template = getTemplate('wa-cold-outreach-local')!;
      const variables: Record<string, string> = {};
      for (const v of template.variables) {
        variables[v] = '';
      }
      const result = validateTemplateVariables(template, variables);
      expect(result.valid).toBe(false);
    });
  });
});

// ─── Template Content Quality ──────────

describe('Template Content Quality', () => {
  it('WhatsApp templates mention Indian context or digital marketing', () => {
    const waTemplates = DEFAULT_TEMPLATES.filter((t) => t.channel === 'whatsapp');
    for (const template of waTemplates) {
      const hasIndianContext = template.body.includes('₹') ||
        template.body.includes('INR') ||
        template.body.includes('WhatsApp') ||
        template.body.includes('Google') ||
        template.body.includes('city') ||
        template.body.includes('marketing') ||
        template.body.includes('business') ||
        template.body.includes('leads');
      expect(hasIndianContext).toBe(true);
    }
  });

  it('email templates have subject lines', () => {
    const emailTemplates = DEFAULT_TEMPLATES.filter((t) => t.channel === 'email');
    for (const template of emailTemplates) {
      expect(template.subject).toBeTruthy();
      expect(template.subject!.length).toBeGreaterThan(5);
    }
  });

  it('all templates use {{variable}} syntax consistently', () => {
    for (const template of DEFAULT_TEMPLATES) {
      const extracted = extractVariables(template.body);
      for (const declared of template.variables) {
        expect(extracted).toContain(declared);
      }
    }
  });

  it('no templates exceed 10000 characters', () => {
    for (const template of DEFAULT_TEMPLATES) {
      expect(template.body.length).toBeLessThanOrEqual(10000);
    }
  });
});
