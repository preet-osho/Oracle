// ═══════════════════════════════════════
// ORACLE — CRM MCP Server
// Leads · Pipeline · Contacts · Deals · Follow-ups
// ═══════════════════════════════════════

import { McpServer } from '../server';
import type { Tool, ToolResult } from '../protocol';
import { createLogger } from '@/lib/logger';
import type { Lead, ClientProject } from '@/types';

const log = createLogger('MCP:CRM');

// ─── In-Memory CRM Store ──────────────
// In production this would connect to Supabase; for MCP tool
// purposes we provide a thin CRUD layer over localStorage-like state.

interface CrmContact {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  industry: string;
  city: string;
  status: 'lead' | 'prospect' | 'client' | 'churned';
  source: string;
  notes: string;
  dealValue: number;
  createdAt: number;
  updatedAt: number;
}

interface CrmDeal {
  id: string;
  contactId: string;
  title: string;
  value: number;
  stage: 'discovery' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';
  probability: number;
  expectedCloseDate: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
}

interface CrmActivity {
  id: string;
  contactId: string;
  dealId?: string;
  type: 'email' | 'call' | 'meeting' | 'note' | 'task';
  subject: string;
  description: string;
  scheduledAt?: number;
  completedAt?: number;
  createdAt: number;
}

// Global in-memory stores (shared across MCP calls)
const contacts = new Map<string, CrmContact>();
const deals = new Map<string, CrmDeal>();
const activities = new Map<string, CrmActivity>();

