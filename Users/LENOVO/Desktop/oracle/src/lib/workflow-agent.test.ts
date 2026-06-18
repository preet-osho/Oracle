import { describe, it, expect } from 'vitest';
import { WORKFLOW_AGENT_PROMPT } from './system-prompt';
import {
  extractFirstJson,
  parseWorkflowResponse,
  validateWorkflowOutput,
  detectCyclesInPlan,
  topologicalSort,
  parallelExecutionGroups,
  VALID_AGENTS,
  type WorkflowOutput,
} from './workflow-validation';

// ─── Test Fixtures ─────────────────────

const VALID_WORKFLOW_OUTPUT: WorkflowOutput = {
  workflowName: 'Website Launch Pipeline',
  phases: [
    { step: 1, agent: 'researcher', task: 'Market research', inputFrom: 'Client brief', outputTo: 'Research report', qualityGate: false, estimatedTime: '2 hours' },
    { step: 2, agent: 'strategist', task: 'Positioning strategy', inputFrom: 'Research report', outputTo: 'Strategy doc', qualityGate: true, estimatedTime: '1 hour' },
    { step: 3, agent: 'designer', task: 'UI/UX design', inputFrom: 'Strategy doc', outputTo: 'Design specs', qualityGate: false, estimatedTime: '3 hours' },
    { step: 4, agent: 'developer', task: 'Build website', inputFrom: 'Design specs', outputTo: 'Working site', qualityGate: true, estimatedTime: '8 hours' },
    { step: 5, agent: 'qa', task: 'Testing & QA', inputFrom: 'Working site', outputTo: 'QA report', qualityGate: false, estimatedTime: '2 hours' },
    { step: 6, agent: 'marketer', task: 'Launch campaign', inputFrom: 'QA report', outputTo: 'Launch plan', qualityGate: false, estimatedTime: '1 hour' },
  ],
  totalSteps: 6,
  estimatedTotalTime: '17 hours',
  dependencies: [],
};

const MOCK_AI_RESPONSE_WITHOUT_FENCES = JSON.stringify(VALID_WORKFLOW_OUTPUT);

const MOCK_AI_RESPONSE_WITH_FENCES = 'Here is the workflow plan:\n```json\n' + JSON.stringify(VALID_WORKFLOW_OUTPUT, null, 2) + '\n```\nHope this helps!';

const MOCK_AI_RESPONSE_WITH_SURROUNDING_TEXT = 'Based on your request, here is the workflow:\n\n' + JSON.stringify(VALID_WORKFLOW_OUTPUT) + '\n\nLet me know if you need changes.';

// ═══════════════════════════════════════
// Prompt Content Tests
// ═══════════════════════════════════════

