// ═══════════════════════════════════════
// ORACLE — AI Providers & Smart Routing
// ═══════════════════════════════════════

import type { ModelProvider } from '@/types';

// ─── 10 AI Providers ───────────────────

export const PROVIDERS: ModelProvider[] = [
  // ── 1. OpenAI ──
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    keyFormat: 'sk-...',
    keyLabel: 'sk-xxxx...xxxx',
    docsUrl: 'https://platform.openai.com/docs',
    signupUrl: 'https://platform.openai.com/signup',
    freeLimit: '$5 free credit for new accounts',
    color: '#10a37f',
    logo: '/logos/openai.svg',
    supportsStreaming: true,
    supportsMCP: false,
    costPer1kTokens: { input: 0.0025, output: 0.01, currency: 'USD' },
    models: [
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        contextWindow: 128000,
        bestFor: ['general', 'writing', 'analysis', 'multimodal'],
        isFree: false,
        costPer1k: { input: 0.0025, output: 0.01 },
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        contextWindow: 128000,
        bestFor: ['fast general', 'drafts', 'classification', 'budget'],
        isFree: false,
        costPer1k: { input: 0.00015, output: 0.0006 },
      },
      {
        id: 'o3-mini',
        name: 'o3-mini',
        contextWindow: 128000,
        bestFor: ['reasoning', 'code', 'math', 'complex tasks'],
        isFree: false,
        costPer1k: { input: 0.0011, output: 0.0044 },
      },
    ],
  },

  // ── 2. Anthropic ──
  {
    id: 'anthropic',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    keyFormat: 'sk-ant-...',
    keyLabel: 'sk-ant-xxxx...xxxx',
    docsUrl: 'https://docs.anthropic.com',
    signupUrl: 'https://console.anthropic.com/signup',
    freeLimit: '$5 free credit for new accounts',
    color: '#d4a574',
    logo: '/logos/anthropic.svg',
    supportsStreaming: true,
    supportsMCP: true,
    costPer1kTokens: { input: 0.015, output: 0.075, currency: 'USD' },
    models: [
      {
        id: 'claude-opus-4-7',
        name: 'Claude Opus 4',
        contextWindow: 200000,
        bestFor: ['complex reasoning', 'long-form writing', 'coding', 'analysis'],
        isFree: false,
        costPer1k: { input: 0.015, output: 0.075 },
      },
      {
        id: 'claude-sonnet-4-6',
        name: 'Claude Sonnet 4',
        contextWindow: 200000,
        bestFor: ['balanced performance', 'coding', 'writing', 'analysis'],
        isFree: false,
        costPer1k: { input: 0.003, output: 0.015 },
      },
      {
        id: 'claude-haiku-4-5',
        name: 'Claude Haiku 4',
        contextWindow: 200000,
        bestFor: ['fast responses', 'classification', 'extraction', 'budget'],
        isFree: false,
        costPer1k: { input: 0.0008, output: 0.004 },
      },
    ],
  },

  // ── 3. Groq ──
  {
    id: 'groq',
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    keyFormat: 'gsk_...',
    keyLabel: 'gsk_xxxx...xxxx',
    docsUrl: 'https://console.groq.com/docs',
    signupUrl: 'https://console.groq.com/signup',
    freeLimit: '14,400 requests/day free (Llama), 6,000 requests/day (Mixtral)',
    color: '#f55036',
    logo: '/logos/groq.svg',
    supportsStreaming: true,
    supportsMCP: false,
    costPer1kTokens: { input: 0.00059, output: 0.00079, currency: 'USD' },
    models: [
      {
        id: 'llama-3.3-70b-versatile',
        name: 'Llama 3.3 70B Versatile',
        contextWindow: 128000,
        bestFor: ['general', 'fast inference', 'free tier', 'balanced'],
        isFree: true,
        costPer1k: { input: 0.00059, output: 0.00079 },
      },
      {
        id: 'llama3-8b-8192',
        name: 'Llama 3 8B',
        contextWindow: 8192,
        bestFor: ['quick tasks', 'classification', 'extraction', 'free'],
        isFree: true,
        costPer1k: { input: 0.00005, output: 0.00008 },
      },
      {
        id: 'mixtral-8x7b',
        name: 'Mixtral 8x7B',
        contextWindow: 32768,
        bestFor: ['multilingual', 'code', 'reasoning', 'free'],
        isFree: true,
        costPer1k: { input: 0.00024, output: 0.00024 },
      },
    ],
  },

  // ── 4. Google ──
  {
    id: 'google',
    name: 'Google AI',
    baseUrl: 'https://generativelanguage.googleapis.com/v1',
    keyFormat: 'AIza...',
    keyLabel: 'AIza_xxxx...xxxx',
    docsUrl: 'https://ai.google.dev/docs',
    signupUrl: 'https://aistudio.google.com/signup',
    freeLimit: '15 RPM, 1M tokens/day free for Gemini Flash',
    color: '#4285f4',
    logo: '/logos/google.svg',
    supportsStreaming: true,
    supportsMCP: false,
    costPer1kTokens: { input: 0.000075, output: 0.0003, currency: 'USD' },
    models: [
      {
        id: 'gemini-2.0-flash',
        name: 'Gemini 2.0 Flash',
        contextWindow: 1048576,
        bestFor: ['multimodal', 'fast', 'document processing', 'large context'],
        isFree: true,
        costPer1k: { input: 0.000075, output: 0.0003 },
      },
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        contextWindow: 2097152,
        bestFor: ['longest context', 'document analysis', 'complex reasoning'],
        isFree: false,
        costPer1k: { input: 0.00125, output: 0.005 },
      },
      {
        id: 'gemini-2.0-flash-thinking',
        name: 'Gemini 2.0 Flash Thinking',
        contextWindow: 1048576,
        bestFor: ['step-by-step reasoning', 'chain of thought', 'complex tasks'],
        isFree: true,
        costPer1k: { input: 0.000075, output: 0.0003 },
      },
    ],
  },

  // ── 5. OpenRouter ──
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    keyFormat: 'sk-or-...',
    keyLabel: 'sk-or-xxxx...xxxx',
    docsUrl: 'https://openrouter.ai/docs',
    signupUrl: 'https://openrouter.ai/signup',
    freeLimit: '200+ models, many free including DeepSeek R1 & Llama 3.3 70B',
    color: '#6366f1',
    logo: '/logos/openrouter.svg',
    supportsStreaming: true,
    supportsMCP: false,
    costPer1kTokens: { input: 0.0, output: 0.0, currency: 'USD' },
    models: [
      {
        id: 'deepseek/deepseek-r1',
        name: 'DeepSeek R1',
        contextWindow: 163840,
        bestFor: ['code', 'reasoning', 'math', 'free'],
        isFree: true,
      },
      {
        id: 'meta-llama/llama-3.3-70b-instruct:free',
        name: 'Llama 3.3 70B Instruct (Free)',
        contextWindow: 128000,
        bestFor: ['general', 'free', 'fast', 'balanced'],
        isFree: true,
      },
      {
        id: 'anthropic/claude-sonnet-4',
        name: 'Claude Sonnet 4',
        contextWindow: 200000,
        bestFor: ['balanced', 'writing', 'analysis', 'coding'],
        isFree: false,
        costPer1k: { input: 0.003, output: 0.015 },
      },
      {
        id: 'openai/gpt-4o',
        name: 'GPT-4o',
        contextWindow: 128000,
        bestFor: ['general', 'multimodal', 'fast'],
        isFree: false,
        costPer1k: { input: 0.0025, output: 0.01 },
      },
    ],
  },

  // ── 6. Together AI ──
  {
    id: 'together',
    name: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    keyFormat: 'tok_...',
    keyLabel: 'tok_xxxx...xxxx',
    docsUrl: 'https://docs.together.ai',
    signupUrl: 'https://api.together.ai/signup',
    freeLimit: '$25 free credit for new accounts',
    color: '#0ea5e9',
    logo: '/logos/together.svg',
    supportsStreaming: true,
    supportsMCP: false,
    costPer1kTokens: { input: 0.0001, output: 0.0001, currency: 'USD' },
    models: [
      {
        id: 'meta-llama/Llama-3.3-70B-Turbo-Free',
        name: 'Llama 3.3 70B Turbo Free',
        contextWindow: 128000,
        bestFor: ['general', 'free', 'fast inference'],
        isFree: true,
      },
      {
        id: 'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo',
        name: 'Llama 3.1 405B Turbo',
        contextWindow: 128000,
        bestFor: ['complex reasoning', 'long context', 'analysis'],
        isFree: false,
        costPer1k: { input: 0.0035, output: 0.0035 },
      },
      {
        id: 'deepseek-ai/DeepSeek-R1',
        name: 'DeepSeek R1',
        contextWindow: 163840,
        bestFor: ['code', 'reasoning', 'math'],
        isFree: false,
        costPer1k: { input: 0.00055, output: 0.00219 },
      },
    ],
  },

  // ── 7. Cerebras ──
  {
    id: 'cerebras',
    name: 'Cerebras',
    baseUrl: 'https://api.cerebras.ai/v1',
    keyFormat: 'csk-...',
    keyLabel: 'csk_xxxx...xxxx',
    docsUrl: 'https://inference-docs.cerebras.ai',
    signupUrl: 'https://cloud.cerebras.ai/signup',
    freeLimit: '600 requests/min free',
    color: '#f97316',
    logo: '/logos/cerebras.svg',
    supportsStreaming: true,
    supportsMCP: false,
    costPer1kTokens: { input: 0.0006, output: 0.0006, currency: 'USD' },
    models: [
      {
        id: 'llama-3.3-70b',
        name: 'Llama 3.3 70B (2000 tok/s)',
        contextWindow: 128000,
        bestFor: ['ultra-fast inference', 'real-time', 'low latency'],
        isFree: true,
        costPer1k: { input: 0.0006, output: 0.0006 },
      },
      {
        id: 'llama-3.1-8b',
        name: 'Llama 3.1 8B',
        contextWindow: 8192,
        bestFor: ['quick tasks', 'classification', 'fastest'],
        isFree: true,
        costPer1k: { input: 0.0001, output: 0.0001 },
      },
    ],
  },

  // ── 8. Mistral AI ──
  {
    id: 'mistral',
    name: 'Mistral AI',
    baseUrl: 'https://api.mistral.ai/v1',
    keyFormat: 'mist-...',
    keyLabel: 'mist_xxxx...xxxx',
    docsUrl: 'https://docs.mistral.ai',
    signupUrl: 'https://console.mistral.ai/signup',
    freeLimit: 'Rate-limited free tier for all models',
    color: '#ff7000',
    logo: '/logos/mistral.svg',
    supportsStreaming: true,
    supportsMCP: false,
    costPer1kTokens: { input: 0.002, output: 0.006, currency: 'USD' },
    models: [
      {
        id: 'mistral-large-latest',
        name: 'Mistral Large',
        contextWindow: 128000,
        bestFor: ['reasoning', 'multilingual', 'code', 'analysis'],
        isFree: false,
        costPer1k: { input: 0.002, output: 0.006 },
      },
      {
        id: 'mistral-small-latest',
        name: 'Mistral Small',
        contextWindow: 128000,
        bestFor: ['fast', 'budget', 'general tasks'],
        isFree: false,
        costPer1k: { input: 0.0001, output: 0.0003 },
      },
      {
        id: 'open-mixtral-8x22b',
        name: 'Mixtral 8x22B',
        contextWindow: 65536,
        bestFor: ['code', 'math', 'reasoning', 'free tier'],
        isFree: true,
        costPer1k: { input: 0.0002, output: 0.0002 },
      },
    ],
  },

  // ── 9. Cohere ──
  {
    id: 'cohere',
    name: 'Cohere',
    baseUrl: 'https://api.cohere.ai/v1',
    keyFormat: 'cmd-...',
    keyLabel: 'cmd_xxxx...xxxx',
    docsUrl: 'https://docs.cohere.com',
    signupUrl: 'https://dashboard.cohere.com/signup',
    freeLimit: '1000 API calls/month free',
    color: '#39594d',
    logo: '/logos/cohere.svg',
    supportsStreaming: true,
    supportsMCP: false,
    costPer1kTokens: { input: 0.0015, output: 0.002, currency: 'USD' },
    models: [
      {
        id: 'command-r-plus',
        name: 'Command R+',
        contextWindow: 128000,
        bestFor: ['RAG', 'grounded generation', 'enterprise'],
        isFree: false,
        costPer1k: { input: 0.0015, output: 0.002 },
      },
      {
        id: 'command-r',
        name: 'Command R',
        contextWindow: 128000,
        bestFor: ['fast RAG', 'classification', 'budget'],
        isFree: false,
        costPer1k: { input: 0.00015, output: 0.0002 },
      },
      {
        id: 'command-light',
        name: 'Command Light',
        contextWindow: 4096,
        bestFor: ['quick tasks', 'free tier', 'simple prompts'],
        isFree: true,
      },
    ],
  },

  // ── 10. Perplexity ──
  {
    id: 'perplexity',
    name: 'Perplexity',
    baseUrl: 'https://api.perplexity.ai',
    keyFormat: 'pplx-...',
    keyLabel: 'pplx_xxxx...xxxx',
    docsUrl: 'https://docs.perplexity.ai',
    signupUrl: 'https://www.perplexity.ai/hub',
    freeLimit: '5 free Pro searches/day, $5 credit for API',
    color: '#1fb8cd',
    logo: '/logos/perplexity.svg',
    supportsStreaming: true,
    supportsMCP: false,
    costPer1kTokens: { input: 0.001, output: 0.001, currency: 'USD' },
    models: [
      {
        id: 'llama-3.1-sonar-large-128k-online',
        name: 'Sonar Large 128K (Online)',
        contextWindow: 128000,
        bestFor: ['web search', 'real-time info', 'research', 'citations'],
        isFree: false,
        costPer1k: { input: 0.001, output: 0.001 },
      },
      {
        id: 'llama-3.1-sonar-small-32k-online',
        name: 'Sonar Small 32K (Online)',
        contextWindow: 32768,
        bestFor: ['quick search', 'fast answers', 'budget web search'],
        isFree: false,
        costPer1k: { input: 0.0002, output: 0.0002 },
      },
      {
        id: 'llama-3.1-sonar-large-128k-chat',
        name: 'Sonar Large 128K (Chat)',
        contextWindow: 128000,
        bestFor: ['conversation', 'multi-turn', 'balanced'],
        isFree: false,
        costPer1k: { input: 0.001, output: 0.001 },
      },
    ],
  },
];

