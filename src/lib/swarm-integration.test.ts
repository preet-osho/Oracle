// ═══════════════════════════════════════
// ORACLE — Full Swarm Pipeline Integration Test
// Task analysis → Agent routing → Parallel/Sequential execution → Synthesis → Validation
// ═══════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { shouldUseSwarm, runSwarm } from './swarm';

// ─── Hoisted mocks ────────────────────

const {
  mockSelectModel,
  mockLogAgentPerformance,
  mockTrackTokenUsage,
  mockShouldDowngrade,
} = vi.hoisted(() => {
  const mockSelectModel = vi.fn().mockReturnValue({
    providerId: 'groq',
    modelId: 'llama-3.3-70b-versatile',
    tier: 'standard' as const,
    costEstimate: { usd: 0.001, tokens: 500 },
  });
  const mockLogAgentPerformance = vi.fn();
  const mockTrackTokenUsage = vi.fn().mockReturnValue(true);
  const mockShouldDowngrade = vi.fn().mockReturnValue(undefined);
  return { mockSelectModel, mockLogAgentPerformance, mockTrackTokenUsage, mockShouldDowngrade };
});

vi.mock('@/lib/model-selector', () => ({
  selectModel: (...args: unknown[]) => mockSelectModel(...args),
  logAgentPerformance: (...args: unknown[]) => mockLogAgentPerformance(...args),
  shouldDowngradeDueToBudget: (...args: unknown[]) => mockShouldDowngrade(...args),
  trackTokenUsage: (...args: unknown[]) => mockTrackTokenUsage(...args),
}));

const {
  mockCanStartSwarm,
  mockRegisterSwarmExecution,
  mockShouldContinueSwarm,
  mockCompleteSwarmExecution,
  mockIsWithinCostLimit,
} = vi.hoisted(() => {
  const mockCanStartSwarm = vi.fn().mockReturnValue(null);
  const mockRegisterSwarmExecution = vi.fn().mockReturnValue('exec-1');
  const mockShouldContinueSwarm = vi.fn().mockReturnValue(null);
  const mockCompleteSwarmExecution = vi.fn();
  const mockIsWithinCostLimit = vi.fn().mockReturnValue(true);
  return {
    mockCanStartSwarm,
    mockRegisterSwarmExecution,
    mockShouldContinueSwarm,
    mockCompleteSwarmExecution,
    mockIsWithinCostLimit,
  };
});

vi.mock('@/lib/emergency-stop', () => ({
  canStartSwarm: (...args: unknown[]) => mockCanStartSwarm(...args),
  registerSwarmExecution: (...args: unknown[]) => mockRegisterSwarmExecution(...args),
  shouldContinueSwarm: (...args: unknown[]) => mockShouldContinueSwarm(...args),
  completeSwarmExecution: (...args: unknown[]) => mockCompleteSwarmExecution(...args),
  isWithinCostLimit: (...args: unknown[]) => mockIsWithinCostLimit(...args),
}));