describe('WORKFLOW_AGENT_PROMPT', () => {
  it('is a non-empty string', () => {
    expect(typeof WORKFLOW_AGENT_PROMPT).toBe('string');
    expect(WORKFLOW_AGENT_PROMPT.length).toBeGreaterThan(100);
  });

  it('contains the agent identity statement', () => {
    expect(WORKFLOW_AGENT_PROMPT).toContain('workflow orchestrator agent');
  });

  describe('JSON output format', () => {
    it('contains all required top-level JSON fields', () => {
      for (const field of ['workflowName', 'phases', 'totalSteps', 'estimatedTotalTime', 'dependencies']) {
        expect(WORKFLOW_AGENT_PROMPT).toContain(`"${field}"`);
      }
    });

    it('contains all required phase-level fields', () => {
      for (const field of ['step', 'agent', 'task', 'inputFrom', 'outputTo', 'qualityGate', 'estimatedTime']) {
        expect(WORKFLOW_AGENT_PROMPT).toContain(`"${field}"`);
      }
    });
  });

  describe('valid agent types', () => {
    it('mentions key agents in the chain examples (researcher, strategist, designer, developer, qa, marketer, analyst, writer, coordinator, finance)', () => {
      // The WORKFLOW_AGENT_PROMPT references these agents in its 3 chain examples
      for (const agent of ['researcher', 'strategist', 'designer', 'developer', 'qa', 'marketer', 'analyst', 'writer', 'coordinator', 'finance']) {
        expect(WORKFLOW_AGENT_PROMPT).toContain(agent);
      }
    });

    it('includes 3 agent chaining examples', () => {
      expect(WORKFLOW_AGENT_PROMPT).toContain('Website Launch');
      expect(WORKFLOW_AGENT_PROMPT).toContain('Marketing Campaign');
      expect(WORKFLOW_AGENT_PROMPT).toContain('Product Launch');
    });
  });

  describe('constraints', () => {
    it('specifies max 8 steps per workflow', () => {
      expect(WORKFLOW_AGENT_PROMPT).toContain('Max 8 steps');
    });

    it('requires quality gates in every workflow', () => {
      expect(WORKFLOW_AGENT_PROMPT).toContain('quality gate');
    });

    it('requires each step to be self-contained', () => {
      expect(WORKFLOW_AGENT_PROMPT).toContain('self-contained');
    });

    it('mentions parallel execution of independent steps', () => {
      expect(WORKFLOW_AGENT_PROMPT).toContain('parallel');
    });

    it('requires complete, client-ready deliverables', () => {
      expect(WORKFLOW_AGENT_PROMPT).toContain('client-ready');
    });
  });

  describe('domain rules', () => {
    it('requires INR pricing', () => {
      expect(WORKFLOW_AGENT_PROMPT).toContain('INR');
    });

    it('requires specific tool names', () => {
      expect(WORKFLOW_AGENT_PROMPT).toContain('tool names specific');
    });

    it('requires India context', () => {
      expect(WORKFLOW_AGENT_PROMPT).toContain('India');
    });

    it('includes the professional quality standard', () => {
      expect(WORKFLOW_AGENT_PROMPT).toContain('₹50,000+ client');
    });

    it('forbids placeholders', () => {
      expect(WORKFLOW_AGENT_PROMPT).toContain('no placeholders');
    });
  });

  describe('specialization areas', () => {
    it('covers all 5 workflow specializations', () => {
      expect(WORKFLOW_AGENT_PROMPT).toContain('PIPELINE DESIGN');
      expect(WORKFLOW_AGENT_PROMPT).toContain('AGENT CHAINING');
      expect(WORKFLOW_AGENT_PROMPT).toContain('QUALITY GATES');
      expect(WORKFLOW_AGENT_PROMPT).toContain('HANDOFF MANAGEMENT');
      expect(WORKFLOW_AGENT_PROMPT).toContain('PARALLEL OPTIMIZATION');
    });
  });

  describe('workflow method', () => {
    it('includes all 5 method steps', () => {
      expect(WORKFLOW_AGENT_PROMPT).toContain('DECOMPOSE');
      expect(WORKFLOW_AGENT_PROMPT).toContain('ASSIGN');
      expect(WORKFLOW_AGENT_PROMPT).toContain('SEQUENCE');
      expect(WORKFLOW_AGENT_PROMPT).toContain('CONTEXT CHAIN');
      expect(WORKFLOW_AGENT_PROMPT).toContain('QUALITY CHECKS');
    });
  });

  describe('phase structure', () => {
    it('defines step numbering', () => {
      expect(WORKFLOW_AGENT_PROMPT).toContain('"step": 1');
    });

    it('defines agent assignment per phase', () => {
      expect(WORKFLOW_AGENT_PROMPT).toContain('"agent":');
    });

    it('defines input/output chain between phases', () => {
      expect(WORKFLOW_AGENT_PROMPT).toContain('"inputFrom"');
      expect(WORKFLOW_AGENT_PROMPT).toContain('"outputTo"');
    });

    it('defines qualityGate as boolean', () => {
      expect(WORKFLOW_AGENT_PROMPT).toContain('"qualityGate": <boolean');
    });

    it('defines totalSteps at root level', () => {
      expect(WORKFLOW_AGENT_PROMPT).toContain('"totalSteps": <number>');
    });

    it('defines dependencies array at root level', () => {
      expect(WORKFLOW_AGENT_PROMPT).toContain('"dependencies": [');
    });
  });

  describe('chain examples', () => {
    it('Website Launch chains researcher → strategist → designer → developer → qa → marketer', () => {
      const idx = WORKFLOW_AGENT_PROMPT.indexOf('Website Launch');
      const slice = WORKFLOW_AGENT_PROMPT.slice(idx, idx + 300);
      for (const agent of ['researcher', 'strategist', 'designer', 'developer', 'qa', 'marketer']) {
        expect(slice).toContain(agent);
      }
    });

    it('Marketing Campaign chains researcher → analyst → marketer → writer → coordinator', () => {
      const idx = WORKFLOW_AGENT_PROMPT.indexOf('Marketing Campaign');
      const slice = WORKFLOW_AGENT_PROMPT.slice(idx, idx + 300);
      for (const agent of ['researcher', 'analyst', 'marketer', 'writer', 'coordinator']) {
        expect(slice).toContain(agent);
      }
    });

    it('Product Launch chains strategist → finance → designer → writer → marketer → coordinator', () => {
      const idx = WORKFLOW_AGENT_PROMPT.indexOf('Product Launch');
      const slice = WORKFLOW_AGENT_PROMPT.slice(idx, idx + 300);
      for (const agent of ['strategist', 'finance', 'designer', 'writer', 'marketer', 'coordinator']) {
        expect(slice).toContain(agent);
      }
    });
  });

  describe('verification instructions', () => {
    it('includes VERIFY instruction', () => {
      expect(WORKFLOW_AGENT_PROMPT).toContain('VERIFY before outputting');
    });

    it('verifies sequential steps', () => {
      expect(WORKFLOW_AGENT_PROMPT).toContain('steps are sequential');
    });

    it('verifies quality gates at critical points', () => {
      expect(WORKFLOW_AGENT_PROMPT).toContain('quality gates at critical points');
    });
  });
});

// ═══════════════════════════════════════
// Output Validation Tests
// ═══════════════════════════════════════

describe('extractFirstJson', () => {
  it('extracts JSON from plain text', () => {
    const json = '{"a": 1}';
    expect(extractFirstJson(json)).toBe(json);
  });

  it('extracts JSON from surrounding text', () => {
    const result = extractFirstJson('Here is the result: {"a": 1} hope this helps');
    expect(result).toBe('{"a": 1}');
  });

  it('returns null for text without JSON', () => {
    expect(extractFirstJson('no json here')).toBeNull();
  });

  it('handles nested braces', () => {
    const json = '{"a": {"b": {"c": 1}}}';
    expect(extractFirstJson(json)).toBe(json);
  });

  it('handles strings containing braces', () => {
    const json = '{"msg": "hello {world}"}';
    expect(extractFirstJson(json)).toBe(json);
  });
});

