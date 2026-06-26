// ═══════════════════════════════════════
// ORACLE — Editor Gate
// Automatic final-pass quality gate using the editor agent
// Runs after every AI response to catch grammar, consistency, placeholders, and polish issues
// ═══════════════════════════════════════

import { EDITOR_AGENT_PROMPT } from '@/lib/agents/editor-agent';
import { csrfHeaders } from '@/lib/csrf';
import { createLogger } from '@/lib/logger';

const log = createLogger('EditorGate');

// ─── Types ─────────────────────────────

export interface EditorGateResult {
  /** Whether the output passed the editor gate */
  passed: boolean;
  /** Issues found by the editor */
  issues: EditorIssue[];
  /** The corrected text if issues were found and fixed */
  correctedText?: string;
  /** Overall confidence score (0-100) */
  confidence: number;
  /** Brief assessment */
  assessment: string;
  /** Timestamp */
  checkedAt: number;
}

export interface EditorIssue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  description: string;
  location?: string;
}

// ─── Editor Gate Config ────────────────

export interface EditorGateConfig {
  enabled: boolean;
  /** Maximum response length to run editor gate on (skip very short responses) */
  minLength: number;
  /** Skip editor gate for certain agent types (e.g., 'orchestrator' may not need it) */
  skipAgentTypes: string[];
}

export const DEFAULT_EDITOR_CONFIG: EditorGateConfig = {
  enabled: true,
  minLength: 100,
  skipAgentTypes: [],
};

const EDITOR_CONFIG_KEY = 'oracle-editor-gate-config';

export function loadEditorConfig(): EditorGateConfig {
  if (typeof window === 'undefined') return DEFAULT_EDITOR_CONFIG;
  try {
    const raw = localStorage.getItem(EDITOR_CONFIG_KEY);
    if (!raw) return DEFAULT_EDITOR_CONFIG;
    const parsed = JSON.parse(raw) as Partial<EditorGateConfig>;
    return { ...DEFAULT_EDITOR_CONFIG, ...parsed };
  } catch {
    return DEFAULT_EDITOR_CONFIG;
  }
}

export function saveEditorConfig(config: EditorGateConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(EDITOR_CONFIG_KEY, JSON.stringify(config));
  } catch (e) {
    log.warn('Failed to save editor config', { error: e instanceof Error ? e.message : 'Unknown' });
  }
}

// ─── Editor Gate Runner ────────────────

/**
 * Run the editor agent as a final-pass quality gate on an AI response.
 *
 * This sends the response through the editor agent prompt via the /api/ai/chat proxy,
 * which checks for grammar, consistency, placeholders, INR formatting, and professional polish.
 *
 * @param userRequest - The original user request
 * @param aiResponse - The AI-generated response to review
 * @param agentType - The agent type that generated the response
 * @param configuredProviders - Available AI providers
 * @returns EditorGateResult with pass/fail, issues, and optional corrected text
 */
export async function runEditorGate(
  userRequest: string,
  aiResponse: string,
  agentType: string,
  configuredProviders: string[]
): Promise<EditorGateResult> {
  const config = loadEditorConfig();

  // Skip if disabled or response too short
  if (!config.enabled) {
    return createPassResult('Editor gate disabled');
  }
  if (aiResponse.length < config.minLength) {
    return createPassResult('Response too short for editor review');
  }
  if (config.skipAgentTypes.includes(agentType)) {
    return createPassResult(`Agent type '${agentType}' excluded from editor gate`);
  }

  const startTime = Date.now();

  try {
    const providerId = configuredProviders.length > 0 ? configuredProviders[0] : 'groq';

    const editorPrompt = `${EDITOR_AGENT_PROMPT}

---

REVIEW THIS AI-OUTPUT:

USER REQUEST:
\"\"\"
${userRequest.slice(0, 2000)}
\"\"\"

AI RESPONSE TO REVIEW:
\"\"\"
${aiResponse.slice(0, 4000)}
\"\"\"

Run your full editor review. Focus on:
1. Placeholder detection: [INSERT], [TODO], [TBD], [YOUR_TEXT_HERE], etc.
2. INR formatting: ensure all prices use ₹ Indian formatting (₹1,50,000 not ₹150,000)
3. Grammar and consistency
4. Professional polish for ₹50,000+ client delivery
5. Completeness — does the response end with "**Next Step:**"?

If you find issues, provide the CORRECTED version of the response.
If no issues, say "PASS" and nothing else.

OUTPUT FORMAT (JSON only):
{
  "passed": <boolean>,
  "issues": [
    {
      "severity": "<critical|high|medium|low>",
      "category": "<grammar|placeholder|formatting|consistency|completeness|polish>",
      "description": "<what's wrong>"
    }
  ],
  "correctedText": "<full corrected response if issues found, otherwise null>",
  "confidence": <0-100>,
  "assessment": "<brief assessment>"
}`;

    const proxyResponse = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
      body: JSON.stringify({
        messages: [{ role: 'user', content: editorPrompt }],
        maxTokens: 1500,
        stream: false,
      }),
    });

    if (!proxyResponse.ok) {
      log.warn('Editor gate API call failed', { status: proxyResponse.status });
      return createPassResult('Editor gate API call failed');
    }

    const proxyResult = await proxyResponse.json();
    const text = proxyResult.text || '';

    // Parse the JSON response
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      const cleaned = text.replace(/```json|```/g, '').trim();
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
          try { parsed = JSON.parse(match[0]); } catch { /* ignore */ }
        }
      }
    }

    if (!parsed) {
      log.warn('Editor gate failed to parse response');
      return createPassResult('Editor gate response parse failed');
    }

    const passed = Boolean(parsed.passed);
    const issues = Array.isArray(parsed.issues)
      ? parsed.issues.map((i: Record<string, unknown>) => ({
          severity: (String(i.severity || 'low') as EditorIssue['severity']),
          category: String(i.category || 'unknown'),
          description: String(i.description || ''),
          location: i.location ? String(i.location) : undefined,
        }))
      : [];
    const correctedText = typeof parsed.correctedText === 'string' && parsed.correctedText.length > 0
      ? parsed.correctedText
      : undefined;
    const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 80;
    const assessment = typeof parsed.assessment === 'string' ? parsed.assessment : '';

    const timeMs = Date.now() - startTime;
    log.info('Editor gate completed', {
      passed,
      issueCount: issues.length,
      confidence,
      timeMs,
      hasCorrection: !!correctedText,
    });

    return {
      passed,
      issues,
      correctedText,
      confidence,
      assessment,
      checkedAt: Date.now(),
    };
  } catch (e) {
    log.warn('Editor gate failed', { error: e instanceof Error ? e.message : 'Unknown' });
    return createPassResult('Editor gate error');
  }
}

// ─── Helper ────────────────────────────

function createPassResult(assessment: string): EditorGateResult {
  return {
    passed: true,
    issues: [],
    confidence: 100,
    assessment,
    checkedAt: Date.now(),
  };
}
