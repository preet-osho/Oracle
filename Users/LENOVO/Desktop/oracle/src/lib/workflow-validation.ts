// ═══════════════════════════════════════
// ORACLE — Workflow Output Validation
// Validates AI-generated workflow JSON against the expected schema
// ═══════════════════════════════════════

export const VALID_AGENTS = [
  'researcher', 'writer', 'developer', 'analyst', 'strategist',
  'marketer', 'designer', 'finance', 'voice', 'qa', 'coordinator', 'workflow',
] as const;

export type WorkflowAgent = typeof VALID_AGENTS[number];

export interface WorkflowPhase {
  step: number;
  agent: string;
  task: string;
  inputFrom: string;
  outputTo: string;
  qualityGate: boolean;
  estimatedTime: string;
}

export interface WorkflowOutput {
  workflowName: string;
  phases: WorkflowPhase[];
  totalSteps: number;
  estimatedTotalTime: string;
  dependencies: number[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Extract the first complete JSON object from text using bracket-depth tracking.
 * More robust than regex-based extraction.
 */
export function extractFirstJson(text: string): string | null {
  const startIdx = text.indexOf('{');
  if (startIdx === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let j = startIdx; j < text.length; j++) {
    const ch = text[j];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    if (ch === '}') { depth--; if (depth === 0) return text.slice(startIdx, j + 1); }
  }
  return null;
}

/**
 * Parse AI response text into a WorkflowOutput object.
 * Handles markdown code fences and surrounding text.
 */
export function parseWorkflowResponse(text: string): { parsed: WorkflowOutput | null; error: string | null } {
  // Try direct JSON parse first
  try {
    const parsed = JSON.parse(text) as unknown;
    if (isWorkflowOutput(parsed)) return { parsed, error: null };
  } catch { /* continue */ }

  // Try extracting JSON from markdown code fences
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    try {
      const parsed = JSON.parse(fenceMatch[1]) as unknown;
      if (isWorkflowOutput(parsed)) return { parsed, error: null };
    } catch { /* continue */ }
  }

  // Try bracket-depth extraction
  const jsonString = extractFirstJson(text);
  if (jsonString) {
    try {
      const parsed = JSON.parse(jsonString) as unknown;
      if (isWorkflowOutput(parsed)) return { parsed, error: null };
      return { parsed: null, error: 'Extracted JSON does not match workflow schema' };
    } catch { /* continue */ }
  }

  return { parsed: null, error: 'No valid JSON found in response' };
}

/**
 * Type guard for WorkflowOutput
 */
function isWorkflowOutput(obj: unknown): obj is WorkflowOutput {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.workflowName === 'string' &&
    Array.isArray(o.phases) &&
    typeof o.totalSteps === 'number' &&
    typeof o.estimatedTotalTime === 'string' &&
    Array.isArray(o.dependencies)
  );
}

/**
 * Build adjacency, reverse adjacency, and in-degree maps from a plan's dependency arrays.
 * Filters self-references and out-of-range indices.
 * Shared by detectCyclesInPlan, topologicalSort, and parallelExecutionGroups.
 */
export interface PlanGraph {
  adj: Map<number, number[]>;
  reverseAdj: Map<number, number[]>;
  inDegree: Map<number, number>;
}

export function buildPlanGraph(dependsOnArrays: number[][], phaseCount: number): PlanGraph {
  const adj = new Map<number, number[]>();
  const reverseAdj = new Map<number, number[]>();
  const inDegree = new Map<number, number>();

  for (let i = 0; i < phaseCount; i++) {
    inDegree.set(i, 0);
    const deps = (dependsOnArrays[i] || []).filter((d) => d >= 0 && d < phaseCount && d !== i);
    if (deps.length > 0) adj.set(i, deps);
    for (const d of deps) {
      inDegree.set(i, (inDegree.get(i) || 0) + 1);
      const existing = reverseAdj.get(d);
      if (existing) existing.push(i); else reverseAdj.set(d, [i]);
    }
  }

  return { adj, reverseAdj, inDegree };
}

/**
 * Core cycle detection on a directed graph.
 * adj maps each node to its list of outgoing neighbors.
 * labelFn converts a node id to a human-readable label.
 * Returns an array of cycle description strings.
 */
