// ═══════════════════════════════════════
// ORACLE — LLM Output Quality Evaluator
// Rule-based scoring for Indian market context
// Covers Sections 1, 5, 13 of USER_COMPLAINT_TRACKER
// ═══════════════════════════════════════

// ─── Types ─────────────────────────────

export interface EvalCheck {
  name: string;
  passed: boolean;
  score: number; // 0-100
  message: string;
  details?: string;
}

export interface EvalResult {
  overallScore: number; // 0-100
  passed: boolean;
  checks: EvalCheck[];
  suggestions: string[];
  scenario?: string; // e.g. "1.1", "5.2", "13.3"
}

export interface EvalContext {
  industry?: string;
  cityTier?: 1 | 2 | 3;
  language?: string;
  audience?: string;
  contentType?: 'blog' | 'social' | 'whatsapp' | 'email' | 'proposal' | 'general';
  thresholds?: Partial<ThresholdConfig>;
}

// ─── Configurable Thresholds ───────────

export interface ThresholdConfig {
  /** Minimum overall score to pass (0-100). Default: 60 */
  passThreshold: number;
  /** Weight for each check in the overall score calculation */
  weights: Record<string, number>;
  /** Per-content-type overrides for check weights */
  contentTypeWeights: Partial<Record<string, Record<string, number>>>;
  /** Pass threshold per check name (overrides global passThreshold) */
  checkPassThresholds: Record<string, number>;
}

export const DEFAULT_THRESHOLDS: ThresholdConfig = {
  passThreshold: 60,
  weights: {
    india_context: 15,
    platform_relevance: 15,
    vernacular_tone: 10,
    city_tier_awareness: 10,
    festival_calendar: 10,
    whatsapp_first: 10,
    generic_content: 15,
    b2b_tone: 10,
    inr_currency: 10,
    local_platform_mention: 5,
  },
  contentTypeWeights: {
    whatsapp: {
      vernacular_tone: 20,
      whatsapp_first: 5,
      generic_content: 10,
    },
    blog: {
      generic_content: 20,
      india_context: 15,
      festival_calendar: 10,
    },
    proposal: {
      b2b_tone: 15,
      inr_currency: 15,
      generic_content: 10,
    },
    email: {
      vernacular_tone: 15,
      whatsapp_first: 5,
    },
    social: {
      festival_calendar: 15,
      vernacular_tone: 15,
      india_context: 10,
    },
  },
  checkPassThresholds: {},
};

// ─── Preset Threshold Configurations ───

export type PresetName = 'strict' | 'lenient' | 'balanced' | 'whatsapp' | 'proposal' | 'social' | 'blog';

export interface PresetConfig {
  name: PresetName;
  label: string;
  description: string;
  thresholds: Partial<ThresholdConfig>;
}

export const PRESETS: Record<PresetName, PresetConfig> = {
  strict: {
    name: 'strict',
    label: 'Strict',
    description: 'High bar for all outputs — flags even minor issues',
    thresholds: {
      passThreshold: 75,
      weights: {
        india_context: 20,
        platform_relevance: 15,
        vernacular_tone: 10,
        city_tier_awareness: 10,
        festival_calendar: 10,
        whatsapp_first: 10,
        generic_content: 15,
        b2b_tone: 5,
        inr_currency: 5,
        local_platform_mention: 10,
      },
    },
  },
  lenient: {
    name: 'lenient',
    label: 'Lenient',
    description: 'Only flag severe quality issues — good for drafts',
    thresholds: {
      passThreshold: 40,
    },
  },
  balanced: {
    name: 'balanced',
    label: 'Balanced',
    description: 'Default settings — balanced quality checks',
    thresholds: {},
  },
  whatsapp: {
    name: 'whatsapp',
    label: 'WhatsApp',
    description: 'Optimized for WhatsApp outreach — casual tone, short messages',
    thresholds: {
      passThreshold: 55,
      contentTypeWeights: {
        whatsapp: {
          vernacular_tone: 25,
          whatsapp_first: 15,
          generic_content: 10,
          india_context: 10,
          platform_relevance: 5,
          city_tier_awareness: 5,
          festival_calendar: 5,
          b2b_tone: 0,
          inr_currency: 5,
          local_platform_mention: 5,
        },
      },
    },
  },
  proposal: {
    name: 'proposal',
    label: 'Proposal',
    description: 'Optimized for client proposals — professional tone, B2B focus',
    thresholds: {
      passThreshold: 65,
      contentTypeWeights: {
        proposal: {
          b2b_tone: 20,
          inr_currency: 15,
          generic_content: 15,
          india_context: 10,
          platform_relevance: 10,
          vernacular_tone: 5,
          city_tier_awareness: 5,
          festival_calendar: 5,
          whatsapp_first: 0,
          local_platform_mention: 5,
        },
      },
    },
  },
  social: {
    name: 'social',
    label: 'Social Media',
    description: 'Optimized for social posts — festival-aware, visually engaging',
    thresholds: {
      passThreshold: 60,
      contentTypeWeights: {
        social: {
          festival_calendar: 20,
          vernacular_tone: 15,
          india_context: 10,
          generic_content: 15,
          platform_relevance: 10,
          b2b_tone: 0,
          inr_currency: 5,
          city_tier_awareness: 5,
          whatsapp_first: 5,
          local_platform_mention: 5,
        },
      },
    },
  },
  blog: {
    name: 'blog',
    label: 'Blog / SEO',
    description: 'Optimized for blog content — SEO-focused, non-generic',
    thresholds: {
      passThreshold: 60,
      contentTypeWeights: {
        blog: {
          generic_content: 25,
          india_context: 15,
          festival_calendar: 10,
          platform_relevance: 10,
          vernacular_tone: 10,
          b2b_tone: 5,
          inr_currency: 5,
          whatsapp_first: 5,
          city_tier_awareness: 5,
          local_platform_mention: 5,
        },
      },
    },
  },
};

