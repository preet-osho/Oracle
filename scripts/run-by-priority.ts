#!/usr/bin/env tsx
// ═══════════════════════════════════════
// ORACLE — Priority-Based Test Runner
// Executes tests by risk level: P1 (Critical) → P2 → P3 → P4 → P5 → P6
// ═══════════════════════════════════════

import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const COVERAGE_DIR = path.join(ROOT, 'coverage-priority');

/** Strip ANSI color escape codes from a string. */
function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

// ─── Priority Definitions ───────────────

interface PriorityLevel {
  level: string;
  label: string;
  files: string[];
}

const PRIORITY_LEVELS: PriorityLevel[] = [
  {
    level: 'P1',
    label: '🔴 Critical Risk — Security, Compliance, Data Integrity',
    files: [
      // Security & Encryption
      'src/lib/encryption.test.ts',
      'src/lib/prompt-sanitizer.test.ts',
      'src/lib/permissions.test.ts',
      'src/lib/rate-limit.test.ts',
      'src/lib/csrf.test.ts',
      // Domain Compliance (SEBI, Healthcare, Legal)
      'src/lib/domain-compliance.test.ts',
      // Auth Enforcement
      'src/lib/auth-enforcement.test.ts',
      // Data Integrity — Workflow validation
      'src/lib/workflow-validation.test.ts',
      // Invoice & Tax
      'src/lib/invoice.test.ts',
      'src/lib/tax-calculator.test.ts',
      'src/lib/late-fee-calculator.test.ts',
      // Contracts (Indian law)
      'src/lib/contracts.test.ts',
    ],
  },
  {
    level: 'P2',
    label: '🟠 High Risk — AI Quality Assurance, Business Logic',
    files: [
      // Hallucination Guard & Quality
      'src/lib/hallucination-guard.test.ts',
      'src/lib/confidence-scorer.test.ts',
      'src/lib/fact-grounding.test.ts',
      'src/lib/quality.test.ts',
      // Business Logic
      'src/lib/profitability.test.ts',
      'src/lib/expense-tracker.test.ts',
      'src/lib/cost-tracker.test.ts',
      // Subscriptions & Billing
      'src/lib/subscription.test.ts',
      'src/lib/razorpay.test.ts',
    ],
  },
  {
    level: 'P3',
    label: '🟡 Medium Risk — Knowledge, Memory, Intelligence',
    files: [
      // Knowledge & Memory
      'src/lib/memory.test.ts',
      'src/lib/search.test.ts',
      'src/lib/rag.test.ts',
      'src/lib/embeddings.test.ts',
      // Intelligence & Automation
      'src/lib/proactive-intelligence.test.ts',
      'src/lib/upsell-detection.test.ts',
      'src/lib/self-training.test.ts',
      'src/lib/satisfaction-tracker.test.ts',
      'src/lib/pattern-recognition.test.ts',
      'src/lib/weekly-web-scan.test.ts',
      // Provider & Model
      'src/lib/model-selector.test.ts',
      'src/lib/circuit-breaker.test.ts',
      'src/lib/provider-health.test.ts',
      'src/lib/token-budget.test.ts',
      'src/lib/context-manager.test.ts',
    ],
  },
  {
    level: 'P4',
    label: '🟢 Low Risk — Export, UI Helpers, Utilities',
    files: [
      'src/lib/export-utils.test.ts',
      'src/lib/logger.test.ts',
      'src/lib/audit-log.test.ts',
      'src/lib/brand-asset-library.test.ts',
      'src/lib/communication-log.test.ts',
      'src/lib/deadline-tracker.test.ts',
      'src/lib/progress-tracker.test.ts',
      'src/lib/fetch-with-timeout.test.ts',
      'src/lib/prompt-versioning.test.ts',
    ],
  },
  {
    level: 'P5',
    label: '🔵 Backlog — API, Data, UI Components',
    files: [
      'src/lib/api.test.ts',
      'src/lib/annual-revenue-report.test.ts',
      'src/lib/search-helpers.test.ts',
      'src/lib/feedback-bridge.test.ts',
    ],
  },
  {
    level: 'P6',
    label: '⚪ Nice-to-Have — Component Tests',
    files: [
      // Glob patterns — passed directly to vitest
      'src/components/**/*.test.ts',
      'src/components/**/*.test.tsx',
    ],
  },
];