function detectCyclesInGraph(
  adj: Map<number, number[]>,
  nodeCount: number,
  startNode: number,
  labelFn: (n: number) => string,
): string[] {
  const cycles: string[] = [];
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<number, number>();
  const parent = new Map<number, number>();

  for (let i = 0; i < nodeCount; i++) color.set(startNode + i, WHITE);

  function dfs(u: number): void {
    color.set(u, GRAY);
    for (const v of adj.get(u) || []) {
      if (color.get(v) === GRAY) {
        // Reconstruct cycle path: v → ... → u → v
        const path: number[] = [v];
        let cur = u;
        while (cur !== v) {
          path.unshift(cur);
          cur = parent.get(cur)!;
        }
        path.unshift(v);
        cycles.push(`Dependency cycle: ${path.map(labelFn).join(' → ')}`);
      } else if (color.get(v) === WHITE) {
        parent.set(v, u);
        dfs(v);
      }
    }
    color.set(u, BLACK);
  }

  for (let i = 0; i < nodeCount; i++) {
    const node = startNode + i;
    if (color.get(node) === WHITE) dfs(node);
  }

  return cycles;
}

/**
 * Detect cycles in the dependency graph encoded by the dependencies array.
 * dependencies[i] means phase (i+1) depends on phase dependencies[i].
 * Returns an array of cycle descriptions, or empty if no cycles.
 */
export function detectDependencyCycles(dependencies: number[], phaseCount: number): string[] {
  const adj = new Map<number, number[]>();
  for (let i = 0; i < dependencies.length; i++) {
    const from = i + 1;
    const to = dependencies[i];
    if (from >= 1 && from <= phaseCount && to >= 1 && to <= phaseCount) {
      const existing = adj.get(from);
      if (existing) existing.push(to); else adj.set(from, [to]);
    }
  }
  return detectCyclesInGraph(adj, phaseCount, 1, (n) => `Phase ${n}`);
}

/**
 * Detect cycles in a plan where each phase declares its dependencies via dependsOn.
 * dependsOn entries are 0-based phase indices.
 * Returns an array of cycle descriptions, or empty if no cycles.
 */
export function detectCyclesInPlan(
  dependsOnArrays: number[][],
  phaseCount: number,
  graph?: PlanGraph,
): string[] {
  const { adj } = graph ?? buildPlanGraph(dependsOnArrays, phaseCount);
  return detectCyclesInGraph(adj, phaseCount, 0, (n) => `Phase ${n + 1}`);
}

/**
 * Topological sort of a directed acyclic graph.
 * dependsOnArrays[i] lists 0-based indices of phases that phase i depends on.
 * Returns phases in execution order, or null if the graph has cycles.
 */
export function topologicalSort(
  dependsOnArrays: number[][],
  phaseCount: number,
  graph?: PlanGraph,
): number[] | null {
  const { reverseAdj, inDegree } = graph ?? buildPlanGraph(dependsOnArrays, phaseCount);
  const deg = new Map(inDegree); // copy to avoid mutating shared graph

  // Kahn's algorithm
  const queue: number[] = [];
  for (let i = 0; i < phaseCount; i++) {
    if (deg.get(i) === 0) queue.push(i);
  }

  const sorted: number[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    sorted.push(node);
    for (const neighbor of reverseAdj.get(node) || []) {
      const d = (deg.get(neighbor) || 1) - 1;
      deg.set(neighbor, d);
      if (d === 0) queue.push(neighbor);
    }
  }

  return sorted.length === phaseCount ? sorted : null;
}

/**
 * Group phases into parallel execution levels.
 * Phases at the same level have no inter-dependencies and can run concurrently.
 * Returns an array of groups (each group is an array of phase indices), or null if cycles exist.
 */
export function parallelExecutionGroups(
  dependsOnArrays: number[][],
  phaseCount: number,
  graph?: PlanGraph,
): number[][] | null {
  const g = graph ?? buildPlanGraph(dependsOnArrays, phaseCount);

  const order = topologicalSort(dependsOnArrays, phaseCount, g);
  if (!order) return null;

  // Compute depth of each node (longest path from any root)
  const depth = new Map<number, number>();
  for (const node of order) {
    const deps = g.adj.get(node) || [];
    const maxParentDepth = deps.length > 0 ? Math.max(...deps.map((d) => depth.get(d) ?? 0)) : -1;
    depth.set(node, maxParentDepth + 1);
  }

  // Group nodes by depth
  const groups: Map<number, number[]> = new Map();
  for (const node of order) {
    const d = depth.get(node) ?? 0;
    const existing = groups.get(d);
    if (existing) existing.push(node); else groups.set(d, [node]);
  }

  // Return groups sorted by depth level
  const maxDepth = Math.max(0, ...Array.from(groups.keys()));
  const result: number[][] = [];
  for (let i = 0; i <= maxDepth; i++) {
    const group = groups.get(i);
    if (group) result.push(group);
  }
  return result;
}

