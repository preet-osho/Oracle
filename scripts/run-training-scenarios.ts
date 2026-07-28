#!/usr/bin/env tsx
// ═══════════════════════════════════════
// ORACLE — Training Scenario Runner CLI
// Run training scenarios for agent evaluation
//
// Usage:
//   npx tsx scripts/run-training-scenarios.ts
//   npx tsx scripts/run-training-scenarios.ts --agent researcher
//   npx tsx scripts/run-training-scenarios.ts --difficulty hard
//   npx tsx scripts/run-training-scenarios.ts --category india-specific
//   npx tsx scripts/run-training-scenarios.ts --critical
//   npx tsx scripts/run-training-scenarios.ts --list
// ═══════════════════════════════════════

import {
  TRAINING_SCENARIOS,
} from '../src/lib/agents/training-scenarios-library';
import {
  TrainingScenarioRunner,
  type AgentExecutor,
} from '../src/lib/agents/training-scenario-runner';
import type {
  TrainingScenario,
  ScenarioResult,
  BatchScenarioResult,
} from '../src/lib/agents/training-scenarios';
import { AGENT_REGISTRY, type AgentName } from '../src/lib/agents/registry';

// ─── ANSI Colors ───────────────────────

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

function colorize(text: string, color: keyof typeof colors): string {
  return `${colors[color]}${text}${colors.reset}`;
}

// ─── CLI Argument Parsing ──────────────

interface CLIOptions {
  agent?: string;
  difficulty?: string;
  category?: string;
  critical: boolean;
  list: boolean;
  verbose: boolean;
  help: boolean;
  scenarioId?: string;
}

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {
    critical: false,
    list: false,
    verbose: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--agent':
      case '-a':
        options.agent = args[++i];
        break;
      case '--difficulty':
      case '-d':
        options.difficulty = args[++i];
        break;
      case '--category':
      case '-c':
        options.category = args[++i];
        break;
      case '--critical':
        options.critical = true;
        break;
      case '--list':
      case '-l':
        options.list = true;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--scenario':
      case '-s':
        options.scenarioId = args[++i];
        break;
      default:
        if (arg.startsWith('-')) break;
        if (arg.includes('-') && /\d/.test(arg)) {
          options.scenarioId = arg;
        }
    }
  }

  return options;
}

// ─── Help Text ─────────────────────────

function printHelp() {
  console.log(`
${colorize('═══════════════════════════════════════', 'cyan')}
  ${colorize('ORACLE — Training Scenario Runner CLI', 'bright')}
${colorize('═══════════════════════════════════════', 'cyan')}

${colorize('USAGE:', 'bright')}
  npx tsx scripts/run-training-scenarios.ts [options]

${colorize('OPTIONS:', 'bright')}
  --agent, -a <name>      Filter by agent type (e.g., researcher, writer, developer)
  --difficulty, -d <level> Filter by difficulty (easy, medium, hard, adversarial)
  --category, -c <name>   Filter by category (single-agent, india-specific, edge-case, etc.)
  --critical              Run only critical scenarios
  --scenario, -s <id>     Run a specific scenario by ID (e.g., researcher-001)
  --list, -l              List all available scenarios
  --verbose, -v           Show detailed output
  --help, -h              Show this help message

${colorize('EXAMPLES:', 'bright')}
  # Run all scenarios
  npx tsx scripts/run-training-scenarios.ts

  # Run only researcher scenarios
  npx tsx scripts/run-training-scenarios.ts --agent researcher

  # Run hard difficulty scenarios
  npx tsx scripts/run-training-scenarios.ts --difficulty hard

  # Run India-specific scenarios
  npx tsx scripts/run-training-scenarios.ts --category india-specific

  # Run critical scenarios only
  npx tsx scripts/run-training-scenarios.ts --critical

  # Run a specific scenario
  npx tsx scripts/run-training-scenarios.ts --scenario researcher-001

  # List all scenarios
  npx tsx scripts/run-training-scenarios.ts --list

  # List scenarios with details
  npx tsx scripts/run-training-scenarios.ts --list --verbose

${colorize('AVAILABLE AGENTS:', 'bright')}
  ${Object.keys(AGENT_REGISTRY).join(', ')}

${colorize('AVAILABLE DIFFICULTIES:', 'bright')}
  easy, medium, hard, adversarial

${colorize('AVAILABLE CATEGORIES:', 'bright')}
  single-agent, multi-agent-workflow, edge-case, failure-recovery,
  india-specific, client-facing, technical, compliance, performance-under-pressure
`);
}

