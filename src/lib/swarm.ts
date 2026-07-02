// ═══════════════════════════════════════
// ORACLE — Multi-Agent Swarm Orchestration
// Task decomposition · Agent routing · Parallel execution · Synthesis
// ═══════════════════════════════════════

import { ORCHESTRATOR_PROMPT } from '@/lib/system-prompt';
import { ALL_AGENT_NAMES, getAgentPrompt, getAgentMetadata } from '@/lib/agents/registry';
import { analyzeTask, type TaskAnalysis } from '@/lib/task-analyzer';
import { routeAgencyTask, runQualityGates, detectMistakes } from '@/lib/agency-operations';
import {
  selectModel,
  logAgentPerformance,
  shouldDowngradeDueToBudget,
  trackTokenUsage,
  type ModelTier,
} from '@/lib/model-selector';
import { NeverStopRouter } from '@/lib/router';
import { registerSwarmExecution, shouldContinueSwarm, completeSwarmExecution, isWithinCostLimit, canStartSwarm } from '@/lib/emergency-stop';
import { createLogger } from '@/lib/logger';
import type { ClientProject } from '@/types';

const log = createLogger('Swarm');

// ─── Agent System Prompts ──────────────

// Build AGENT_PROMPTS from the centralized registry
const AGENT_PROMPTS: Record<string, string> = Object.fromEntries(
  ALL_AGENT_NAMES.map((name) => [name, getAgentPrompt(name)])
);

// ─── Orchestrator Decision ─────────────

export async function shouldUseSwarm(
  task: string,
  callAI: (prompt: string) => Promise<string>,
  _availableProviders: string[] = []
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
            try { parsed = JSON.parse(match[0]); } catch { log.warn('Failed to parse orchestrator JSON from text match'); }
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
      log.warn('Failed to get orchestrator decision', { error: e instanceof Error ? e.message : 'Unknown' });
    }
  }

  // Use analysis-based routing for simpler tasks
  // Enhance with agency-specific routing only when task matches an agency pattern
  const agencyRoute = routeAgencyTask(task);
  const isAgencyTask = agencyRoute.workflow !== 'strategy'; // default fallback
  const analysisAgents = analysis.agents.map(a => a.role);
  const mergedAgents = isAgencyTask
    ? [
        agencyRoute.primary,
        ...agencyRoute.support,
        ...analysisAgents.filter(a => a !== agencyRoute.primary && !agencyRoute.support.includes(a)),
      ]
    : analysisAgents;

  return {
    needs: mergedAgents.length > 1 && analysis.complexity > 0.3,
    agents: mergedAgents,
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
  onAgentComplete?: (agentRole: string, result: string) => void,
  userId?: string
): Promise<{ synthesis: string; agentResults: SwarmResult[]; totalCostUsd: number }> {
  // ── Emergency Stop: Register execution ──
  const blockReason = canStartSwarm(userId);
  if (blockReason) {
    log.warn('Swarm execution blocked by emergency stop', { reason: blockReason });
    return {
      synthesis: `[Blocked] ${blockReason}`,
      agentResults: [],
      totalCostUsd: 0,
    };
  }

  const executionId = registerSwarmExecution(userId, task);
  if (!executionId) {
    return {
      synthesis: '[Blocked] Could not register swarm execution (limit reached or emergency stop).',
      agentResults: [],
      totalCostUsd: 0,
    };
  }

  const agentResults: SwarmResult[] = [];
  const results: string[] = [];

  // Analyze task for intelligent routing
  const analysis = analyzeTask(task);

  // ── Emergency Stop: Check cost limit ──
  if (!isWithinCostLimit(analysis.estimatedTokens * 0.00003)) {
    // Rough cost estimate — if estimated cost > limit, abort early
    completeSwarmExecution(executionId);
    log.warn('Swarm execution aborted: estimated cost exceeds limit', { estimatedTokens: analysis.estimatedTokens });
    return {
      synthesis: '[Aborted] Estimated cost exceeds the swarm budget limit.',
      agentResults: [],
      totalCostUsd: 0,
    };
  }

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

      // ── Emergency Stop: Check before each agent ──
      const abortReason = shouldContinueSwarm(executionId);
      if (abortReason) {
        log.warn('Swarm agent aborted mid-execution', { agent: st.agent, reason: abortReason });
        agentResults.push({
          agent: st.agent,
          result: `[Aborted: ${abortReason}]`,
          provider: 'aborted',
          model: 'aborted',
          tier: st.modelSelection.tier,
          tokens: 0,
          timeMs: 0,
          costUsd: 0,
        });
        results.push(`## ${capitalize(st.agent)} Agent\n[Aborted: ${abortReason}]`);
        return;
      }

      // Check budget and potentially downgrade or skip
      let modelSelection = st.modelSelection;
      const estimatedTokens = analysis.estimatedTokens;
      const budgetAvailable = trackTokenUsage(estimatedTokens);
      if (!budgetAvailable) {
        log.warn('Token budget exceeded, skipping parallel agent', { agent: st.agent });
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
        log.info('Downgrading agent due to budget', { agent: st.agent, from: st.modelSelection.tier, to: downgradedTier });
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
      // ── Emergency Stop: Check before each agent ──
      const abortReason = shouldContinueSwarm(executionId);
      if (abortReason) {
        log.warn('Swarm sequential agent aborted', { agent: st.agent, reason: abortReason });
        break;
      }

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
        log.warn('Token budget exceeded, skipping sequential agent', { agent: st.agent });
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
        log.info('Downgrading agent due to budget', { agent: st.agent, from: st.modelSelection.tier, to: downgradedTier });
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

    // ── Post-Synthesis Validation Pipeline ──
    const validationResult = await runPostSynthesisValidation(
      synthesisResult.text,
      task,
      results,
      callAI,
      availableProviders
    );
    if (validationResult.correctedSynthesis) {
      agentResults.push({
        agent: 'validation',
        result: validationResult.correctedSynthesis,
        provider: validationResult.provider,
        model: validationResult.model,
        tier: 'standard',
        tokens: validationResult.tokens,
        timeMs: validationResult.timeMs,
        costUsd: validationResult.costUsd,
      });
    }
    const finalSynthesis = validationResult.correctedSynthesis || synthesisResult.text;
    const totalCostUsd = agentResults.reduce((sum, r) => sum + r.costUsd, 0);

    // ── Agency Quality Gate (non-blocking) ──
    try {
      const qualityGate = runQualityGates(finalSynthesis, task);
      if (!qualityGate.passed) {
        const mistakes = detectMistakes(task, finalSynthesis);
        log.info('Agency quality gate did not pass', { score: qualityGate.score, issues: qualityGate.checks.filter(c => !c.passed).map(c => c.name) });
        // Attach quality gate metadata as a final agent result for visibility
        const gateSummary = qualityGate.checks.filter(c => !c.passed).map(c => `• ${c.name}: ${c.message}`).join('\n');
        const mistakeSummary = mistakes.length > 0 ? '\n\nDetected Mistakes:\n' + mistakes.map(m => `• [${m.severity}] ${m.description} → ${m.fix}`).join('\n') : '';
        agentResults.push({
          agent: 'agency-qa',
          result: `Agency Quality Gate Score: ${qualityGate.score}/100\n\nFailed Checks:\n${gateSummary}${mistakeSummary}`,
          provider: 'local',
          model: 'quality-gate',
          tier: 'free',
          tokens: 0,
          timeMs: 0,
          costUsd: 0,
        });
      }
    } catch {
      // Quality gate is non-critical
    }

    // ── Emergency Stop: Clean up ──
    completeSwarmExecution(executionId);

    return { synthesis: finalSynthesis, agentResults, totalCostUsd };
  } catch (e) {
    log.warn('Synthesis failed, returning concatenated results', { error: e instanceof Error ? e.message : 'Unknown' });

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

    // ── Emergency Stop: Clean up ──
    completeSwarmExecution(executionId);

    return { synthesis: results.join('\n\n---\n\n'), agentResults, totalCostUsd: 0 };
  }
}