// ─── Coverage Types ────────────────────

interface CoverageMetrics {
  lines: { total: number; covered: number; skipped: number; pct: number };
  branches: { total: number; covered: number; skipped: number; pct: number };
  functions: { total: number; covered: number; skipped: number; pct: number };
  statements: { total: number; covered: number; skipped: number; pct: number };
}

interface CoverageResult {
  level: string;
  passed: boolean;
  tests: number;
  duration: number;
  coverage: CoverageMetrics | null;
}

interface VitestCoverageSummary {
  total: CoverageMetrics;
  [key: string]: CoverageMetrics | string;
}

// ─── CI Environment Detection ───────────

type CIProvider = 'github' | 'gitlab' | 'bitbucket' | 'circleci' | 'travis' | 'azure' | 'unknown';

interface CIDetection {
  provider: CIProvider;
  baseBranch: string | null;
  headBranch: string | null;
  commitSha: string | null;
}

function detectCI(): CIDetection {
  // GitHub Actions
  if (process.env.GITHUB_ACTIONS === 'true') {
    return {
      provider: 'github',
      baseBranch: process.env.GITHUB_BASE_REF || null,
      headBranch: process.env.GITHUB_HEAD_REF || null,
      commitSha: process.env.GITHUB_SHA || null,
    };
  }

  // GitLab CI
  if (process.env.GITLAB_CI === 'true') {
    return {
      provider: 'gitlab',
      baseBranch: process.env.CI_MERGE_REQUEST_TARGET_BRANCH_NAME || process.env.CI_DEFAULT_BRANCH || null,
      headBranch: process.env.CI_MERGE_REQUEST_SOURCE_BRANCH_NAME || null,
      commitSha: process.env.CI_COMMIT_SHA || null,
    };
  }

  // Bitbucket Pipelines
  if (process.env.BITBUCKET_BUILD_NUMBER) {
    return {
      provider: 'bitbucket',
      baseBranch: process.env.BITBUCKET_PR_DESTINATION_BRANCH || null,
      headBranch: process.env.BITBUCKET_BRANCH || null,
      commitSha: process.env.BITBUCKET_COMMIT || null,
    };
  }

  // CircleCI
  if (process.env.CIRCLECI === 'true') {
    return {
      provider: 'circleci',
      baseBranch: process.env.CIRCLE_PR_NUMBER ? null : null, // CircleCI doesn't expose base branch directly
      headBranch: process.env.CIRCLE_BRANCH || null,
      commitSha: process.env.CIRCLE_SHA1 || null,
    };
  }

  // Travis CI
  if (process.env.TRAVIS === 'true') {
    return {
      provider: 'travis',
      baseBranch: process.env.TRAVIS_BRANCH || null,
      headBranch: null, // Travis doesn't distinguish base/head easily
      commitSha: process.env.TRAVIS_COMMIT || null,
    };
  }

  // Azure DevOps Pipelines
  if (process.env.AzureDevsPipelines === 'true' || process.env.SYSTEM_TEAMFOUNDATIONSERVERURI) {
    return {
      provider: 'azure',
      baseBranch: process.env.SYSTEM_PULLREQUEST_TARGETBRANCH?.replace('refs/heads/', '') || null,
      headBranch: process.env.SYSTEM_PULLREQUEST_SOURCEBRANCH?.replace('refs/heads/', '') || null,
      commitSha: process.env.BUILD_SOURCEVERSION || null,
    };
  }

  // Generic CI detection via CI env var
  if (process.env.CI === 'true') {
    return {
      provider: 'unknown',
      baseBranch: process.env.CI_BASE_BRANCH || process.env.BASE_BRANCH || null,
      headBranch: process.env.CI_HEAD_BRANCH || process.env.HEAD_BRANCH || null,
      commitSha: process.env.CI_COMMIT_SHA || process.env.COMMIT_SHA || null,
    };
  }

  return { provider: 'unknown', baseBranch: null, headBranch: null, commitSha: null };
}

