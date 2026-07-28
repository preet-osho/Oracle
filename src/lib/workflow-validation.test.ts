import { describe, it, expect } from 'vitest';
import { ALL_AGENT_NAMES } from '@/lib/agents/registry';
import {
  extractFirstJson,
  parseWorkflowResponse,
  detectDependencyCycles,
  detectCyclesInPlan,
  topologicalSort,
  parallelExecutionGroups,
  buildPlanGraph,
  validateWorkflowOutput,
  VALID_AGENTS,
  type WorkflowOutput,
} from './workflow-validation';

// ─── Test Data ──────────────────────────

const validWorkflow: WorkflowOutput = {
  workflowName: 'SEO Audit Workflow',
  phases: [
    { step: 1, agent: 'researcher', task: 'Research competitors', inputFrom: '', outputTo: 'Phase 2', qualityGate: true, estimatedTime: '15 min' },
    { step: 2, agent: 'analyst', task: 'Analyze SEO data', inputFrom: 'Phase 1', outputTo: 'Phase 3', qualityGate: true, estimatedTime: '20 min' },
    { step: 3, agent: 'developer', task: 'Implement fixes', inputFrom: 'Phase 2', outputTo: 'Phase 4', qualityGate: false, estimatedTime: '30 min' },
    { step: 4, agent: 'qa', task: 'Verify changes', inputFrom: 'Phase 3', outputTo: 'Final Output', qualityGate: true, estimatedTime: '15 min' },
  ],
  totalSteps: 4,
  estimatedTotalTime: '80 min',
  dependencies: [2, 3, 4],
};

// ─── extractFirstJson ───────────────────

