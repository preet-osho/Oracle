'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

// ─── Types ────────────────────────────

interface AgentPlan {
  agent: string;
  task: string;
  inputs: string;
  expectedOutput: string;
  dependsOn: number[];
}

interface DependencyGraphProps {
  plan: AgentPlan[];
  cycleEdges: Set<string>;       // "from-to" strings for edges in cycles
  parallelGroups: number[][] | null;
  sequentialMode?: boolean;     // when true, dependency edges are shown as bypassed
}

interface NodePosition {
  idx: number;
  agent: string;
  x: number;
  y: number;
  layer: number;
}

interface Edge {
  from: number;
  to: number;
  isCycle: boolean;
  isBypassed: boolean;
}

// ─── Constants ────────────────────────

const AGENT_EMOJIS: Record<string, string> = {
  researcher: '🔍', writer: '✍️', developer: '💻', analyst: '📊',
  strategist: '🎯', marketer: '📣', designer: '🎨', finance: '💰',
  voice: '🎙️', qa: '🛡️', coordinator: '📋', workflow: '🔗',
};

const AGENT_COLOR_VARS: Record<string, string> = {
  researcher: 'var(--oracle-info)', writer: 'var(--oracle-success)',
  developer: 'var(--oracle-primary-l)', analyst: 'var(--oracle-warning)',
  strategist: 'var(--oracle-error)', marketer: 'var(--oracle-violet)',
  designer: 'var(--oracle-pink)', finance: 'var(--oracle-amber)',
  voice: 'var(--oracle-cyan)', qa: 'var(--oracle-info)',
  coordinator: 'var(--oracle-primary-l)', workflow: 'var(--oracle-success)',
};

const NODE_W = 140;
const NODE_H = 52;
const LAYER_GAP = 180;
const NODE_GAP = 68;
const PAD_X = 40;
const PAD_Y = 30;
const ARROW_SIZE = 7;

// ─── Helpers ──────────────────────────

function parseCycleEdges(cycleWarnings: string[]): Set<string> {
  const edges = new Set<string>();
  for (const warning of cycleWarnings) {
    const match = warning.match(/Phase (\d+)/g);
    if (!match) continue;
    const indices = match.map((m) => parseInt(m.replace('Phase ', ''), 10) - 1);
    for (let i = 0; i < indices.length - 1; i++) {
      edges.add(`${indices[i]}-${indices[i + 1]}`);
    }
  }
  return edges;
}

// ─── Component ────────────────────────