// ─── Git Diff Integration ───────────────

function getChangedFiles(since: string): string[] {
  let cmd: string;

  switch (since) {
    case 'HEAD':
      // Uncommitted changes (staged + unstaged)
      cmd = 'git diff --name-only HEAD';
      break;
    case 'STAGED':
      // Only staged changes
      cmd = 'git diff --cached --name-only';
      break;
    case 'MAIN':
    case 'MASTER':
      // Changes since main/master branch
      cmd = 'git diff --name-only origin/main...HEAD 2>/dev/null || git diff --name-only origin/master...HEAD';
      break;

    default: {
      // Handle HEAD~N format
      const headNMatch = since.match(/^HEAD~(\d+)$/);
      if (headNMatch) {
        cmd = `git diff --name-only HEAD~${headNMatch[1]}`;
        break;
      }

      // Handle bare number (e.g., --since 3 → HEAD~3)
      if (/^\d+$/.test(since)) {
        cmd = `git diff --name-only HEAD~${since}`;
        break;
      }

      // Treat as a branch name or commit ref
      try {
        execSync(`git rev-parse --verify ${since}`, { stdio: 'pipe' });
        cmd = `git diff --name-only ${since}...HEAD`;
      } catch {
        console.error(`  ⚠️  Invalid ref: ${since}. Using HEAD~1 as fallback.`);
        cmd = 'git diff --name-only HEAD~1';
      }
    }
  }

  try {
    const output = execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' });
    return output.split('\n').map((f) => f.trim()).filter(Boolean);
  } catch (error) {
    console.error(`  ⚠️  git diff failed: ${(error as Error).message}`);
    return [];
  }
}

function mapSourceToTest(changedFiles: string[]): string[] {
  const testFiles: string[] = [];

  for (const file of changedFiles) {
    // If it's already a test file, include it directly
    if (file.match(/\.test\.(ts|tsx)$/)) {
      testFiles.push(file);
      continue;
    }

    // Map source file → test file
    // src/lib/encryption.ts → src/lib/encryption.test.ts
    // src/components/oracle/Foo.tsx → src/components/oracle/Foo.test.tsx
    const ext = path.extname(file);
    const base = file.slice(0, -ext.length);
    const testTs = `${base}.test.ts`;
    const testTsx = `${base}.test.tsx`;

    if (fs.existsSync(path.resolve(ROOT, testTs))) {
      testFiles.push(testTs);
    }
    if (fs.existsSync(path.resolve(ROOT, testTsx))) {
      testFiles.push(testTsx);
    }

    // Also check for __tests__ directories
    const dir = path.dirname(file);
    const name = path.basename(file, ext);
    const testDir = path.join(dir, '__tests__');
    const testDirTs = path.join(testDir, `${name}.test.ts`);
    const testDirTsx = path.join(testDir, `${name}.test.tsx`);

    if (fs.existsSync(path.resolve(ROOT, testDirTs))) {
      testFiles.push(testDirTs);
    }
    if (fs.existsSync(path.resolve(ROOT, testDirTsx))) {
      testFiles.push(testDirTsx);
    }
  }

  // Deduplicate
  return [...new Set(testFiles)];
}

function filterLevelsByChangedFiles(
  levels: PriorityLevel[],
  changedTestFiles: string[],
): PriorityLevel[] {
  return levels.map((level) => {
    const filtered = level.files.filter((f) => {
      // Glob patterns: always include (they cover component tests)
      if (f.includes('*') || f.includes('{')) {
        // For globs, check if any changed file matches the pattern prefix
        const prefix = f.split('*')[0].split('{')[0];
        return changedTestFiles.some((cf) => cf.startsWith(prefix));
      }
      return changedTestFiles.includes(f);
    });
    return { ...level, files: filtered };
  }).filter((level) => level.files.length > 0);
}

