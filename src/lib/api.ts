// ═══════════════════════════════════════
// ORACLE — Client-Side API Helpers
// Replace all localStorage calls with HTTP requests
// ═══════════════════════════════════════

// ─── Types ─────────────────────────────

export interface ApiProject {
  id: string;
  client_name: string;
  industry: string;
  sector: string;
  service: string;
  status: string;
  value: string;
  deadline?: string;
  city: string;
  notes: string;
  requirements: string[];
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  tags: string[];
  total_hours: number;
  invoice_total: number;
  created_at: number;
  updated_at: number;
}

export interface ApiTimeEntry {
  id: string;
  client_id: string;
  description: string;
  hours: number;
  rate: number;
  date: number;
  billable: boolean;
}

export interface ApiInvoice {
  id: string;
  client_id: string;
  client_name: string;
  items: Array<{ description: string; quantity: number; rate: number; amount: number }>;
  subtotal: number;
  gst: number;
  total: number;
  status: string;
  created_at: number;
  due_at: number;
  notes?: string;
}

export interface ApiMemory {
  id: string;
  client_id: string;
  content: string;
  category: string;
  importance: number;
  created_at: number;
}

export interface ApiKnowledgeDoc {
  id: string;
  name: string;
  content: string;
  source: string;
  tags: string[];
  created_at: number;
}

export interface ApiProposal {
  id: string;
  brief: string;
  domain: string;
  output: string;
  created_at: number;
}

export interface ApiCustomPrompt {
  id: string;
  title: string;
  category: string;
  domain: string;
  difficulty: string;
  time_estimate: string;
  tools: string[];
  description: string;
  prompt: string;
  use_count: number;
  user_rating: number;
  last_used?: number;
}

export interface ApiFavourite {
  id: string;
  prompt_id: string;
  created_at: number;
}

// ─── CSRF Token Helper ─────────────────

import { getCsrfToken } from '@/lib/csrf';
import { fetchWithTimeout } from '@/lib/fetch-utils';

// ─── Fetch Helper ──────────────────────

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const method = options?.method?.toUpperCase() || 'GET';
  const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

  // Auto-attach CSRF token for mutating requests
  const csrfHeaders: Record<string, string> = {};
  if (isMutating) {
    const token = getCsrfToken();
    if (token) csrfHeaders['x-csrf-token'] = token;
  }

  const res = await fetchWithTimeout(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...csrfHeaders, ...(options?.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `API error: ${res.status}`);
  }
  return res.json();
}

// ─── Projects ──────────────────────────

export const projectsApi = {
  list: () => apiFetch<ApiProject[]>('/api/projects'),

  get: (id: string) => apiFetch<ApiProject>(`/api/projects/${id}`),

  create: (data: Omit<ApiProject, 'id' | 'created_at' | 'updated_at'>) =>
    apiFetch<ApiProject>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<ApiProject>) =>
    apiFetch<ApiProject>(`/api/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiFetch<{ success: boolean }>(`/api/projects/${id}`, {
      method: 'DELETE',
    }),
};

// ─── Time Entries ──────────────────────

export const timeEntriesApi = {
  list: (clientId?: string) => {
    const q = clientId ? `?client_id=${clientId}` : '';
    return apiFetch<ApiTimeEntry[]>(`/api/time-entries${q}`);
  },

  create: (data: Omit<ApiTimeEntry, 'id'>) =>
    apiFetch<ApiTimeEntry>('/api/time-entries', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiFetch<{ success: boolean }>(`/api/time-entries/${id}`, {
      method: 'DELETE',
    }),
};

// ─── Invoices ──────────────────────────

export const invoicesApi = {
  list: (clientId?: string) => {
    const q = clientId ? `?client_id=${clientId}` : '';
    return apiFetch<ApiInvoice[]>(`/api/invoices${q}`);
  },

  create: (data: Omit<ApiInvoice, 'id'>) =>
    apiFetch<ApiInvoice>('/api/invoices', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ─── Memories ──────────────────────────

export const memoriesApi = {
  list: (clientId: string) =>
    apiFetch<ApiMemory[]>(`/api/memories?client_id=${clientId}`),

  create: (data: Omit<ApiMemory, 'id' | 'created_at'>) =>
    apiFetch<ApiMemory>('/api/memories', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<Pick<ApiMemory, 'content' | 'category' | 'importance'>>) =>
    apiFetch<ApiMemory>(`/api/memories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiFetch<{ success: boolean }>(`/api/memories/${id}`, {
      method: 'DELETE',
    }),

  getAllClientIds: () =>
    apiFetch<string[]>('/api/memories?all_clients=true'),
};

