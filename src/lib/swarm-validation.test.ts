// ═══════════════════════════════════════
// ORACLE — Post-Synthesis Validation Pipeline Tests
// Cross-agent consistency · Contradiction detection · Completeness · Numerical · Citation
// ═══════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runPostSynthesisValidation } from './swarm';

// ─── Hoisted mocks ────────────────────

const { mockSelectModel } = vi.hoisted(() => ({
  mockSelectModel: vi.fn().mockReturnValue({
    providerId: 'groq',
    modelId: 'llama-3.3-70b-versatile',
    tier: 'standard' as const,
    costEstimate: { usd: 0.001, tokens: 500 },
  }),
}));

vi.mock('@/lib/model-selector', () => ({
  selectModel: (...args: unknown[]) => mockSelectModel(...args),
  logAgentPerformance: vi.fn(),
  shouldDowngradeDueToBudget: vi.fn().mockReturnValue(undefined),
  trackTokenUsage: vi.fn().mockReturnValue(true),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('@/lib/emergency-stop', () => ({
  canStartSwarm: vi.fn().mockReturnValue(null),
  registerSwarmExecution: vi.fn().mockReturnValue('exec-1'),
  shouldContinueSwarm: vi.fn().mockReturnValue(null),
  completeSwarmExecution: vi.fn(),
  isWithinCostLimit: vi.fn().mockReturnValue(true),
}));

vi.mock('@/lib/router', () => ({
  NeverStopRouter: {
    getAllKeys: vi.fn().mockReturnValue({ groq: true }),
  },
}));

// ─── Helpers ──────────────────────────

type CallAI = (
  prompt: string,
  systemPrompt?: string,
  providerId?: string,
  modelId?: string
) => Promise<{ text: string; provider: string; model: string; tokens: number }>;

function makeCallAI(validationResponse: Record<string, unknown>): CallAI {
  return vi.fn().mockResolvedValue({
    text: JSON.stringify(validationResponse),
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    tokens: 500,
  });
}

const SYNTHESIS = `
## Research Agent (standard tier)
The marketing budget should be ₹5,00,000 per month for SEO and PPC campaigns.

## Writer Agent (standard tier)
Total investment: ₹5,00,000/month with expected ROI of 3x within 6 months.

## Finance Agent (standard tier)
Recommended allocation: SEO ₹2,00,000, PPC ₹3,00,000. Total: ₹5,00,000.

**Next Step:** Approve the ₹5,00,000 monthly budget and begin campaign setup.
`;

const ORIGINAL_TASK = 'Create a marketing strategy for a dental clinic in Mumbai with ₹5,00,000 budget';

const AGENT_RESULTS = [
  '## Research Agent\nMarketing budget analysis complete.',
  '## Writer Agent\nContent strategy drafted.',
  '## Finance Agent\nBudget allocation finalized.',
];

// ─── Tests ─────────────────────────────

describe('runPostSynthesisValidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectModel.mockReturnValue({
      providerId: 'groq',
      modelId: 'llama-3.3-70b-versatile',
      tier: 'standard' as const,
      costEstimate: { usd: 0.001, tokens: 500 },
    });
  });

  // ── Cross-Agent Consistency Check ──

  describe('Cross-Agent Consistency', () => {
    it('returns null when all numbers/prices are consistent across sections', async () => {
      const callAI = makeCallAI({
        passed: true,
        issues: [],
        correctedSynthesis: null,
        overallConfidence: 92,
        summary: 'All numbers match across sections. ₹5,00,000 is consistent throughout.',
      });

      const result = await runPostSynthesisValidation(
        SYNTHESIS,
        ORIGINAL_TASK,
        AGENT_RESULTS,
        callAI,
        ['groq']
      );

      expect(result.correctedSynthesis).toBeNull();
    });

    it('returns corrected synthesis when prices contradict across sections', async () => {
      const callAI = makeCallAI({
        passed: false,
        issues: [
          {
            check: 'consistency',
            severity: 'critical',
            description: 'Research agent says ₹5,00,000 but synthesis header says ₹6,00,000',
            fix: '₹6,00,000',
            replacement: '₹5,00,000',
          },
        ],
        correctedSynthesis: SYNTHESIS.replace('₹6,00,000', '₹5,00,000'),
        overallConfidence: 55,
        summary: 'Price inconsistency detected and corrected.',
      });

      const result = await runPostSynthesisValidation(
        '## Research\nBudget is ₹6,00,000.\n## Writer\nTotal: ₹5,00,000.',
        ORIGINAL_TASK,
        AGENT_RESULTS,
        callAI,
        ['groq']
      );

      expect(result.correctedSynthesis).not.toBeNull();
      expect(result.correctedSynthesis).toContain('₹5,00,000');
    });

    it('returns null when no correctedSynthesis provided despite tool inconsistency', async () => {
      const callAI = makeCallAI({
        passed: false,
        issues: [
          {
            check: 'consistency',
            severity: 'high',
            description: 'Research agent recommends Ahrefs but synthesis section says SEMrush for SEO',
            fix: 'SEMrush for SEO',
            replacement: 'Ahrefs for SEO',
          },
        ],
        correctedSynthesis: null,
        overallConfidence: 68,
        summary: 'Tool recommendation inconsistency found.',
      });

      const result = await runPostSynthesisValidation(
        '## Research\nUse Ahrefs for SEO.\n## Strategy\nUse SEMrush for SEO.',
        ORIGINAL_TASK,
        AGENT_RESULTS,
        callAI,
        ['groq']
      );

      // confidence >= 70 would return null, but 68 < 70 AND no correctedSynthesis → still null
      // The pipeline only returns correctedSynthesis if it exists and is non-empty
      expect(result.correctedSynthesis).toBeNull();
    });

    it('detects timeline contradictions between sections', async () => {
      const callAI = makeCallAI({
        passed: false,
        issues: [
          {
            check: 'consistency',
            severity: 'medium',
            description: 'Timeline says 3 months in Research section but 6 months in Finance section',
            fix: '6 months',
            replacement: '3 months',
          },
        ],
        correctedSynthesis: '## Research\nTimeline: 3 months.\n## Finance\nTimeline: 3 months.',
        overallConfidence: 60,
        summary: 'Timeline contradiction corrected.',
      });

      const result = await runPostSynthesisValidation(
        '## Research\nTimeline: 3 months.\n## Finance\nTimeline: 6 months.',
        ORIGINAL_TASK,
        AGENT_RESULTS,
        callAI,
        ['groq']
      );

      expect(result.correctedSynthesis).not.toBeNull();
      expect(result.correctedSynthesis).toContain('3 months');
    });
  });

  // ── Contradiction Detection ──

  describe('Contradiction Detection', () => {
    it('returns null when no contradictions found', async () => {
      const callAI = makeCallAI({
        passed: true,
        issues: [],
        correctedSynthesis: null,
        overallConfidence: 95,
        summary: 'No contradictions detected. All recommendations align.',
      });

      const result = await runPostSynthesisValidation(
        'All recommendations are aligned and consistent.',
        ORIGINAL_TASK,
        AGENT_RESULTS,
        callAI,
        ['groq']
      );

      expect(result.correctedSynthesis).toBeNull();
    });

    it('returns corrected synthesis when conflicting pricing found', async () => {
      const callAI = makeCallAI({
        passed: false,
        issues: [
          {
            check: 'contradiction',
            severity: 'critical',
            description: 'Finance agent says ₹5,00,000 budget but Strategy agent recommends ₹8,00,000',
            fix: '₹8,00,000',
            replacement: '₹5,00,000',
          },
        ],
        correctedSynthesis: 'Budget: ₹5,00,000 (consistent across all agents).',
        overallConfidence: 40,
        summary: 'Critical budget contradiction corrected.',
      });

      const result = await runPostSynthesisValidation(
        'Finance: ₹5,00,000. Strategy: ₹8,00,000.',
        ORIGINAL_TASK,
        AGENT_RESULTS,
        callAI,
        ['groq']
      );

      expect(result.correctedSynthesis).not.toBeNull();
      expect(result.correctedSynthesis).toContain('₹5,00,000');
    });

    it('flags advice contradicting Indian market reality', async () => {
      const callAI = makeCallAI({
        passed: false,
        issues: [
          {
            check: 'contradiction',
            severity: 'high',
            description: 'Recommending USD pricing ($500) in Indian market context — contradicts INR requirement',
            fix: '$500',
            replacement: '₹42,000',
          },
        ],
        correctedSynthesis: 'Service cost: ₹42,000.',
        overallConfidence: 50,
        summary: 'USD pricing corrected to INR.',
      });

      const result = await runPostSynthesisValidation(
        'Service cost: $500 per month.',
        ORIGINAL_TASK,
        AGENT_RESULTS,
        callAI,
        ['groq']
      );

      expect(result.correctedSynthesis).not.toBeNull();
      expect(result.correctedSynthesis).toContain('₹42,000');
    });

    it('detects conflicting strategy recommendations', async () => {
      const callAI = makeCallAI({
        passed: false,
        issues: [
          {
            check: 'contradiction',
            severity: 'medium',
            description: 'Writer recommends aggressive tone but Voice agent suggests formal tone',
            fix: 'formal tone',
            replacement: 'professional yet approachable tone',
          },
        ],
        correctedSynthesis: 'Tone: professional yet approachable.',
        overallConfidence: 65,
        summary: 'Tone conflict resolved.',
      });

      const result = await runPostSynthesisValidation(
        'Writer: Use aggressive tone. Voice: Use formal tone.',
        ORIGINAL_TASK,
        AGENT_RESULTS,
        callAI,
        ['groq']
      );

      expect(result.correctedSynthesis).not.toBeNull();
      expect(result.correctedSynthesis).toContain('professional yet approachable');
    });
  });

  // ── Completeness Gate ──

  describe('Completeness Gate', () => {
    it('returns null when synthesis is complete with Next Step', async () => {
      const callAI = makeCallAI({
        passed: true,
        issues: [],
        correctedSynthesis: null,
        overallConfidence: 90,
        summary: 'All aspects addressed. Next Step present. No placeholders.',
      });

      const result = await runPostSynthesisValidation(
        SYNTHESIS + '\n**Next Step:** Approve budget.',
        ORIGINAL_TASK,
        AGENT_RESULTS,
        callAI,
        ['groq']
      );

      expect(result.correctedSynthesis).toBeNull();
    });

    it('returns corrected synthesis when placeholders are found', async () => {
      const callAI = makeCallAI({
        passed: false,
        issues: [
          {
            check: 'completeness',
            severity: 'critical',
            description: 'Found placeholder [INSERT YOUR LOGO HERE] in design section',
            fix: '[INSERT YOUR LOGO HERE]',
            replacement: '',
          },
        ],
        correctedSynthesis: 'Design section with logo properly placed.',
        overallConfidence: 35,
        summary: 'Placeholder removed from design section.',
      });

      const result = await runPostSynthesisValidation(
        'Design: [INSERT YOUR LOGO HERE] at the top.',
        ORIGINAL_TASK,
        AGENT_RESULTS,
        callAI,
        ['groq']
      );

      expect(result.correctedSynthesis).not.toBeNull();
    });

    it('flags missing Next Step section', async () => {
      const callAI = makeCallAI({
        passed: false,
        issues: [
          {
            check: 'completeness',
            severity: 'high',
            description: 'Missing "Next Step" section at the end of synthesis',
            fix: '',
            replacement: '\n\n**Next Step:** Review the complete marketing strategy with the clinic owner.',
          },
        ],
        correctedSynthesis: '## Strategy\nComplete plan.\n\n**Next Step:** Review with clinic owner.',
        overallConfidence: 60,
        summary: 'Next Step added.',
      });

      const result = await runPostSynthesisValidation(
        '## Strategy\nComplete plan.',
        ORIGINAL_TASK,
        AGENT_RESULTS,
        callAI,
        ['groq']
      );

      expect(result.correctedSynthesis).not.toBeNull();
      expect(result.correctedSynthesis).toContain('Next Step');
    });

    it('returns null when no correction provided for incomplete sections', async () => {
      const callAI = makeCallAI({
        passed: false,
        issues: [
          {
            check: 'completeness',
            severity: 'medium',
            description: 'Finance section appears incomplete — no budget breakdown provided',
            fix: '',
            replacement: '',
          },
        ],
        correctedSynthesis: null,
        overallConfidence: 65,
        summary: 'Finance section needs more detail.',
      });

      const result = await runPostSynthesisValidation(
        '## Finance\nTODO: Add budget breakdown.',
        ORIGINAL_TASK,
        AGENT_RESULTS,
        callAI,
        ['groq']
      );

      // No correctedSynthesis provided → returns null
      expect(result.correctedSynthesis).toBeNull();
    });
  });

  // ── Numerical Validator ──

  describe('Numerical Validator', () => {
    it('returns null when all numbers and formatting are correct', async () => {
      const callAI = makeCallAI({
        passed: true,
        issues: [],
        correctedSynthesis: null,
        overallConfidence: 94,
        summary: 'All calculations correct. INR formatting consistent.',
      });

      const result = await runPostSynthesisValidation(
        'Budget: ₹5,00,000. Breakdown: SEO ₹2,00,000 + PPC ₹3,00,000 = ₹5,00,000.',
        ORIGINAL_TASK,
        AGENT_RESULTS,
        callAI,
        ['groq']
      );

      expect(result.correctedSynthesis).toBeNull();
    });

    it('returns corrected synthesis when math doesn\'t add up', async () => {
      const callAI = makeCallAI({
        passed: false,
        issues: [
          {
            check: 'numerical',
            severity: 'high',
            description: 'Budget breakdown: ₹2,00,000 + ₹3,00,000 = ₹6,00,000 (should be ₹5,00,000)',
            fix: '₹6,00,000',
            replacement: '₹5,00,000',
          },
        ],
        correctedSynthesis: 'Budget: ₹5,00,000. Breakdown: SEO ₹2,00,000 + PPC ₹3,00,000 = ₹5,00,000.',
        overallConfidence: 50,
        summary: 'Math error corrected in budget breakdown.',
      });

      const result = await runPostSynthesisValidation(
        'Budget: ₹5,00,000. Breakdown: SEO ₹2,00,000 + PPC ₹3,00,000 = ₹6,00,000.',
        ORIGINAL_TASK,
        AGENT_RESULTS,
        callAI,
        ['groq']
      );

      expect(result.correctedSynthesis).not.toBeNull();
      expect(result.correctedSynthesis).toContain('₹5,00,000');
    });

    it('flags USD pricing in Indian context', async () => {
      const callAI = makeCallAI({
        passed: false,
        issues: [
          {
            check: 'numerical',
            severity: 'high',
            description: 'Price listed as $5,000 instead of Indian Rupee format',
            fix: '$5,000',
            replacement: '₹4,20,000',
          },
        ],
        correctedSynthesis: 'Cost: ₹4,20,000 per month.',
        overallConfidence: 45,
        summary: 'USD converted to INR.',
      });

      const result = await runPostSynthesisValidation(
        'Cost: $5,000 per month.',
        ORIGINAL_TASK,
        AGENT_RESULTS,
        callAI,
        ['groq']
      );

      expect(result.correctedSynthesis).not.toBeNull();
      expect(result.correctedSynthesis).toContain('₹4,20,000');
    });

    it('flags incorrect Indian number formatting (₹150000 instead of ₹1,50,000)', async () => {
      const callAI = makeCallAI({
        passed: false,
        issues: [
          {
            check: 'numerical',
            severity: 'medium',
            description: 'Indian number formatting incorrect: ₹150000 should be ₹1,50,000',
            fix: '₹150000',
            replacement: '₹1,50,000',
          },
        ],
        correctedSynthesis: 'Budget: ₹1,50,000.',
        overallConfidence: 70,
        summary: 'Number formatting corrected.',
      });

      const result = await runPostSynthesisValidation(
        'Budget: ₹150000.',
        ORIGINAL_TASK,
        AGENT_RESULTS,
        callAI,
        ['groq']
      );

      // confidence >= 70 AND no correctedSynthesis set → returns null
      // But here correctedSynthesis is set, so it should return it
      expect(result.correctedSynthesis).not.toBeNull();
      expect(result.correctedSynthesis).toContain('₹1,50,000');
    });

    it('validates percentage calculations', async () => {
      const callAI = makeCallAI({
        passed: false,
        issues: [
          {
            check: 'numerical',
            severity: 'medium',
            description: 'ROI stated as 400% but actual calculation gives 300% (3x return)',
            fix: '400%',
            replacement: '300%',
          },
        ],
        correctedSynthesis: 'Expected ROI: 300% (3x return on ₹5,00,000 investment).',
        overallConfidence: 65,
        summary: 'ROI percentage corrected.',
      });

      const result = await runPostSynthesisValidation(
        'Expected ROI: 400% on ₹5,00,000 investment.',
        ORIGINAL_TASK,
        AGENT_RESULTS,
        callAI,
        ['groq']
      );

      expect(result.correctedSynthesis).not.toBeNull();
      expect(result.correctedSynthesis).toContain('300%');
    });
  });

  // ── Citation & Fact Verifier ──

  describe('Citation & Fact Verifier', () => {
    it('returns null when all citations and facts are accurate', async () => {
      const callAI = makeCallAI({
        passed: true,
        issues: [],
        correctedSynthesis: null,
        overallConfidence: 88,
        summary: 'All tool recommendations verified. Pricing within Indian market ranges.',
      });

      const result = await runPostSynthesisValidation(
        'Use Ahrefs (₹10,000/mo) for SEO. Google Ads for PPC.',
        ORIGINAL_TASK,
        AGENT_RESULTS,
        callAI,
        ['groq']
      );

      expect(result.correctedSynthesis).toBeNull();
    });

    it('flags fabricated tool recommendations', async () => {
      const callAI = makeCallAI({
        passed: false,
        issues: [
          {
            check: 'citation',
            severity: 'high',
            description: 'Tool "SEOPowerMax" does not exist — appears to be fabricated',
            fix: 'SEOPowerMax',
            replacement: 'SEMrush',
          },
        ],
        correctedSynthesis: 'Use SEMrush for keyword research and competitive analysis.',
        overallConfidence: 55,
        summary: 'Fabricated tool name replaced with real alternative.',
      });

      const result = await runPostSynthesisValidation(
        'Use SEOPowerMax for keyword research.',
        ORIGINAL_TASK,
        AGENT_RESULTS,
        callAI,
        ['groq']
      );

      expect(result.correctedSynthesis).not.toBeNull();
      expect(result.correctedSynthesis).toContain('SEMrush');
    });

    it('flags unrealistic pricing for Indian market', async () => {
      const callAI = makeCallAI({
        passed: false,
        issues: [
          {
            check: 'citation',
            severity: 'medium',
            description: 'SEO tool pricing at ₹500/month is unrealistic — minimum is ₹5,000/month',
            fix: '₹500/month',
            replacement: '₹5,000/month',
          },
        ],
        correctedSynthesis: 'SEO tool cost: ₹5,000/month (market standard).',
        overallConfidence: 72,
        summary: 'Pricing corrected to realistic Indian market range.',
      });

      const result = await runPostSynthesisValidation(
        'SEO tool cost: ₹500/month.',
        ORIGINAL_TASK,
        AGENT_RESULTS,
        callAI,
        ['groq']
      );

      // confidence >= 72 AND correctedSynthesis is set → should return it
      expect(result.correctedSynthesis).not.toBeNull();
      expect(result.correctedSynthesis).toContain('₹5,000/month');
    });

    it('validates Indian legal references (GST, SEBI)', async () => {
      const callAI = makeCallAI({
        passed: false,
        issues: [
          {
            check: 'citation',
            severity: 'critical',
            description: 'GST rate cited as 18% for healthcare services — dental clinics are GST-exempt',
            fix: '18% GST',
            replacement: 'GST-exempt (healthcare under Schedule III)',
          },
        ],
        correctedSynthesis: 'Dental services are GST-exempt under Schedule III of the CGST Act.',
        overallConfidence: 45,
        summary: 'GST reference corrected — healthcare is exempt.',
      });

      const result = await runPostSynthesisValidation(
        'Dental services attract 18% GST.',
        ORIGINAL_TASK,
        AGENT_RESULTS,
        callAI,
        ['groq']
      );

      expect(result.correctedSynthesis).not.toBeNull();
      expect(result.correctedSynthesis).toContain('GST-exempt');
    });
  });

  // ── JSON Parsing Edge Cases ──

  describe('JSON Parsing', () => {
    it('parses JSON wrapped in markdown code fences', async () => {
      const validationResponse = {
        passed: true,
        issues: [],
        correctedSynthesis: null,
        overallConfidence: 90,
        summary: 'All checks passed.',
      };
      const callAI: CallAI = vi.fn().mockResolvedValue({
        text: '```json\n' + JSON.stringify(validationResponse) + '\n```',
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        tokens: 500,
      });

      const result = await runPostSynthesisValidation(
        SYNTHESIS,
        ORIGINAL_TASK,
        AGENT_RESULTS,
        callAI,
        ['groq']
      );

      expect(result.correctedSynthesis).toBeNull();
    });

    it('extracts JSON from surrounding text', async () => {
      const validationResponse = {
        passed: true,
        issues: [],
        correctedSynthesis: null,
        overallConfidence: 88,
        summary: 'Passed.',
      };
      const callAI: CallAI = vi.fn().mockResolvedValue({
        text: 'Here is my validation result:\n' + JSON.stringify(validationResponse) + '\nDone.',
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        tokens: 500,
      });

      const result = await runPostSynthesisValidation(
        SYNTHESIS,
        ORIGINAL_TASK,
        AGENT_RESULTS,
        callAI,
        ['groq']
      );

      expect(result.correctedSynthesis).toBeNull();
    });

    it('returns null (original) when AI response is unparseable', async () => {
      const callAI: CallAI = vi.fn().mockResolvedValue({
        text: 'This is just plain text with no JSON at all.',
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        tokens: 500,
      });

      const result = await runPostSynthesisValidation(
        SYNTHESIS,
        ORIGINAL_TASK,
        AGENT_RESULTS,
        callAI,
        ['groq']
      );

      expect(result.correctedSynthesis).toBeNull(); // falls back to original synthesis
    });

    it('handles API failure gracefully', async () => {
      const callAI: CallAI = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await runPostSynthesisValidation(
        SYNTHESIS,
        ORIGINAL_TASK,
        AGENT_RESULTS,
        callAI,
        ['groq']
      );

      expect(result.correctedSynthesis).toBeNull(); // falls back to original synthesis
    });

    it('handles response with missing fields gracefully', async () => {
      const callAI: CallAI = vi.fn().mockResolvedValue({
        text: JSON.stringify({ passed: true }),
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        tokens: 500,
      });

      const result = await runPostSynthesisValidation(
        SYNTHESIS,
        ORIGINAL_TASK,
        AGENT_RESULTS,
        callAI,
        ['groq']
      );

      expect(result.correctedSynthesis).toBeNull();
    });
  });

  // ── Confidence Thresholds ──

  describe('Confidence Thresholds', () => {
    it('returns correctedSynthesis when provided and not passed', async () => {
      const callAI = makeCallAI({
        passed: false,
        issues: [{ check: 'consistency', severity: 'high', description: 'Minor inconsistency' }],
        correctedSynthesis: 'Corrected synthesis content here.',
        overallConfidence: 55,
        summary: 'Low confidence, corrections applied.',
      });

      const result = await runPostSynthesisValidation(
        SYNTHESIS,
        ORIGINAL_TASK,
        AGENT_RESULTS,
        callAI,
        ['groq']
      );

      expect(result.correctedSynthesis).toBe('Corrected synthesis content here.');
    });

    it('returns null when no correctedSynthesis provided despite low confidence', async () => {
      const callAI = makeCallAI({
        passed: false,
        issues: [{ check: 'polish', severity: 'low', description: 'Minor style issue' }],
        correctedSynthesis: null,
        overallConfidence: 75,
        summary: 'Minor issues only, no correction needed.',
      });

      const result = await runPostSynthesisValidation(
        SYNTHESIS,
        ORIGINAL_TASK,
        AGENT_RESULTS,
        callAI,
        ['groq']
      );

      expect(result.correctedSynthesis).toBeNull();
    });

    it('returns null when passed is true regardless of issues', async () => {
      const callAI = makeCallAI({
        passed: true,
        issues: [{ check: 'polish', severity: 'low', description: 'Could be more concise' }],
        correctedSynthesis: null,
        overallConfidence: 85,
        summary: 'Passed with minor notes.',
      });

      const result = await runPostSynthesisValidation(
        SYNTHESIS,
        ORIGINAL_TASK,
        AGENT_RESULTS,
        callAI,
        ['groq']
      );

      expect(result.correctedSynthesis).toBeNull();
    });

    it('returns empty correctedSynthesis as null (no-op)', async () => {
      const callAI = makeCallAI({
        passed: false,
        issues: [{ check: 'consistency', severity: 'high', description: 'Issue found' }],
        correctedSynthesis: '',
        overallConfidence: 40,
        summary: 'Issues found but no correction provided.',
      });

      const result = await runPostSynthesisValidation(
        SYNTHESIS,
        ORIGINAL_TASK,
        AGENT_RESULTS,
        callAI,
        ['groq']
      );

      // Empty string correctedSynthesis → treated as falsy → returns null
      expect(result.correctedSynthesis).toBeNull();
    });
  });

  // ── Provider Selection ──

  describe('Provider Selection', () => {
    it('calls selectModel with editor agent and standard tier', async () => {
      const callAI = makeCallAI({
        passed: true,
        issues: [],
        correctedSynthesis: null,
        overallConfidence: 90,
        summary: 'Passed.',
      });

      await runPostSynthesisValidation(
        SYNTHESIS,
        ORIGINAL_TASK,
        AGENT_RESULTS,
        callAI,
        ['groq', 'openai']
      );

      expect(mockSelectModel).toHaveBeenCalledWith(
        ORIGINAL_TASK,
        'editor',
        ['groq', 'openai'],
        'standard'
      );
    });

    it('uses empty providers list gracefully', async () => {
      const callAI = makeCallAI({
        passed: true,
        issues: [],
        correctedSynthesis: null,
        overallConfidence: 90,
        summary: 'Passed.',
      });

      await runPostSynthesisValidation(
        SYNTHESIS,
        ORIGINAL_TASK,
        AGENT_RESULTS,
        callAI,
        []
      );

      expect(mockSelectModel).toHaveBeenCalledWith(
        ORIGINAL_TASK,
        'editor',
        [],
        'standard'
      );
    });
  });

  // ── Multi-Check Scenarios ──

  describe('Multi-Check Scenarios', () => {
    it('handles synthesis with multiple critical issues across checks', async () => {
      const callAI = makeCallAI({
        passed: false,
        issues: [
          {
            check: 'consistency',
            severity: 'critical',
            description: 'Budget shows ₹5,00,000 in one section and ₹7,00,000 in another',
            fix: '₹7,00,000',
            replacement: '₹5,00,000',
          },
          {
            check: 'contradiction',
            severity: 'high',
            description: 'Strategy says "aggressive growth" but Finance says "conservative approach"',
            fix: 'conservative approach',
            replacement: 'balanced growth approach',
          },
          {
            check: 'numerical',
            severity: 'high',
            description: 'ROI calculated as 500% but 3x = 300%',
            fix: '500%',
            replacement: '300%',
          },
          {
            check: 'citation',
            severity: 'medium',
            description: 'Tool "GrowthBot" does not exist',
            fix: 'GrowthBot',
            replacement: 'Google Analytics',
          },
          {
            check: 'completeness',
            severity: 'high',
            description: 'Missing Next Step section',
            fix: '',
            replacement: '\n\n**Next Step:** Review strategy with clinic owner.',
          },
        ],
        correctedSynthesis:
          '## Complete Strategy\nBudget: ₹5,00,000.\nApproach: balanced growth.\nROI: 300%.\nTools: Google Analytics.\n\n**Next Step:** Review with clinic owner.',
        overallConfidence: 25,
        summary: '5 critical issues corrected across all checks.',
      });

      const result = await runPostSynthesisValidation(
        '## Strategy\nBudget: ₹7,00,000. Approach: conservative. ROI: 500%. Tool: GrowthBot.',
        ORIGINAL_TASK,
        AGENT_RESULTS,
        callAI,
        ['groq']
      );

      expect(result.correctedSynthesis).not.toBeNull();
      expect(result.correctedSynthesis).toContain('₹5,00,000');
      expect(result.correctedSynthesis).toContain('balanced growth');
      expect(result.correctedSynthesis).toContain('300%');
      expect(result.correctedSynthesis).toContain('Google Analytics');
      expect(result.correctedSynthesis).toContain('Next Step');
    });

    it('returns null when synthesis passes all 5 checks', async () => {
      const callAI = makeCallAI({
        passed: true,
        issues: [],
        correctedSynthesis: null,
        overallConfidence: 96,
        summary: 'All 5 validation checks passed. Output is client-ready.',
      });

      const result = await runPostSynthesisValidation(
        SYNTHESIS,
        ORIGINAL_TASK,
        AGENT_RESULTS,
        callAI,
        ['groq']
      );

      expect(result.correctedSynthesis).toBeNull();
    });
  });
});