// ─── Runner ─────────────────────────────

interface RunResult {
  level: string;
  passed: boolean;
  tests: number;
  duration: number;
}

function runTestsForLevel(level: PriorityLevel, failFast: boolean): RunResult {
  const startTime = Date.now();

  // Filter to files that actually exist
  const existingFiles = level.files.filter((f) => {
    if (f.includes('*') || f.includes('{')) return true; // Glob patterns always "exist"
    return fs.existsSync(path.resolve(ROOT, f));
  });

  if (existingFiles.length === 0) {
    console.log(`  ⏭️  No test files found for ${level.level}`);
    return { level: level.level, passed: true, tests: 0, duration: 0 };
  }

  const fileArgs = existingFiles.map((f) => `"${f}"`).join(' ');
  const failFastFlag = failFast ? ' --bail 1' : '';

  try {
    const output = execSync(
      `npx vitest run ${fileArgs} --reporter=verbose${failFastFlag} 2>&1`,
      {
        encoding: 'utf-8',
        timeout: 300_000, // 5 minutes per priority level
        stdio: 'pipe',
      }
    );

    // Extract test count from vitest output (strip ANSI color codes first)
    const testMatch = stripAnsi(output).match(/Tests?\s+(\d+)\s+passed/);
    const tests = testMatch ? parseInt(testMatch[1], 10) : 0;
    const duration = Date.now() - startTime;

    console.log(`  ✅ ${level.level} passed — ${tests} tests in ${(duration / 1000).toFixed(1)}s`);
    return { level: level.level, passed: true, tests, duration };
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    const output = (error as { stdout?: string; stderr?: string }).stdout || '';
    const errOutput = (error as { stderr?: string }).stderr || '';

    // Extract failure info (strip ANSI color codes first)
    const failMatch = stripAnsi(output).match(/Tests?\s+(\d+)\s+failed/);
    const fails = failMatch ? parseInt(failMatch[1], 10) : 'unknown';

    console.log(`  ❌ ${level.level} FAILED — ${fails} test(s) failed in ${(duration / 1000).toFixed(1)}s`);

    // Print last 30 lines of output for debugging
    const lines = (output + errOutput).split('\n');
    const lastLines = lines.slice(-30).join('\n');
    console.log('\n--- Last 30 lines of output ---');
    console.log(lastLines);
    console.log('--- End of output ---\n');

    return { level: level.level, passed: false, tests: 0, duration };
  }
}

// ─── Coverage Runner ────────────────────

function getExistingFiles(level: PriorityLevel): string[] {
  return level.files.filter((f) => {
    if (f.includes('*') || f.includes('{')) return true;
    return fs.existsSync(path.resolve(ROOT, f));
  });
}