/**
 * Validate a WorkflowOutput against the expected schema.
 * Returns a ValidationResult with errors and warnings.
 */
export function validateWorkflowOutput(output: WorkflowOutput): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // ─── Root-level validation ────────────

  if (!output.workflowName || output.workflowName.trim().length === 0) {
    errors.push('workflowName is missing or empty');
  }

  if (!Array.isArray(output.phases) || output.phases.length === 0) {
    errors.push('phases array is missing or empty');
    return { valid: false, errors, warnings };
  }

  if (output.phases.length > 8) {
    errors.push(`phases array has ${output.phases.length} items (max 8 allowed)`);
  }

  if (typeof output.totalSteps !== 'number' || !Number.isFinite(output.totalSteps) || output.totalSteps < 1) {
    errors.push('totalSteps must be a positive number');
  }

  if (output.totalSteps !== output.phases.length) {
    errors.push(`totalSteps (${output.totalSteps}) does not match phases.length (${output.phases.length})`);
  }

  if (typeof output.estimatedTotalTime !== 'string' || output.estimatedTotalTime.trim().length === 0) {
    errors.push('estimatedTotalTime is missing or empty');
  }

  if (!Array.isArray(output.dependencies)) {
    errors.push('dependencies must be an array');
    return { valid: false, errors, warnings };
  }

  // ─── Phase-level validation ───────────

  const hasQualityGate = output.phases.some((p) => p.qualityGate === true);
  if (!hasQualityGate) {
    warnings.push('No quality gates found — prompt requires at least one quality gate per workflow');
  }

  output.phases.forEach((phase, idx) => {
    const prefix = `phases[${idx}]`;

    if (typeof phase.step !== 'number' || !Number.isFinite(phase.step) || phase.step < 1) {
      errors.push(`${prefix}.step must be a positive number`);
    }

    if (phase.step !== idx + 1) {
      errors.push(`${prefix}.step is ${phase.step} but should be ${idx + 1} (sequential numbering)`);
    }

    if (typeof phase.agent !== 'string' || !VALID_AGENTS.includes(phase.agent as WorkflowAgent)) {
      errors.push(`${prefix}.agent "${phase.agent}" is not a valid agent type. Valid: ${VALID_AGENTS.join(', ')}`);
    }

    if (typeof phase.task !== 'string' || phase.task.trim().length === 0) {
      errors.push(`${prefix}.task is missing or empty`);
    }

    if (typeof phase.inputFrom !== 'string') {
      errors.push(`${prefix}.inputFrom must be a string`);
    }

    if (typeof phase.outputTo !== 'string' || phase.outputTo.trim().length === 0) {
      errors.push(`${prefix}.outputTo is missing or empty`);
    }

    if (typeof phase.qualityGate !== 'boolean') {
      errors.push(`${prefix}.qualityGate must be a boolean`);
    }

    if (typeof phase.estimatedTime !== 'string' || phase.estimatedTime.trim().length === 0) {
      errors.push(`${prefix}.estimatedTime is missing or empty`);
    }
  });

  // ─── Dependency validation ────────────

  output.dependencies.forEach((dep, idx) => {
    if (typeof dep !== 'number' || !Number.isFinite(dep) || dep < 1 || dep > output.phases.length) {
      errors.push(`dependencies[${idx}] value ${dep} is out of range (1-${output.phases.length})`);
    }
  });

  // Cycle detection
  const cycles = detectDependencyCycles(output.dependencies, output.phases.length);
  cycles.forEach((c) => errors.push(c));

  // ─── Context chain validation ─────────

  output.phases.forEach((phase, idx) => {
    if (idx > 0 && phase.inputFrom.trim().length === 0) {
      warnings.push(`${`phases[${idx}]`}.inputFrom is empty — first phase may be OK, but subsequent phases should receive input`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