describe('parseWorkflowResponse', () => {
  it('parses plain JSON', () => {
    const { parsed, error } = parseWorkflowResponse(MOCK_AI_RESPONSE_WITHOUT_FENCES);
    expect(error).toBeNull();
    expect(parsed).not.toBeNull();
    expect(parsed!.workflowName).toBe('Website Launch Pipeline');
    expect(parsed!.phases).toHaveLength(6);
  });

  it('parses JSON wrapped in markdown code fences', () => {
    const { parsed, error } = parseWorkflowResponse(MOCK_AI_RESPONSE_WITH_FENCES);
    expect(error).toBeNull();
    expect(parsed).not.toBeNull();
    expect(parsed!.phases).toHaveLength(6);
  });

  it('parses JSON with surrounding text', () => {
    const { parsed, error } = parseWorkflowResponse(MOCK_AI_RESPONSE_WITH_SURROUNDING_TEXT);
    expect(error).toBeNull();
    expect(parsed).not.toBeNull();
    expect(parsed!.totalSteps).toBe(6);
  });

  it('returns error for non-JSON text', () => {
    const { parsed, error } = parseWorkflowResponse('This is not JSON at all');
    expect(parsed).toBeNull();
    expect(error).toContain('No valid JSON');
  });

  it('returns error for JSON that does not match schema', () => {
    const { parsed, error } = parseWorkflowResponse('{"foo": "bar"}');
    expect(parsed).toBeNull();
    expect(error).toBeDefined();
  });
});

