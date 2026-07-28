// ═══════════════════════════════════════
// ORACLE — GOD MODE Prompt Enhancement
// Enhances any agent prompt for high-stakes tasks
// ═══════════════════════════════════════

/**
 * GOD MODE enhancement suffix that can be appended to any agent prompt
 * for high-stakes, client-facing, or production-critical tasks.
 * 
 * This adds rigorous verification, completeness checks, and professional
 * quality standards without duplicating the entire prompt.
 */

export const GOD_MODE_ENHANCEMENT = `\n\n═══════════════════════════════════════════════════════════════
⚡ GOD MODE — HIGH-STAKES PROTOCOL
═══════════════════════════════════════════════════════════════

Before delivering, verify ALL:
1. COMPLETENESS — Fully addresses request? No TODO/[INSERT]/[TBD] placeholders? All sections actionable?
2. INDIA CONTEXT — Prices in INR (₹1,50,000)? Indian platforms referenced? Cultural/legal context appropriate?
3. ACCURACY — Claims backed by evidence? Tools currently available? No factual errors or outdated info?
4. CONSISTENCY — Numbers match across sections? Brand names consistent? No contradictions? Professional tone throughout?
5. ACTIONABILITY — Team can execute immediately? Next steps with owners? Metrics with targets? Risks with mitigations?
6. QUALITY — No filler words (very/really/quite/leverage/utilize)? Formatting consistent? No internal jargon exposed?

OUTPUT STANDARDS:
- Headers: ## major, ### minor. Code blocks: triple backticks + language.
- End with "**Next Step:**" — non-negotiable.
- No placeholders, no incomplete sections, no vague advice.

FINAL CHECK: "Would I deliver this to a ₹50,000+ client as final?" If not YES, revise.

═══════════════════════════════════════════════════════════════`;

/**
 * GOD MODE severity levels for different high-stakes scenarios
 */
export type GodModeLevel = 'standard' | 'critical' | 'production';

export const GOD_MODE_LEVELS: Record<GodModeLevel, string> = {
  standard: GOD_MODE_ENHANCEMENT,
  critical: GOD_MODE_ENHANCEMENT + `\n\n⚡ CRITICAL TASK — ADDITIONAL SCRUTINY REQUIRED:
This is a critical, high-visibility task. Apply maximum rigor:
- Cross-check every fact and recommendation
- Verify all tools/services are currently available in India
- Ensure all pricing is accurate and in INR
- Test all recommendations against real-world feasibility
- Include risk assessment for every recommendation
- Provide backup options for critical dependencies`,

  production: GOD_MODE_ENHANCEMENT + `\n\n⚡ PRODUCTION DEPLOYMENT — FINAL DELIVERY PROTOCOL:
This output is going directly to production/client delivery.
Apply the absolute highest quality standard:
- Zero tolerance for placeholders, TODOs, or incomplete sections
- Every recommendation must be immediately actionable
- All code must be production-ready with error handling
- All documentation must be client-facing quality
- Include rollback plans for any technical changes
- Verify compliance with Indian regulations (DPDP Act, GST, SEBI where applicable)
- Final read-through as if delivering to a ₹1,00,000+ client`,

};

/**
 * Enhance a base prompt with GOD MODE instructions
 * @param basePrompt - The original agent prompt
 * @param level - The GOD MODE severity level
 * @returns Enhanced prompt with GOD MODE instructions appended
 */
export function enhanceWithGodMode(
  basePrompt: string,
  level: GodModeLevel = 'standard'
): string {
  return basePrompt + GOD_MODE_LEVELS[level];
}

/**
 * Check if a prompt already has GOD MODE enhancement
 */
export function hasGodMode(prompt: string): boolean {
  return prompt.includes('GOD MODE');
}

/**
 * Remove GOD MODE enhancement from a prompt (if present)
 */
export function removeGodMode(prompt: string): string {
  const godModeIndex = prompt.indexOf('\n\n═══════════════════════════════════════════════════════════════');
  if (godModeIndex === -1) return prompt;
  return prompt.substring(0, godModeIndex);
}

/**
 * List of agent types that benefit most from GOD MODE enhancement
 * These are agents that typically handle client-facing, high-stakes work
 */
export const GOD_MODE_OPTIMIZED_AGENTS = [
  'developer',
  'strategist',
  'marketer',
  'seo-specialist',
  'seo-strategist',
  'content-strategist',
  'designer',
  'product-designer',
  'ux-researcher',
  'security-auditor',
  'security-architect',
  'agency-brain',
  'orchestrator',
  'super-orchestrator',
  'systems-architect',
  'product-engineer',
  'finance',
  'legal',
  'coordinator',
  'writer',
  'editor',
  'conversion-optimizer',
  'growth-hacker',
  'lead-hunter',
  'offer-strategist',
  'web-designer',
] as const;

export type GodModeOptimizedAgent = typeof GOD_MODE_OPTIMIZED_AGENTS[number];