// ─── List Scenarios ────────────────────

function listScenariosFiltered(scenarios: TrainingScenario[], verbose: boolean) {
  console.log(`\n${colorize('═══════════════════════════════════════', 'cyan')}`);
  console.log(colorize('  TRAINING SCENARIOS', 'bright'));
  console.log(`${colorize('═══════════════════════════════════════', 'cyan')}\n`);

  const byCategory = new Map<string, TrainingScenario[]>();
  for (const scenario of scenarios) {
    const cat = scenario.category;
    if (!byCategory.has(cat)) {
      byCategory.set(cat, []);
    }
    byCategory.get(cat)!.push(scenario);
  }

  for (const [category, categoryScenarios] of byCategory) {
    console.log(colorize(`📁 ${category.toUpperCase()}`, 'bright'));

    for (const s of categoryScenarios) {
      const difficultyColor = ({
        easy: 'green',
        medium: 'yellow',
        hard: 'red',
        adversarial: 'magenta',
      } as Record<string, keyof typeof colors>)[s.difficulty] || 'white';

      const criticalIcon = s.isCritical ? ' ⚠️' : '';

      console.log(`  ${colorize(s.id, 'cyan')} [${colorize(s.difficulty, difficultyColor)}] - ${s.agentNames.join(', ')}${criticalIcon}`);

      if (verbose) {
        console.log(`    Task: ${colorize(s.taskPrompt.slice(0, 80) + (s.taskPrompt.length > 80 ? '...' : ''), 'dim')}`);
        console.log(`    Rubric criteria: ${s.rubric.customCriteria?.length ?? 0}, Bonuses: ${s.rubric.bonusPoints?.length ?? 0}, Penalties: ${s.rubric.penalties?.length ?? 0}`);
        console.log('');
      }
    }
    console.log('');
  }

  console.log(colorize(`Total: ${scenarios.length} scenarios`, 'bright'));
  const critCount = scenarios.filter(s => s.isCritical).length;
  if (critCount > 0) {
    console.log(colorize(`Critical: ${critCount} scenarios`, 'yellow'));
  }
  console.log('');
}

// ─── Mock Agent Executor ───────────────

