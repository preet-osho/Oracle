// ═══════════════════════════════════════
// ORACLE — Prompt Injection Sanitizer
// Prevents user-supplied systemPrompt from overriding ORACLE's identity
// ═══════════════════════════════════════

import { createLogger } from '@/lib/logger';

const log = createLogger('PromptSanitizer');

// ─── Injection Patterns ────────────────

/** Patterns that indicate prompt injection attempts */
const INJECTION_PATTERNS: Array<{ pattern: RegExp; description: string }> = [
  // Identity override attempts
  { pattern: /you\s+are\s+now\s+(?!ORACLE)/i, description: 'identity override' },
  { pattern: /forget\s+(all\s+)?(previous|your)\s+(instructions|rules|prompts)/i, description: 'instruction erasure' },
  { pattern: /ignore\s+(all\s+)?(previous|your|above|prior)\s+(instructions|rules|prompts|context)/i, description: 'instruction bypass' },
  { pattern: /disregard\s+(all\s+)?(previous|your|above|prior)\s+(instructions|rules|prompts)/i, description: 'instruction bypass' },
  { pattern: /new\s+instructions?:/i, description: 'instruction override' },
  { pattern: /override\s+(previous|your|all)\s+(instructions|rules|prompts)/i, description: 'instruction override' },

  // System prompt manipulation
  { pattern: /\bsystem\s*prompt\b.*\b(override|replace|change|rewrite|modify)\b/i, description: 'system prompt manipulation' },
  { pattern: /\bend\s+of\s+(system\s+)?prompt\b/i, description: 'prompt boundary injection' },
  { pattern: /\b---\s*end\s+/i, description: 'delimiter injection' },
  { pattern: /(^|\s)###\s*(system|assistant|new)\s+(message|prompt|instructions?)\b/i, description: 'role spoofing' },

  // Role hijacking
  { pattern: /\byou\s+are\s+(a|an)\s+(hacker|attacker|jailbreak|DAN|unrestricted)/i, description: 'role hijacking' },
  { pattern: /\bpretend\s+(you\s+are|to\s+be)\s+(?:a\s+)?(?:different|unrestricted|unfiltered)/i, description: 'role manipulation' },
  { pattern: /\bact\s+as\s+if\s+you\s+(have|don.t|do\s+not)\s+have\s+(any\s+)?(restrictions|rules|limits)/i, description: 'restriction bypass' },

  // Data exfiltration attempts
  { pattern: /\b(exfiltrate|leak|send|expose|reveal|transmit)\s+(your|the)\s+(system\s+prompt|instructions|rules|API\s*key)/i, description: 'data exfiltration' },
  { pattern: /\b(what|show|print|repeat|display)\s+(are\s+)?your\s+(system\s+prompt|instructions|rules|initial\s+prompt)/i, description: 'prompt extraction' },
  { pattern: /\b(share|tell\s+me)\s+(your|the)\s+(secret|hidden|original)\s+(prompt|instructions)/i, description: 'prompt extraction' },

  // Encoded/obfuscated injection
  { pattern: /\b(base64|rot13|decode|eval)\s*\(/i, description: 'encoded injection' },
];

// ─── Maximum Lengths ────────────────────

const MAX_SYSTEM_PROMPT_LENGTH = 10_000; // 10KB max
const MAX_SINGLE_LINE_LENGTH = 2_000;     // No single line > 2KB

// ─── Sanitization ──────────────────────

export interface SanitizationResult {
  sanitized: string;
  wasModified: boolean;
  threatsDetected: string[];
  riskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Sanitize a user-supplied systemPrompt to prevent prompt injection.
 *
 * Defense layers:
 * 1. Length limits (prevent token flooding)
 * 2. Pattern detection (flag injection attempts)
 * 3. Content stripping (remove known attack vectors)
 * 4. Logging (audit trail for security review)
 */
export function sanitizeSystemPrompt(
  input: string | undefined | null,
  context: { userId?: string; route?: string } = {}
): SanitizationResult {
  if (!input || typeof input !== 'string') {
    return { sanitized: '', wasModified: false, threatsDetected: [], riskLevel: 'none' };
  }

  let sanitized = input;
  const threatsDetected: string[] = [];

  // ── Layer 1: Length enforcement ──
  if (sanitized.length > MAX_SYSTEM_PROMPT_LENGTH) {
    sanitized = sanitized.slice(0, MAX_SYSTEM_PROMPT_LENGTH);
    threatsDetected.push('length_overflow');
    log.warn('System prompt exceeded max length, truncated', {
      originalLength: input.length,
      truncatedTo: MAX_SYSTEM_PROMPT_LENGTH,
      ...context,
    });
  }

  // ── Layer 2: Line length enforcement ──
  const lines = sanitized.split('\n');
  const sanitizedLines = lines.map((line) => {
    if (line.length > MAX_SINGLE_LINE_LENGTH) {
      threatsDetected.push('long_line');
      return line.slice(0, MAX_SINGLE_LINE_LENGTH);
    }
    return line;
  });
  sanitized = sanitizedLines.join('\n');

  // ── Layer 3: Pattern detection ──
  for (const { pattern, description } of INJECTION_PATTERNS) {
    if (pattern.test(sanitized)) {
      threatsDetected.push(description);
    }
  }

  // ── Layer 4: Strip known attack vectors ──
  // Remove zero-width characters (common in obfuscated injection)
  const zeroWidthPattern = /[\u200B-\u200F\u2028-\u202F\u2060-\u2064\uFEFF]/g;
  if (zeroWidthPattern.test(sanitized)) {
    sanitized = sanitized.replace(zeroWidthPattern, '');
    threatsDetected.push('zero_width_chars');
  }

  // Remove excessive special characters that may be used for delimiter injection
  const delimiterPattern = /={3,}|-{3,}|#{3,}|\*{3,}/g;
  if (delimiterPattern.test(sanitized)) {
    // Flag but don't strip — legitimate prompts may use markdown dividers
    threatsDetected.push('delimiter_chars');
  }

  // ── Layer 5: Risk assessment ──
  // Exclude informational-only detections (delimiter chars, long lines) from risk calculation
  // These are common in legitimate markdown prompts and should not escalate risk
  const INFO_ONLY_THREATS = new Set(['delimiter_chars', 'long_line']);
  const riskThreats = threatsDetected.filter((t) => !INFO_ONLY_THREATS.has(t));

  const HIGH_SEVERITY_THREATS = new Set([
    'identity override', 'instruction erasure', 'role hijacking',
    'data exfiltration', 'prompt extraction', 'instruction bypass',
    'instruction override', 'system prompt manipulation',
    'prompt boundary injection', 'role spoofing', 'role manipulation',
    'restriction bypass', 'encoded injection',
  ]);

  let riskLevel: SanitizationResult['riskLevel'] = 'none';
  if (riskThreats.length === 0) {
    riskLevel = 'none';
  } else if (riskThreats.length === 1 && !riskThreats.some((t) => HIGH_SEVERITY_THREATS.has(t))) {
    riskLevel = 'low';
  } else if (riskThreats.length <= 2) {
    riskLevel = 'medium';
  } else if (riskThreats.length <= 4) {
    riskLevel = 'high';
  } else {
    riskLevel = 'critical';
  }

  // ── Audit logging ──
  if (threatsDetected.length > 0) {
    log.warn('Prompt injection attempt detected', {
      threats: threatsDetected,
      riskLevel,
      inputLength: input.length,
      outputLength: sanitized.length,
      ...context,
    });
  }

  const wasModified = sanitized !== input;

  // For critical risk, reject the entire prompt
  if (riskLevel === 'critical') {
    log.error('Critical prompt injection attempt — rejecting prompt', {
      threats: threatsDetected,
      ...context,
    });
    return {
      sanitized: '',
      wasModified: true,
      threatsDetected,
      riskLevel,
    };
  }

  return { sanitized, wasModified, threatsDetected, riskLevel };
}

/**
 * Quick check: is this prompt likely safe?
 * Returns true if no injection patterns detected.
 */
export function isPromptSafe(input: string | undefined | null): boolean {
  if (!input) return true;
  const result = sanitizeSystemPrompt(input);
  return result.riskLevel === 'none' || result.riskLevel === 'low';
}

// ─── External Content Sanitization ────

const MAX_DOCUMENT_CONTENT_LENGTH = 20_000; // 20KB max per document
const MAX_SEARCH_RESULT_LENGTH = 2_000;     // 2KB max per search result
const MAX_EXTERNAL_CONTEXT_LENGTH = 30_000;  // 30KB max for all external context

// ─── Shared Regex Patterns (module-level to avoid recompilation) ────
// NOTE: No /g flag — lastIndex leaks between calls on shared module-level regexes.
// Use .replace(new RegExp(ZERO_WIDTH_PATTERN.source, 'gi'), '') when replacing all.
const ZERO_WIDTH_PATTERN = /[\u200B-\u200F\u2028-\u202F\u2060-\u2064\uFEFF]/i;
const ZERO_WIDTH_GLOBAL = /[\u200B-\u200F\u2028-\u202F\u2060-\u2064\uFEFF]/gi;
const ROLE_SPOOFING_PATTERN = /(^|\s)###\s*(system|assistant|new)\s+(message|prompt|instructions?)\b/i;
const INSTRUCTION_OVERRIDE_PATTERN = /\b(forget|ignore|disregard)\s+(all\s+)?(previous|your|above|prior)\s+(instructions?|rules?|prompts?)\b/i;

/**
 * Sanitize uploaded document content before injecting into prompts.
 * Documents are a high-risk injection vector since users can upload
 * files containing adversarial instructions disguised as data.
 *
 * Defense layers:
 * 1. Length enforcement (prevent token flooding)
 * 2. Zero-width character stripping (remove obfuscation)
 * 3. Delimiter injection detection (flag role-spoofing attempts)
 * 4. Audit logging for security review
 */
export function sanitizeDocumentContent(
  content: string,
  documentName: string,
  context: { userId?: string; route?: string } = {}
): SanitizationResult {
  if (!content || typeof content !== 'string') {
    return { sanitized: '', wasModified: false, threatsDetected: [], riskLevel: 'none' };
  }

  let sanitized = content;
  const threatsDetected: string[] = [];

  // Layer 1: Length enforcement
  if (sanitized.length > MAX_DOCUMENT_CONTENT_LENGTH) {
    sanitized = sanitized.slice(0, MAX_DOCUMENT_CONTENT_LENGTH);
    threatsDetected.push('document_length_overflow');
    log.warn('Document content exceeded max length, truncated', {
      documentName,
      originalLength: content.length,
      truncatedTo: MAX_DOCUMENT_CONTENT_LENGTH,
      ...context,
    });
  }

  // Layer 2: Strip zero-width characters (common in obfuscated injection)
  if (ZERO_WIDTH_PATTERN.test(sanitized)) {
    sanitized = sanitized.replace(ZERO_WIDTH_GLOBAL, '');
    threatsDetected.push('document_zero_width_chars');
  }

  // Layer 3: Detect delimiter injection in documents
  // Attackers embed role markers in documents to hijack the AI
  if (ROLE_SPOOFING_PATTERN.test(sanitized)) {
    threatsDetected.push('document_role_spoofing');
    log.warn('Potential role spoofing detected in uploaded document', {
      documentName,
      ...context,
    });
  }

  // Layer 4: Detect instruction override attempts embedded in documents
  if (INSTRUCTION_OVERRIDE_PATTERN.test(sanitized)) {
    threatsDetected.push('document_instruction_override');
    log.warn('Potential instruction override detected in uploaded document', {
      documentName,
      ...context,
    });
  }

  // Layer 5: Risk assessment
  const hasRoleSpoofing = threatsDetected.includes('document_role_spoofing');
  const hasInstructionOverride = threatsDetected.includes('document_instruction_override');

  let riskLevel: SanitizationResult['riskLevel'] = 'none';
  if (hasRoleSpoofing && hasInstructionOverride) {
    riskLevel = 'high'; // Multiple distinct attack types
  } else if (hasRoleSpoofing || hasInstructionOverride) {
    riskLevel = 'medium';
  } else if (threatsDetected.length > 0) {
    riskLevel = 'low';
  }

  // Audit logging
  if (threatsDetected.length > 0) {
    log.warn('Threats detected in uploaded document', {
      documentName,
      threats: threatsDetected,
      riskLevel,
      ...context,
    });
  }

  return { sanitized, wasModified: sanitized !== content, threatsDetected, riskLevel };
}

/**
 * Sanitize web search results before injecting into prompts.
 * Search results are a high-risk vector since attackers can poison
 * web content to include adversarial instructions in search snippets.
 *
 * Defense layers:
 * 1. Length enforcement per result
 * 2. Zero-width character stripping
 * 3. Delimiter injection detection
 * 4. Audit logging
 */
export interface SanitizedSearchResult {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
}

export function sanitizeSearchResults(
  results: Array<{ title: string; snippet: string; url: string; publishedDate?: string }>,
  context: { userId?: string; route?: string } = {}
): SanitizedSearchResult[] {
  if (!Array.isArray(results)) return [];

  const sanitizedResults: SanitizedSearchResult[] = [];
  const allThreats: string[] = [];

  for (const result of results) {
    let title = result.title || '';
    let snippet = result.snippet || '';
    let wasModified = false;
    const threats: string[] = [];

    // Length enforcement on title
    if (title.length > 500) {
      title = title.slice(0, 500);
      wasModified = true;
      threats.push('title_truncated');
    }

    // Length enforcement on snippet
    if (snippet.length > MAX_SEARCH_RESULT_LENGTH) {
      snippet = snippet.slice(0, MAX_SEARCH_RESULT_LENGTH);
      wasModified = true;
      threats.push('snippet_truncated');
    }

    // Zero-width character stripping on both
    if (ZERO_WIDTH_PATTERN.test(title)) {
      title = title.replace(ZERO_WIDTH_GLOBAL, '');
      wasModified = true;
      threats.push('title_zero_width');
    }
    if (ZERO_WIDTH_PATTERN.test(snippet)) {
      snippet = snippet.replace(ZERO_WIDTH_GLOBAL, '');
      wasModified = true;
      threats.push('snippet_zero_width');
    }

    // Delimiter injection detection
    if (ROLE_SPOOFING_PATTERN.test(title) || ROLE_SPOOFING_PATTERN.test(snippet)) {
      threats.push('role_spoofing');
    }

    // Instruction override detection
    if (INSTRUCTION_OVERRIDE_PATTERN.test(title) || INSTRUCTION_OVERRIDE_PATTERN.test(snippet)) {
      threats.push('instruction_override');
    }

    allThreats.push(...threats);

    sanitizedResults.push({
      title,
      snippet,
      url: result.url,
      publishedDate: result.publishedDate,
    });
  }

  // Audit logging for any threats
  if (allThreats.length > 0) {
    log.warn('Threats detected in search results', {
      threats: allThreats,
      resultCount: results.length,
      ...context,
    });
  }

  return sanitizedResults;
}

/**
 * Sanitize any external context (agent memory, attachments, etc.)
 * before injecting into prompts. Generic wrapper around content sanitization.
 */
export function sanitizeExternalContext(
  content: string,
  sourceType: 'attachment' | 'agent_memory' | 'rag_chunk' | 'unknown',
  context: { userId?: string; route?: string } = {}
): SanitizationResult {
  if (!content || typeof content !== 'string') {
    return { sanitized: '', wasModified: false, threatsDetected: [], riskLevel: 'none' };
  }

  let sanitized = content;
  const threatsDetected: string[] = [];

  // Length enforcement based on source type
  const maxLength = sourceType === 'agent_memory' ? 5_000 : MAX_EXTERNAL_CONTEXT_LENGTH;
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength);
    threatsDetected.push(`${sourceType}_length_overflow`);
    log.warn('External context exceeded max length, truncated', {
      sourceType,
      originalLength: content.length,
      truncatedTo: maxLength,
      ...context,
    });
  }

  // Strip zero-width characters
  if (ZERO_WIDTH_PATTERN.test(sanitized)) {
    sanitized = sanitized.replace(ZERO_WIDTH_GLOBAL, '');
    threatsDetected.push(`${sourceType}_zero_width_chars`);
  }

  // Detect delimiter injection
  if (ROLE_SPOOFING_PATTERN.test(sanitized)) {
    threatsDetected.push(`${sourceType}_role_spoofing`);
    log.warn('Potential role spoofing detected in external context', {
      sourceType,
      ...context,
    });
  }

  // Detect instruction override attempts
  if (INSTRUCTION_OVERRIDE_PATTERN.test(sanitized)) {
    threatsDetected.push(`${sourceType}_instruction_override`);
    log.warn('Potential instruction override detected in external context', {
      sourceType,
      ...context,
    });
  }

  // Risk assessment
  const roleSpoofing = threatsDetected.some((t) => t.includes('role_spoofing'));
  const instructionOverride = threatsDetected.some((t) => t.includes('instruction_override'));

  let riskLevel: SanitizationResult['riskLevel'] = 'none';
  if (roleSpoofing && instructionOverride) {
    riskLevel = 'high'; // Multiple distinct attack types
  } else if (roleSpoofing || instructionOverride) {
    riskLevel = 'medium';
  } else if (threatsDetected.length > 0) {
    riskLevel = 'low';
  }

  // Audit logging
  if (threatsDetected.length > 0) {
    log.warn('Threats detected in external context', {
      sourceType,
      threats: threatsDetected,
      riskLevel,
      ...context,
    });
  }

  return { sanitized, wasModified: sanitized !== content, threatsDetected, riskLevel };
}

// ─── User Message Sanitization ────────

const MAX_MESSAGE_LENGTH = 50_000; // 50KB max per message
const MAX_MESSAGE_COUNT = 100;     // Max messages per request

export interface MessageSanitizationResult {
  sanitizedMessages: Array<{ role: string; content: string }>;
  threatsDetected: string[];
  riskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
  blocked: boolean;
}

/**
 * Sanitize the messages array from a chat request.
 * Detects prompt injection attempts in user message content.
 *
 * Defense layers:
 * 1. Message count limit (prevent token flooding)
 * 2. Per-message length limit
 * 3. Zero-width character stripping
 * 4. Injection pattern detection on each user message
 * 5. Audit logging for all detection events
 */
export function sanitizeMessages(
  messages: Array<{ role: string; content: string }>,
  context: { userId?: string; route?: string } = {}
): MessageSanitizationResult {
  if (!Array.isArray(messages)) {
    return { sanitizedMessages: [], threatsDetected: [], riskLevel: 'none', blocked: false };
  }

  // Layer 1: Message count enforcement
  const truncatedMessages = messages.slice(0, MAX_MESSAGE_COUNT);
  const threatsDetected: string[] = [];

  if (messages.length > MAX_MESSAGE_COUNT) {
    threatsDetected.push('message_count_overflow');
    log.warn('Message count exceeded max, truncated', {
      originalCount: messages.length,
      truncatedTo: MAX_MESSAGE_COUNT,
      ...context,
    });
  }

  // Process each message
  const sanitizedMessages = truncatedMessages.map((msg, index) => {
    let content = msg.content;

    // Layer 2: Per-message length enforcement
    if (content.length > MAX_MESSAGE_LENGTH) {
      content = content.slice(0, MAX_MESSAGE_LENGTH);
      threatsDetected.push(`message_${index}_length_overflow`);
    }

    // Layer 3: Strip zero-width characters (common in obfuscated injection)
    const zeroWidthPattern = /[\u200B-\u200F\u2028-\u202F\u2060-\u2064\uFEFF]/g;
    if (zeroWidthPattern.test(content)) {
      content = content.replace(zeroWidthPattern, '');
      threatsDetected.push(`message_${index}_zero_width_chars`);
    }

    // Layer 4: Injection pattern detection (only on user messages)
    if (msg.role === 'user') {
      for (const { pattern, description } of INJECTION_PATTERNS) {
        if (pattern.test(content)) {
          threatsDetected.push(`message_${index}_${description}`);
        }
      }
    }

    return { role: msg.role, content };
  });

  // Layer 5: Risk assessment
  const INFO_ONLY_THREATS = new Set(['message_count_overflow']);
  const riskThreats = threatsDetected.filter((t) => !INFO_ONLY_THREATS.has(t));

  const HIGH_SEVERITY_THREATS = new Set([
    'identity override', 'instruction erasure', 'role hijacking',
    'data exfiltration', 'prompt extraction', 'instruction bypass',
    'instruction override', 'system prompt manipulation',
    'prompt boundary injection', 'role spoofing', 'role manipulation',
    'restriction bypass', 'encoded injection',
  ]);

  let riskLevel: MessageSanitizationResult['riskLevel'] = 'none';
  if (riskThreats.length === 0) {
    riskLevel = 'none';
  } else if (riskThreats.length === 1 && !riskThreats.some((t) => HIGH_SEVERITY_THREATS.has(t))) {
    riskLevel = 'low';
  } else if (riskThreats.length <= 2) {
    riskLevel = 'medium';
  } else if (riskThreats.length <= 4) {
    riskLevel = 'high';
  } else {
    riskLevel = 'critical';
  }

  // Audit logging
  if (threatsDetected.length > 0) {
    log.warn('Prompt injection attempt detected in messages', {
      threats: threatsDetected,
      riskLevel,
      messageCount: messages.length,
      ...context,
    });
  }

  // Block only on critical risk
  const blocked = riskLevel === 'critical';
  if (blocked) {
    log.error('Critical prompt injection attempt in messages — blocking request', {
      threats: threatsDetected,
      ...context,
    });
  }

  return { sanitizedMessages, threatsDetected, riskLevel, blocked };
}