describe('extractFirstJson', () => {
  it('extracts JSON from plain text', () => {
    const text = 'Here is the result: {"name": "test"} done.';
    const result = extractFirstJson(text);
    expect(result).toBe('{"name": "test"}');
  });

  it('extracts JSON with nested braces', () => {
    const text = 'Result: {"a": {"b": "c"}, "d": 1} end';
    const result = extractFirstJson(text);
    expect(result).toBe('{"a": {"b": "c"}, "d": 1}');
  });

  it('handles JSON with strings containing braces', () => {
    const text = 'Result: {"msg": "use { and }"} end';
    const result = extractFirstJson(text);
    expect(result).toBe('{"msg": "use { and }"}');
  });

  it('returns null when no JSON found', () => {
    expect(extractFirstJson('no json here')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(extractFirstJson('')).toBeNull();
  });

  it('extracts the first JSON when multiple exist', () => {
    const text = '{"a": 1} and {"b": 2}';
    const result = extractFirstJson(text);
    expect(result).toBe('{"a": 1}');
  });

  it('handles escaped quotes in strings', () => {
    const text = '{"msg": "he said \\"hello\\""}';
    const result = extractFirstJson(text);
    expect(result).toBe('{"msg": "he said \\"hello\\""}');
  });
});

// ─── parseWorkflowResponse ──────────────

describe('parseWorkflowResponse', () => {
  it('parses valid JSON directly', () => {
    const { parsed, error } = parseWorkflowResponse(JSON.stringify(validWorkflow));
    expect(parsed).toEqual(validWorkflow);
    expect(error).toBeNull();
  });

  it('parses JSON inside markdown code fences', () => {
    const text = 'Here is the workflow:\n```json\n' + JSON.stringify(validWorkflow) + '\n```\nDone!';
    const { parsed, error } = parseWorkflowResponse(text);
    expect(parsed).toEqual(validWorkflow);
    expect(error).toBeNull();
  });

  it('parses JSON inside code fences without language tag', () => {
    const text = '```\n' + JSON.stringify(validWorkflow) + '\n```';
    const { parsed, error } = parseWorkflowResponse(text);
    expect(parsed).toEqual(validWorkflow);
    expect(error).toBeNull();
  });

  it('extracts JSON using bracket-depth when code fences fail', () => {
    const text = 'Workflow: ' + JSON.stringify(validWorkflow) + ' completed.';
    const { parsed, error } = parseWorkflowResponse(text);
    expect(parsed).toEqual(validWorkflow);
    expect(error).toBeNull();
  });

  it('returns error for non-workflow JSON', () => {
    const { parsed, error } = parseWorkflowResponse('{"not": "workflow"}');
    expect(parsed).toBeNull();
    expect(error).toBeTruthy();
  });

  it('returns error for no JSON found', () => {
    const { parsed, error } = parseWorkflowResponse('No JSON here at all');
    expect(parsed).toBeNull();
    expect(error).toContain('No valid JSON found');
  });

  it('handles workflow with extra text around code fences', () => {
    const text = 'Based on the analysis, here is the workflow plan:\n\n```json\n' + JSON.stringify(validWorkflow) + '\n```\n\nThis workflow covers all the requirements.';
    const { parsed, error } = parseWorkflowResponse(text);
    expect(parsed).toEqual(validWorkflow);
    expect(error).toBeNull();
  });
});

// ─── detectDependencyCycles ─────────────

describe('detectDependencyCycles', () => {
  it('returns empty for linear dependencies', () => {
    const cycles = detectDependencyCycles([0, 1, 2, 3], 4);
    expect(cycles).toEqual([]);
  });

  it('returns empty for no dependencies', () => {
    const cycles = detectDependencyCycles([], 0);
    expect(cycles).toEqual([]);
  });

  it('detects a simple cycle', () => {
    // Phase 1 depends on Phase 2, Phase 2 depends on Phase 1
    const cycles = detectDependencyCycles([2, 1], 2);
    expect(cycles.length).toBeGreaterThan(0);
    expect(cycles[0]).toContain('cycle');
  });

  it('detects a longer cycle', () => {
    // Phase 1→2, Phase 2→3, Phase 3→1
    const cycles = detectDependencyCycles([2, 3, 1], 3);
    expect(cycles.length).toBeGreaterThan(0);
  });

  it('ignores out-of-range dependencies', () => {
    const cycles = detectDependencyCycles([0, 1, 99], 3);
    expect(cycles).toEqual([]);
  });
});

// ─── detectCyclesInPlan ─────────────────

describe('detectCyclesInPlan', () => {
  it('returns empty for DAG with no cycles', () => {
    const deps = [[], [0], [1], [2]];
    const cycles = detectCyclesInPlan(deps, 4);
    expect(cycles).toEqual([]);
  });

  it('detects cycle in plan graph', () => {
    // Phase 1 depends on Phase 2, Phase 2 depends on Phase 1
    const deps = [[1], [0]];
    const cycles = detectCyclesInPlan(deps, 2);
    expect(cycles.length).toBeGreaterThan(0);
  });

  it('uses provided graph if given', () => {
    const deps = [[], [0]];
    const graph = buildPlanGraph(deps, 2);
    const cycles = detectCyclesInPlan(deps, 2, graph);
    expect(cycles).toEqual([]);
  });
});

// ─── topologicalSort ────────────────────

describe('topologicalSort', () => {
  it('sorts linear dependencies correctly', () => {
    const deps = [[], [0], [1], [2]];
    const order = topologicalSort(deps, 4);
    expect(order).toEqual([0, 1, 2, 3]);
  });

  it('handles parallel dependencies', () => {
    // Phases 1 and 2 both depend on Phase 0
    const deps = [[], [0], [0]];
    const order = topologicalSort(deps, 3);
    expect(order).not.toBeNull();
    expect(order!.indexOf(0)).toBeLessThan(order!.indexOf(1));
    expect(order!.indexOf(0)).toBeLessThan(order!.indexOf(2));
  });

  it('returns null for cyclic graph', () => {
    const deps = [[1], [0]];
    const order = topologicalSort(deps, 2);
    expect(order).toBeNull();
  });

  it('handles no dependencies', () => {
    const order = topologicalSort([], 0);
    expect(order).toEqual([]);
  });

  it('handles single node', () => {
    const order = topologicalSort([[]], 1);
    expect(order).toEqual([0]);
  });
});

// ─── parallelExecutionGroups ────────────

describe('parallelExecutionGroups', () => {
  it('groups independent phases together', () => {
    // All phases independent
    const deps = [[], [], [], []];
    const groups = parallelExecutionGroups(deps, 4);
    expect(groups).not.toBeNull();
    expect(groups!.length).toBe(1); // All in one group
    expect(groups![0].sort()).toEqual([0, 1, 2, 3]);
  });

  it('creates separate groups for sequential dependencies', () => {
    const deps = [[], [0], [1], [2]];
    const groups = parallelExecutionGroups(deps, 4);
    expect(groups).not.toBeNull();
    expect(groups!.length).toBe(4); // Each in its own group
  });

  it('returns null for cyclic graph', () => {
    const deps = [[1], [0]];
    const groups = parallelExecutionGroups(deps, 2);
    expect(groups).toBeNull();
  });

  it('handles mixed parallel and sequential', () => {
    // Phase 0 runs first, then Phase 1 and 2 run in parallel
    const deps = [[], [0], [0]];
    const groups = parallelExecutionGroups(deps, 3);
    expect(groups).not.toBeNull();
    expect(groups!.length).toBe(2);
    expect(groups![0]).toEqual([0]);
    expect(groups![1].sort()).toEqual([1, 2]);
  });
});

// ─── buildPlanGraph ─────────────────────

describe('buildPlanGraph', () => {
  it('builds correct adjacency and in-degree maps', () => {
    const deps = [[], [0], [0, 1]];
    const graph = buildPlanGraph(deps, 3);
    expect(graph.inDegree.get(0)).toBe(0);
    expect(graph.inDegree.get(1)).toBe(1);
    expect(graph.inDegree.get(2)).toBe(2);
  });

  it('filters self-references', () => {
    const deps = [[0], []]; // Phase 0 depends on itself
    const graph = buildPlanGraph(deps, 2);
    expect(graph.inDegree.get(0)).toBe(0); // Self-ref filtered
  });

  it('filters out-of-range indices', () => {
    const deps = [[99], []];
    const graph = buildPlanGraph(deps, 2);
    expect(graph.inDegree.get(0)).toBe(0);
  });

  it('handles empty dependencies', () => {
    const graph = buildPlanGraph([], 0);
    expect(graph.adj.size).toBe(0);
    expect(graph.inDegree.size).toBe(0);
  });
});

// ─── validateWorkflowOutput ─────────────

describe('validateWorkflowOutput', () => {
  it('validates a correct workflow', () => {
    const result = validateWorkflowOutput(validWorkflow);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('reports error for missing workflowName', () => {
    const invalid = { ...validWorkflow, workflowName: '' };
    const result = validateWorkflowOutput(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('workflowName'))).toBe(true);
  });

  it('reports error for empty phases', () => {
    const invalid = { ...validWorkflow, phases: [] };
    const result = validateWorkflowOutput(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('phases'))).toBe(true);
  });

  it('reports error for more than 8 phases', () => {
    const phases = Array.from({ length: 9 }, (_, i) => ({
      step: i + 1, agent: 'researcher', task: `Task ${i + 1}`,
      inputFrom: '', outputTo: '', qualityGate: false, estimatedTime: '5 min',
    }));
    const invalid = { ...validWorkflow, phases, totalSteps: 9 };
    const result = validateWorkflowOutput(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('max 8'))).toBe(true);
  });

  it('reports error for invalid agent type', () => {
    const invalid = {
      ...validWorkflow,
      phases: [{ ...validWorkflow.phases[0], agent: 'invalid-agent' }],
      totalSteps: 1,
    };
    const result = validateWorkflowOutput(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('agent'))).toBe(true);
  });

  it('reports error for non-sequential step numbers', () => {
    const invalid = {
      ...validWorkflow,
      phases: [
        { ...validWorkflow.phases[0], step: 2 },
        { ...validWorkflow.phases[1], step: 3 },
      ],
      totalSteps: 2,
    };
    const result = validateWorkflowOutput(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('step'))).toBe(true);
  });

  it('reports error when totalSteps does not match phases.length', () => {
    const invalid = { ...validWorkflow, totalSteps: 10 };
    const result = validateWorkflowOutput(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('totalSteps'))).toBe(true);
  });

  it('warns when no quality gates present', () => {
    const noGates: WorkflowOutput = {
      ...validWorkflow,
      phases: validWorkflow.phases.map(p => ({ ...p, qualityGate: false })),
    };
    const result = validateWorkflowOutput(noGates);
    expect(result.warnings.some(w => w.includes('quality gate'))).toBe(true);
  });

  it('reports error for invalid dependencies', () => {
    const invalid = { ...validWorkflow, dependencies: [0, 1, 99] };
    const result = validateWorkflowOutput(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('dependencies'))).toBe(true);
  });

  it('reports error for dependency cycles', () => {
    const invalid: WorkflowOutput = {
      workflowName: 'Cyclic',
      phases: [
        { step: 1, agent: 'researcher', task: 'A', inputFrom: '', outputTo: 'B', qualityGate: true, estimatedTime: '5 min' },
        { step: 2, agent: 'writer', task: 'B', inputFrom: 'A', outputTo: '', qualityGate: true, estimatedTime: '5 min' },
      ],
      totalSteps: 2,
      estimatedTotalTime: '10 min',
      dependencies: [2, 1], // Phase 1→2, Phase 2→1 = cycle
    };
    const result = validateWorkflowOutput(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('cycle'))).toBe(true);
  });
});