function createMockExecutor(): AgentExecutor {
  return async (agentName: AgentName, taskPrompt: string): Promise<string> => {
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

    const mockResponses: Record<string, string> = {
      researcher: `## Market Research Report: SEO Services in India\n\n### Executive Summary\nBased on comprehensive analysis of the Indian SEO market, we have identified significant growth opportunities across Tier 1 and Tier 2 cities. The market is projected to reach ₹15,000 Cr by 2027.\n\n### Key Findings\n\n**Market Size & Growth**\n- Current Indian SEO market: ₹8,500 Cr (2025)\n- Projected CAGR: 22% through 2027\n- Digital ad spend growing at 30% YoY\n\n**Pricing Landscape (INR)**\n| Service Tier | Monthly Price | Target Segment |\n|-------------|---------------|----------------|\n| Basic SEO | ₹15,000 - ₹25,000 | Local businesses |\n| Standard SEO | ₹30,000 - ₹60,000 | Mid-market SMBs |\n| Premium SEO | ₹75,000 - ₹2,00,000 | Enterprise clients |\n| E-commerce SEO | ₹50,000 - ₹1,50,000 | Online stores |\n\n**Competitive Landscape**\n1. Webchutney (now Dentsu Webchutney) - Premium positioning\n2. PageTraffic - Mid-market focus\n3. SEOValley - Affordable packages\n4. Bruce Clay India - Enterprise segment\n\n**Recommendations**\n1. Focus on Tier 2 cities (Pune, Jaipur, Lucknow) for underserved market\n2. Offer bundled packages combining SEO + content marketing\n3. Price competitively at ₹25,000-₹50,000 for mid-market\n4. Leverage AI tools for efficiency gains\n\nSources: IAMAI, Statista, RedSeer Consulting`,
      writer: `## Professional Landing Page Copy: InvoiceMaster Pro\n\n### Hero Section\n**Headline:** Simplify Your Invoicing — Get Paid Faster\n**Subheadline:** India's #1 invoicing software trusted by 50,000+ businesses. Generate GST-compliant invoices in seconds.\n**CTA:** Start Free Trial → No credit card required\n\n### Value Proposition 1: GST-Compliant Invoicing\nCreate professional invoices that comply with India's GST regulations. Auto-calculate CGST, SGST, and IGST based on your state and client location. Never worry about tax errors again.\n\n### Value Proposition 2: Multi-Channel Payment Collection\nAccept payments via UPI, NEFT, RTGS, credit/debit cards, and popular wallets. Get paid 3x faster with automated payment reminders via WhatsApp and SMS.\n\n### Value Proposition 3: Real-Time Business Insights\nTrack your cash flow, outstanding payments, and revenue trends with beautiful dashboards. Know exactly where your money stands at any moment.\n\n### Social Proof\n> "InvoiceMaster reduced our payment collection time from 45 days to 12 days." — Rajesh Kumar, Founder, TechStart India\n\n**Trusted by:** 50,000+ businesses across India\n**Invoices Generated:** ₹2,500 Cr worth of invoices\n\n### Pricing (All in INR)\n| Plan | Monthly Price | Features |\n|------|--------------|----------|\n| Starter | ₹499/mo | 50 invoices, 1 user |\n| Business | ₹999/mo | Unlimited invoices, 5 users |\n| Enterprise | ₹2,499/mo | API access, custom branding |\n\n### Final CTA\nStart your 14-day free trial today. No credit card required. Join 50,000+ Indian businesses already using InvoiceMaster Pro.`,
      developer: `## Next.js API Route Implementation\n\nHere's a complete, production-ready API route for lead capture:\n\n\`\`\`typescript\n// src/app/api/leads/capture/route.ts\nimport { NextRequest, NextResponse } from 'next/server';\nimport { createClient } from '@supabase/supabase-js';\nimport { z } from 'zod';\n\n// Input validation schema\nconst LeadSchema = z.object({\n  name: z.string().min(2, 'Name must be at least 2 characters'),\n  email: z.string().email('Invalid email address'),\n  phone: z.string().regex(/^[\\+]?[0-9]{10,13}$/, 'Invalid phone number'),\n  message: z.string().optional(),\n  source: z.string().optional(),\n});\n\ntype LeadInput = z.infer<typeof LeadSchema>;
\n// Supabase client\nconst supabase = createClient(\n  process.env.NEXT_PUBLIC_SUPABASE_URL!,\n  process.env.SUPABASE_SERVICE_ROLE_KEY!,\n);\n\nexport async function POST(request: NextRequest) {\n  try {\n    // Parse and validate request body\n    const body = await request.json();\n    const validationResult = LeadSchema.safeParse(body);\n\n    if (!validationResult.success) {\n      return NextResponse.json(\n        {\n          success: false,\n          error: 'Validation failed',\n          details: validationResult.error.flatten().fieldErrors,\n        },\n        { status: 400 }\n      );\n    }\n\n    const leadData: LeadInput = validationResult.data;\n\n    // Insert into Supabase\n    const { data, error } = await supabase\n      .from('leads')\n      .insert({\n        name: leadData.name,\n        email: leadData.email,\n        phone: leadData.phone,\n        message: leadData.message || null,\n        source: leadData.source || 'website',\n        status: 'new',\n        created_at: new Date().toISOString(),\n      })\n      .select()\n      .single();\n\n    if (error) {\n      console.error('Supabase error:', error);\n      return NextResponse.json(\n        { success: false, error: 'Failed to save lead' },\n        { status: 500 }\n      );\n    }\n\n    // Return success response\n    return NextResponse.json({\n      success: true,\n      message: 'Lead captured successfully',\n      data: { id: data.id },\n    }, { status: 201 });\n\n  } catch (error) {\n    console.error('API error:', error);\n    return NextResponse.json(\n      { success: false, error: 'Internal server error' },\n      { status: 500 }\n    );\n  }\n}\n\n// Handle unsupported methods\nexport async function GET() {\n  return NextResponse.json(\n    { error: 'Method not allowed' },\n    { status: 405 }\n  );\n}\n\`\`\`\n\n### Key Features\n- TypeScript with full type safety\n- Zod schema validation\n- Proper error handling with try-catch\n- Supabase integration with service role key\n- Returns appropriate HTTP status codes\n- Input sanitization and validation\n- Structured error responses for frontend consumption`,
      analyst: `## SEO Health Analysis Report: example.com\n\n### Executive Summary\nOverall SEO Health Score: 62/100 (Needs Improvement)\n\n### Technical Issues Found\n\n#### Critical (Fix Immediately)\n1. **Missing Meta Descriptions** — 47% of pages lack meta descriptions\n   - Impact: Reduced click-through rates from search results\n   - Fix: Add unique, keyword-rich meta descriptions (150-160 chars)\n   - Expected Impact: +15-20% organic CTR improvement\n\n2. **Slow Core Web Vitals** — LCP: 4.2s (should be < 2.5s)\n   - Impact: Poor mobile experience, ranking penalty\n   - Fix: Optimize images (WebP format), implement lazy loading, use CDN\n   - Expected Impact: +10-15% ranking improvement\n\n3. **Broken Internal Links** — 23 broken links detected\n   - Impact: Crawl budget waste, poor user experience\n   - Fix: Update or redirect all broken links\n   - Expected Impact: Better crawl efficiency\n\n#### High Priority\n4. **Missing Schema Markup** — No structured data found\n   - Fix: Add Organization, FAQPage, and BreadcrumbList schemas\n\n5. **Duplicate Content** — 12 pages with similar content\n   - Fix: Implement canonical tags, consolidate similar pages\n\n### Recommended Action Plan\n| Priority | Action | Owner | Timeline | Expected Impact |\n|----------|--------|-------|----------|-----------------|\n| P1 | Fix Core Web Vitals | Dev team | Week 1-2 | +15% rankings |\n| P1 | Add meta descriptions | Content | Week 1 | +20% CTR |\n| P2 | Fix broken links | Dev team | Week 2 | Better UX |\n| P2 | Add schema markup | Dev team | Week 2-3 | Rich snippets |\n| P3 | Consolidate content | Content | Week 3-4 | Reduced cannibalization |\n\n### Sources\n- Google PageSpeed Insights\n- Screaming Frog crawl data\n- Search Console performance report`,
      strategist: `## 90-Day Go-to-Market Strategy: B2B SaaS for Indian SMBs\n\n### Executive Summary\nTarget: Capture 500 SMB customers in 90 days with ₹5,00,000 budget.\n\n### Channel Strategy & Budget Allocation (₹5,00,000)\n\n| Channel | Budget | Expected Leads | Cost per Lead |\n|---------|--------|----------------|---------------|\n| Google Ads | ₹1,50,000 | 200 | ₹750 |\n| LinkedIn Ads | ₹1,00,000 | 100 | ₹1,000 |\n| Content Marketing | ₹80,000 | 150 | ₹533 |\n| WhatsApp Outreach | ₹50,000 | 120 | ₹417 |\n| Referral Program | ₹70,000 | 80 | ₹875 |\n| Events/Webinars | ₹50,000 | 50 | ₹1,000 |\n\n### 90-Day Timeline\n\n**Month 1 (Days 1-30): Foundation**\n- Week 1: Launch Google Ads campaigns targeting "invoicing software India", "GST billing software"\n- Week 2: Publish 8 SEO-optimized blog posts targeting long-tail keywords\n- Week 3: Start LinkedIn outreach to 500 Indian startup founders\n- Week 4: Launch WhatsApp broadcast to warm leads\n- Milestone: 50 qualified leads\n\n**Month 2 (Days 31-60): Scale**\n- Week 5-6: Double down on top-performing Google Ads keywords\n- Week 7-8: Host 2 webinars on "GST compliance for SMBs"\n- Launch referral program: ₹2,000 credit per referral\n- Milestone: 200 total leads, 20 trials\n\n**Month 3 (Days 61-90): Optimize**\n- Week 9-10: A/B test landing pages for conversion optimization\n- Week 11-12: Scale WhatsApp automation sequences\n- Focus on converting trials to paid\n- Milestone: 500 leads, 50 paid customers\n\n### KPIs\n1. **Leads Generated**: 500 target\n2. **Trial Signups**: 50 target\n3. **Paid Conversions**: 50 target\n4. **Cost per Acquisition**: ₹10,000 target\n5. **MRR from New Customers**: ₹2,50,000 target\n\n### India-Specific Considerations\n- GST compliance messaging resonates strongly\n- WhatsApp is primary communication channel\n- Price sensitivity: ₹999/mo sweet spot\n- Trust signals: Indian company, local support\n- Festival season (Oct-Nov) for promotional campaigns`,
      default: `## Task Completion Report\n\n### Summary\nI've completed the requested task with comprehensive analysis and actionable recommendations. Here's what was delivered:\n\n### Key Deliverables\n1. **Comprehensive Analysis** — Thorough review covering all aspects of the requirements\n2. **India-Specific Context** — Recommendations tailored for the Indian market with INR pricing\n3. **Actionable Recommendations** — Clear next steps with priority ordering\n4. **Risk Assessment** — Identified potential challenges and mitigation strategies\n\n### Implementation Notes\n- All pricing references use INR (₹) for Indian market relevance\n- Recommendations consider Indian regulatory requirements (DPDP Act, GST)\n- Timeline accounts for Indian festival seasons and business cycles\n- Budget allocations reflect Indian market cost structures\n\n### Next Steps\n1. Review recommendations and prioritize based on business goals\n2. Allocate budget for Q1 initiatives\n3. Set up tracking and measurement framework\n4. Schedule follow-up review in 2 weeks\n\nPlease let me know if you need any modifications or additional details.`,
    };

    return mockResponses[agentName] || mockResponses.default;
  };
}

