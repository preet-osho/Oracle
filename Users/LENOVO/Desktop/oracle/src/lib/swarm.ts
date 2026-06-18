// ═══════════════════════════════════════
// ORACLE — Multi-Agent Swarm Orchestration
// Task decomposition · Agent routing · Parallel execution · Synthesis
// ═══════════════════════════════════════

import {
  ORCHESTRATOR_PROMPT,
  RESEARCHER_AGENT_PROMPT,
  WRITER_AGENT_PROMPT,
  DEVELOPER_AGENT_PROMPT,
  ANALYST_AGENT_PROMPT,
  STRATEGIST_AGENT_PROMPT,
  MARKETER_AGENT_PROMPT,
  DESIGNER_AGENT_PROMPT,
  FINANCE_AGENT_PROMPT,
  VOICE_AGENT_PROMPT,
  QA_AGENT_PROMPT,
  COORDINATOR_AGENT_PROMPT,
  WORKFLOW_AGENT_PROMPT,
} from '@/lib/system-prompt';
import { analyzeTask, type TaskAnalysis } from '@/lib/task-analyzer';
import {
  selectModel,
  logAgentPerformance,
  shouldDowngradeDueToBudget,
  trackTokenUsage,
  type ModelTier,
} from '@/lib/model-selector';
import { NeverStopRouter } from '@/lib/router';
import type { ClientProject } from '@/types';

// ─── Agent System Prompts ──────────────

const AGENT_PROMPTS: Record<string, string> = {
  researcher: RESEARCHER_AGENT_PROMPT,
  writer: WRITER_AGENT_PROMPT,
  developer: DEVELOPER_AGENT_PROMPT,
  analyst: ANALYST_AGENT_PROMPT,
  strategist: STRATEGIST_AGENT_PROMPT,
  marketer: MARKETER_AGENT_PROMPT,
  designer: DESIGNER_AGENT_PROMPT,
  finance: FINANCE_AGENT_PROMPT,
  voice: VOICE_AGENT_PROMPT,
  qa: QA_AGENT_PROMPT,
  coordinator: COORDINATOR_AGENT_PROMPT,
  workflow: WORKFLOW_AGENT_PROMPT,
};

// ─── Orchestrator Decision ─────────────

export async function shouldUseSwarm(
  task: string,
  callAI: (prompt: string) => Promise<string>,
  availableProviders: string[] = []
): Promise<{ needs: boolean; agents: string[]; parallel: boolean; analysis?: TaskAnalysis }> {
  // Use intelligent task analysis
  const analysis = analyzeTask(task);

  // For complex tasks with multiple agents, use orchestrator
  if (analysis.complexity > 0.6 || analysis.agents.length > 3) {
    const prompt = `${ORCHESTRATOR_PROMPT}\n\nAnalyze this task:\n${task.slice(0, 2000)}`;

    try {
      const raw = await callAI(prompt);

      // Parse JSON response
      let parsed: Record<string, unknown> | null = null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        const cleaned = raw.replace(/```json|```/g, '').trim();
        try {
          parsed = JSON.parse(cleaned);
        } catch {
          const match = raw.match(/\{[\s\S]*\}/);
          if (match) {
            try { parsed = JSON.parse(match[0]); } catch { console.warn('[Swarm] Failed to parse orchestrator JSON from text match'); }
          }
        }
      }

      if (parsed && typeof parsed === 'object') {
        return {
          needs: Boolean(parsed.needs_swarm),
          agents: Array.isArray(parsed.agents) ? parsed.agents : analysis.agents.map(a => a.role),
          parallel: Boolean(parsed.parallel),
          analysis,
        };
      }
    } catch (e) {
      console.warn('[Swarm] Failed to get orchestrator decision:', e);
    }
  }

  // Use analysis-based routing for simpler tasks
  return {
    needs: analysis.agents.length > 1 && analysis.complexity > 0.3,
    agents: analysis.agents.map(a => a.role),
    parallel: analysis.parallelizable,
    analysis,
  };
}

// ─── Run Swarm ─────────────────────────