export function DependencyGraph({ plan, cycleEdges, parallelGroups, sequentialMode = false }: DependencyGraphProps) {
  // Assign layers from parallelGroups or fallback to dependsOn depth
  const layers = useMemo(() => {
    if (parallelGroups && parallelGroups.length > 0) {
      const layerMap = new Map<number, number>();
      parallelGroups.forEach((group, layerIdx) => {
        group.forEach((idx) => layerMap.set(idx, layerIdx));
      });
      return layerMap;
    }
    // Fallback: compute depth from dependencies
    const depth = new Map<number, number>();
    const computeDepth = (idx: number, visited: Set<number>): number => {
      if (depth.has(idx)) return depth.get(idx)!;
      if (visited.has(idx)) return 0;
      visited.add(idx);
      const deps = plan[idx]?.dependsOn || [];
      const maxDepDepth = deps.length > 0
        ? Math.max(...deps.filter((d) => d >= 0 && d < plan.length).map((d) => computeDepth(d, new Set(visited))))
        : -1;
      const d = maxDepDepth + 1;
      depth.set(idx, d);
      return d;
    };
    plan.forEach((_, i) => computeDepth(i, new Set()));
    const groups = new Map<number, number[]>();
    depth.forEach((d, idx) => {
      const existing = groups.get(d);
      if (existing) existing.push(idx); else groups.set(d, [idx]);
    });
    const result = new Map<number, number>();
    let layerIdx = 0;
    const keyArr = Array.from(groups.keys());
    const maxD = keyArr.length > 0 ? Math.max(0, ...keyArr) : 0;
    for (let i = 0; i <= maxD; i++) {
      const g = groups.get(i);
      if (g) { g.forEach((idx) => result.set(idx, layerIdx)); layerIdx++; }
    }
    return result;
  }, [plan, parallelGroups]);

  // Compute node positions
  const positions = useMemo(() => {
    const layerNodes = new Map<number, number[]>();
    plan.forEach((_, i) => {
      const layer = layers.get(i) ?? 0;
      const existing = layerNodes.get(layer);
      if (existing) existing.push(i); else layerNodes.set(layer, [i]);
    });

    const layerKeys = Array.from(layerNodes.keys());
    const maxLayer = layerKeys.length > 0 ? Math.max(0, ...layerKeys) : 0;

    const nodes: NodePosition[] = [];
    layerNodes.forEach((nodeIndices, layer) => {
      nodeIndices.forEach((idx, posInLayer) => {
        nodes.push({
          idx,
          agent: plan[idx].agent,
          x: PAD_X + layer * (NODE_W + LAYER_GAP),
          y: PAD_Y + posInLayer * NODE_GAP,
          layer,
        });
      });
    });

    const nodeCounts = Array.from(layerNodes.values()).map((n) => n.length);
    const maxNodesInLayer = nodeCounts.length > 0 ? Math.max(...nodeCounts) : 1;
    return {
      nodes,
      totalWidth: PAD_X * 2 + (maxLayer + 1) * NODE_W + maxLayer * LAYER_GAP,
      totalHeight: PAD_Y * 2 + maxNodesInLayer * NODE_GAP,
    };
  }, [plan, layers]);

  // Build edges
  const edges = useMemo(() => {
    const result: Edge[] = [];
    const posMap = new Map(positions.nodes.map((n) => [n.idx, n]));
    plan.forEach((p, i) => {
      for (const dep of p.dependsOn) {
        if (dep < 0 || dep >= plan.length || dep === i) continue;
        const fromPos = posMap.get(dep);
        const toPos = posMap.get(i);
        if (fromPos && toPos) {
          result.push({
            from: dep,
            to: i,
            isCycle: cycleEdges.has(`${dep}-${i}`) || cycleEdges.has(`${i}-${dep}`),
            isBypassed: sequentialMode,
          });
        }
      }
    });
    return result;
  }, [plan, positions.nodes, cycleEdges, sequentialMode]);

  const svgWidth = Math.max(positions.totalWidth, 400);
  const svgHeight = Math.max(positions.totalHeight, 120);
  const posMap = useMemo(() => new Map(positions.nodes.map((n) => [n.idx, n])), [positions.nodes]);

  // Precompute which nodes are involved in cycles
  const cycleNodeSet = useMemo(() => {
    const set = new Set<number>();
    Array.from(cycleEdges).forEach((e) => {
      const [from, to] = e.split('-').map(Number);
      if (!isNaN(from)) set.add(from);
      if (!isNaN(to)) set.add(to);
    });
    return set;
  }, [cycleEdges]);

  const uid = 'dep-g';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="w-full overflow-x-auto rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)]/50 p-4"
    >
      <svg
        width="100%"
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        xmlns="http://www.w3.org/2000/svg"
        className="min-w-[360px]"
        role="img"
        aria-label="Dependency graph showing agent execution order and cycles"
      >
        <defs>
          <marker id={`${uid}-arrow`} viewBox={`0 0 ${ARROW_SIZE * 2} ${ARROW_SIZE * 2}`}
            refX={ARROW_SIZE * 2} refY={ARROW_SIZE}
            markerWidth={ARROW_SIZE} markerHeight={ARROW_SIZE}
            orient="auto-start-reverse">
            <path d={`M 0 0 L ${ARROW_SIZE * 2} ${ARROW_SIZE} L 0 ${ARROW_SIZE * 2} z`}
              style={{ fill: 'var(--oracle-text-muted)' }} opacity={0.5} />
          </marker>
          <marker id={`${uid}-cycle`} viewBox={`0 0 ${ARROW_SIZE * 2} ${ARROW_SIZE * 2}`}
            refX={ARROW_SIZE * 2} refY={ARROW_SIZE}
            markerWidth={ARROW_SIZE} markerHeight={ARROW_SIZE}
            orient="auto-start-reverse">
            <path d={`M 0 0 L ${ARROW_SIZE * 2} ${ARROW_SIZE} L 0 ${ARROW_SIZE * 2} z`}
              style={{ fill: 'var(--oracle-error)' }} />
          </marker>
          {/* Bypassed arrow marker for sequential mode */}
          <marker id={`${uid}-bypass`} viewBox={`0 0 ${ARROW_SIZE * 2} ${ARROW_SIZE * 2}`}
            refX={ARROW_SIZE * 2} refY={ARROW_SIZE}
            markerWidth={ARROW_SIZE} markerHeight={ARROW_SIZE}
            orient="auto-start-reverse">
            <path d={`M 0 0 L ${ARROW_SIZE * 2} ${ARROW_SIZE} L 0 ${ARROW_SIZE * 2} z`}
              style={{ fill: 'var(--oracle-warning)' }} opacity={0.4} />
          </marker>
          <filter id={`${uid}-glow`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feFlood style={{ floodColor: 'var(--oracle-error)' }} floodOpacity="0.35" />
            <feComposite in2="blur" operator="in" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Edges */}
        {edges.map((edge) => {
          const from = posMap.get(edge.from);
          const to = posMap.get(edge.to);
          if (!from || !to) return null;

          const x1 = from.x + NODE_W;
          const y1 = from.y + NODE_H / 2;
          const x2 = to.x;
          const y2 = to.y + NODE_H / 2;
          const dx = x2 - x1;
          const cp = Math.max(Math.abs(dx) * 0.4, 30);
          const d = `M ${x1} ${y1} C ${x1 + cp} ${y1}, ${x2 - cp} ${y2}, ${x2} ${y2}`;

          return (
            <g key={`${edge.from}-${edge.to}`}>
              <path
                d={d}
                fill="none"
                style={{
                  stroke: edge.isCycle ? 'var(--oracle-error)' : edge.isBypassed ? 'var(--oracle-warning)' : 'var(--oracle-text-muted)',
                }}
                strokeWidth={edge.isCycle ? 2.5 : edge.isBypassed ? 1 : 1.5}
                strokeOpacity={edge.isCycle ? 0.9 : edge.isBypassed ? 0.3 : 0.35}
                strokeDasharray={edge.isCycle ? '6 3' : edge.isBypassed ? '4 4' : undefined}
                markerEnd={edge.isCycle ? `url(#${uid}-cycle)` : edge.isBypassed ? `url(#${uid}-bypass)` : `url(#${uid}-arrow)`}
              />
              {edge.isCycle && (
                <path
                  d={d}
                  fill="none"
                  style={{ stroke: 'var(--oracle-error)' }}
                  strokeWidth={6}
                  strokeOpacity={0.12}
                  strokeLinecap="round"
                />
              )}
              {edge.isBypassed && !edge.isCycle && (
                <path
                  d={d}
                  fill="none"
                  style={{ stroke: 'var(--oracle-warning)' }}
                  strokeWidth={4}
                  strokeOpacity={0.06}
                  strokeLinecap="round"
                />
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {positions.nodes.map((node) => {
          const isInCycle = cycleNodeSet.has(node.idx);
          const agentColor = AGENT_COLOR_VARS[node.agent] || '#818cf8';

          return (
            <g key={node.idx}              filter={isInCycle ? `url(#${uid}-glow)` : undefined}>
              {/* Background */}
              <rect
                x={node.x}
                y={node.y}
                width={NODE_W}
                height={NODE_H}
                rx={12}                  style={{
                    fill: isInCycle ? 'rgba(239,68,68,0.08)' : 'var(--oracle-surface-1)',
                    stroke: isInCycle ? 'var(--oracle-error)' : 'var(--oracle-border)',
                  }}
                strokeWidth={isInCycle ? 2 : 1}
              />
              {/* Accent bar */}
              <rect
                x={node.x}
                y={node.y}
                width={4}
                height={NODE_H}
                rx={2}
                style={{ fill: agentColor }}
                opacity={isInCycle ? 1 : 0.7}
              />
              {/* Emoji */}
              <text
                x={node.x + 18}
                y={node.y + NODE_H / 2 + 1}
                dominantBaseline="central"
                fontSize={16}
              >
                {AGENT_EMOJIS[node.agent] || '🤖'}
              </text>
              {/* Agent name */}
              <text
                x={node.x + 38}
                y={node.y + NODE_H / 2 - 5}
                dominantBaseline="central"
                style={{ fill: 'var(--oracle-text-1)' }}
                fontSize={11}
                fontWeight={600}
                fontFamily="system-ui, sans-serif"
              >
                {node.agent.charAt(0).toUpperCase() + node.agent.slice(1)}
              </text>
              {/* Phase number */}
              <text
                x={node.x + 38}
                y={node.y + NODE_H / 2 + 11}
                dominantBaseline="central"
                style={{ fill: 'var(--oracle-text-muted)' }}
                fontSize={9}
                fontFamily="system-ui, sans-serif"
              >
                Phase {node.idx + 1}
              </text>
              {/* Cycle badge */}
              {isInCycle && (
                <g>
                  <rect
                    x={node.x + NODE_W - 22}
                    y={node.y + 4}
                    width={18}
                    height={14}
                    rx={7}
                    style={{ fill: 'var(--oracle-error)' }}
                    opacity={0.9}
                  />
                  <text
                    x={node.x + NODE_W - 13}
                    y={node.y + 12}
                    dominantBaseline="central"
                    textAnchor="middle"
                    style={{ fill: '#ffffff' }}
                    fontSize={8}
                    fontWeight={700}
                    fontFamily="system-ui, sans-serif"
                  >
                    !
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </motion.div>
  );
}

export { parseCycleEdges };
