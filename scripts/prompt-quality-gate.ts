#!/usr/bin/env tsx
// ═══════════════════════════════════════════════════════════════════
// Prompt Quality CI Gate
// Fails the build if any agent prompt drops below minimum thresholds.
//
// Thresholds:
//   - All agents:       >= 1000 chars  (prevents empty/stub prompts)
//   - Enhanced agents:  >= 5000 chars  (prevents quality regression)
//
// Usage:
//   npx tsx scripts/prompt-quality-gate.ts
//   npm run prompt:quality:gate
// ═══════════════════════════════════════════════════════════════════

import { ALL_AGENT_NAMES, getAgentPrompt, AGENT_REGISTRY } from '../src/lib/agents/registry';

// ─── Configuration ───────────────────────────────────────────────

const MIN_PROMPT_LENGTH = 1000;
const ENHANCED_MIN_PROMPT_LENGTH = 5000;

const ENHANCED_AGENTS = [
  // Core Agents
  'researcher',
  'writer',
  'developer',
  'analyst',
  'strategist',
  'marketer',
  'designer',
  'finance',
  'voice',
  'qa',
  'coordinator',
  'workflow',
  // Specialist Domain Agents
  'legal',
  'security-auditor',
  'data-scientist',
  'competitor-intel',
  'editor',
  'localization',
  'devops',
  'ux-researcher',
  'growth-hacker',
  'seo-specialist',
  'seo-strategist',
  'content-strategist',
  'conversion-optimizer',
  'community-manager',
  'sales-optimizer',
  // Quality & Documentation Agents
  'accessibility-auditor',
  'api-docs-writer',
  // Meta/System-Level Agents
  'orchestrator',
  'agency-brain',
  'lead-hunter',
  'offer-strategist',
  'video-specialist',
  'web-designer',
  // Systems-Level Agents
  'agent-builder',
  'systems-architect',
  'security-architect',
  'product-engineer',
  'intelligence-architect',
  'training-architect',
  // Additional
  'product-designer',
  'super-orchestrator',
] as const;