export interface SwarmResult {
  agent: string;
  result: string;
  provider: string;
  model: string;
  tier: ModelTier;
  tokens: number;
  timeMs: number;
  costUsd: number;
}

export async function runSwarm(
  task: string,
  agents: string[],
  parallel: boolean,
  context: {
    rag?: string;
    memory?: string;
    project?: ClientProject;
  },
  callAI: (prompt: string, systemPrompt?: string, providerId?: string, modelId?: string) => Promise<{
    text: string;
    provider: string;
    model: string;
    tokens: number;
  }>,
  onAgentComplete?: (agentRole: string, result: string) => void
): Promise<{ synthesis: string; agentResults: SwarmResult[]; totalCostUsd: number }> {
  const agentResults: SwarmResult[] = [];
  const results: string[] = [];

  // Analyze task for intelligent routing
  const analysis = analyzeTask(task);

  // Build context prefix
  const contextParts: string[] = [];
  if (context.rag) contextParts.push(`## Document Context\n${context.rag}`);
  if (context.memory) contextParts.push(`## Client Memory\n${context.memory}`);
  if (context.project) {
    contextParts.push(`## Client Context\nClient: ${context.project.clientName} | Industry: ${context.project.industry} | City: ${context.project.city}\nService: ${context.project.service} | Budget: ${context.project.value}`);
  }
  const contextPrefix = contextParts.length > 0 ? contextParts.join('\n\n') + '\n\n---\n\n' : '';

  // Get available providers from BYOK keys
  const allKeys = NeverStopRouter.getAllKeys();
  const availableProviders = Object.keys(allKeys);

  // Build sub-tasks for each agent with intelligent model selection
  // Pass analysis.suggestedTier as forceTier so swarm analysis drives model selection consistently
  const subTasks = agents.map((agent) => {
    const modelSelection = selectModel(task, agent, availableProviders, analysis.suggestedTier);
    return {
      agent,
      prompt: buildSubTaskPrompt(task, agent, contextPrefix, analysis),
      modelSelection,
    };
  });

  if (parallel) {
    // Run all agents in parallel
    const promises = subTasks.map(async (st) => {
      const systemPrompt = AGENT_PROMPTS[st.agent] || AGENT_PROMPTS.researcher;
      const startTime = Date.now();

      // Check budget and potentially downgrade or skip
      let modelSelection = st.modelSelection;
      const estimatedTokens = analysis.estimatedTokens;
      const budgetAvailable = trackTokenUsage(estimatedTokens);
      if (!budgetAvailable) {
        console.warn(`[Swarm] Token budget exceeded, skipping ${st.agent}`);
        agentResults.push({
          agent: st.agent,
          result: '[Skipped: token budget exceeded]',
          provider: 'budget',
          model: 'skipped',
          tier: modelSelection.tier,
          tokens: 0,
          timeMs: 0,
          costUsd: 0,
        });
        results.push(`## ${capitalize(st.agent)} Agent\n[Skipped: token budget exceeded]`);
        return;
      }
      const downgradedTier = shouldDowngradeDueToBudget(estimatedTokens, modelSelection.tier);
      if (downgradedTier !== modelSelection.tier) {
        modelSelection = selectModel(task, st.agent, availableProviders, downgradedTier);
        console.log(`[Swarm] Downgrading ${st.agent} from ${st.modelSelection.tier} to ${downgradedTier} due to budget`);
      }

      try {
        const result = await callAI(st.prompt, systemPrompt, modelSelection.providerId, modelSelection.modelId);

        // Log performance
        logAgentPerformance(
          st.agent,
          result.model,
          result.provider,
          true,
          undefined,
          Date.now() - startTime,
          result.tokens,
          modelSelection.costEstimate.usd
        );

        const swarmResult: SwarmResult = {
          agent: st.agent,
          result: result.text,
          provider: result.provider,
          model: result.model,
          tier: modelSelection.tier,
          tokens: result.tokens,
          timeMs: Date.now() - startTime,
          costUsd: modelSelection.costEstimate.usd,
        };

        agentResults.push(swarmResult);
        results.push(`## ${capitalize(st.agent)} Agent (${modelSelection.tier} tier)\n${result.text}`);
        onAgentComplete?.(st.agent, result.text);
      } catch (err) {
        // Log failure
        logAgentPerformance(st.agent, modelSelection.modelId, modelSelection.providerId, false);

        const errorResult: SwarmResult = {
          agent: st.agent,
          result: `Error: ${err instanceof Error ? err.message : 'Agent failed'}`,
          provider: 'error',
          model: 'error',
          tier: modelSelection.tier,
          tokens: 0,
          timeMs: Date.now() - startTime,
          costUsd: 0,
        };
        agentResults.push(errorResult);
        results.push(`## ${capitalize(st.agent)} Agent\n[Failed: ${err instanceof Error ? err.message : 'Unknown error'}]`);
      }
    });

    await Promise.allSettled(promises);
  } else {
    // Run agents sequentially, passing previous results as context
    let previousResults = '';

    for (const st of subTasks) {
      const systemPrompt = AGENT_PROMPTS[st.agent] || AGENT_PROMPTS.researcher;
      const fullPrompt = previousResults
        ? `${st.prompt}\n\n## Previous Agent Results:\n${previousResults.slice(-400)}`
        : st.prompt;

      const startTime = Date.now();

      // Check budget
      let modelSelection = st.modelSelection;
      const estimatedTokens = analysis.estimatedTokens;
      const budgetAvailable = trackTokenUsage(estimatedTokens);
      if (!budgetAvailable) {
        console.warn(`[Swarm] Token budget exceeded, skipping ${st.agent}`);
        agentResults.push({
          agent: st.agent,
          result: '[Skipped: token budget exceeded]',
          provider: 'budget',
          model: 'skipped',
          tier: modelSelection.tier,
          tokens: 0,
          timeMs: 0,
          costUsd: 0,
        });
        continue;
      }
      const downgradedTier = shouldDowngradeDueToBudget(estimatedTokens, modelSelection.tier);
      if (downgradedTier !== modelSelection.tier) {
        modelSelection = selectModel(task, st.agent, availableProviders, downgradedTier);
        console.log(`[Swarm] Downgrading ${st.agent} from ${st.modelSelection.tier} to ${downgradedTier} due to budget`);
      }

      try {
        const result = await callAI(fullPrompt, systemPrompt, modelSelection.providerId, modelSelection.modelId);

        logAgentPerformance(
          st.agent,
          result.model,
          result.provider,
          true,
          undefined,
          Date.now() - startTime,
          result.tokens,
          modelSelection.costEstimate.usd
        );

        const swarmResult: SwarmResult = {
          agent: st.agent,
          result: result.text,
          provider: result.provider,
          model: result.model,
          tier: modelSelection.tier,
          tokens: result.tokens,
          timeMs: Date.now() - startTime,
          costUsd: modelSelection.costEstimate.usd,
        };

        agentResults.push(swarmResult);
        previousResults += `\n## ${capitalize(st.agent)} Agent (${modelSelection.tier} tier)\n${result.text}`;
        results.push(previousResults);
        onAgentComplete?.(st.agent, result.text);
      } catch (err) {
        logAgentPerformance(st.agent, modelSelection.modelId, modelSelection.providerId, false);

        const errorResult: SwarmResult = {
          agent: st.agent,
          result: `Error: ${err instanceof Error ? err.message : 'Agent failed'}`,
          provider: 'error',
          model: 'error',
          tier: modelSelection.tier,
          tokens: 0,
          timeMs: Date.now() - startTime,
          costUsd: 0,
        };
        agentResults.push(errorResult);
      }
    }
  }

  // Synthesize all results using premium tier
  const synthesisPrompt = buildSynthesisPrompt(task, results);
  const synthesisSystemPrompt = `You are ORACLE's synthesis agent. Combine outputs from multiple specialist agents into one cohesive, complete deliverable. 
The output must be professional, India-contextualized, and ready to send to a ₹50,000+ client.
All prices in INR. Specific tool names. Numbered steps. Tables for comparisons.
End with "**Next Step:** [one specific action]"`;

  const synthesisModel = selectModel(task, 'coordinator', availableProviders);

  try {
    const synthesisResult = await callAI(synthesisPrompt, synthesisSystemPrompt, synthesisModel.providerId, synthesisModel.modelId);

    agentResults.push({
      agent: 'synthesizer',
      result: synthesisResult.text,
      provider: synthesisResult.provider,
      model: synthesisResult.model,
      tier: synthesisModel.tier,
      tokens: synthesisResult.tokens,
      timeMs: 0,
      costUsd: synthesisModel.costEstimate.usd,
    });

    const totalCostUsd = agentResults.reduce((sum, r) => sum + r.costUsd, 0);

    return { synthesis: synthesisResult.text, agentResults, totalCostUsd };
  } catch (e) {
    console.warn('[Swarm] Synthesis failed, returning concatenated results:', e);

    const fallbackResult: SwarmResult = {
      agent: 'synthesizer',
      result: results.join('\n\n---\n\n'),
      provider: 'fallback',
      model: 'concatenated',
      tier: 'free',
      tokens: 0,
      timeMs: 0,
      costUsd: 0,
    };

    agentResults.push(fallbackResult);

    return { synthesis: results.join('\n\n---\n\n'), agentResults, totalCostUsd: 0 };
  }
}