describe('validateWorkflowOutput', () => {
  it('validates a correct workflow output', () => {
    const result = validateWorkflowOutput(VALID_WORKFLOW_OUTPUT);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects empty workflowName', () => {
    const output = { ...VALID_WORKFLOW_OUTPUT, workflowName: '' };
    const result = validateWorkflowOutput(output);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('workflowName'))).toBe(true);
  });

  it('rejects empty phases array', () => {
    const output = { ...VALID_WORKFLOW_OUTPUT, phases: [], totalSteps: 0 };
    const result = validateWorkflowOutput(output);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('phases'))).toBe(true);
  });

  it('rejects more than 8 phases', () => {
    const phases = Array.from({ length: 9 }, (_, i) => ({
      step: i + 1, agent: 'researcher', task: `Task ${i + 1}`, inputFrom: 'input', outputTo: 'output', qualityGate: false, estimatedTime: '1h',
    }));
    const output = { ...VALID_WORKFLOW_OUTPUT, phases, totalSteps: 9 };
    const result = validateWorkflowOutput(output);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('max 8'))).toBe(true);
  });

  it('rejects invalid agent type', () => {
    const phases = [{ ...VALID_WORKFLOW_OUTPUT.phases[0], agent: 'invalid-agent' }];
    const output = { ...VALID_WORKFLOW_OUTPUT, phases, totalSteps: 1 };
    const result = validateWorkflowOutput(output);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('not a valid agent type'))).toBe(true);
  });

  it('rejects non-sequential step numbering', () => {
    const phases = [
      { ...VALID_WORKFLOW_OUTPUT.phases[0], step: 1 },
      { ...VALID_WORKFLOW_OUTPUT.phases[1], step: 5 }, // skip to 5
    ];
    const output = { ...VALID_WORKFLOW_OUTPUT, phases, totalSteps: 2 };
    const result = validateWorkflowOutput(output);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('should be 2'))).toBe(true);
  });

  it('rejects totalSteps mismatch with phases length', () => {
    const output = { ...VALID_WORKFLOW_OUTPUT, totalSteps: 3 }; // phases has 6
    const result = validateWorkflowOutput(output);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('does not match'))).toBe(true);
  });

  it('warns when no quality gates exist', () => {
    const phases = VALID_WORKFLOW_OUTPUT.phases.map((p) => ({ ...p, qualityGate: false }));
    const output = { ...VALID_WORKFLOW_OUTPUT, phases };
    const result = validateWorkflowOutput(output);
    expect(result.warnings.some((w) => w.includes('quality gate'))).toBe(true);
  });

  it('rejects missing task in a phase', () => {
    const phases = [{ ...VALID_WORKFLOW_OUTPUT.phases[0], task: '' }];
    const output = { ...VALID_WORKFLOW_OUTPUT, phases, totalSteps: 1 };
    const result = validateWorkflowOutput(output);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('task is missing'))).toBe(true);
  });

  it('rejects non-boolean qualityGate', () => {
    const phases = [{ ...VALID_WORKFLOW_OUTPUT.phases[0], qualityGate: 'yes' as unknown as boolean }];
    const output = { ...VALID_WORKFLOW_OUTPUT, phases, totalSteps: 1 };
    const result = validateWorkflowOutput(output);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('qualityGate must be a boolean'))).toBe(true);
  });

  it('validates dependency values are within range', () => {
    const output = { ...VALID_WORKFLOW_OUTPUT, dependencies: [10] }; // only 6 phases
    const result = validateWorkflowOutput(output);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('out of range'))).toBe(true);
  });

  it('validates all 12 agent types are accepted', () => {
    for (const agent of VALID_AGENTS) {
      const phases = [{ step: 1, agent, task: 'Test', inputFrom: 'input', outputTo: 'output', qualityGate: false, estimatedTime: '1h' }];
      const output = { ...VALID_WORKFLOW_OUTPUT, phases, totalSteps: 1 };
      const result = validateWorkflowOutput(output);
      expect(result.errors.filter((e) => e.includes('not a valid agent type'))).toHaveLength(0);
    }
  });

  // ─── Edge Case Tests ────────────────

  describe('empty and whitespace agent strings', () => {
    it('rejects empty agent string', () => {
      const phases = [{ ...VALID_WORKFLOW_OUTPUT.phases[0], agent: '' }];
      const output = { ...VALID_WORKFLOW_OUTPUT, phases, totalSteps: 1 };
      const result = validateWorkflowOutput(output);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('not a valid agent type'))).toBe(true);
    });

    it('rejects whitespace-only agent string', () => {
      const phases = [{ ...VALID_WORKFLOW_OUTPUT.phases[0], agent: '   ' }];
      const output = { ...VALID_WORKFLOW_OUTPUT, phases, totalSteps: 1 };
      const result = validateWorkflowOutput(output);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('not a valid agent type'))).toBe(true);
    });

    it('rejects agent with wrong casing', () => {
      const phases = [{ ...VALID_WORKFLOW_OUTPUT.phases[0], agent: 'Researcher' }];
      const output = { ...VALID_WORKFLOW_OUTPUT, phases, totalSteps: 1 };
      const result = validateWorkflowOutput(output);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('not a valid agent type'))).toBe(true);
    });

    it('rejects agent with special characters', () => {
      const phases = [{ ...VALID_WORKFLOW_OUTPUT.phases[0], agent: 'researcher@' }];
      const output = { ...VALID_WORKFLOW_OUTPUT, phases, totalSteps: 1 };
      const result = validateWorkflowOutput(output);
      expect(result.valid).toBe(false);
    });
  });

  describe('non-numeric step values', () => {
    it('rejects string step value', () => {
      const phases = [{ ...VALID_WORKFLOW_OUTPUT.phases[0], step: 'abc' as unknown as number }];
      const output = { ...VALID_WORKFLOW_OUTPUT, phases, totalSteps: 1 };
      const result = validateWorkflowOutput(output);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('step must be a positive number'))).toBe(true);
    });

    it('rejects NaN step value', () => {
      const phases = [{ ...VALID_WORKFLOW_OUTPUT.phases[0], step: NaN }];
      const output = { ...VALID_WORKFLOW_OUTPUT, phases, totalSteps: 1 };
      const result = validateWorkflowOutput(output);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('step must be a positive number'))).toBe(true);
    });

    it('rejects zero step value', () => {
      const phases = [{ ...VALID_WORKFLOW_OUTPUT.phases[0], step: 0 }];
      const output = { ...VALID_WORKFLOW_OUTPUT, phases, totalSteps: 1 };
      const result = validateWorkflowOutput(output);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('step must be a positive number'))).toBe(true);
    });

    it('rejects negative step value', () => {
      const phases = [{ ...VALID_WORKFLOW_OUTPUT.phases[0], step: -1 }];
      const output = { ...VALID_WORKFLOW_OUTPUT, phases, totalSteps: 1 };
      const result = validateWorkflowOutput(output);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('step must be a positive number'))).toBe(true);
    });

    it('rejects null step value', () => {
      const phases = [{ ...VALID_WORKFLOW_OUTPUT.phases[0], step: null as unknown as number }];
      const output = { ...VALID_WORKFLOW_OUTPUT, phases, totalSteps: 1 };
      const result = validateWorkflowOutput(output);
      expect(result.valid).toBe(false);
    });

    it('rejects undefined step value', () => {
      const phases = [{ ...VALID_WORKFLOW_OUTPUT.phases[0], step: undefined as unknown as number }];
      const output = { ...VALID_WORKFLOW_OUTPUT, phases, totalSteps: 1 };
      const result = validateWorkflowOutput(output);
      expect(result.valid).toBe(false);
    });
  });

  describe('dependency edge cases', () => {
    it('rejects circular dependencies', () => {
      // Phase 1 depends on phase 2, phase 2 depends on phase 1
      const phases = [
        { ...VALID_WORKFLOW_OUTPUT.phases[0], step: 1 },
        { ...VALID_WORKFLOW_OUTPUT.phases[1], step: 2 },
      ];
      const output = { ...VALID_WORKFLOW_OUTPUT, phases, totalSteps: 2, dependencies: [2, 1] };
      const result = validateWorkflowOutput(output);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Dependency cycle'))).toBe(true);
    });

    it('rejects self-referencing dependency', () => {
      const phases = [{ ...VALID_WORKFLOW_OUTPUT.phases[0], step: 1 }];
      const output = { ...VALID_WORKFLOW_OUTPUT, phases, totalSteps: 1, dependencies: [1] };
      const result = validateWorkflowOutput(output);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Dependency cycle'))).toBe(true);
    });

    it('rejects dependency with non-number value', () => {
      const phases = [{ ...VALID_WORKFLOW_OUTPUT.phases[0], step: 1 }];
      const output = { ...VALID_WORKFLOW_OUTPUT, phases, totalSteps: 1, dependencies: ['abc'] as unknown as number[] };
      const result = validateWorkflowOutput(output);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('out of range'))).toBe(true);
    });

    it('rejects dependency with zero value', () => {
      const phases = [{ ...VALID_WORKFLOW_OUTPUT.phases[0], step: 1 }];
      const output = { ...VALID_WORKFLOW_OUTPUT, phases, totalSteps: 1, dependencies: [0] };
      const result = validateWorkflowOutput(output);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('out of range'))).toBe(true);
    });

    it('rejects negative dependency value', () => {
      const phases = [{ ...VALID_WORKFLOW_OUTPUT.phases[0], step: 1 }];
      const output = { ...VALID_WORKFLOW_OUTPUT, phases, totalSteps: 1, dependencies: [-1] };
      const result = validateWorkflowOutput(output);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('out of range'))).toBe(true);
    });

    it('rejects 3-phase cycle', () => {
      // Phase 1→2, Phase 2→3, Phase 3→1
      const phases = [
        { ...VALID_WORKFLOW_OUTPUT.phases[0], step: 1 },
        { ...VALID_WORKFLOW_OUTPUT.phases[1], step: 2 },
        { ...VALID_WORKFLOW_OUTPUT.phases[2], step: 3 },
      ];
      const output = { ...VALID_WORKFLOW_OUTPUT, phases, totalSteps: 3, dependencies: [2, 3, 1] };
      const result = validateWorkflowOutput(output);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Dependency cycle'))).toBe(true);
    });

    it('accepts valid acyclic dependencies', () => {
      // Phase 1→2, Phase 2→3 (chain, no cycle — phase 3 has no dependency)
      const phases = [
        { ...VALID_WORKFLOW_OUTPUT.phases[0], step: 1 },
        { ...VALID_WORKFLOW_OUTPUT.phases[1], step: 2 },
        { ...VALID_WORKFLOW_OUTPUT.phases[2], step: 3 },
      ];
      const output = { ...VALID_WORKFLOW_OUTPUT, phases, totalSteps: 3, dependencies: [2, 3] };
      const result = validateWorkflowOutput(output);
      expect(result.errors.filter((e) => e.includes('Dependency cycle'))).toHaveLength(0);
    });

    it('rejects NaN dependency value', () => {
      const phases = [{ ...VALID_WORKFLOW_OUTPUT.phases[0], step: 1 }];
      const output = { ...VALID_WORKFLOW_OUTPUT, phases, totalSteps: 1, dependencies: [NaN] };
      const result = validateWorkflowOutput(output);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('out of range'))).toBe(true);
    });
  });

  describe('root-level field edge cases', () => {
    it('rejects whitespace-only workflowName', () => {
      const output = { ...VALID_WORKFLOW_OUTPUT, workflowName: '   ' };
      const result = validateWorkflowOutput(output);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('workflowName'))).toBe(true);
    });

    it('rejects null workflowName', () => {
      const output = { ...VALID_WORKFLOW_OUTPUT, workflowName: null as unknown as string };
      const result = validateWorkflowOutput(output);
      expect(result.valid).toBe(false);
    });

    it('rejects negative totalSteps', () => {
      const output = { ...VALID_WORKFLOW_OUTPUT, totalSteps: -1 };
      const result = validateWorkflowOutput(output);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('totalSteps must be a positive number'))).toBe(true);
    });

    it('rejects zero totalSteps', () => {
      const output = { ...VALID_WORKFLOW_OUTPUT, totalSteps: 0 };
      const result = validateWorkflowOutput(output);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('totalSteps must be a positive number'))).toBe(true);
    });

    it('rejects empty estimatedTotalTime', () => {
      const output = { ...VALID_WORKFLOW_OUTPUT, estimatedTotalTime: '' };
      const result = validateWorkflowOutput(output);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('estimatedTotalTime'))).toBe(true);
    });

    it('rejects whitespace-only estimatedTotalTime', () => {
      const output = { ...VALID_WORKFLOW_OUTPUT, estimatedTotalTime: '   ' };
      const result = validateWorkflowOutput(output);
      expect(result.valid).toBe(false);
    });

    it('rejects non-array dependencies', () => {
      const output = { ...VALID_WORKFLOW_OUTPUT, dependencies: 'not-an-array' as unknown as number[] };
      const result = validateWorkflowOutput(output);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('dependencies must be an array'))).toBe(true);
    });
  });

  describe('phase field edge cases', () => {
    it('rejects empty outputTo', () => {
      const phases = [{ ...VALID_WORKFLOW_OUTPUT.phases[0], outputTo: '' }];
      const output = { ...VALID_WORKFLOW_OUTPUT, phases, totalSteps: 1 };
      const result = validateWorkflowOutput(output);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('outputTo is missing'))).toBe(true);
    });

    it('rejects empty estimatedTime', () => {
      const phases = [{ ...VALID_WORKFLOW_OUTPUT.phases[0], estimatedTime: '' }];
      const output = { ...VALID_WORKFLOW_OUTPUT, phases, totalSteps: 1 };
      const result = validateWorkflowOutput(output);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('estimatedTime is missing'))).toBe(true);
    });

    it('rejects non-string inputFrom', () => {
      const phases = [{ ...VALID_WORKFLOW_OUTPUT.phases[0], inputFrom: 123 as unknown as string }];
      const output = { ...VALID_WORKFLOW_OUTPUT, phases, totalSteps: 1 };
      const result = validateWorkflowOutput(output);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('inputFrom must be a string'))).toBe(true);
    });

    it('rejects null task', () => {
      const phases = [{ ...VALID_WORKFLOW_OUTPUT.phases[0], task: null as unknown as string }];
      const output = { ...VALID_WORKFLOW_OUTPUT, phases, totalSteps: 1 };
      const result = validateWorkflowOutput(output);
      expect(result.valid).toBe(false);
    });

    it('rejects duplicate step numbers', () => {
      const phases = [
        { ...VALID_WORKFLOW_OUTPUT.phases[0], step: 1 },
        { ...VALID_WORKFLOW_OUTPUT.phases[1], step: 1 }, // duplicate
      ];
      const output = { ...VALID_WORKFLOW_OUTPUT, phases, totalSteps: 2 };
      const result = validateWorkflowOutput(output);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('should be 2'))).toBe(true);
    });
  });

  describe('context chain warnings', () => {
    it('warns when non-first phase has empty inputFrom', () => {
      const phases = [
        { ...VALID_WORKFLOW_OUTPUT.phases[0], step: 1, inputFrom: 'Start' },
        { ...VALID_WORKFLOW_OUTPUT.phases[1], step: 2, inputFrom: '' },
      ];
      const output = { ...VALID_WORKFLOW_OUTPUT, phases, totalSteps: 2 };
      const result = validateWorkflowOutput(output);
      expect(result.warnings.some((w) => w.includes('inputFrom is empty'))).toBe(true);
    });

    it('does not warn when first phase has empty inputFrom', () => {
      const phases = [
        { ...VALID_WORKFLOW_OUTPUT.phases[0], step: 1, inputFrom: '' },
      ];
      const output = { ...VALID_WORKFLOW_OUTPUT, phases, totalSteps: 1 };
      const result = validateWorkflowOutput(output);
      expect(result.warnings.filter((w) => w.includes('inputFrom is empty'))).toHaveLength(0);
    });
  });
});