function runTestsForLevelWithCoverage(level: PriorityLevel): CoverageResult {
  const startTime = Date.now();
  const existingFiles = getExistingFiles(level);
  const outDir = path.join(COVERAGE_DIR, level.level);

  if (existingFiles.length === 0) {
    console.log(`  ⏭️  No test files found for ${level.level}`);
    return { level: level.level, passed: true, tests: 0, duration: 0, coverage: null };
  }

  const fileArgs = existingFiles.map((f) => `"${f}"`).join(' ');

  try {
    const output = execSync(
      `npx vitest run ${fileArgs} --coverage --coverage.reportsDirectory="${outDir}" 2>&1`,
      {
        encoding: 'utf-8',
        timeout: 600_000, // 10 minutes with coverage
        stdio: 'pipe',
      }
    );

    const testMatch = stripAnsi(output).match(/Tests?\s+(\d+)\s+passed/);
    const tests = testMatch ? parseInt(testMatch[1], 10) : 0;
    const duration = Date.now() - startTime;

    // Parse coverage JSON output
    const coverage = parseCoverageJSON(outDir);

    if (coverage) {
      console.log(
        `  ✅ ${level.level} passed — ${tests} tests, ` +
        `coverage: ${coverage.lines.pct}% lines, ${coverage.branches.pct}% branches, ` +
        `${coverage.functions.pct}% functions` +
        ` in ${(duration / 1000).toFixed(1)}s`
      );
    } else {
      console.log(`  ✅ ${level.level} passed — ${tests} tests in ${(duration / 1000).toFixed(1)}s`);
    }

    return { level: level.level, passed: true, tests, duration, coverage };
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    const output = (error as { stdout?: string; stderr?: string }).stdout || '';
    const errOutput = (error as { stderr?: string }).stderr || '';

    const failMatch = stripAnsi(output).match(/Tests?\s+(\d+)\s+failed/);
    const fails = failMatch ? parseInt(failMatch[1], 10) : 'unknown';

    console.log(`  ❌ ${level.level} FAILED — ${fails} test(s) failed in ${(duration / 1000).toFixed(1)}s`);

    const lines = (output + errOutput).split('\n');
    const lastLines = lines.slice(-30).join('\n');
    console.log('\n--- Last 30 lines of output ---');
    console.log(lastLines);
    console.log('--- End of output ---\n');

    // Even on failure, try to read partial coverage data
    const coverage = parseCoverageJSON(outDir);

    return { level: level.level, passed: false, tests: 0, duration, coverage };
  }
}

function parseCoverageJSON(outDir: string): CoverageMetrics | null {
  const jsonPath = path.join(outDir, 'coverage-summary.json');
  try {
    if (fs.existsSync(jsonPath)) {
      const raw = fs.readFileSync(jsonPath, 'utf-8');
      const data: VitestCoverageSummary = JSON.parse(raw);
      return data.total || null;
    }
  } catch {
    // Coverage JSON may be malformed on partial runs
  }
  return null;
}

// ─── Coverage Report ────────────────────