// ─── Display Results ───────────────────

function displayResult(result: ScenarioResult, verbose: boolean) {
  const passedColor: keyof typeof colors = result.passed ? 'green' : 'red';
  const passedIcon = result.passed ? '✅' : '❌';
  const outcomeIcon = ({
    pass: '✅',
    fail: '❌',
    partial: '⚠️',
    flagged: '🚩',
  } as Record<string, string>)[result.actualOutcome] || '❓';

  console.log(`${passedIcon} ${colorize(result.scenarioId, 'cyan')} - ${outcomeIcon} ${colorize(result.actualOutcome.toUpperCase(), passedColor)} (Score: ${result.finalScore.toFixed(1)})`);

  if (verbose || !result.passed) {
    console.log(`   Duration: ${result.executionTimeMs}ms`);
    console.log(`   Rubric Score: ${result.weightedTotal.toFixed(1)}, Bonus: +${result.bonusPointsEarned.toFixed(1)}, Penalty: -${result.penaltyDeductions.toFixed(1)}`);

    if (result.contentChecks.wordCount > 0) {
      console.log(`   Word count: ${result.contentChecks.wordCount}`);
    }

    if (result.contentChecks.mustContainResults.some(r => !r.found)) {
      const missing = result.contentChecks.mustContainResults.filter(r => !r.found).map(r => r.term);
      console.log(`   ${colorize('Missing:', 'red')} ${missing.join(', ')}`);
    }

    if (result.contentChecks.mustNotContainResults.some(r => r.found)) {
      const forbidden = result.contentChecks.mustNotContainResults.filter(r => r.found).map(r => r.term);
      console.log(`   ${colorize('Forbidden:', 'red')} ${forbidden.join(', ')}`);
    }

    if (result.detectedFlags.length > 0) {
      console.log(`   ${colorize('Flags:', 'yellow')} ${result.detectedFlags.join(', ')}`);
    }

    if (result.feedback.length > 0 && verbose) {
      console.log(`   Feedback: ${result.feedback.join('; ')}`);
    }

    console.log('');
  }
}