// ═══════════════════════════════════════
// detectCyclesInPlan Tests
// ═══════════════════════════════════════

describe('detectCyclesInPlan', () => {
  it('returns no cycles for empty dependencies', () => {
    const deps: number[][] = [[], [], []];
    expect(detectCyclesInPlan(deps, 3)).toHaveLength(0);
  });

  it('returns no cycles for linear chain (0→1→2)', () => {
    const deps: number[][] = [[], [0], [1]];
    expect(detectCyclesInPlan(deps, 3)).toHaveLength(0);
  });

  it('detects 2-phase cycle (0→1→0)', () => {
    const deps: number[][] = [[1], [0]];
    const cycles = detectCyclesInPlan(deps, 2);
    expect(cycles).toHaveLength(1);
    expect(cycles[0]).toContain('Dependency cycle');
  });

  it('detects 3-phase cycle (0→1→2→0)', () => {
    const deps: number[][] = [[1], [2], [0]];
    const cycles = detectCyclesInPlan(deps, 3);
    expect(cycles).toHaveLength(1);
    expect(cycles[0]).toContain('Phase 1');
    expect(cycles[0]).toContain('Phase 2');
    expect(cycles[0]).toContain('Phase 3');
  });

  it('filters out self-references (no cycle)', () => {
    const deps: number[][] = [[0], [1], [2]];
    expect(detectCyclesInPlan(deps, 3)).toHaveLength(0);
  });

  it('detects diamond with cycle (0→1→3→0 and 0→2→3)', () => {
    // 0→1, 0→2, 1→3, 2→3, 3→0
    const deps: number[][] = [[1, 2], [3], [3], [0]];
    const cycles = detectCyclesInPlan(deps, 4);
    expect(cycles.length).toBeGreaterThan(0);
  });

  it('accepts diamond without cycle (0→1→3, 0→2→3)', () => {
    const deps: number[][] = [[1, 2], [3], [3], []];
    expect(detectCyclesInPlan(deps, 4)).toHaveLength(0);
  });

  it('detects cycle in multi-dependency graph', () => {
    // 0→1, 1→2, 2→0 (classic 3-cycle)
    const deps: number[][] = [[1], [2], [0]];
    const cycles = detectCyclesInPlan(deps, 3);
    expect(cycles).toHaveLength(1);
  });

  it('detects multiple cycles in disjoint components', () => {
    // Component 1: 0→1→0, Component 2: 2→3→2
    const deps: number[][] = [[1], [0], [3], [2]];
    const cycles = detectCyclesInPlan(deps, 4);
    expect(cycles).toHaveLength(2);
  });

  it('ignores out-of-range dependency values', () => {
    const deps: number[][] = [[99], [-1], []];
    expect(detectCyclesInPlan(deps, 3)).toHaveLength(0);
  });

  it('handles single phase with no deps', () => {
    const deps: number[][] = [[]];
    expect(detectCyclesInPlan(deps, 1)).toHaveLength(0);
  });

  it('handles mixed valid and invalid deps', () => {
    // Phase 0 has valid dep [1], phase 1 has invalid dep [99], phase 2 has valid dep [0]
    // 0→1→(99 filtered), 2→0 — no cycle
    const deps: number[][] = [[1], [99], [0]];
    expect(detectCyclesInPlan(deps, 3)).toHaveLength(0);
  });

  it('handles 4-phase chain with no cycle', () => {
    const deps: number[][] = [[], [0], [1], [2]];
    expect(detectCyclesInPlan(deps, 4)).toHaveLength(0);
  });

  it('detects long chain cycle (0→1→2→3→0)', () => {
    const deps: number[][] = [[1], [2], [3], [0]];
    const cycles = detectCyclesInPlan(deps, 4);
    expect(cycles).toHaveLength(1);
    expect(cycles[0]).toContain('Phase 1');
    expect(cycles[0]).toContain('Phase 4');
  });

  it('handles phases with empty dependsOn array', () => {
    const deps: number[][] = []; // no entries at all
    expect(detectCyclesInPlan(deps, 3)).toHaveLength(0);
  });
});