function printCoverageReport(results: CoverageResult[]) {
  console.log('\n═══════════════════════════════════════');
  console.log('  COVERAGE REPORT BY PRIORITY TIER');
  console.log('═══════════════════════════════════════\n');

  const rows: Array<{
    level: string;
    lines: string;
    branches: string;
    functions: string;
    statements: string;
    tests: number;
  }> = [];

  let totalLines = 0;
  let totalBranches = 0;
  let totalFunctions = 0;
  let totalStatements = 0;
  let tiersWithCoverage = 0;

  for (const r of results) {
    if (r.coverage) {
      tiersWithCoverage++;
      totalLines += r.coverage.lines.pct;
      totalBranches += r.coverage.branches.pct;
      totalFunctions += r.coverage.functions.pct;
      totalStatements += r.coverage.statements.pct;

      rows.push({
        level: r.level,
        lines: `${r.coverage.lines.pct.toFixed(1)}% (${r.coverage.lines.covered}/${r.coverage.lines.total})`,
        branches: `${r.coverage.branches.pct.toFixed(1)}% (${r.coverage.branches.covered}/${r.coverage.branches.total})`,
        functions: `${r.coverage.functions.pct.toFixed(1)}% (${r.coverage.functions.covered}/${r.coverage.functions.total})`,
        statements: `${r.coverage.statements.pct.toFixed(1)}% (${r.coverage.statements.covered}/${r.coverage.statements.total})`,
        tests: r.tests,
      });
    } else {
      rows.push({
        level: r.level,
        lines: '—',
        branches: '—',
        functions: '—',
        statements: '—',
        tests: r.tests,
      });
    }
  }

  // Print table
  const colWidths = { level: 6, lines: 22, branches: 22, functions: 22, statements: 22, tests: 6 };
  const header = [
    'Tier'.padEnd(colWidths.level),
    'Lines'.padEnd(colWidths.lines),
    'Branches'.padEnd(colWidths.branches),
    'Functions'.padEnd(colWidths.functions),
    'Statements'.padEnd(colWidths.statements),
    'Tests'.padEnd(colWidths.tests),
  ].join(' │ ');

  const separator = [
    '─'.repeat(colWidths.level),
    '─'.repeat(colWidths.lines),
    '─'.repeat(colWidths.branches),
    '─'.repeat(colWidths.functions),
    '─'.repeat(colWidths.statements),
    '─'.repeat(colWidths.tests),
  ].join('─┼─');

  console.log(`  ${header}`);
  console.log(`  ${separator}`);

  for (const row of rows) {
    console.log(
      `  ${row.level.padEnd(colWidths.level)} │ ` +
      `${row.lines.padEnd(colWidths.lines)} │ ` +
      `${row.branches.padEnd(colWidths.branches)} │ ` +
      `${row.functions.padEnd(colWidths.functions)} │ ` +
      `${row.statements.padEnd(colWidths.statements)} │ ` +
      `${row.tests.toString().padEnd(colWidths.tests)}`
    );
  }

  // Average across tiers with coverage
  if (tiersWithCoverage > 0) {
    const avgLines = (totalLines / tiersWithCoverage).toFixed(1);
    const avgBranches = (totalBranches / tiersWithCoverage).toFixed(1);
    const avgFunctions = (totalFunctions / tiersWithCoverage).toFixed(1);
    const avgStatements = (totalStatements / tiersWithCoverage).toFixed(1);
    const totalTests = results.reduce((s, r) => s + r.tests, 0);

    console.log(`  ${separator}`);
    console.log(
      `  ${'AVG'.padEnd(colWidths.level)} │ ` +
      `${(avgLines + '%').padEnd(colWidths.lines)} │ ` +
      `${(avgBranches + '%').padEnd(colWidths.branches)} │ ` +
      `${(avgFunctions + '%').padEnd(colWidths.functions)} │ ` +
      `${(avgStatements + '%').padEnd(colWidths.statements)} │ ` +
      `${totalTests.toString().padEnd(colWidths.tests)}`
    );
  }

  // Per-tier color-coded status
  console.log('\n  Per-Tier Status:');
  for (const r of results) {
    if (!r.coverage) {
      console.log(`    ${r.level}: ⚪ No coverage data`);
      continue;
    }
    const pct = r.coverage.lines.pct;
    const icon = pct >= 80 ? '🟢' : pct >= 60 ? '🟡' : '🔴';
    const status = pct >= 80 ? 'GOOD' : pct >= 60 ? 'NEEDS WORK' : 'LOW';
    console.log(`    ${r.level}: ${icon} ${pct.toFixed(1)}% lines — ${status}`);
  }

  // Write JSON summary for CI artifact upload
  const summaryPath = path.join(COVERAGE_DIR, 'coverage-summary.json');
  const summary = results.map((r) => ({
    level: r.level,
    tests: r.tests,
    duration: r.duration,
    passed: r.passed,
    coverage: r.coverage,
  }));
  fs.mkdirSync(COVERAGE_DIR, { recursive: true });
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`\n  📄 JSON summary written to ${path.relative(ROOT, summaryPath)}\n`);
}

// ─── Watch Mode ────────────────────────

function runWatchMode(levels: PriorityLevel[]) {
  // Collect all test files across the filtered levels
  const allTestFiles: string[] = [];
  for (const level of levels) {
    const existing = level.files.filter((f) => {
      if (f.includes('*') || f.includes('{')) return true;
      return fs.existsSync(path.resolve(ROOT, f));
    });
    allTestFiles.push(...existing);
  }

  if (allTestFiles.length === 0) {
    console.log('  ✅ No test files to watch. Nothing to do.\n');
    process.exit(0);
  }

  const fileArgs = allTestFiles.map((f) => `"${f}"`).join(' ');
  // Watch mode uses vitest's built-in interactive UI — no --reporter flag
  const cmd = `npx vitest watch ${fileArgs}`;

  console.log(`  👁️  Watching ${allTestFiles.length} test file(s) for changes...`);
  console.log('  Press Ctrl+C to stop.\n');

  const child = spawn(cmd, [], {
    shell: true,
    stdio: 'inherit',
    cwd: ROOT,
  });

  // Forward SIGINT/SIGTERM to child process
  const forwardSignal = (signal: NodeJS.Signals) => {
    if (!child.killed) {
      child.kill(signal);
    }
  };
  const onSigInt = () => forwardSignal('SIGINT');
  const onSigTerm = () => forwardSignal('SIGTERM');
  process.on('SIGINT', onSigInt);
  process.on('SIGTERM', onSigTerm);

  child.on('close', (code) => {
    // Clean up signal handlers
    process.removeListener('SIGINT', onSigInt);
    process.removeListener('SIGTERM', onSigTerm);
    process.exit(code ?? 1);
  });
}