/**
 * Get a preset configuration by name.
 * Falls back to DEFAULT_THRESHOLDS if preset not found.
 */
export function getPreset(name: PresetName): PresetConfig {
  return PRESETS[name] || PRESETS.balanced;
}

/**
 * Get all preset names with their labels.
 */
export function listPresets(): Array<{ name: PresetName; label: string; description: string }> {
  return Object.values(PRESETS).map((p) => ({ name: p.name, label: p.label, description: p.description }));
}

// ─── Custom Preset CRUD ────────────────

const CUSTOM_PRESETS_KEY = 'oracle-eval-custom-presets';

export interface CustomPreset {
  id: string;
  name: string;
  description: string;
  thresholds: Partial<ThresholdConfig>;
  createdAt: number;
  updatedAt: number;
}

/** Load all custom presets from localStorage. */
export function loadCustomPresets(): CustomPreset[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CUSTOM_PRESETS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CustomPreset[];
  } catch {
    return [];
  }
}

/** Save a custom preset (creates or updates by id). */
export function saveCustomPreset(preset: Omit<CustomPreset, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): { preset: CustomPreset; error?: string } {
  const presets = loadCustomPresets();
  const now = Date.now();
  const isUpdate = preset.id && presets.some((p) => p.id === preset.id);

  // Validate: name must not collide with built-in presets
  const builtinNames = Object.keys(PRESETS);
  if (!isUpdate && builtinNames.includes(preset.name.toLowerCase())) {
    return { preset: null as unknown as CustomPreset, error: `Cannot use built-in preset name "${preset.name}"` };
  }

  // Validate: max custom presets
  if (!isUpdate && presets.length >= MAX_CUSTOM_PRESETS) {
    return { preset: null as unknown as CustomPreset, error: `Maximum ${MAX_CUSTOM_PRESETS} custom presets reached. Delete one first.` };
  }

  const saved: CustomPreset = {
    id: preset.id || `custom-${now}-${Math.random().toString(36).slice(2, 8)}`,
    name: preset.name,
    description: preset.description,
    thresholds: preset.thresholds,
    createdAt: isUpdate ? presets.find((p) => p.id === preset.id)!.createdAt : now,
    updatedAt: now,
  };

  if (isUpdate) {
    const idx = presets.findIndex((p) => p.id === preset.id);
    presets[idx] = saved;
  } else {
    presets.push(saved);
  }

  localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(presets));
  return { preset: saved };
}

/** Delete a custom preset by id. */
export function deleteCustomPreset(id: string): void {
  const presets = loadCustomPresets().filter((p) => p.id !== id);
  localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(presets));
}

/** Get all available presets (built-in + custom). */
/** Maximum number of custom presets allowed. */
export const MAX_CUSTOM_PRESETS = 20;

export function getAllPresets(): Array<PresetConfig | CustomPreset> {
  return [...Object.values(PRESETS), ...loadCustomPresets()];
}