// ═══════════════════════════════════════
// topologicalSort Tests
// ═══════════════════════════════════════

describe('topologicalSort', () => {
  it('returns all phases in order for empty dependencies', () => {
    const order = topologicalSort([[], [], []], 3);
    expect(order).not.toBeNull();
    expect(order).toHaveLength(3);
    expect(order).toEqual(expect.arrayContaining([0, 1, 2]));
  });

  it('sorts linear chain (0→1→2)', () => {
    const order = topologicalSort([[], [0], [1]], 3);
    expect(order).not.toBeNull();
    expect(order!.indexOf(0)).toBeLessThan(order!.indexOf(1));
    expect(order!.indexOf(1)).toBeLessThan(order!.indexOf(2));
  });

  it('sorts diamond graph (3 before 1,2; 1,2 before 0)', () => {
    // Phase 0 depends on [1,2], phase 1 depends on [3], phase 2 depends on [3], phase 3 has no deps
    // Correct order: 3 → 1/2 → 0
    const order = topologicalSort([[1, 2], [3], [3], []], 4);
    expect(order).not.toBeNull();
    expect(order!.indexOf(3)).toBeLessThan(order!.indexOf(1));
    expect(order!.indexOf(3)).toBeLessThan(order!.indexOf(2));
    expect(order!.indexOf(1)).toBeLessThan(order!.indexOf(0));
    expect(order!.indexOf(2)).toBeLessThan(order!.indexOf(0));
  });

  it('returns null for 2-phase cycle', () => {
    expect(topologicalSort([[1], [0]], 2)).toBeNull();
  });

  it('returns null for 3-phase cycle', () => {
    expect(topologicalSort([[1], [2], [0]], 3)).toBeNull();
  });

  it('filters out self-references', () => {
    const order = topologicalSort([[0], [1], [2]], 3);
    expect(order).not.toBeNull();
    expect(order).toHaveLength(3);
  });

  it('handles single phase with no deps', () => {
    const order = topologicalSort([[]], 1);
    expect(order).toEqual([0]);
  });

  it('ignores out-of-range deps', () => {
    const order = topologicalSort([[99], [-1], []], 3);
    expect(order).not.toBeNull();
    expect(order).toHaveLength(3);
  });

  it('sorts mixed valid and invalid deps', () => {
    // Phase 0 depends on [1], phase 1 depends on [] (99 filtered), phase 2 depends on [0]
    // Correct order: 1 → 0 → 2
    const order = topologicalSort([[1], [99], [0]], 3);
    expect(order).not.toBeNull();
    expect(order!.indexOf(1)).toBeLessThan(order!.indexOf(0));
    expect(order!.indexOf(0)).toBeLessThan(order!.indexOf(2));
  });

  it('returns null for long chain cycle (0→1→2→3→0)', () => {
    expect(topologicalSort([[1], [2], [3], [0]], 4)).toBeNull();
  });

  it('handles phases with empty dependsOn array', () => {
    const order = topologicalSort([], 3);
    expect(order).not.toBeNull();
    expect(order).toHaveLength(3);
  });

  it('sorts complex DAG with multiple paths', () => {
    // Phase 0 depends on [1,2], phase 1 depends on [3], phase 2 depends on [3], phase 3 depends on [4], phase 4 has no deps
    // Correct order: 4 → 3 → 1/2 → 0
    const order = topologicalSort([[1, 2], [3], [3], [4], []], 5);
    expect(order).not.toBeNull();
    expect(order!.indexOf(4)).toBeLessThan(order!.indexOf(3));
    expect(order!.indexOf(3)).toBeLessThan(order!.indexOf(1));
    expect(order!.indexOf(3)).toBeLessThan(order!.indexOf(2));
    expect(order!.indexOf(1)).toBeLessThan(order!.indexOf(0));
    expect(order!.indexOf(2)).toBeLessThan(order!.indexOf(0));
  });

  it('returns null when partial cycle exists in subset', () => {
    // 0→1, 1→0 (cycle), 2 is independent
    const order = topologicalSort([[1], [0], []], 3);
    expect(order).toBeNull();
  });
});