// ─── Main ───────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const failFast = args.includes('--fail-fast') || args.includes('-b');
  const coverageMode = args.includes('--coverage') || args.includes('-c');
  const watchMode = args.includes('--watch') || args.includes('-w');
  const onlyLevel = args.find((a) => a.startsWith('P') && /^P[1-6]$/.test(a));

  // Parse --since flag
  const sinceIndex = args.indexOf('--since');
  let sinceMode: string | null = null;
  if (sinceIndex !== -1) {
    const nextArg = args[sinceIndex + 1];
    // If next arg is a flag or missing, default to HEAD~1
    sinceMode = nextArg && !nextArg.startsWith('-') ? nextArg : 'HEAD~1';
  }

  // Parse --changed-since-ci flag (auto-detect base branch from CI env vars)
  const changedSinceCI = args.includes('--changed-since-ci') || args.includes('--ci');

  console.log('\n═══════════════════════════════════════');
  console.log('  ORACLE — Priority-Based Test Runner');
  console.log('═══════════════════════════════════════\n');

  if (coverageMode) {
    console.log('  📊 Coverage mode: collecting per-tier coverage metrics\n');
  }

  if (watchMode) {
    console.log('  👁️  Watch mode: re-running tests on file changes\n');
  }

  // ─── CI Auto-Detection ─────────────
  if (changedSinceCI) {
    const ci = detectCI();

    if (!ci.baseBranch) {
      console.error('  ❌ --changed-since-ci requires a CI base branch, but none was detected.');
      console.error(`     Provider: ${ci.provider}`);
      console.error('     Set GITHUB_BASE_REF or the appropriate env var for your CI provider.\n');
      process.exit(1);
    }

    console.log(`  🔄 CI mode: detected ${ci.provider} provider`);
    console.log(`     Base branch: ${ci.baseBranch}`);
    if (ci.headBranch) console.log(`     Head branch: ${ci.headBranch}`);
    if (ci.commitSha)    console.log(`     Commit: ${ci.commitSha.slice(0, 8)}`);
    console.log('');

    // Reuse the branch-ref path in getChangedFiles — no special CI_BRANCH case needed
    sinceMode = ci.baseBranch;
  }

  if (sinceMode) {
    console.log(`  🔍 Incremental mode: running tests for files changed since ${sinceMode}\n`);
  }

  if (failFast) {
    console.log('  ⚡ Fail-fast mode: stopping on first failure\n');
  }

  if (onlyLevel) {
    console.log(`  🎯 Running only ${onlyLevel} tests\n`);
  }

  let levels = onlyLevel
    ? PRIORITY_LEVELS.filter((l) => l.level === onlyLevel)
    : PRIORITY_LEVELS;

  // ─── Incremental Mode ──────────────
  if (sinceMode) {
    const changedFiles = getChangedFiles(sinceMode);

    if (changedFiles.length === 0) {
      console.log('  ✅ No changed files detected. Nothing to test.\n');
      process.exit(0);
    }

    console.log(`  Changed files (${changedFiles.length}):`);
    for (const f of changedFiles.slice(0, 20)) {
      console.log(`    • ${f}`);
    }
    if (changedFiles.length > 20) {
      console.log(`    ... and ${changedFiles.length - 20} more`);
    }
    console.log('');

    // Map source files → test files
    const affectedTests = mapSourceToTest(changedFiles);

    if (affectedTests.length === 0) {
      console.log('  ✅ No test files affected by changes. Nothing to test.\n');
      process.exit(0);
    }

    console.log(`  Affected tests (${affectedTests.length}):`);
    for (const t of affectedTests) {
      console.log(`    • ${t}`);
    }
    console.log('');

    // Filter priority levels to only affected tests
    levels = filterLevelsByChangedFiles(levels, affectedTests);

    if (levels.length === 0) {
      console.log('  ✅ No matching test files in any priority tier. Nothing to test.\n');
      process.exit(0);
    }

    const totalAffected = levels.reduce((sum, l) => sum + l.files.length, 0);
    console.log(`  Running ${totalAffected} affected test(s) across ${levels.length} tier(s):`);
    for (const l of levels) {
      console.log(`    ${l.level}: ${l.files.length} file(s)`);
    }
    console.log('');
  }

  // ─── Watch Mode ────────────────────
  if (watchMode) {
    runWatchMode(levels);
    return; // runWatchMode never exits normally
  }

  if (coverageMode) {
    runWithCoverage(levels);
  } else {
    runWithoutCoverage(levels, failFast);
  }
}