function resolveThresholds(context: EvalContext): ThresholdConfig {
  const base = { ...DEFAULT_THRESHOLDS };
  if (context.thresholds) {
    if (context.thresholds.passThreshold !== undefined) base.passThreshold = context.thresholds.passThreshold;
    if (context.thresholds.checkPassThresholds) base.checkPassThresholds = { ...base.checkPassThresholds, ...context.thresholds.checkPassThresholds };
  }
  // Merge content-type-specific weight overrides (deep merge per content type)
  const ct = context.contentType || 'general';
  const defaultCtWeights = DEFAULT_THRESHOLDS.contentTypeWeights[ct] || {};
  const customCtWeights = context.thresholds?.contentTypeWeights?.[ct] || {};
  const mergedCtWeights = { ...defaultCtWeights, ...customCtWeights };

  // Merge weights: defaults → content-type → custom (custom wins)
  const customWeights = context.thresholds?.weights || {};
  base.weights = { ...DEFAULT_THRESHOLDS.weights, ...mergedCtWeights, ...customWeights };

  return base;
}

// ─── Indian Platforms Database ──────────

const INDIAN_PLATFORMS = {
  food: ['Zomato', 'Swiggy', 'Dunzo', 'EatSure', 'Box8'],
  ecommerce: ['Flipkart', 'Meesho', 'JioMart', 'Nykaa', 'Myntra', 'Tata Cliq', 'Amazon India'],
  payments: ['Razorpay', 'PayU', 'PhonePe', 'Google Pay', 'Paytm', 'UPI', 'BHIM'],
  crm: ['Zoho', 'Freshsales', 'Kreativ Street', 'LeadSquared'],
  social: ['WhatsApp', 'Instagram', 'ShareChat', 'Josh', 'Moj', 'LinkedIn India'],
  local: ['JustDial', 'Sulekha', 'IndiaMART', 'TradeIndia', 'UrbanClap', 'Housejoy'],
  delivery: ['Dunzo', 'Borzo', 'WeFast', 'Porter'],
  education: ['Unacademy', 'BYJU\'S', 'PhysicsWallah', 'Vedantu', 'Testbook', 'Oliveboard'],
  healthcare: ['Practo', '1mg', 'PharmEasy', 'Apollo 24|7', 'MediBuddy'],
  travel: ['MakeMyTrip', 'Goibibo', 'Cleartrip', 'OYO', 'ixigo', 'Railyatri'],
};

const WESTERN_PLATFORMS = [
  'Yelp', 'UberEats', 'DoorDash', 'Grubhub', 'Postmates',
  'Shopify', 'Etsy', 'eBay', 'Walmart',
  'Stripe', 'PayPal', 'Square',
  'Salesforce', 'HubSpot', 'Mailchimp',
  'Nextdoor', 'Craigslist', 'Groupon',
  'Yelp', 'Thumbtack', 'Angi',
];

// ─── Indian Festivals Calendar ──────────

const INDIAN_FESTIVALS = [
  { name: 'Diwali', months: [10, 11], keywords: ['diwali', 'deepavali', 'festival of lights', 'dhanteras', 'choti diwali'] },
  { name: 'Holi', months: [2, 3], keywords: ['holi', 'colors festival', 'rang'] },
  { name: 'Navratri', months: [9, 10], keywords: ['navratri', 'durga puja', 'garba', 'dandiya'] },
  { name: 'Eid', months: [3, 4, 6, 7], keywords: ['eid', 'ramadan', 'ramzan', 'bakrid', 'eid-ul-fitr', 'eid-ul-adha'] },
  { name: 'IPL', months: [3, 4, 5], keywords: ['ipl', 'indian premier league', 'cricket season'] },
  { name: 'Christmas', months: [12], keywords: ['christmas', 'xmas', 'new year'] },
  { name: 'Republic Day', months: [1], keywords: ['republic day', '26 january', 'jan 26'] },
  { name: 'Independence Day', months: [8], keywords: ['independence day', '15 august', 'aug 15'] },
  { name: 'Raksha Bandhan', months: [7, 8], keywords: ['raksha bandhan', 'rakhi'] },
  { name: 'Ganesh Chaturthi', months: [8, 9], keywords: ['ganesh', 'ganpati', 'vinayaka'] },
  { name: 'Pongal/Makar Sankranti', months: [1], keywords: ['pongal', 'makar sankranti', 'uttarayan', 'lodi'] },
  { name: 'Onam', months: [8, 9], keywords: ['onam'] },
  { name: 'Wedding Season', months: [11, 12, 1, 2], keywords: ['wedding', 'shaadi', 'marriage season'] },
  { name: 'Board Exams', months: [2, 3, 4, 5], keywords: ['board exams', 'exam season', 'cbse', 'icse'] },
  { name: 'Monsoon', months: [6, 7, 8, 9], keywords: ['monsoon', 'rainy season', 'baisakhi'] },
];