// ═══════════════════════════════════════
// parallelExecutionGroups Tests
// ═══════════════════════════════════════

describe('parallelExecutionGroups', () => {
  it('returns null for cycles', () => {
    expect(parallelExecutionGroups([[1], [0]], 2)).toBeNull();
  });

  it('groups empty deps into single group', () => {
    const groups = parallelExecutionGroups([[], [], []], 3);
    expect(groups).not.toBeNull();
    expect(groups).toHaveLength(1);
    expect(groups![0]).toHaveLength(3);
  });

  it('groups linear chain into sequential groups', () => {
    const groups = parallelExecutionGroups([[], [0], [1]], 3);
    expect(groups).not.toBeNull();
    expect(groups).toHaveLength(3);
    expect(groups![0]).toEqual([0]);
    expect(groups![1]).toEqual([1]);
    expect(groups![2]).toEqual([2]);
  });

  it('groups diamond graph into 3 levels', () => {
    // Phase 0 depends on [1,2], phase 1 depends on [3], phase 2 depends on [3], phase 3 has no deps
    const groups = parallelExecutionGroups([[1, 2], [3], [3], []], 4);
    expect(groups).not.toBeNull();
    expect(groups).toHaveLength(3);
    // Level 0: phase 3 (no deps)
    expect(groups![0]).toEqual([3]);
    // Level 1: phases 1 and 2 (depend on 3)
    expect(groups![1]).toHaveLength(2);
    expect(groups![1]).toEqual(expect.arrayContaining([1, 2]));
    // Level 2: phase 0 (depends on 1 and 2)
    expect(groups![2]).toEqual([0]);
  });

  it('groups independent phases at same level', () => {
    // 0→1, 2→3 — two independent chains
    const groups = parallelExecutionGroups([[1], [], [3], []], 4);
    expect(groups).not.toBeNull();
    expect(groups).toHaveLength(2);
    // Wave 0: phases with no deps (1, 3) — can run first
    expect(groups![0]).toHaveLength(2);
    expect(groups![0]).toEqual(expect.arrayContaining([1, 3]));
    // Wave 1: phases depending on wave 0 (0, 2)
    expect(groups![1]).toHaveLength(2);
    expect(groups![1]).toEqual(expect.arrayContaining([0, 2]));
  });

  it('handles single phase', () => {
    const groups = parallelExecutionGroups([[]], 1);
    expect(groups).not.toBeNull();
    expect(groups).toHaveLength(1);
    expect(groups![0]).toEqual([0]);
  });

  it('preserves all phases across groups', () => {
    const groups = parallelExecutionGroups([[1, 2], [3], [3], []], 4);
    expect(groups).not.toBeNull();
    const allPhases = groups!.flat();
    expect(allPhases).toHaveLength(4);
    expect(allPhases).toEqual(expect.arrayContaining([0, 1, 2, 3]));
  });
});