const PLACEHOLDER_REGEX = /^\s*\[INSERT\b|^\s*\[TODO\b|^\s*\[TBD\b|^\s*\[YOUR_TEXT_HERE\b/;

// ─── Helpers ─────────────────────────────────────────────────────

interface GateResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    totalAgents: number;
    enhancedAgents: number;
    avgPromptLength: number;
    minPromptLength: { name: string; length: number };
    maxPromptLength: { name: string; length: number };
  };
}

function runGate(): GateResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let totalLength = 0;
  let minLength = Infinity;
  let minLengthName = '';
  let maxLength = 0;
  let maxLengthName = '';

  // ─── Check 1: All agent prompts >= MIN_PROMPT_LENGTH ───
  const shortPrompts: { name: string; length: number }[] = [];

  for (const name of ALL_AGENT_NAMES) {
    const prompt = getAgentPrompt(name);
    const len = prompt.length;

    totalLength += len;

    if (len < minLength) {
      minLength = len;
      minLengthName = name;
    }
    if (len > maxLength) {
      maxLength = len;
      maxLengthName = name;
    }

    if (len < MIN_PROMPT_LENGTH) {
      shortPrompts.push({ name, length: len });
    }
  }

  if (shortPrompts.length > 0) {
    for (const p of shortPrompts) {
      errors.push(
        `❌ ${p.name}: prompt is ${p.length} chars (minimum: ${MIN_PROMPT_LENGTH})`,
      );
    }
  }

  // ─── Check 2: Enhanced agents >= ENHANCED_MIN_PROMPT_LENGTH ───
  const shortEnhanced: { name: string; length: number }[] = [];

  for (const name of ENHANCED_AGENTS) {
    if (!ALL_AGENT_NAMES.includes(name)) {
      errors.push(`❌ ${name}: listed as enhanced agent but not found in registry`);
      continue;
    }

    const prompt = getAgentPrompt(name);
    if (prompt.length < ENHANCED_MIN_PROMPT_LENGTH) {
      shortEnhanced.push({ name, length: prompt.length });
    }
  }

  if (shortEnhanced.length > 0) {
    for (const p of shortEnhanced) {
      errors.push(
        `❌ ${p.name}: enhanced prompt is ${p.length} chars (minimum: ${ENHANCED_MIN_PROMPT_LENGTH})`,
      );
    }
  }

  // ─── Check 3: Every prompt starts with role definition ───
  for (const name of ALL_AGENT_NAMES) {
    const prompt = getAgentPrompt(name);
    if (!prompt.startsWith('You are ')) {
      errors.push(
        `❌ ${name}: prompt must start with 'You are' (starts with: '${prompt.substring(0, 40)}')`,
      );
    }
  }

  // ─── Check 4: Every prompt contains VERIFY instruction ───
  for (const name of ALL_AGENT_NAMES) {
    const prompt = getAgentPrompt(name);
    if (!prompt.includes('VERIFY')) {
      errors.push(`❌ ${name}: prompt must contain a VERIFY instruction`);
    }
  }

  // ─── Check 5: No active placeholder markers ───
  for (const name of ALL_AGENT_NAMES) {
    const prompt = getAgentPrompt(name);
    const lines = prompt.split('\n');
    const badLines = lines.filter((l) => PLACEHOLDER_REGEX.test(l));
    if (badLines.length > 0) {
      errors.push(
        `❌ ${name}: contains active placeholder markers on lines: ${badLines.join('; ')}`,
      );
    }
  }

  // ─── Check 6: Registry consistency ───
  for (const name of ALL_AGENT_NAMES) {
    const entry = AGENT_REGISTRY[name];
    if (!entry) {
      errors.push(`❌ ${name}: in ALL_AGENT_NAMES but missing from AGENT_REGISTRY`);
      continue;
    }
    if (entry.prompt.length === 0) {
      errors.push(`❌ ${name}: registry entry has empty prompt`);
    }
    if (entry.prompt !== getAgentPrompt(name)) {
      errors.push(`❌ ${name}: registry prompt does not match getAgentPrompt() output`);
    }
  }

  // ─── Warnings (non-blocking) ───
  for (const name of ALL_AGENT_NAMES) {
    const prompt = getAgentPrompt(name);
    if (prompt.length < 2000 && !ENHANCED_AGENTS.includes(name)) {
      warnings.push(
        `⚠️  ${name}: prompt is only ${prompt.length} chars (consider expanding beyond 2000)`,
      );
    }
  }

  const avgLength = Math.round(totalLength / ALL_AGENT_NAMES.length);

  return {
    passed: errors.length === 0,
    errors,
    warnings,
    stats: {
      totalAgents: ALL_AGENT_NAMES.length,
      enhancedAgents: ENHANCED_AGENTS.filter((a) => ALL_AGENT_NAMES.includes(a)).length,
      avgPromptLength: avgLength,
      minPromptLength: { name: minLengthName, length: minLength },
      maxPromptLength: { name: maxLengthName, length: maxLength },
    },
  };
}

// ─── Main ────────────────────────────────────────────────────────

function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   🛡️  Prompt Quality CI Gate                ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log();

  const result = runGate();

  // ─── Print stats ───
  console.log('📊 Stats:');
  console.log(`   Total agents:       ${result.stats.totalAgents}`);
  console.log(`   Enhanced agents:    ${result.stats.enhancedAgents}`);
  console.log(`   Avg prompt length:  ${result.stats.avgPromptLength} chars`);
  console.log(`   Min prompt:         ${result.stats.minPromptLength.name} (${result.stats.minPromptLength.length} chars)`);
  console.log(`   Max prompt:         ${result.stats.maxPromptLength.name} (${result.stats.maxPromptLength.length} chars)`);
  console.log();

  // ─── Print warnings ───
  if (result.warnings.length > 0) {
    console.log('⚠️  Warnings:');
    for (const w of result.warnings) {
      console.log(`   ${w}`);
    }
    console.log();
  }

  // ─── Print errors ───
  if (result.errors.length > 0) {
    console.log('❌ Errors (build will fail):');
    for (const e of result.errors) {
      console.log(`   ${e}`);
    }
    console.log();
  }

  // ─── Verdict ───
  if (result.passed) {
    console.log('✅ Prompt quality gate PASSED');
    console.log(`   All ${result.stats.totalAgents} agent prompts meet minimum thresholds.`);
    process.exit(0);
  } else {
    console.log('🚫 Prompt quality gate FAILED');
    console.log(`   ${result.errors.length} violation(s) found. Fix the issues above and try again.`);
    console.log();
    console.log('Tips:');
    console.log(`   - All agents need >= ${MIN_PROMPT_LENGTH} chars`);
    console.log(`   - Enhanced agents need >= ${ENHANCED_MIN_PROMPT_LENGTH} chars`);
    console.log('   - Prompts must start with "You are"');
    console.log('   - Prompts must contain a VERIFY instruction');
    console.log('   - Remove any [INSERT...], [TODO...], [TBD...] placeholders');
    process.exit(1);
  }
}

main();