// ─── Tier-1/2/3 City Classification ────

const TIER1_BUDGETS = { min: 50000, max: 200000 };
const TIER2_BUDGETS = { min: 10000, max: 30000 };
const TIER3_BUDGETS = { min: 5000, max: 15000 };

// ─── Generic/Template Language Patterns ─

const GENERIC_PATTERNS = [
  /\b(?:best (?:practices?|way|approach|strategy))\b/i,
  /\b(?:leverage (?:the power of|AI|technology))\b/i,
  /\b(?:in today'?s (?:digital|fast-paced|competitive) (?:world|landscape|era))\b/i,
  /\b(?:it'?s no secret that)\b/i,
  /\b(?:at the end of the day)\b/i,
  /\b(?:when it comes to)\b/i,
  /\b(?:in (?:the )?(?:realm|sphere) of)\b/i,
  /\b(?:delve (?:into|deeper|deeper into))\b/i,
  /\b(?:harness(?:ing)? (?:the power of))\b/i,
  /\b(?:game[- ]?changer)\b/i,
  /\b(?:synerg(?:y|ies|ize))\b/i,
  /\b(?:bandwidth)\b/i,
  /\b(?:move the needle)\b/i,
  /\b(?:thought leadership)\b/i,
  /\b(?:seamless(?:ly)? integration)\b/i,
  /\b(?:unlock(?:ing)? (?:the potential|growth|value))\b/i,
  /\b(?:revolutioniz(?:ing|e))\b/i,
  /\b(?:transform(?:ing|ation))\b/i,
  /\b(?:cutting[- ]?edge)\b/i,
  /\b(?:holistic approach)\b/i,
  /\b(?:robust solution)\b/i,
  /\b(?:scalable solution)\b/i,
];

const FORMAL_LANGUAGE_PATTERNS = [
  /\b(?:we are writing to inform)\b/i,
  /\b(?:please find (?:attached|enclosed))\b/i,
  /\b(?:as per your request)\b/i,
  /\b(?:with reference to)\b/i,
  /\b(?:kindly (?:note|observe|be informed))\b/i,
  /\b(?:in accordance with)\b/i,
  /\b(?:herewith)\b/i,
  /\b(?:aforementioned)\b/i,
  /\b(?:furthermore|moreover|nevertheless|consequently|henceforth)\b/i,
  /\b(?:pursuant to)\b/i,
];

// ─── Indian Currency Patterns ───────────

const INR_PATTERN = /₹[\d,]+(?:\.\d{2})?/;
const USD_PATTERN = /\$[\d,]+(?:\.\d{2})?/;

// ═══════════════════════════════════════
// CORE EVALUATOR FUNCTIONS
// ═══════════════════════════════════════

/**
 * Main entry point: evaluate an AI output against Indian market quality criteria.
 */
export function evaluateOutput(
  output: string,
  context: EvalContext = {}
): EvalResult {
  const checks: EvalCheck[] = [];
  const thresholds = resolveThresholds(context);

  // Run all applicable checks
  checks.push(checkIndiaContext(output, context));
  checks.push(checkPlatformRelevance(output, context));
  checks.push(checkVernacularTone(output, context));
  checks.push(checkCityTierAwareness(output, context));
  checks.push(checkFestivalCalendar(output, context));
  checks.push(checkWhatsAppFirst(output, context));
  checks.push(checkGenericContent(output, context));
  checks.push(checkBToneAppropriateness(output, context));
  checks.push(checkINRCurrency(output, context));
  checks.push(checkLocalPlatformMention(output, context));

  // Apply per-check pass thresholds
  for (const check of checks) {
    const checkThreshold = thresholds.checkPassThresholds[check.name];
    if (checkThreshold !== undefined) {
      check.passed = check.score >= checkThreshold;
    }
  }

  // Calculate overall score (weighted average using resolved thresholds)
  const weights = thresholds.weights;

  let totalWeighted = 0;
  let totalWeight = 0;
  for (const check of checks) {
    const w = weights[check.name] || 5;
    totalWeighted += check.score * w;
    totalWeight += w;
  }
  const overallScore = totalWeight > 0 ? Math.round(totalWeighted / totalWeight) : 50;

  // Generate suggestions
  const suggestions = generateSuggestions(checks);

  return {
    overallScore,
    passed: overallScore >= thresholds.passThreshold,
    checks,
    suggestions,
  };
}

// ─── Individual Checks ─────────────────

/**
 * Checks if output references Indian-specific context (currency, platforms, events)
 * Covers: 5.5 (Tier-2/3 city strategy), general India awareness
 */
function checkIndiaContext(output: string, _context: EvalContext): EvalCheck {
  const hasINR = INR_PATTERN.test(output);
  const hasIndianPlatforms = new RegExp(
    [...INDIAN_PLATFORMS.food, ...INDIAN_PLATFORMS.payments, ...INDIAN_PLATFORMS.social].join('|'),
    'i'
  ).test(output);
  const hasIndianEvents = /(?:Diwali|Holi|Navratri|IPL|monsoon|wedding season|festival)/i.test(output);
  const hasGST = /(?:GST|GSTIN|tax)/i.test(output);

  let score = 0;
  if (hasINR) score += 30;
  if (hasIndianPlatforms) score += 25;
  if (hasIndianEvents) score += 25;
  if (hasGST) score += 20;

  return {
    name: 'india_context',
    passed: score >= 30,
    score: Math.min(100, score),
    message: score >= 50
      ? 'Output contains Indian market context'
      : score >= 30
        ? 'Output has some Indian context but could be more specific'
        : 'Output lacks Indian market context — consider adding INR pricing, local platforms, or festival references',
  };
}

/**
 * Checks if output recommends Indian platforms over Western equivalents
 * Covers: 5.2 (Wrong Platform Recommendations), 1.1-1.4 (generic proposals)
 */
function checkPlatformRelevance(output: string, _context: EvalContext): EvalCheck {
  const westernFound = WESTERN_PLATFORMS.filter((p) =>
    output.toLowerCase().includes(p.toLowerCase())
  );
  const indianFound = Object.values(INDIAN_PLATFORMS)
    .flat()
    .filter((p) => output.toLowerCase().includes(p.toLowerCase()));

  // Only flag Western platforms if Indian alternatives exist for the same category
  const hasWesternOnly = westernFound.length > 0 && indianFound.length === 0;
  const hasBoth = westernFound.length > 0 && indianFound.length > 0;

  let score = 70; // default
  if (hasWesternOnly) score = 20;
  else if (hasBoth) score = 50;
  else if (indianFound.length > 0) score = 90;
  else score = 70; // no platforms mentioned = neutral

  return {
    name: 'platform_relevance',
    passed: score >= 50,
    score,
    message: hasWesternOnly
      ? `Output recommends Western platforms (${westernFound.join(', ')}) — consider Indian alternatives`
      : indianFound.length > 0
        ? `Output includes Indian platforms (${indianFound.join(', ')})`
        : 'No specific platforms mentioned',
    details: hasWesternOnly ? `Consider: ${Object.values(INDIAN_PLATFORMS).flat().slice(0, 5).join(', ')}` : undefined,
  };
}

/**
 * Checks if output tone matches the target audience
 * Covers: 1.3 (B2B gets consumer copy), 1.4 (WhatsApp sounds like email), 1.6 (Hinglish issues)
 */
function checkVernacularTone(output: string, context: EvalContext): EvalCheck {
  const contentType = context.contentType || 'general';
  const isWhatsApp = contentType === 'whatsapp';
  const isB2B = context.audience?.toLowerCase().includes('b2b') || context.audience?.toLowerCase().includes('enterprise');

  let score = 70;

  if (isWhatsApp) {
    // WhatsApp should be casual, short, use emojis
    const hasEmojis = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(output);
    const isShort = output.length < 500;
    const isFormal = FORMAL_LANGUAGE_PATTERNS.some((p) => p.test(output));

    if (hasEmojis) score += 10;
    if (isShort) score += 10;
    if (isFormal) score -= 30;
    if (output.length > 1000) score -= 20;
  } else if (isB2B) {
    // B2B should be professional but not consumer-style
    const hasConsumerLanguage = /(?:hey|hi!|check out|awesome|cool|OMG|OMG!|fire|lit|vibes)/i.test(output);
    if (hasConsumerLanguage) score -= 25;
    const hasProfessionalTone = /(?:ROI|KPI|SLA|pipeline|stakeholder|strategic|quarterly|implementation)/i.test(output);
    if (hasProfessionalTone) score += 15;
  }

  return {
    name: 'vernacular_tone',
    passed: score >= 50,
    score: Math.max(0, Math.min(100, score)),
    message: score >= 70
      ? 'Tone appears appropriate for the content type'
      : score >= 50
        ? 'Tone could be adjusted for the target audience'
        : `Tone mismatch: ${isWhatsApp ? 'too formal for WhatsApp' : isB2B ? 'too consumer-oriented for B2B' : 'tone needs adjustment'}`,
  };
}

/**
 * Checks if output respects city tier budget expectations
 * Covers: 5.5 (Tier-2/3 City Strategy Ignored)
 */
function checkCityTierAwareness(output: string, context: EvalContext): EvalCheck {
  if (!context.cityTier) {
    return {
      name: 'city_tier_awareness',
      passed: true,
      score: 70,
      message: 'No city tier specified — skipping tier-awareness check',
    };
  }

  const budgetRange = context.cityTier === 1 ? TIER1_BUDGETS
    : context.cityTier === 2 ? TIER2_BUDGETS
    : TIER3_BUDGETS;

  // Extract budget numbers from output
  const budgetNumbers: number[] = [];
  const matches = output.match(/₹[\d,]+/g) || [];
  for (const m of matches) {
    const num = parseInt(m.replace(/[₹,]/g, ''), 10);
    if (!isNaN(num)) budgetNumbers.push(num);
  }

  // Check if any mentioned budget exceeds tier range
  const excessiveBudgets = budgetNumbers.filter((b) => b > budgetRange.max * 3);
  const affordableBudgets = budgetNumbers.filter((b) => b >= budgetRange.min && b <= budgetRange.max);

  let score = 70;
  if (excessiveBudgets.length > 0) score -= 30;
  if (affordableBudgets.length > 0) score += 20;

  const tierLabel = context.cityTier === 1 ? 'Tier-1' : context.cityTier === 2 ? 'Tier-2' : 'Tier-3';
  const rangeLabel = `₹${budgetRange.min.toLocaleString('en-IN')}-₹${budgetRange.max.toLocaleString('en-IN')}/month`;

  return {
    name: 'city_tier_awareness',
    passed: score >= 50,
    score: Math.max(0, Math.min(100, score)),
    message: excessiveBudgets.length > 0
      ? `Output suggests ₹${excessiveBudgets[0].toLocaleString('en-IN')} — too high for ${tierLabel} city (typical range: ${rangeLabel})`
      : affordableBudgets.length > 0
        ? `Budget suggestions align with ${tierLabel} city range (${rangeLabel})`
        : `No specific budgets detected — ensure they align with ${tierLabel} city expectations (${rangeLabel})`,
  };
}

/**
 * Checks if output references Indian festivals when discussing campaigns/calendars
 * Covers: 5.4 (Missing Festival Calendar)
 */
function checkFestivalCalendar(output: string, _context: EvalContext): EvalCheck {
  const isCampaignContext = /(?:campaign|calendar|content plan|marketing plan|strategy|schedule|monthly|quarterly)/i.test(output);
  if (!isCampaignContext) {
    return {
      name: 'festival_calendar',
      passed: true,
      score: 70,
      message: 'Not a campaign/calendar context — skipping festival check',
    };
  }

  const festivalsReferenced = INDIAN_FESTIVALS.filter((f) =>
    f.keywords.some((k) => output.toLowerCase().includes(k))
  );

  // Check for Western-only events
  const hasChristmas = /christmas|xmas/i.test(output);
  const hasNewYear = /new year/i.test(output);
  const hasValentine = /valentine/i.test(output);
  const hasHalloween = /halloween/i.test(output);
  const hasWesternOnly = (hasChristmas || hasNewYear || hasValentine || hasHalloween) && festivalsReferenced.length === 0;

  let score = 50;
  if (festivalsReferenced.length >= 2) score = 90;
  else if (festivalsReferenced.length === 1) score = 75;
  else if (hasWesternOnly) score = 30;
  else score = 50;

  return {
    name: 'festival_calendar',
    passed: score >= 50,
    score,
    message: festivalsReferenced.length > 0
      ? `References Indian festivals: ${festivalsReferenced.map((f) => f.name).join(', ')}`
      : 'No Indian festivals referenced in campaign context — consider adding Diwali, Holi, Navratri, IPL season',
  };
}

/**
 * Checks if output assumes WhatsApp over email for Indian audiences
 * Covers: 5.1 (WhatsApp > Email Assumption), 1.4 (WhatsApp Sounds Like Email)
 */
function checkWhatsAppFirst(output: string, _context: EvalContext): EvalCheck {
  const isOutreachContext = /(?:outreach|communication|follow[- ]?up|contact|connect|message|campaign)/i.test(output);
  if (!isOutreachContext) {
    return {
      name: 'whatsapp_first',
      passed: true,
      score: 70,
      message: 'Not an outreach context — skipping WhatsApp-first check',
    };
  }

  const mentionsWhatsApp = /whatsapp/i.test(output);
  const mentionsEmail = /email/i.test(output);
  const mentionsPhone = /phone|call|sms/i.test(output);

  // In India, WhatsApp is primary communication channel
  let score = 60;
  if (mentionsWhatsApp && !mentionsEmail) score = 85;
  else if (mentionsWhatsApp && mentionsEmail) score = 70;
  else if (!mentionsWhatsApp && mentionsEmail) score = 40;
  else if (mentionsPhone) score = 55;

  return {
    name: 'whatsapp_first',
    passed: score >= 50,
    score,
    message: mentionsWhatsApp
      ? 'Output includes WhatsApp as a communication channel'
      : mentionsEmail
        ? 'Output defaults to email — in India, WhatsApp is the primary outreach channel'
        : 'No specific communication channel mentioned',
  };
}

/**
 * Detects generic/template content patterns
 * Covers: 1.1-1.4, 1.7 (Generic Content Problem)
 */
function checkGenericContent(output: string, _context: EvalContext): EvalCheck {
  const matches = GENERIC_PATTERNS.filter((p) => p.test(output));

  let score = 85;
  if (matches.length >= 5) score = 20;
  else if (matches.length >= 3) score = 40;
  else if (matches.length >= 1) score = 65;

  // Check for excessive filler words
  const fillerWords = /(?:very|really|quite|extremely|incredibly|absolutely|totally|completely|totally|highly)\s+(?:effective|efficient|important|crucial|essential|valuable)/gi;
  const fillerMatches = output.match(fillerWords) || [];
  if (fillerMatches.length >= 3) score -= 15;

  return {
    name: 'generic_content',
    passed: score >= 50,
    score: Math.max(0, Math.min(100, score)),
    message: matches.length >= 3
      ? `Detected ${matches.length} generic/template phrases — output may need more specific, local content`
      : matches.length > 0
        ? `${matches.length} generic phrase(s) detected — consider replacing with specific details`
        : 'Output appears specific and non-generic',
    details: matches.length > 0 ? matches.slice(0, 3).map((p) => `"${p.source}"`).join(', ') : undefined,
  };
}

/**
 * Checks B2B vs B2C tone appropriateness
 * Covers: 1.3 (B2B Gets Consumer-Style Copy)
 */
function checkBToneAppropriateness(output: string, _context: EvalContext): EvalCheck {
  if (_context.audience !== 'b2b' && _context.audience !== 'enterprise') {
    return {
      name: 'b2b_tone',
      passed: true,
      score: 70,
      message: 'Not a B2B context — skipping B2B tone check',
    };
  }

  const consumerPatterns = /(?:hey guys|check this out|OMG|fire|lit|vibes|slay|no cap|bestie|yolo|fomo)/i;
  const b2bPatterns = /(?:ROI|KPI|SLA|pipeline|stakeholder|strategic|implementation|onboarding|retention|acquisition cost|LTV|ARR|MRR|quarterly review|board meeting)/i;

  const hasConsumer = consumerPatterns.test(output);
  const hasB2B = b2bPatterns.test(output);

  let score = 70;
  if (hasConsumer && !hasB2B) score = 25;
  else if (hasConsumer && hasB2B) score = 50;
  else if (hasB2B) score = 85;

  return {
    name: 'b2b_tone',
    passed: score >= 50,
    score,
    message: hasConsumer && !hasB2B
      ? 'B2B output uses consumer-style language — consider professional tone'
      : hasB2B
        ? 'Output uses appropriate B2B terminology'
        : 'No strong B2B or consumer tone detected',
  };
}

/**
 * Checks if output uses INR instead of USD
 * Covers: 5.3 (USD Pricing in Indian Context)
 */
function checkINRCurrency(output: string, _context: EvalContext): EvalCheck {
  const inrMatches = output.match(INR_PATTERN) || [];
  const usdMatches = output.match(USD_PATTERN) || [];

  let score = 70;
  if (inrMatches.length > 0 && usdMatches.length === 0) score = 95;
  else if (inrMatches.length > 0 && usdMatches.length > 0) score = 50;
  else if (inrMatches.length === 0 && usdMatches.length > 0) score = 25;
  else score = 70;

  return {
    name: 'inr_currency',
    passed: score >= 50,
    score,
    message: inrMatches.length > 0 && usdMatches.length === 0
      ? `Uses INR correctly (${inrMatches.length} instances)`
      : usdMatches.length > 0 && inrMatches.length === 0
        ? `Uses USD ($) — Indian context should use ₹ INR`
        : 'No pricing detected',
  };
}

/**
 * Checks if output mentions Indian-local platforms
 * Covers: 5.10 (No UPI/Payment Context), 13.1-13.10 (Real Indian Business Scenarios)
 */
function checkLocalPlatformMention(output: string, context: EvalContext): EvalCheck {
  const industry = context.industry?.toLowerCase() || '';

  let relevantPlatforms: string[] = [];
  if (industry.includes('food') || industry.includes('restaurant')) {
    relevantPlatforms = [...INDIAN_PLATFORMS.food, ...INDIAN_PLATFORMS.delivery];
  } else if (industry.includes('health') || industry.includes('dental') || industry.includes('medical')) {
    relevantPlatforms = [...INDIAN_PLATFORMS.healthcare];
  } else if (industry.includes('education') || industry.includes('coaching')) {
    relevantPlatforms = [...INDIAN_PLATFORMS.education];
  } else if (industry.includes('travel') || industry.includes('hospitality')) {
    relevantPlatforms = [...INDIAN_PLATFORMS.travel];
  } else {
    relevantPlatforms = [...INDIAN_PLATFORMS.local, ...INDIAN_PLATFORMS.payments];
  }

  const mentionedLocal = relevantPlatforms.filter((p) =>
    output.toLowerCase().includes(p.toLowerCase())
  );

  let score = 60;
  if (mentionedLocal.length >= 2) score = 90;
  else if (mentionedLocal.length === 1) score = 75;

  return {
    name: 'local_platform_mention',
    passed: score >= 50,
    score,
    message: mentionedLocal.length > 0
      ? `Mentions local platforms: ${mentionedLocal.join(', ')}`
      : 'No industry-specific local platforms mentioned',
  };
}

// ─── Suggestion Generator ───────────────

function generateSuggestions(checks: EvalCheck[]): string[] {
  const suggestions: string[] = [];

  for (const check of checks) {
    if (!check.passed) {
      switch (check.name) {
        case 'india_context':
          suggestions.push('Add Indian market context: INR pricing, local platforms, festival references');
          break;
        case 'platform_relevance':
          suggestions.push('Replace Western platforms with Indian alternatives (Zomato/Swiggy, Razorpay, JustDial)');
          break;
        case 'vernacular_tone':
          suggestions.push('Adjust tone for the target audience (casual for WhatsApp, professional for B2B)');
          break;
        case 'city_tier_awareness':
          suggestions.push('Adjust budget recommendations to match the city tier');
          break;
        case 'festival_calendar':
          suggestions.push('Reference Indian festivals (Diwali, Holi, Navratri, IPL) in campaign calendars');
          break;
        case 'whatsapp_first':
          suggestions.push('Consider WhatsApp as the primary communication channel in India');
          break;
        case 'generic_content':
          suggestions.push('Replace generic phrases with specific, actionable details (tool names, prices, timelines)');
          break;
        case 'b2b_tone':
          suggestions.push('Use B2B-appropriate language (ROI, KPIs, pipeline, implementation)');
          break;
        case 'inr_currency':
          suggestions.push('Use INR (₹) instead of USD ($) for Indian context');
          break;
        case 'local_platform_mention':
          suggestions.push('Mention Indian-local platforms relevant to the industry');
          break;
      }
    }
  }

  return suggestions;
}

// ─── Batch Evaluation ──────────────────

/**
 * Evaluate multiple outputs and return aggregate statistics.
 */
export function evaluateBatch(
  outputs: Array<{ text: string; context?: EvalContext; label?: string }>
): {
  averageScore: number;
  passRate: number;
  results: Array<EvalResult & { label?: string }>;
  weakestChecks: string[];
  strongestChecks: string[];
} {
  const results = outputs.map((o) => ({
    ...evaluateOutput(o.text, o.context),
    label: o.label,
  }));

  const averageScore = results.length > 0
    ? Math.round(results.reduce((s, r) => s + r.overallScore, 0) / results.length)
    : 0;

  const passRate = results.length > 0
    ? Math.round(results.filter((r) => r.passed).length / results.length * 100)
    : 0;

  // Aggregate check scores
  const checkScores: Record<string, number[]> = {};
  for (const r of results) {
    for (const c of r.checks) {
      if (!checkScores[c.name]) checkScores[c.name] = [];
      checkScores[c.name].push(c.score);
    }
  }

  const checkAverages = Object.entries(checkScores).map(([name, scores]) => ({
    name,
    avg: scores.reduce((a, b) => a + b, 0) / scores.length,
  }));
  checkAverages.sort((a, b) => a.avg - b.avg);

  return {
    averageScore,
    passRate,
    results,
    weakestChecks: checkAverages.slice(0, 3).map((c) => c.name),
    strongestChecks: checkAverages.slice(-3).map((c) => c.name),
  };
}