// ─── Helper: Build Sub-Task Prompt ─────

function buildSubTaskPrompt(task: string, agent: string, contextPrefix: string, analysis: TaskAnalysis): string {
  const agentDescriptions: Record<string, string> = {
    researcher: 'Focus on gathering data, tools, benchmarks, and current market information relevant to this task.',
    writer: 'Focus on creating polished, ready-to-publish content for this task.',
    developer: 'Focus on writing complete, runnable code for this task.',
    analyst: 'Focus on data analysis, metrics, benchmarks, and data-driven recommendations for this task.',
    strategist: 'Focus on strategic planning, roadmap, and long-term value creation for this task.',
    marketer: 'Focus on digital marketing strategy, campaign design, channel optimization, and growth tactics for this task.',
    designer: 'Focus on UI/UX design, brand identity, visual systems, and design specifications for this task.',
    finance: 'Focus on financial modeling, pricing strategy, budget allocation, and ROI analysis for this task.',
    voice: 'Focus on voice agent configuration, conversation design, telephony setup, and provider integration for this task.',
    qa: 'Focus on quality assurance, code review, testing strategy, security audit, and performance optimization for this task.',
    coordinator: 'Focus on project planning, task breakdown, timeline management, and delivery coordination for this task.',
    workflow: 'Focus on designing multi-phase workflows that chain specialist agents in sequence, with quality gates and dependency management for this task.',
  };

  // Get task breakdown if available
  const breakdownSection = analysis.breakdown
    ? `\n\nRECOMMENDED BREAKDOWN:\n${analysis.breakdown.map((b, i) => `${i + 1}. ${b}`).join('\n')}`
    : '';

  return `${contextPrefix}${agentDescriptions[agent] || agentDescriptions.researcher}

TASK COMPLEXITY: ${analysis.complexity.toFixed(2)} (0=simple, 1=complex)
DOMAIN: ${analysis.category}
${breakdownSection}

TASK: ${task.slice(0, 3000)}

Deliver a complete, polished output specific to your role. No placeholders. No [brackets].
All prices in INR. Specific tool names. India-contextualized recommendations.`;
}

// ─── Helper: Build Synthesis Prompt ────

function buildSynthesisPrompt(task: string, agentResults: string[]): string {
  return `You have received outputs from multiple specialist agents working on this task:

ORIGINAL TASK: ${task.slice(0, 2000)}

AGENT OUTPUTS:
${agentResults.join('\n\n---\n\n')}

SYNTHESIZE all agent outputs into ONE cohesive, complete deliverable.
- Remove redundancies
- Ensure consistency
- Fill any gaps
- Polish to client-ready quality
- All prices in INR
- End with "**Next Step:** [one specific action]"`;
}

// ─── Utility ───────────────────────────

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