// ═══════════════════════════════════════
// Integration: Parse + Validate
// ═══════════════════════════════════════

describe('parseWorkflowResponse + validateWorkflowOutput integration', () => {
  it('parses and validates a complete workflow from plain JSON', () => {
    const { parsed, error } = parseWorkflowResponse(MOCK_AI_RESPONSE_WITHOUT_FENCES);
    expect(error).toBeNull();
    expect(parsed).not.toBeNull();

    const validation = validateWorkflowOutput(parsed!);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('parses and validates a complete workflow from fenced JSON', () => {
    const { parsed, error } = parseWorkflowResponse(MOCK_AI_RESPONSE_WITH_FENCES);
    expect(error).toBeNull();

    const validation = validateWorkflowOutput(parsed!);
    expect(validation.valid).toBe(true);
  });

  it('parses and validates a complete workflow from surrounded JSON', () => {
    const { parsed, error } = parseWorkflowResponse(MOCK_AI_RESPONSE_WITH_SURROUNDING_TEXT);
    expect(error).toBeNull();

    const validation = validateWorkflowOutput(parsed!);
    expect(validation.valid).toBe(true);
  });

  it('handles a minimal valid workflow (1 phase)', () => {
    const minimal: WorkflowOutput = {
      workflowName: 'Simple Task',
      phases: [
        { step: 1, agent: 'developer', task: 'Build the feature', inputFrom: 'Requirements', outputTo: 'Working code', qualityGate: true, estimatedTime: '4 hours' },
      ],
      totalSteps: 1,
      estimatedTotalTime: '4 hours',
      dependencies: [],
    };

    const { parsed, error } = parseWorkflowResponse(JSON.stringify(minimal));
    expect(error).toBeNull();

    const validation = validateWorkflowOutput(parsed!);
    expect(validation.valid).toBe(true);
  });

  it('handles a maximum valid workflow (8 phases)', () => {
    const maximal: WorkflowOutput = {
      workflowName: 'Full Pipeline',
      phases: Array.from({ length: 8 }, (_, i) => ({
        step: i + 1,
        agent: VALID_AGENTS[i % VALID_AGENTS.length],
        task: `Phase ${i + 1} task`,
        inputFrom: i === 0 ? 'Client brief' : `Phase ${i} output`,
        outputTo: `Phase ${i + 1} output`,
        qualityGate: i === 3 || i === 7,
        estimatedTime: `${(i + 1) * 2} hours`,
      })),
      totalSteps: 8,
      estimatedTotalTime: '72 hours',
      dependencies: [],
    };

    const { parsed, error } = parseWorkflowResponse(JSON.stringify(maximal));
    expect(error).toBeNull();

    const validation = validateWorkflowOutput(parsed!);
    expect(validation.valid).toBe(true);
  });
});