// ═══════════════════════════════════════
// POST-SYNTHESIS VALIDATION PIPELINE
// Cross-agent consistency · Fact-check · Contradiction detection · Completeness
// ═══════════════════════════════════════

export interface ValidationResult {
  correctedSynthesis: string | null;
  tokens: number;
  provider: string;
  model: string;
  costUsd: number;
  timeMs: number;
}

export async function runPostSynthesisValidation(
  synthesis: string,
  originalTask: string,
  agentResults: string[],
  callAI: (prompt: string, systemPrompt?: string, providerId?: string, modelId?: string) => Promise<{
    text: string;
    provider: string;
    model: string;
    tokens: number;
  }>,
  availableProviders: string[]
): Promise<ValidationResult> {
  // Micro-subagent 1: Cross-Agent Consistency Check
  // Micro-subagent 2: Contradiction Detection
  // Micro-subagent 3: Completeness Gate
  // Micro-subagent 4: Numerical Validator
  // Micro-subagent 5: Citation Verifier

  const validationPrompt = `You are ORACLE's post-synthesis validation engine. You are the FINAL quality gate after all specialist agents have produced their outputs and they have been synthesized into one deliverable.

ORIGINAL TASK:
"""
${originalTask.slice(0, 2000)}
"""

SYNTHESIZED OUTPUT:
"""
${synthesis.slice(0, 4000)}
"""

INDIVIDUAL AGENT RESULTS (for cross-reference):
"""
${agentResults.slice(0, 3000)}
"""

RUN THESE 5 VALIDATION CHECKS:

1. CROSS-AGENT CONSISTENCY
   - Do different sections of the synthesis contradict each other?
   - Do numbers/prices match across sections?
   - Are tool recommendations consistent throughout?
   - Are timelines realistic and non-contradictory?

2. CONTRADICTION DETECTION
   - Does any recommendation conflict with another?
   - Are there conflicting pricing or budget figures?
   - Do strategy recommendations align with each other?
   - Is there any advice that directly contradicts Indian market reality?

3. COMPLETENESS GATE
   - Does the synthesis address ALL aspects of the original task?
   - Are there any sections that feel incomplete or rushed?
   - Is there a clear "Next Step" at the end?
   - Are all sections client-ready (no placeholders, no TODOs)?

4. NUMERICAL VALIDATOR
   - Do all math calculations add up correctly?
   - Are all prices in INR with Indian formatting (₹1,50,000 not ₹150,000)?
   - Are percentage calculations correct?
   - Are budget allocations realistic for Indian market?

5. CITATION & FACT VERIFIER
   - Are all tool/platform recommendations real and currently available?
   - Are pricing estimates within realistic Indian market ranges?
   - Are there any claims that sound authoritative but may be fabricated?
   - Are Indian legal references (GST, SEBI, IT Act) correctly cited?

OUTPUT FORMAT (JSON only):
{
  "passed": <boolean — true if output passes all checks>,
  "issues": [
    {
      "check": "<consistency|contradiction|completeness|numerical|citation>",
      "severity": "<critical|high|medium|low>",
      "description": "<what's wrong>",
      "fix": "<exact text to change>",
      "replacement": "<corrected text>"
    }
  ],
  "correctedSynthesis": "<the FULL corrected synthesis if issues were found, otherwise null>",
  "overallConfidence": <0-100 score>,
  "summary": "<brief assessment>"
}

RULES:
- Be extremely strict — this is the last line of defense before client delivery
- If confidence < 70, include correctedSynthesis with all fixes applied
- If confidence >= 70 and only low-severity issues, set correctedSynthesis to null
- Never let placeholder text through: [INSERT], [TODO], [TBD]
- Never let USD pricing through in Indian context
- Never let contradictory recommendations through
- All prices must use Indian number formatting: ₹1,50,000 not ₹150,000`;

  const model = selectModel(originalTask, 'editor', availableProviders, 'standard');
  const startTime = Date.now();

  try {
    const result = await callAI(
      validationPrompt,
      'You are ORACLE validation engine. Respond only in valid JSON.',
      model.providerId,
      model.modelId
    );

    const timeMs = Date.now() - startTime;

    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(result.text);
    } catch {
      const cleaned = result.text.replace(/```json|```/g, '').trim();
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        const match = result.text.match(/\{[\s\S]*\}/);
        if (match) {
          try { parsed = JSON.parse(match[0]); } catch { /* ignore */ }
        }
      }
    }

    if (parsed && !parsed.passed && typeof parsed.correctedSynthesis === 'string' && parsed.correctedSynthesis.length > 0) {
      log.info('Post-synthesis validation applied corrections', {
        issues: Array.isArray(parsed.issues) ? parsed.issues.length : 0,
        confidence: parsed.overallConfidence,
      });
      return {
        correctedSynthesis: parsed.correctedSynthesis,
        tokens: result.tokens,
        provider: result.provider,
        model: result.model,
        costUsd: model.costEstimate.usd,
        timeMs,
      };
    }

    if (parsed && typeof parsed.overallConfidence === 'number') {
      log.info('Post-synthesis validation passed', { confidence: parsed.overallConfidence });
    }

    return {
      correctedSynthesis: null,
      tokens: result.tokens,
      provider: result.provider,
      model: result.model,
      costUsd: model.costEstimate.usd,
      timeMs,
    };
  } catch (e) {
    log.warn('Post-synthesis validation failed, returning original synthesis', { error: e instanceof Error ? e.message : 'Unknown' });
  }

  return { correctedSynthesis: null, tokens: 0, provider: 'error', model: 'error', costUsd: 0, timeMs: 0 };
}

// ─── Helper: Build Sub-Task Prompt ─────

function buildSubTaskPrompt(task: string, agent: string, contextPrefix: string, analysis: TaskAnalysis): string {
  // Use the centralized registry for agent descriptions
  const agentMetadata = getAgentMetadata(agent);
  const agentDescription = agentMetadata
    ? `You are ORACLE's specialist ${agent} agent. Your domain: ${agentMetadata.description}. Focus on this domain for the task below.`
    : `Focus on gathering data, tools, benchmarks, and current market information relevant to this task.`;

  // Get task breakdown if available
  const breakdownSection = analysis.breakdown
    ? `\n\nRECOMMENDED BREAKDOWN:\n${analysis.breakdown.map((b, i) => `${i + 1}. ${b}`).join('\n')}`
    : '';

  return `${contextPrefix}${agentDescription}

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