function generateId(): string {
  return `crm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Tool Definitions ─────────────────

const CREATE_CONTACT_TOOL: Tool = {
  name: 'crm_create_contact',
  title: 'Create Contact',
  description: 'Create a new contact/lead in the CRM.',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Full name' },
      email: { type: 'string', description: 'Email address' },
      phone: { type: 'string', description: 'Phone number' },
      company: { type: 'string', description: 'Company name' },
      industry: { type: 'string', description: 'Industry' },
      city: { type: 'string', description: 'City' },
      source: { type: 'string', description: 'Lead source (Google Maps, LinkedIn, etc.)' },
      notes: { type: 'string', description: 'Initial notes' },
      dealValue: { type: 'string', description: 'Estimated deal value in INR' },
    },
    required: ['name'],
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
};

const UPDATE_CONTACT_TOOL: Tool = {
  name: 'crm_update_contact',
  title: 'Update Contact',
  description: 'Update an existing contact record.',
  inputSchema: {
    type: 'object',
    properties: {
      contactId: { type: 'string', description: 'Contact ID' },
      status: { type: 'string', description: 'New status: lead, prospect, client, churned' },
      notes: { type: 'string', description: 'Additional notes' },
      dealValue: { type: 'string', description: 'Updated deal value' },
    },
    required: ['contactId'],
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
};

const SEARCH_CONTACTS_TOOL: Tool = {
  name: 'crm_search_contacts',
  title: 'Search Contacts',
  description: 'Search contacts by name, company, industry, city, or status.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query (name, company, etc.)' },
      status: { type: 'string', description: 'Filter by status: lead, prospect, client, churned' },
      industry: { type: 'string', description: 'Filter by industry' },
      city: { type: 'string', description: 'Filter by city' },
    },
    required: [],
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
};

const LIST_CONTACTS_TOOL: Tool = {
  name: 'crm_list_contacts',
  title: 'List Contacts',
  description: 'List all contacts with optional status filter.',
  inputSchema: {
    type: 'object',
    properties: {
      status: { type: 'string', description: 'Filter by status' },
      limit: { type: 'string', description: 'Max results (default 20)' },
    },
    required: [],
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
};

const CREATE_DEAL_TOOL: Tool = {
  name: 'crm_create_deal',
  title: 'Create Deal',
  description: 'Create a new deal/opportunity linked to a contact.',
  inputSchema: {
    type: 'object',
    properties: {
      contactId: { type: 'string', description: 'Contact ID' },
      title: { type: 'string', description: 'Deal title' },
      value: { type: 'string', description: 'Deal value in INR' },
      stage: { type: 'string', description: 'Stage: discovery, proposal, negotiation, closed_won, closed_lost' },
      expectedCloseDate: { type: 'string', description: 'Expected close date (YYYY-MM-DD)' },
      notes: { type: 'string', description: 'Deal notes' },
    },
    required: ['contactId', 'title', 'value'],
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
};

const UPDATE_DEAL_TOOL: Tool = {
  name: 'crm_update_deal',
  title: 'Update Deal',
  description: 'Update a deal stage, value, or other properties.',
  inputSchema: {
    type: 'object',
    properties: {
      dealId: { type: 'string', description: 'Deal ID' },
      stage: { type: 'string', description: 'New stage' },
      value: { type: 'string', description: 'Updated value' },
      probability: { type: 'string', description: 'Updated probability (0-100)' },
      notes: { type: 'string', description: 'Additional notes' },
    },
    required: ['dealId'],
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
};

const PIPELINE_VIEW_TOOL: Tool = {
  name: 'crm_pipeline',
  title: 'View Pipeline',
  description: 'View the sales pipeline with deals grouped by stage.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
};

const LOG_ACTIVITY_TOOL: Tool = {
  name: 'crm_log_activity',
  title: 'Log Activity',
  description: 'Log an activity (email, call, meeting, note, task) for a contact.',
  inputSchema: {
    type: 'object',
    properties: {
      contactId: { type: 'string', description: 'Contact ID' },
      dealId: { type: 'string', description: 'Deal ID (optional)' },
      type: { type: 'string', description: 'Activity type: email, call, meeting, note, task' },
      subject: { type: 'string', description: 'Activity subject' },
      description: { type: 'string', description: 'Activity description' },
      scheduledAt: { type: 'string', description: 'Scheduled date/time (ISO string)' },
    },
    required: ['contactId', 'type', 'subject'],
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
};

const ACTIVITY_LOG_TOOL: Tool = {
  name: 'crm_activity_log',
  title: 'View Activity Log',
  description: 'View activity history for a contact or deal.',
  inputSchema: {
    type: 'object',
    properties: {
      contactId: { type: 'string', description: 'Contact ID to filter by' },
      dealId: { type: 'string', description: 'Deal ID to filter by' },
      limit: { type: 'string', description: 'Max results (default 20)' },
    },
    required: [],
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
};

const PIPELINE_STATS_TOOL: Tool = {
  name: 'crm_pipeline_stats',
  title: 'Pipeline Statistics',
  description: 'Get pipeline statistics: total value, deal counts by stage, conversion rates.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
};

// ─── Server Factory ───────────────────

export function createCrmMcpServer(): McpServer {
  const server = new McpServer('crm-mcp', '1.0.0', {
    tools: { listChanged: false },
  });

  server.registerTool(CREATE_CONTACT_TOOL, async (args: Record<string, unknown>) => {
    const id = generateId();
    const now = Date.now();
    const contact: CrmContact = {
      id,
      name: args.name as string,
      email: (args.email as string) || '',
      phone: (args.phone as string) || '',
      company: (args.company as string) || '',
      industry: (args.industry as string) || '',
      city: (args.city as string) || '',
      status: 'lead',
      source: (args.source as string) || 'manual',
      notes: (args.notes as string) || '',
      dealValue: args.dealValue ? parseInt(args.dealValue as string, 10) : 0,
      createdAt: now,
      updatedAt: now,
    };
    contacts.set(id, contact);
    log.info('Contact created', { id, name: contact.name });

    return {
      content: [{
        type: 'text',
        text: `Contact created successfully.\nID: ${id}\nName: ${contact.name}\nCompany: ${contact.company || 'N/A'}\nStatus: ${contact.status}`,
      }],
    };
  });

  server.registerTool(UPDATE_CONTACT_TOOL, async (args: Record<string, unknown>) => {
    const contact = contacts.get(args.contactId as string);
    if (!contact) {
      return { content: [{ type: 'text', text: `Contact not found: ${args.contactId}` }], isError: true };
    }

    if (args.status) contact.status = args.status as CrmContact['status'];
    if (args.notes) contact.notes = contact.notes ? `${contact.notes}\n${args.notes}` : args.notes as string;
    if (args.dealValue) contact.dealValue = parseInt(args.dealValue as string, 10);
    contact.updatedAt = Date.now();

    return {
      content: [{
        type: 'text',
        text: `Contact updated.\nID: ${contact.id}\nName: ${contact.name}\nStatus: ${contact.status}\nDeal Value: ₹${contact.dealValue.toLocaleString('en-IN')}`,
      }],
    };
  });

  server.registerTool(SEARCH_CONTACTS_TOOL, async (args: Record<string, unknown>) => {
    const query = (args.query as string || '').toLowerCase();
    const status = args.status as string | undefined;
    const industry = (args.industry as string || '').toLowerCase();
    const city = (args.city as string || '').toLowerCase();

    const results = Array.from(contacts.values()).filter((c) => {
      if (query && !c.name.toLowerCase().includes(query) && !c.company.toLowerCase().includes(query) && !c.email.toLowerCase().includes(query)) return false;
      if (status && c.status !== status) return false;
      if (industry && !c.industry.toLowerCase().includes(industry)) return false;
      if (city && !c.city.toLowerCase().includes(city)) return false;
      return true;
    });

    if (results.length === 0) {
      return { content: [{ type: 'text', text: 'No contacts found matching criteria.' }] };
    }

    const text = results.map((c) =>
      `[${c.status.toUpperCase()}] ${c.name}\n  Company: ${c.company || 'N/A'} | Industry: ${c.industry || 'N/A'} | City: ${c.city || 'N/A'}\n  Email: ${c.email || 'N/A'} | Phone: ${c.phone || 'N/A'}\n  Deal Value: ₹${c.dealValue.toLocaleString('en-IN')} | ID: ${c.id}`
    ).join('\n\n');

    return {
      content: [{ type: 'text', text: `Found ${results.length} contacts:\n\n${text}` }],
    };
  });

  server.registerTool(LIST_CONTACTS_TOOL, async (args: Record<string, unknown>) => {
    const status = args.status as string | undefined;
    const limit = args.limit ? parseInt(args.limit as string, 10) : 20;

    const results = Array.from(contacts.values())
      .filter((c) => !status || c.status === status)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit);

    if (results.length === 0) {
      return { content: [{ type: 'text', text: 'No contacts found.' }] };
    }

    const text = results.map((c, i) =>
      `${i + 1}. [${c.status}] ${c.name} — ${c.company || 'N/A'} (${c.city || 'N/A'}) — ₹${c.dealValue.toLocaleString('en-IN')}`
    ).join('\n');

    return {
      content: [{ type: 'text', text: `Contacts${status ? ` (${status})` : ''}: ${results.length}\n\n${text}` }],
    };
  });

  server.registerTool(CREATE_DEAL_TOOL, async (args: Record<string, unknown>) => {
    const contact = contacts.get(args.contactId as string);
    if (!contact) {
      return { content: [{ type: 'text', text: `Contact not found: ${args.contactId}` }], isError: true };
    }

    const id = generateId();
    const now = Date.now();
    const deal: CrmDeal = {
      id,
      contactId: args.contactId as string,
      title: args.title as string,
      value: parseInt(args.value as string, 10),
      stage: (args.stage as CrmDeal['stage']) || 'discovery',
      probability: 20,
      expectedCloseDate: (args.expectedCloseDate as string) || '',
      notes: (args.notes as string) || '',
      createdAt: now,
      updatedAt: now,
    };
    deals.set(id, deal);

    // Update contact status
    if (contact.status === 'lead') contact.status = 'prospect';
    contact.updatedAt = now;

    return {
      content: [{
        type: 'text',
        text: `Deal created.\nID: ${id}\nTitle: ${deal.title}\nValue: ₹${deal.value.toLocaleString('en-IN')}\nStage: ${deal.stage}\nContact: ${contact.name}`,
      }],
    };
  });

  server.registerTool(UPDATE_DEAL_TOOL, async (args: Record<string, unknown>) => {
    const deal = deals.get(args.dealId as string);
    if (!deal) {
      return { content: [{ type: 'text', text: `Deal not found: ${args.dealId}` }], isError: true };
    }

    if (args.stage) deal.stage = args.stage as CrmDeal['stage'];
    if (args.value) deal.value = parseInt(args.value as string, 10);
    if (args.probability) deal.probability = parseInt(args.probability as string, 10);
    if (args.notes) deal.notes = deal.notes ? `${deal.notes}\n${args.notes}` : args.notes as string;
    deal.updatedAt = Date.now();

    // Update contact if deal closed
    if (deal.stage === 'closed_won') {
      const contact = contacts.get(deal.contactId);
      if (contact) {
        contact.status = 'client';
        contact.updatedAt = Date.now();
      }
    }

    return {
      content: [{
        type: 'text',
        text: `Deal updated.\nTitle: ${deal.title}\nStage: ${deal.stage}\nValue: ₹${deal.value.toLocaleString('en-IN')}\nProbability: ${deal.probability}%`,
      }],
    };
  });

  server.registerTool(PIPELINE_VIEW_TOOL, async (_args: Record<string, unknown>) => {
    const stages: CrmDeal['stage'][] = ['discovery', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];
    const stageLabels: Record<string, string> = {
      discovery: '🔍 Discovery',
      proposal: '📝 Proposal',
      negotiation: '🤝 Negotiation',
      closed_won: '✅ Closed Won',
      closed_lost: '❌ Closed Lost',
    };

    const lines: string[] = ['═══ SALES PIPELINE ═══', ''];

    for (const stage of stages) {
      const stageDeals = Array.from(deals.values()).filter((d) => d.stage === stage);
      const totalValue = stageDeals.reduce((sum, d) => sum + d.value, 0);

      lines.push(`${stageLabels[stage]} (${stageDeals.length} deals — ₹${totalValue.toLocaleString('en-IN')})`);
      for (const deal of stageDeals) {
        const contact = contacts.get(deal.contactId);
        lines.push(`  • ${deal.title} — ₹${deal.value.toLocaleString('en-IN')} (${contact?.name ?? 'Unknown'})`);
      }
      lines.push('');
    }

    return { content: [{ type: 'text', text: lines.join('\n') }] };
  });

  server.registerTool(LOG_ACTIVITY_TOOL, async (args: Record<string, unknown>) => {
    const contact = contacts.get(args.contactId as string);
    if (!contact) {
      return { content: [{ type: 'text', text: `Contact not found: ${args.contactId}` }], isError: true };
    }

    const id = generateId();
    const activity: CrmActivity = {
      id,
      contactId: args.contactId as string,
      dealId: args.dealId as string | undefined,
      type: args.type as CrmActivity['type'],
      subject: args.subject as string,
      description: (args.description as string) || '',
      scheduledAt: args.scheduledAt ? new Date(args.scheduledAt as string).getTime() : undefined,
      createdAt: Date.now(),
    };
    activities.set(id, activity);

    return {
      content: [{
        type: 'text',
        text: `Activity logged.\nType: ${activity.type}\nSubject: ${activity.subject}\nContact: ${contact.name}\n${activity.description ? `Notes: ${activity.description}` : ''}`,
      }],
    };
  });

  server.registerTool(ACTIVITY_LOG_TOOL, async (args: Record<string, unknown>) => {
    const contactId = args.contactId as string | undefined;
    const dealId = args.dealId as string | undefined;
    const limit = args.limit ? parseInt(args.limit as string, 10) : 20;

    const results = Array.from(activities.values())
      .filter((a) => {
        if (contactId && a.contactId !== contactId) return false;
        if (dealId && a.dealId !== dealId) return false;
        return true;
      })
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);

    if (results.length === 0) {
      return { content: [{ type: 'text', text: 'No activities found.' }] };
    }

    const text = results.map((a) => {
      const contact = contacts.get(a.contactId);
      return `[${a.type.toUpperCase()}] ${a.subject}\n  Contact: ${contact?.name ?? 'Unknown'} | ${new Date(a.createdAt).toLocaleDateString()}\n  ${a.description || ''}`;
    }).join('\n\n');

    return {
      content: [{ type: 'text', text: `Activity Log (${results.length}):\n\n${text}` }],
    };
  });

  server.registerTool(PIPELINE_STATS_TOOL, async (_args: Record<string, unknown>) => {
    const allDeals = Array.from(deals.values());
    const totalValue = allDeals.reduce((s, d) => s + d.value, 0);
    const wonValue = allDeals.filter((d) => d.stage === 'closed_won').reduce((s, d) => s + d.value, 0);
    const lostValue = allDeals.filter((d) => d.stage === 'closed_lost').reduce((s, d) => s + d.value, 0);
    const activeValue = allDeals.filter((d) => !['closed_won', 'closed_lost'].includes(d.stage)).reduce((s, d) => s + d.value, 0);
    const weightedValue = allDeals.filter((d) => !['closed_won', 'closed_lost'].includes(d.stage)).reduce((s, d) => s + (d.value * d.probability / 100), 0);

    const stages = ['discovery', 'proposal', 'negotiation', 'closed_won', 'closed_lost'] as const;
    const stageCounts = stages.map((s) => `${s}: ${allDeals.filter((d) => d.stage === s).length}`);

    const text = [
      '═══ PIPELINE STATISTICS ═══',
      '',
      `Total Deals: ${allDeals.length}`,
      `Total Pipeline Value: ₹${totalValue.toLocaleString('en-IN')}`,
      `Active Pipeline Value: ₹${activeValue.toLocaleString('en-IN')}`,
      `Weighted Pipeline Value: ₹${weightedValue.toLocaleString('en-IN')}`,
      `Won Value: ₹${wonValue.toLocaleString('en-IN')}`,
      `Lost Value: ₹${lostValue.toLocaleString('en-IN')}`,
      '',
      '── By Stage ──',
      ...stageCounts,
      '',
      `Win Rate: ${allDeals.length > 0 ? Math.round((allDeals.filter((d) => d.stage === 'closed_won').length / allDeals.length) * 100) : 0}%`,
    ].join('\n');

    return { content: [{ type: 'text', text }] };
  });

  return server;
}