// ─── Smart Routing Rules ───────────────

export const SMART_ROUTING_RULES: Record<string, string> = {
  code: 'openrouter',       // deepseek-r1 best for code
  reasoning: 'openrouter',  // deepseek-r1 best reasoning
  speed: 'cerebras',        // 2000 tok/s fastest
  document: 'google',       // 1M context window
  search: 'perplexity',     // built-in web search
  general: 'groq',          // best free general
  budget: 'groq',           // generous free tier
  writing: 'anthropic',     // Claude best for writing
  multimodal: 'google',     // Gemini best for images
  enterprise: 'anthropic',  // Claude Sonnet for business
  analysis: 'openai',       // GPT-4o strong for analysis
  multilingual: 'mistral',  // Mistral excels in French, German, etc.
  longform: 'google',       // 2M context for long documents
  fast: 'cerebras',         // 2000 tok/s throughput
};

// ─── MCP Servers ───────────────────────

export const MCP_SERVERS: Record<string, { url: string; name: string }> = {
  gmail: {
    url: 'https://gmailmcp.googleapis.com/mcp/v1',
    name: 'Gmail',
  },
  calendar: {
    url: 'https://calendarmcp.googleapis.com/mcp/v1',
    name: 'Calendar',
  },
  drive: {
    url: 'https://drivemcp.googleapis.com/mcp/v1',
    name: 'Drive',
  },
};
