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
  { pattern: /\b###\s*(system|assistant|new)\s+(message|prompt|instructions?)\b/i, description: 'role spoofing' },

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
