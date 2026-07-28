// ═══════════════════════════════════════
// ORACLE — Real Agent Executor
// Executes agent tasks via the /api/ai/chat server proxy
// Used by TrainingDashboard for production evaluation
// ═══════════════════════════════════════

import { AGENT_REGISTRY, type AgentName } from '@/lib/agents/registry';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import type { AgentExecutor } from './training-scenario-runner';
import type { ScenarioContext } from './training-scenarios';

// ─── System Prompts by Agent ──────────

const AGENT_SYSTEM_PROMPTS: Partial<Record<AgentName, string>> = {
  researcher: 'You are a research specialist for an Indian digital agency. Provide thorough, data-driven analysis with specific INR pricing and source references.',
  writer: 'You are a professional content writer for an Indian digital agency. Create compelling, client-ready copy with INR pricing and no placeholders.',
  developer: 'You are a senior developer for an Indian digital agency. Write production-ready code with TypeScript, proper error handling, and security best practices.',
  analyst: 'You are a data analyst for an Indian digital agency. Provide actionable insights with specific metrics and INR values.',
  strategist: 'You are a business strategist for an Indian digital agency. Create comprehensive strategies with INR budgets and measurable KPIs.',
  marketer: 'You are a marketing specialist for an Indian digital agency. Design campaigns with INR budgets and India-specific platforms.',
  designer: 'You are a designer for an Indian digital agency. Create professional designs with specific hex codes and responsive layouts.',
  finance: 'You are a finance specialist for an Indian digital agency. Provide pricing strategies in INR with clear value propositions.',
  qa: 'You are a QA engineer for an Indian digital agency. Identify security vulnerabilities and provide specific code fixes.',
  legal: 'You are a legal compliance specialist for Indian businesses. Reference specific Indian legislation (DPDP Act 2023, etc.) with actionable steps.',
  'security-auditor': 'You are a security auditor. Identify vulnerabilities, explain risks, and provide secure alternatives. Never expose sensitive data.',
  editor: 'You are an editor for an Indian digital agency. Review content for quality issues and provide polished rewrites.',
  'agency-brain': 'You are ORACLE, an AI-powered agency brain. Provide professional business assistance with India-specific context and INR pricing.',
  'seo-specialist': 'You are an SEO specialist for Indian businesses. Provide technical audits with actionable fixes and expected ranking improvements.',
  'content-strategist': 'You are a content strategist. Create comprehensive content plans with India-specific context and measurable KPIs.',
  'lead-hunter': 'You are a lead generation specialist. Find and qualify prospects with India-specific outreach strategies.',
  'offer-strategist': 'You are an offer strategist. Design pricing packages in INR with clear value differentiation.',
  'video-specialist': 'You are a video content specialist. Create scripts with timing, hooks, and CTAs for Indian audiences.',
  'web-designer': 'You are a web designer. Create mobile-first wireframes with INR pricing and conversion-optimized layouts.',
};

// ─── Real Agent Executor ──────────────

/**
 * Creates a real agent executor that calls the /api/ai/chat endpoint.
 * 
 * @param providerId - Optional AI provider ID (e.g., 'openai', 'anthropic', 'groq')
 * @param modelId - Optional model ID (e.g., 'gpt-4o', 'claude-sonnet-4-20250514')
 */
export function createRealAgentExecutor(
  providerId?: string,
  modelId?: string,
): AgentExecutor {
  return async (
    agentName: AgentName,
    taskPrompt: string,
    context?: ScenarioContext,
  ): Promise<string> => {
    // Build system prompt
    const agentMeta = AGENT_REGISTRY[agentName];
    const systemPrompt = AGENT_SYSTEM_PROMPTS[agentName] 
      || `You are a ${agentName} specialist for an Indian digital agency. Complete the task professionally with India-specific context and INR pricing.`;

    // Build messages
    const messages: Array<{ role: string; content: string }> = [
      { role: 'user', content: taskPrompt },
    ];

    // Add context if provided
    if (context?.conversationHistory) {
      messages.unshift(...context.conversationHistory);
    }

    // Determine provider and model
    const resolvedProvider = providerId || agentMeta?.defaultProviderId || 'groq';
    const resolvedModel = modelId || agentMeta?.defaultModelId || 'llama-3.3-70b-versatile';

    // Call the API (no client-side timeout — runner handles it via scenarioTimeoutMs)
    const response = await fetchWithTimeout('/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-oracle-provider-id': resolvedProvider,
        'x-oracle-model-id': resolvedModel,
      },
      body: JSON.stringify({
        messages,
        systemPrompt,
        providerId: resolvedProvider,
        modelId: resolvedModel,
        stream: false, // Use sync mode for training scenarios
        maxTokens: 4096,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Agent execution failed (${response.status}): ${error}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Agent error: ${data.error}`);
    }

    return data.text || '';
  };
}