function displaySummary(result: BatchScenarioResult) {
  console.log(`\n${colorize('═══════════════════════════════════════', 'cyan')}`);
  console.log(colorize('  SUMMARY', 'bright'));
  console.log(`${colorize('═══════════════════════════════════════', 'cyan')}\n`);

  console.log(`  Total Scenarios: ${result.totalScenarios}`);
  console.log(`  ${colorize(`Passed: ${result.passedCount}`, 'green')}`);
  console.log(`  ${colorize(`Failed: ${result.failedCount}`, 'red')}`);
  console.log(`  Pass Rate: ${result.passRate.toFixed(1)}%`);
  console.log(`  Average Score: ${result.averageScore.toFixed(1)}`);

  if (Object.keys(result.agentSummaries).length > 0) {
    console.log(`\n${colorize('  AGENT PERFORMANCE:', 'bright')}`);
    for (const [agent, summary] of Object.entries(result.agentSummaries)) {
      const passRate = summary.totalTests > 0 ? (summary.passed / summary.totalTests) * 100 : 0;
      const statusIcon = passRate >= 80 ? '🟢' : passRate >= 60 ? '🟡' : '🔴';
      console.log(`    ${statusIcon} ${agent}: ${summary.passed}/${summary.totalTests} passed (${passRate.toFixed(0)}%), avg score: ${summary.averageScore.toFixed(1)}`);
    }
  }

  console.log('');
}