// ─── Knowledge Docs ────────────────────

export const knowledgeDocsApi = {
  list: () => apiFetch<ApiKnowledgeDoc[]>('/api/knowledge-docs'),

  create: (data: { name: string; content: string }) =>
    apiFetch<ApiKnowledgeDoc>('/api/knowledge-docs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiFetch<{ success: boolean }>(`/api/knowledge-docs/${id}`, {
      method: 'DELETE',
    }),
};

// ─── Proposals ─────────────────────────

export const proposalsApi = {
  list: () => apiFetch<ApiProposal[]>('/api/proposals'),

  create: (data: { brief: string; domain: string; output: string }) =>
    apiFetch<ApiProposal>('/api/proposals', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ─── Custom Prompts ────────────────────

export const customPromptsApi = {
  list: () => apiFetch<ApiCustomPrompt[]>('/api/prompts'),

  create: (data: Omit<ApiCustomPrompt, 'id' | 'use_count' | 'user_rating'>) =>
    apiFetch<ApiCustomPrompt>('/api/prompts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ─── Favourites ────────────────────────

export const favouritesApi = {
  list: () => apiFetch<ApiFavourite[]>('/api/favourites'),

  add: (promptId: string) =>
    apiFetch<ApiFavourite>('/api/favourites', {
      method: 'POST',
      body: JSON.stringify({ prompt_id: promptId }),
    }),

  remove: (promptId: string) =>
    apiFetch<{ success: boolean }>(`/api/favourites/${promptId}`, {
      method: 'DELETE',
    }),
};

// ─── Conversations ────────────────────

export interface ApiConversation {
  id: string;
  title: string;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    provider?: string;
    model?: string;
    tokensUsed?: number;
    qualityScore?: {
      completeness: number;
      specificity: number;
      actionability: number;
      indiaContext: number;
      clientReady: number;
      total: number;
      notes: string;
      scoredAt: number;
    };
    agentType?: string;
  }>;
  agent_type: string;
  project_id?: string;
  created_at: number;
  updated_at: number;
}

// ─── Workflow Templates ──────────────

export interface ApiWorkflowTemplate {
  id: string;
  org_id: string;
  name: string;
  description: string;
  color: string;
  estimated_time: string;
  domains: string[];
  steps: Array<{
    id: string;
    name: string;
    description: string;
    prompt: string;
    agent?: string;
  }>;
  is_builtin: boolean;
  use_count: number;
  created_at: number;
  updated_at: number;
}

export const workflowTemplatesApi = {
  list: () => apiFetch<ApiWorkflowTemplate[]>('/api/workflow-templates'),

  create: (data: Omit<ApiWorkflowTemplate, 'id' | 'org_id' | 'is_builtin' | 'use_count' | 'created_at' | 'updated_at'>) =>
    apiFetch<ApiWorkflowTemplate>('/api/workflow-templates', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<Pick<ApiWorkflowTemplate, 'name' | 'description' | 'color' | 'estimated_time' | 'domains' | 'steps' | 'use_count'>>) =>
    apiFetch<ApiWorkflowTemplate>(`/api/workflow-templates/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiFetch<{ success: boolean }>(`/api/workflow-templates/${id}`, {
      method: 'DELETE',
    }),
};

// ─── Voice Agents ────────────────────

export interface ApiVoiceAgent {
  id: string;
  org_id: string;
  name: string;
  provider: 'vapi' | 'sarvam' | 'elevenlabs' | 'bland';
  voice: string;
  language: string;
  greeting: string;
  instructions: string;
  tools: string[];
  is_active: boolean;
  config: Record<string, unknown>;
  created_at: number;
  updated_at: number;
}

export interface ApiCallLog {
  id: string;
  org_id: string;
  agent_id: string;
  caller_number: string;
  duration: number;
  status: 'completed' | 'missed' | 'failed' | 'in-progress';
  transcript: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  summary: string;
  metadata: Record<string, unknown>;
  created_at: number;
}

// ─── Custom Agents ───────────────────

export interface ApiCustomAgent {
  id: string;
  org_id: string;
  name: string;
  description: string;
  category: string;
  task_focus: string;
  prompt: string;
  default_tier: string;
  default_provider_id: string | null;
  default_model_id: string | null;
  tools: string[];
  is_active: boolean;
  created_at: number;
  updated_at: number;
}

export const customAgentsApi = {
  list: () => apiFetch<ApiCustomAgent[]>('/api/custom-agents'),

  create: (data: Omit<ApiCustomAgent, 'id' | 'org_id' | 'is_active' | 'created_at' | 'updated_at'>) =>
    apiFetch<ApiCustomAgent>('/api/custom-agents', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<Pick<ApiCustomAgent, 'name' | 'description' | 'category' | 'task_focus' | 'prompt' | 'default_tier' | 'default_provider_id' | 'default_model_id' | 'tools' | 'is_active'>>) =>
    apiFetch<ApiCustomAgent>(`/api/custom-agents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiFetch<{ success: boolean }>(`/api/custom-agents/${id}`, {
      method: 'DELETE',
    }),
};

export const voiceAgentsApi = {
  list: () => apiFetch<ApiVoiceAgent[]>('/api/voice-agents'),

  create: (data: Omit<ApiVoiceAgent, 'id' | 'org_id' | 'is_active' | 'config' | 'created_at' | 'updated_at'>) =>
    apiFetch<ApiVoiceAgent>('/api/voice-agents', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<Pick<ApiVoiceAgent, 'name' | 'provider' | 'voice' | 'language' | 'greeting' | 'instructions' | 'tools' | 'is_active' | 'config'>>) =>
    apiFetch<ApiVoiceAgent>(`/api/voice-agents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiFetch<{ success: boolean }>(`/api/voice-agents/${id}`, {
      method: 'DELETE',
    }),
};

export const callLogsApi = {
  list: (agentId?: string) => {
    const q = agentId ? `?agent_id=${agentId}` : '';
    return apiFetch<ApiCallLog[]>(`/api/call-logs${q}`);
  },

  create: (data: Omit<ApiCallLog, 'id' | 'org_id' | 'created_at'>) =>
    apiFetch<ApiCallLog>('/api/call-logs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

export const conversationsApi = {
  list: () => apiFetch<ApiConversation[]>('/api/conversations'),

  get: (id: string) => apiFetch<ApiConversation>(`/api/conversations/${id}`),

  create: (data: { title?: string; messages?: ApiConversation['messages']; agent_type?: string; project_id?: string }) =>
    apiFetch<ApiConversation>('/api/conversations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: { title?: string; messages?: ApiConversation['messages']; agent_type?: string; project_id?: string }) =>
    apiFetch<ApiConversation>(`/api/conversations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiFetch<{ success: boolean }>(`/api/conversations/${id}`, {
      method: 'DELETE',
    }),

  appendMessages: (id: string, messages: ApiConversation['messages']) =>
    apiFetch<{ id: string; messages: ApiConversation['messages'] }>(`/api/conversations/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ messages }),
    }),
};