vi.mock('@/lib/router', () => ({
  NeverStopRouter: {
    getAllKeys: vi.fn().mockReturnValue({ groq: true }),
  },
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ─── Helpers ──────────────────────────

function makeCallAI(responses: string[]) {
  let callIndex = 0;
  return vi.fn().mockImplementation(async () => {
    const text = responses[callIndex] ?? responses[responses.length - 1];
    callIndex++;
    return {
      text,
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      tokens: 200,
    };
  });
}

const COMPLEX_TASK = `
Create a comprehensive marketing strategy for a dental clinic in Mumbai.
Include SEO, PPC, social media, and content marketing plans.
Budget: ₹5,00,000 per month. Target: 300 new patients in 6 months.
Also review the legal compliance for healthcare advertising and run a security audit on the clinic website.
`;

const SIMPLE_TASK = 'Say hello';

// ─── Tests ─────────────────────────────

describe('Full Swarm Pipeline Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanStartSwarm.mockReturnValue(null);
    mockRegisterSwarmExecution.mockReturnValue('exec-1');
    mockShouldContinueSwarm.mockReturnValue(null);
    mockIsWithinCostLimit.mockReturnValue(true);
    mockTrackTokenUsage.mockReturnValue(true);
    mockShouldDowngrade.mockReturnValue(undefined);
    mockSelectModel.mockReturnValue({
      providerId: 'groq',
      modelId: 'llama-3.3-70b-versatile',
      tier: 'standard' as const,
      costEstimate: { usd: 0.001, tokens: 500 },
    });
  });

  // ── shouldUseSwarm ──

  describe('shouldUseSwarm — Task Analysis → Routing', () => {
    it('routes simple tasks without swarm (single agent, low complexity)', async () => {
      const callAI = vi.fn();
      const result = await shouldUseSwarm(SIMPLE_TASK, callAI, ['groq']);

      expect(result.needs).toBe(false);
      expect(callAI).not.toHaveBeenCalled(); // orchestrator not invoked for simple tasks
    });

    it('routes complex tasks through orchestrator (multi-agent, high complexity)', async () => {
      const orchestratorResponse = JSON.stringify({
        needs_swarm: true,
        agents: ['researcher', 'writer', 'marketer', 'legal'],
        parallel: true,
      });
      // shouldUseSwarm's callAI expects (prompt: string) => Promise<string>
      const callAI = vi.fn().mockResolvedValue(orchestratorResponse);

      const result = await shouldUseSwarm(COMPLEX_TASK, callAI, ['groq']);

      expect(result.needs).toBe(true);
      expect(result.agents).toContain('researcher');
      expect(result.agents).toContain('writer');
      expect(result.parallel).toBe(true);
      expect(result.analysis).toBeDefined();
      expect(callAI).toHaveBeenCalledTimes(1);
    });

    it('falls back to analysis-based routing when orchestrator fails', async () => {
      const callAI = vi.fn().mockRejectedValue(new Error('API error'));

      const result = await shouldUseSwarm(COMPLEX_TASK, callAI, ['groq']);

      // Should still return a result based on task analysis
      expect(result.analysis).toBeDefined();
      expect(Array.isArray(result.agents)).toBe(true);
    });

    it('falls back when orchestrator returns invalid JSON', async () => {
      const callAI = vi.fn().mockResolvedValue('This is not valid JSON at all');

      const result = await shouldUseSwarm(COMPLEX_TASK, callAI, ['groq']);

      expect(result.analysis).toBeDefined();
    });
  });

  // ── runSwarm: Parallel Execution ──

  describe('runSwarm — Parallel Execution → Synthesis → Validation', () => {
    it('runs agents in parallel, synthesizes, and validates', async () => {
      const agentOutputs = [
        { text: '## Research\nBudget analysis: ₹5,00,000/month for SEO and PPC.', provider: 'groq', model: 'llama-3.3-70b-versatile', tokens: 200 },
        { text: '## Writer\nContent plan: 4 blog posts per month targeting dental implants.', provider: 'groq', model: 'llama-3.3-70b-versatile', tokens: 200 },
        { text: '## Marketer\nSocial media: Instagram + Google Ads. ₹3,00,000 PPC, ₹2,00,000 content.', provider: 'groq', model: 'llama-3.3-70b-versatile', tokens: 200 },
      ];
      const synthesisOutput = { text: '## Complete Marketing Strategy\nBudget: ₹5,00,000/month.\nSEO: ₹2,00,000. PPC: ₹3,00,000.\n\n**Next Step:** Approve budget.', provider: 'groq', model: 'llama-3.3-70b-versatile', tokens: 300 };
      const validationOutput = { text: JSON.stringify({ passed: true, issues: [], correctedSynthesis: null, overallConfidence: 92, summary: 'All checks passed.' }), provider: 'groq', model: 'llama-3.3-70b-versatile', tokens: 200 };

      let callIdx = 0;
      const allOutputs = [...agentOutputs, synthesisOutput, validationOutput];
      const callAI = vi.fn().mockImplementation(async () => {
        const out = allOutputs[callIdx] ?? allOutputs[allOutputs.length - 1];
        callIdx++;
        return out;
      });

      const result = await runSwarm(
        COMPLEX_TASK,
        ['researcher', 'writer', 'marketer'],
        true, // parallel
        {},
        callAI
      );

      // Agent results: 3 agents + 1 synthesizer + possibly 1 validation
      expect(result.agentResults.length).toBeGreaterThanOrEqual(4);

      // Verify all 3 agents ran
      const agentNames = result.agentResults.map(r => r.agent);
      expect(agentNames).toContain('researcher');
      expect(agentNames).toContain('writer');
      expect(agentNames).toContain('marketer');
      expect(agentNames).toContain('synthesizer');

      // Synthesis should contain the synthesized text
      expect(result.synthesis).toContain('Marketing Strategy');

      // Total cost should be positive
      expect(result.totalCostUsd).toBeGreaterThanOrEqual(0);

      // Emergency stop should be cleaned up
      expect(mockCompleteSwarmExecution).toHaveBeenCalled();
    });

    it('fires onAgentComplete callback for each agent', async () => {
      const callAI = vi.fn()
        .mockResolvedValueOnce({ text: 'Research done', provider: 'groq', model: 'm', tokens: 100 })
        .mockResolvedValueOnce({ text: 'Writer done', provider: 'groq', model: 'm', tokens: 100 })
        .mockResolvedValueOnce({ text: '## Synthesis\nComplete.\n\n**Next Step:** Review.', provider: 'groq', model: 'm', tokens: 100 })
        .mockResolvedValueOnce({ text: JSON.stringify({ passed: true, issues: [], overallConfidence: 90 }), provider: 'groq', model: 'm', tokens: 100 });

      const onAgentComplete = vi.fn();
      await runSwarm(COMPLEX_TASK, ['researcher', 'writer'], true, {}, callAI, onAgentComplete);

      // Should have been called for each agent
      const completedAgents = onAgentComplete.mock.calls.map((c: unknown[]) => c[0]);
      expect(completedAgents).toContain('researcher');
      expect(completedAgents).toContain('writer');
    });
  });

  // ── runSwarm: Sequential Execution ──

  describe('runSwarm — Sequential Execution → Synthesis → Validation', () => {
    it('runs agents sequentially, passing previous results as context', async () => {
      const callAI = vi.fn()
        .mockResolvedValueOnce({ text: '## Research\nSEO keywords identified.', provider: 'groq', model: 'm', tokens: 100 })
        .mockResolvedValueOnce({ text: '## Writer\nBlog post drafted with keywords.', provider: 'groq', model: 'm', tokens: 100 })
        .mockResolvedValueOnce({ text: '## Synthesis\nComplete strategy.\n\n**Next Step:** Review.', provider: 'groq', model: 'm', tokens: 100 })
        .mockResolvedValueOnce({ text: JSON.stringify({ passed: true, issues: [], overallConfidence: 88 }), provider: 'groq', model: 'm', tokens: 100 });

      const result = await runSwarm(
        COMPLEX_TASK,
        ['researcher', 'writer'],
        false, // sequential
        {},
        callAI
      );

      expect(result.agentResults.length).toBeGreaterThanOrEqual(3);
      expect(result.synthesis).toContain('Complete strategy');

      // Verify sequential: second agent prompt should contain previous results
      const writerCall = callAI.mock.calls[1];
      expect(writerCall[0]).toContain('Previous Agent Results');
    });
  });

  // ── Context Integration ──

  describe('Context Integration', () => {
    it('includes RAG context in agent prompts', async () => {
      const callAI = vi.fn()
        .mockResolvedValueOnce({ text: '## Research\nDone.', provider: 'groq', model: 'm', tokens: 100 })
        .mockResolvedValueOnce({ text: '## Synthesis\nDone.\n\n**Next Step:** Approve.', provider: 'groq', model: 'm', tokens: 100 })
        .mockResolvedValueOnce({ text: JSON.stringify({ passed: true, issues: [], overallConfidence: 90 }), provider: 'groq', model: 'm', tokens: 100 });

      await runSwarm(
        COMPLEX_TASK,
        ['researcher'],
        true,
        { rag: 'Patient data from CSV: 500 patients, avg spend ₹15,000' },
        callAI
      );

      // The researcher prompt should contain RAG context
      const researcherPrompt = callAI.mock.calls[0][0];
      expect(researcherPrompt).toContain('Patient data from CSV');
    });

    it('includes memory context in agent prompts', async () => {
      const callAI = vi.fn()
        .mockResolvedValueOnce({ text: '## Research\nDone.', provider: 'groq', model: 'm', tokens: 100 })
        .mockResolvedValueOnce({ text: '## Synthesis\nDone.\n\n**Next Step:** Approve.', provider: 'groq', model: 'm', tokens: 100 })
        .mockResolvedValueOnce({ text: JSON.stringify({ passed: true, issues: [], overallConfidence: 90 }), provider: 'groq', model: 'm', tokens: 100 });

      await runSwarm(
        COMPLEX_TASK,
        ['researcher'],
        true,
        { memory: 'Client prefers formal tone. Previous campaign ROI: 2.5x.' },
        callAI
      );

      const researcherPrompt = callAI.mock.calls[0][0];
      expect(researcherPrompt).toContain('Client prefers formal tone');
    });

    it('includes project context in agent prompts', async () => {
      const callAI = vi.fn()
        .mockResolvedValueOnce({ text: '## Research\nDone.', provider: 'groq', model: 'm', tokens: 100 })
        .mockResolvedValueOnce({ text: '## Synthesis\nDone.\n\n**Next Step:** Approve.', provider: 'groq', model: 'm', tokens: 100 })
        .mockResolvedValueOnce({ text: JSON.stringify({ passed: true, issues: [], overallConfidence: 90 }), provider: 'groq', model: 'm', tokens: 100 });

      await runSwarm(
        COMPLEX_TASK,
        ['researcher'],
        true,
        {
          project: {
            clientName: 'Dr. Patel Dental Clinic',
            industry: 'Healthcare',
            city: 'Mumbai',
            service: 'SEO + PPC',
            value: '₹5,00,000/month',
          } as any,
        },
        callAI
      );

      const researcherPrompt = callAI.mock.calls[0][0];
      expect(researcherPrompt).toContain('Dr. Patel Dental Clinic');
      expect(researcherPrompt).toContain('Mumbai');
    });
  });

  // ── Emergency Stop ──

  describe('Emergency Stop Integration', () => {
    it('blocks swarm when canStartSwarm returns a reason', async () => {
      mockCanStartSwarm.mockReturnValue('Rate limit exceeded');

      const callAI = vi.fn();
      const result = await runSwarm(COMPLEX_TASK, ['researcher'], true, {}, callAI);

      expect(result.synthesis).toContain('Blocked');
      expect(result.synthesis).toContain('Rate limit exceeded');
      expect(result.agentResults).toHaveLength(0);
      expect(callAI).not.toHaveBeenCalled();
    });

    it('blocks when registerSwarmExecution returns null', async () => {
      mockRegisterSwarmExecution.mockReturnValue(null);

      const callAI = vi.fn();
      const result = await runSwarm(COMPLEX_TASK, ['researcher'], true, {}, callAI);

      expect(result.synthesis).toContain('Blocked');
      expect(callAI).not.toHaveBeenCalled();
    });

    it('aborts when cost limit exceeded', async () => {
      mockIsWithinCostLimit.mockReturnValue(false);

      const callAI = vi.fn();
      const result = await runSwarm(COMPLEX_TASK, ['researcher'], true, {}, callAI);

      expect(result.synthesis).toContain('Aborted');
      expect(result.synthesis).toContain('budget limit');
      expect(callAI).not.toHaveBeenCalled();
    });

    it('aborts agent mid-execution when shouldContinueSwarm returns reason', async () => {
      let callCount = 0;
      mockShouldContinueSwarm.mockImplementation(() => {
        callCount++;
        return callCount > 1 ? 'Budget exceeded mid-run' : null;
      });

      const callAI = vi.fn()
        .mockResolvedValueOnce({ text: '## Research\nDone.', provider: 'groq', model: 'm', tokens: 100 })
        .mockResolvedValueOnce({ text: '## Synthesis\nPartial.\n\n**Next Step:** Continue.', provider: 'groq', model: 'm', tokens: 100 })
        .mockResolvedValueOnce({ text: JSON.stringify({ passed: true, issues: [], overallConfidence: 80 }), provider: 'groq', model: 'm', tokens: 100 });

      const result = await runSwarm(
        COMPLEX_TASK,
        ['researcher', 'writer'],
        true,
        {},
        callAI
      );

      // At least the first agent should have been aborted
      const abortedAgents = result.agentResults.filter(r => r.result.includes('Aborted'));
      expect(abortedAgents.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Error Handling ──

  describe('Error Handling', () => {
    it('handles agent failure gracefully (one agent fails, others continue)', async () => {
      const callAI = vi.fn()
        .mockResolvedValueOnce({ text: '## Research\nDone.', provider: 'groq', model: 'm', tokens: 100 })
        .mockRejectedValueOnce(new Error('Agent timeout'))
        .mockResolvedValueOnce({ text: '## Synthesis\nPartial result.\n\n**Next Step:** Retry.', provider: 'groq', model: 'm', tokens: 100 })
        .mockResolvedValueOnce({ text: JSON.stringify({ passed: true, issues: [], overallConfidence: 75 }), provider: 'groq', model: 'm', tokens: 100 });

      const result = await runSwarm(
        COMPLEX_TASK,
        ['researcher', 'writer'],
        true,
        {},
        callAI
      );

      // Should have error result for writer, success for researcher
      const errorResults = result.agentResults.filter(r => r.result.includes('Error'));
      expect(errorResults.length).toBe(1);
      expect(errorResults[0].agent).toBe('writer');

      // Synthesis should still work
      expect(result.synthesis).toContain('Partial result');
    });

    it('handles synthesis failure gracefully (returns concatenated results)', async () => {
      const callAI = vi.fn()
        .mockResolvedValueOnce({ text: '## Research\nDone.', provider: 'groq', model: 'm', tokens: 100 })
        .mockRejectedValueOnce(new Error('Synthesis failed'));

      const result = await runSwarm(
        COMPLEX_TASK,
        ['researcher'],
        true,
        {},
        callAI
      );

      // Fallback: concatenated results
      expect(result.synthesis).toContain('Research');
      expect(result.agentResults.some(r => r.agent === 'synthesizer')).toBe(true);
    });
  });

  // ── Validation Pipeline Integration ──

  describe('Post-Synthesis Validation Pipeline', () => {
    it('applies validation corrections when validation finds critical issues', async () => {
      const correctedSynthesis = '## Corrected Strategy\nBudget: ₹5,00,000.\n\n**Next Step:** Approved.';

      const callAI = vi.fn()
        .mockResolvedValueOnce({ text: '## Research\nDone.', provider: 'groq', model: 'm', tokens: 100 })
        .mockResolvedValueOnce({ text: '## Synthesis\nBudget: ₹6,00,000.\n\n**Next Step:** Review.', provider: 'groq', model: 'm', tokens: 100 })
        .mockResolvedValueOnce({
          text: JSON.stringify({
            passed: false,
            issues: [{ check: 'consistency', severity: 'critical', description: 'Budget mismatch' }],
            correctedSynthesis,
            overallConfidence: 45,
            summary: 'Budget corrected.',
          }),
          provider: 'groq',
          model: 'm',
          tokens: 200,
        });

      const result = await runSwarm(
        COMPLEX_TASK,
        ['researcher'],
        true,
        {},
        callAI
      );

      // Validation should have applied corrections
      expect(result.synthesis).toBe(correctedSynthesis);
      const validationResult = result.agentResults.find(r => r.agent === 'validation');
      expect(validationResult).toBeDefined();
      expect(validationResult!.result).toBe(correctedSynthesis);
    });

    it('preserves original synthesis when validation passes', async () => {
      const originalSynthesis = '## Strategy\nAll good.\n\n**Next Step:** Approve.';

      const callAI = vi.fn()
        .mockResolvedValueOnce({ text: '## Research\nDone.', provider: 'groq', model: 'm', tokens: 100 })
        .mockResolvedValueOnce({ text: originalSynthesis, provider: 'groq', model: 'm', tokens: 100 })
        .mockResolvedValueOnce({
          text: JSON.stringify({
            passed: true,
            issues: [],
            correctedSynthesis: null,
            overallConfidence: 95,
            summary: 'All checks passed.',
          }),
          provider: 'groq',
          model: 'm',
          tokens: 200,
        });

      const result = await runSwarm(
        COMPLEX_TASK,
        ['researcher'],
        true,
        {},
        callAI
      );

      expect(result.synthesis).toBe(originalSynthesis);
      // No validation result in agentResults when validation passes
      const validationResult = result.agentResults.find(r => r.agent === 'validation');
      expect(validationResult).toBeUndefined();
    });

    it('preserves original when validation API call fails', async () => {
      const originalSynthesis = '## Strategy\nGood enough.\n\n**Next Step:** Review.';

      const callAI = vi.fn()
        .mockResolvedValueOnce({ text: '## Research\nDone.', provider: 'groq', model: 'm', tokens: 100 })
        .mockResolvedValueOnce({ text: originalSynthesis, provider: 'groq', model: 'm', tokens: 100 })
        .mockRejectedValueOnce(new Error('Validation API error'));

      const result = await runSwarm(
        COMPLEX_TASK,
        ['researcher'],
        true,
        {},
        callAI
      );

      // Original synthesis preserved despite validation failure
      expect(result.synthesis).toBe(originalSynthesis);
    });
  });

  // ── Full Pipeline End-to-End ──

  describe('Full Pipeline E2E', () => {
    it('complete pipeline: analysis → parallel routing → 3 agents → synthesis → validation pass', async () => {
      const callAI = vi.fn()
        // 3 agent calls (parallel)
        .mockResolvedValueOnce({ text: '## Research\nSEO analysis complete.', provider: 'groq', model: 'm', tokens: 150 })
        .mockResolvedValueOnce({ text: '## Writer\nContent plan ready.', provider: 'groq', model: 'm', tokens: 150 })
        .mockResolvedValueOnce({ text: '## Marketer\nCampaign strategy defined.', provider: 'groq', model: 'm', tokens: 150 })
        // Synthesis
        .mockResolvedValueOnce({
          text: '## Complete Marketing Strategy\nSEO: ₹2,00,000. PPC: ₹3,00,000. Total: ₹5,00,000.\n\n**Next Step:** Approve budget.',
          provider: 'groq', model: 'm', tokens: 300,
        })
        // Validation
        .mockResolvedValueOnce({
          text: JSON.stringify({ passed: true, issues: [], overallConfidence: 94, summary: 'All checks passed.' }),
          provider: 'groq', model: 'm', tokens: 200,
        });

      const onAgentComplete = vi.fn();
      const result = await runSwarm(
        COMPLEX_TASK,
        ['researcher', 'writer', 'marketer'],
        true,
        {
          rag: 'Clinic has 500 Google reviews, 4.8 rating',
          memory: 'Client wants aggressive growth',
          project: { clientName: 'Smile Dental', industry: 'Healthcare', city: 'Mumbai', service: 'SEO', value: '₹5,00,000' } as any,
        },
        callAI,
        onAgentComplete
      );

      // Verify full pipeline output
      expect(result.synthesis).toContain('Marketing Strategy');
      expect(result.synthesis).toContain('₹5,00,000');
      expect(result.synthesis).toContain('Next Step');

      // Verify all agents ran
      const agentNames = result.agentResults.map(r => r.agent);
      expect(agentNames).toContain('researcher');
      expect(agentNames).toContain('writer');
      expect(agentNames).toContain('marketer');
      expect(agentNames).toContain('synthesizer');

      // Verify callbacks fired
      expect(onAgentComplete).toHaveBeenCalledTimes(3);

      // Verify emergency stop cleanup
      expect(mockCompleteSwarmExecution).toHaveBeenCalled();

      // Verify total cost
      expect(result.totalCostUsd).toBeGreaterThanOrEqual(0);
    });

    it('complete pipeline: sequential routing → 2 agents → synthesis → validation corrects', async () => {
      const correctedSynthesis = '## Strategy (Corrected)\nBudget: ₹5,00,000.\n\n**Next Step:** Approved.';

      const callAI = vi.fn()
        .mockResolvedValueOnce({ text: '## Research\nData collected.', provider: 'groq', model: 'm', tokens: 100 })
        .mockResolvedValueOnce({ text: '## Writer\nDraft ready.', provider: 'groq', model: 'm', tokens: 100 })
        .mockResolvedValueOnce({
          text: '## Synthesis\nBudget: ₹6,00,000.\n\n**Next Step:** Review.',
          provider: 'groq', model: 'm', tokens: 200,
        })
        .mockResolvedValueOnce({
          text: JSON.stringify({
            passed: false,
            issues: [{ check: 'numerical', severity: 'critical', description: 'Budget mismatch' }],
            correctedSynthesis,
            overallConfidence: 40,
            summary: 'Budget corrected.',
          }),
          provider: 'groq', model: 'm', tokens: 200,
        });

      const result = await runSwarm(
        COMPLEX_TASK,
        ['researcher', 'writer'],
        false, // sequential
        {},
        callAI
      );

      // Validation should have corrected the synthesis
      expect(result.synthesis).toBe(correctedSynthesis);

      // Should have 2 agents + 1 synthesizer + 1 validation
      const agentNames = result.agentResults.map(r => r.agent);
      expect(agentNames).toContain('researcher');
      expect(agentNames).toContain('writer');
      expect(agentNames).toContain('synthesizer');
      expect(agentNames).toContain('validation');
    });
  });
});