function runWithoutCoverage(levels: PriorityLevel[], failFast: boolean) {
  const results: RunResult[] = [];
  let totalTests = 0;
  let allPassed = true;

  for (const level of levels) {
    console.log(`\n${level.label}`);
    console.log(`  Files: ${level.files.length}`);

    const result = runTestsForLevel(level, failFast);
    results.push(result);
    totalTests += result.tests;

    if (!result.passed) {
      allPassed = false;
      if (failFast) {
        console.log('\n  🛑 Stopping due to --fail-fast');
        break;
      }
    }
  }

  // ─── Summary ────────────────────────
  console.log('\n═══════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════\n');

  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  for (const r of results) {
    const icon = r.passed ? '✅' : '❌';
    const duration = r.duration > 0 ? ` (${(r.duration / 1000).toFixed(1)}s)` : '';
    console.log(`  ${icon} ${r.level}: ${r.tests} tests${duration}`);
  }

  console.log(`\n  Total: ${totalTests} tests in ${(totalDuration / 1000).toFixed(1)}s`);
  console.log(`  Status: ${allPassed ? '✅ ALL PASSED' : '❌ SOME FAILED'}\n`);

  process.exit(allPassed ? 0 : 1);
}

function runWithCoverage(levels: PriorityLevel[]) {
  // Clean previous coverage output
  if (fs.existsSync(COVERAGE_DIR)) {
    fs.rmSync(COVERAGE_DIR, { recursive: true });
  }

  const results: CoverageResult[] = [];
  let totalTests = 0;
  let allPassed = true;

  for (const level of levels) {
    console.log(`\n${level.label}`);
    console.log(`  Files: ${level.files.length}`);

    const result = runTestsForLevelWithCoverage(level);
    results.push(result);
    totalTests += result.tests;

    if (!result.passed) {
      allPassed = false;
    }
  }

  // ─── Test Summary ──────────────────
  console.log('\n═══════════════════════════════════════');
  console.log('  TEST SUMMARY');
  console.log('═══════════════════════════════════════\n');

  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  for (const r of results) {
    const icon = r.passed ? '✅' : '❌';
    const duration = r.duration > 0 ? ` (${(r.duration / 1000).toFixed(1)}s)` : '';
    console.log(`  ${icon} ${r.level}: ${r.tests} tests${duration}`);
  }

  console.log(`\n  Total: ${totalTests} tests in ${(totalDuration / 1000).toFixed(1)}s`);
  console.log(`  Status: ${allPassed ? '✅ ALL PASSED' : '❌ SOME FAILED'}`);

  // ─── Coverage Report ───────────────
  printCoverageReport(results);

  process.exit(allPassed ? 0 : 1);
}

main();