// ─── Main ──────────────────────────────

async function main() {
  const options = parseArgs();

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  console.log(`\n${colorize('═══════════════════════════════════════', 'cyan')}`);
  console.log(colorize('  ORACLE — Training Scenario Runner', 'bright'));
  console.log(`${colorize('═══════════════════════════════════════', 'cyan')}\n`);

  let scenarios: TrainingScenario[] = [...TRAINING_SCENARIOS];

  // Apply filters (used by both --list and run modes)
  if (options.scenarioId) {
    const found = TRAINING_SCENARIOS.find(s => s.id === options.scenarioId);
    if (!found) {
      console.error(colorize(`❌ Scenario not found: ${options.scenarioId}`, 'red'));
      console.log('\nUse --list to see available scenarios.');
      process.exit(1);
    }
    scenarios = [found];
  }

  if (options.agent) {
    if (!AGENT_REGISTRY[options.agent as AgentName]) {
      console.error(colorize(`❌ Unknown agent: ${options.agent}`, 'red'));
      console.log('\nAvailable agents:', Object.keys(AGENT_REGISTRY).join(', '));
      process.exit(1);
    }
    scenarios = scenarios.filter(s => s.agentNames.includes(options.agent as AgentName));
    if (scenarios.length === 0) {
      console.error(colorize(`❌ No scenarios found for agent: ${options.agent}`, 'red'));
      process.exit(1);
    }
  }

  if (options.difficulty) {
    if (!['easy', 'medium', 'hard', 'adversarial'].includes(options.difficulty)) {
      console.error(colorize(`❌ Unknown difficulty: ${options.difficulty}`, 'red'));
      console.log('\nAvailable difficulties: easy, medium, hard, adversarial');
      process.exit(1);
    }
    scenarios = scenarios.filter(s => s.difficulty === options.difficulty);
    if (scenarios.length === 0) {
      console.error(colorize(`❌ No scenarios found with difficulty: ${options.difficulty}`, 'red'));
      process.exit(1);
    }
  }

  if (options.category) {
    scenarios = scenarios.filter(s => s.category === options.category);
    if (scenarios.length === 0) {
      console.error(colorize(`❌ No scenarios found in category: ${options.category}`, 'red'));
      console.log('\nAvailable categories: single-agent, multi-agent-workflow, edge-case, failure-recovery, india-specific, client-facing, technical, compliance, performance-under-pressure');
      process.exit(1);
    }
  }

  if (options.critical) {
    scenarios = scenarios.filter(s => s.isCritical);
  }

  if (options.list) {
    listScenariosFiltered(scenarios, options.verbose);
    process.exit(0);
  }

  if (options.agent || options.difficulty || options.category || options.critical || options.scenarioId) {
    console.log(colorize('Filters applied:', 'dim'));
    if (options.agent) console.log(`  Agent: ${options.agent}`);
    if (options.difficulty) console.log(`  Difficulty: ${options.difficulty}`);
    if (options.category) console.log(`  Category: ${options.category}`);
    if (options.critical) console.log(`  Critical only: yes`);
    if (options.scenarioId) console.log(`  Scenario: ${options.scenarioId}`);
    console.log('');
  }

  console.log(colorize(`Running ${scenarios.length} scenario(s)...`, 'bright'));
  console.log('');

  const executor = createMockExecutor();
  const runner = new TrainingScenarioRunner({
    maxConcurrency: 3,
    scenarioTimeoutMs: 30000,
  });

  const result = await runner.runBatch(
    scenarios.map(s => s.id),
    executor,
  );

  console.log(`${colorize('═══════════════════════════════════════', 'cyan')}`);
  console.log(colorize('  RESULTS', 'bright'));
  console.log(`${colorize('═══════════════════════════════════════', 'cyan')}\n`);

  for (const r of result.results) {
    displayResult(r, options.verbose);
  }

  displaySummary(result);

  process.exit(result.failedCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(colorize('\n❌ Error:', 'red'), err);
  process.exit(1);
});