// ─── VALID_AGENTS ───────────────────────

describe('VALID_AGENTS', () => {
  it('contains all expected agent types', () => {
    expect(VALID_AGENTS).toContain('researcher');
    expect(VALID_AGENTS).toContain('writer');
    expect(VALID_AGENTS).toContain('developer');
    expect(VALID_AGENTS).toContain('analyst');
    expect(VALID_AGENTS).toContain('strategist');
    expect(VALID_AGENTS).toContain('marketer');
    expect(VALID_AGENTS).toContain('designer');
    expect(VALID_AGENTS).toContain('finance');
    expect(VALID_AGENTS).toContain('voice');
    expect(VALID_AGENTS).toContain('qa');
    expect(VALID_AGENTS).toContain('coordinator');
    expect(VALID_AGENTS).toContain('workflow');
    expect(VALID_AGENTS).toContain('lead-hunter');
    expect(VALID_AGENTS).toContain('offer-strategist');
    expect(VALID_AGENTS).toContain('video-specialist');
    expect(VALID_AGENTS).toContain('web-designer');
    expect(VALID_AGENTS).toContain('agent-builder');
  });

  it('has the same agents as ALL_AGENT_NAMES from the registry', () => {
    // If this test fails, you added an agent to ALL_AGENT_NAMES but forgot VALID_AGENTS.
    // Fix: add the new agent name to VALID_AGENTS in workflow-validation.ts.
    expect([...VALID_AGENTS]).toEqual([...ALL_AGENT_NAMES]);
  });

  it('has 43 agents matching ALL_AGENT_NAMES length', () => {
    expect(VALID_AGENTS.length).toBe(ALL_AGENT_NAMES.length);
    expect(VALID_AGENTS.length).toBe(43);
  });
});
