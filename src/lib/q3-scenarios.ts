// ═══════════════════════════════════════
// ORACLE — Q3 2026 Scenario Functions
// Business logic for real user complaint scenarios
// ═══════════════════════════════════════

// ─── Types ─────────────────────────────

export interface WhatsAppComplianceWarning {
  compliant: boolean;
  warnings: string[];
  optInRequired: boolean;
  riskLevel: 'safe' | 'caution' | 'danger';
}

export interface BSPCostComparison {
  provider: string;
  monthlyConversations: number;
  metaCostINR: number;
  subscriptionINR: number;
  markupPercent: number;
  platformFeePerMsg: number;
  totalCostINR: number;
  totalMultiplier: number;
  savingsVsHighest: number;
}

export interface TDSTracking {
  invoiceNumber: string;
  invoiceAmount: number;
  tdsRate: number;
  tdsDeducted: number;
  netReceived: number;
  tdsCertificateStatus: 'received' | 'pending' | 'overdue';
  daysSinceInvoice: number;
  followUpRequired: boolean;
}

export interface InvoiceDateCompliance {
  originalDate: string;
  requestedDate: string;
  risks: string[];
  recommendation: string;
  compliant: boolean;
}

export interface CRMCostWarning {
  currentTool: string;
  teamSize: number;
  monthlyCostINR: number;
  annualCostINR: number;
  alternatives: Array<{
    name: string;
    monthlyCostINR: number;
    annualCostINR: number;
    notes: string;
  }>;
  warningMessage: string;
}

export interface TierBudgetRecommendation {
  city: string;
  tier: 1 | 2 | 3;
  averageBudgetRange: { min: number; max: number };
  recommendedPackage: string;
  packagePrice: number;
  notes: string;
}

export interface GreenTickChecklist {
  eligible: boolean;
  requirementsMet: string[];
  requirementsPending: string[];
  estimatedTimeline: string;
  steps: string[];
}

export interface ZohoFragmentationWarning {
  hasFragmentationRisk: boolean;
  affectedApps: string[];
  integrationOptions: Array<{
    name: string;
    cost: string;
    setupComplexity: 'low' | 'medium' | 'high';
    notes: string;
  }>;
  recommendation: string;
}

export interface CRMRoiAnalysis {
  buildCostINR: number;
  annualMaintenanceINR: number;
  saasAnnualCostINR: number;
  paybackMonths: number;
  breakEvenYear: number;
  recommendation: string;
}

export interface UpfrontPaymentPolicy {
  recommendedPercent: number;
  milestoneStructure: Array<{
    name: string;
    percent: number;
    trigger: string;
  }>;
  enforcementSteps: string[];
  escalationTemplate: string;
}

export interface AINativeValueFrame {
  positioningFramework: string;
  talkingPoints: string[];
  differentiationStrategies: string[];
  pricingJustification: string;
}

export interface VernacularContentGuidance {
  detectedLanguage: string;
  targetAudience: string;
  toneGuidance: string;
  examples: string[];
  warnings: string[];
}

export interface HumanPolishPipeline {
  contentType: string;
  estimatedAiContribution: number;
  polishChecklist: string[];
  timeEstimate: string;
  qualityGates: string[];
}

export interface CommodityDifferentiation {
  currentThreatLevel: 'low' | 'medium' | 'high';
  riskFactors: string[];
  defensiveStrategies: string[];
  pricingRecommendation: string;
  clientEducationScript: string;
}

// ─── 1. WhatsApp Compliance Warning (Q3-W3) ──

export function checkWhatsAppCompliance(
  campaignType: 'promotional' | 'transactional' | 'otp',
  hasOptIn: boolean,
  recipientCount: number
): WhatsAppComplianceWarning {
  const warnings: string[] = [];
  let riskLevel: WhatsAppComplianceWarning['riskLevel'] = 'safe';

  if (campaignType === 'promotional') {
    if (!hasOptIn) {
      warnings.push('WhatsApp requires explicit opt-in for promotional messages. Mass messaging without consent risks account suspension.');
      warnings.push('Build an opt-in list first via: 1) Website form, 2) In-store QR code, 3) Previous customer database.');
      riskLevel = 'danger';
    } else if (recipientCount > 100) {
      warnings.push('High-volume promotional messaging (>100 recipients) may trigger Meta review. Ensure all recipients have valid opt-in records.');
      riskLevel = 'caution';
    }
  }

  if (recipientCount >= 1000) {
    warnings.push('Sending to >=1000 recipients requires Business Verification and may need Meta approval for the message template.');
    if (riskLevel !== 'danger') riskLevel = 'caution';
  }

  return {
    compliant: warnings.length === 0,
    warnings,
    optInRequired: campaignType === 'promotional',
    riskLevel,
  };
}

// ─── 2. BSP Cost Comparison (Q3-W1) ──

export const BSP_PROVIDERS: Array<{
  name: string;
  subscriptionINR: number;
  markupPercent: number;
  platformFeePerMsg: number;
  features: string[];
}> = [
  { name: 'Meta Direct (no BSP)', subscriptionINR: 0, markupPercent: 0, platformFeePerMsg: 0, features: ['Base rates only', 'Requires technical setup', 'No managed dashboard'] },
  { name: '360dialog', subscriptionINR: 2500, markupPercent: 5, platformFeePerMsg: 0.20, features: ['Near-direct API access', 'Developer-focused', 'Minimal markup'] },
  { name: 'WANotifier', subscriptionINR: 1500, markupPercent: 10, platformFeePerMsg: 0.40, features: ['Chrome extension', 'Low subscription', 'Template library'] },
  { name: 'Interakt', subscriptionINR: 3000, markupPercent: 15, platformFeePerMsg: 0.50, features: ['Shared inbox', 'Labels & tags', 'No-code flows'] },
  { name: 'AiSensy', subscriptionINR: 5000, markupPercent: 25, platformFeePerMsg: 0.75, features: ['Campaign manager', 'Chatbot builder', 'Broadcast tools'] },
  { name: 'Wati', subscriptionINR: 4500, markupPercent: 20, platformFeePerMsg: 0.65, features: ['No-code chatbot', 'Team inbox', 'API access'] },
];

export function compareBSPCosts(
  monthlyConversations: number,
  metaCostPerMsgINR: number = 0.75
): BSPCostComparison[] {
  const metaBaseCost = monthlyConversations * metaCostPerMsgINR;

  const results = BSP_PROVIDERS.map((provider) => {
    const markedUpMsgCost = metaCostPerMsgINR * (1 + provider.markupPercent / 100);
    const totalPerMsgCost = markedUpMsgCost + provider.platformFeePerMsg;
    const variableCost = monthlyConversations * totalPerMsgCost;
    const totalCost = provider.subscriptionINR + variableCost;
    const totalMultiplier = metaBaseCost > 0 ? totalCost / metaBaseCost : 0;

    return {
      provider: provider.name,
      monthlyConversations,
      metaCostINR: Math.round(metaBaseCost * 100) / 100,
      subscriptionINR: provider.subscriptionINR,
      markupPercent: provider.markupPercent,
      platformFeePerMsg: provider.platformFeePerMsg,
      totalCostINR: Math.round(totalCost * 100) / 100,
      totalMultiplier: Math.round(totalMultiplier * 10) / 10,
      savingsVsHighest: 0,
    };
  }).sort((a, b) => a.totalCostINR - b.totalCostINR);

  const highestCost = results[results.length - 1]?.totalCostINR ?? 0;
  for (const r of results) {
    r.savingsVsHighest = Math.round((highestCost - r.totalCostINR) * 100) / 100;
  }

  return results;
}

// ─── 3. TDS Deduction Tracking (Q3-P3) ──

export function calculateTDS(
  invoiceAmount: number,
  tdsRate: number = 10,
  invoiceDate: string,
  currentDate: string = new Date().toISOString()
): TDSTracking {
  const tdsDeducted = Math.round((invoiceAmount * tdsRate) / 100);
  const netReceived = invoiceAmount - tdsDeducted;
  const daysSinceInvoice = Math.floor(
    (new Date(currentDate).getTime() - new Date(invoiceDate).getTime()) / (24 * 60 * 60 * 1000)
  );

  const tdsCertificateStatus: TDSTracking['tdsCertificateStatus'] =
    daysSinceInvoice > 60 ? 'overdue' : daysSinceInvoice > 45 ? 'pending' : 'received';

  return {
    invoiceNumber: '',
    invoiceAmount,
    tdsRate,
    tdsDeducted,
    netReceived,
    tdsCertificateStatus,
    daysSinceInvoice,
    followUpRequired: tdsCertificateStatus === 'pending' || tdsCertificateStatus === 'overdue',
  };
}

// ─── 4. Invoice Date Compliance (Q3-P1) ──

export function checkInvoiceDateCompliance(
  originalDate: string,
  requestedDate: string,
  invoiceAmount: number,
  alreadyFiled: boolean = false
): InvoiceDateCompliance {
  const risks: string[] = [];
  let recommendation = '';
  let compliant = true;

  const originalD = new Date(originalDate);
  const requestedD = new Date(requestedDate);

  if (requestedD <= originalD) {
    return {
      originalDate,
      requestedDate,
      risks: [],
      recommendation: 'Requested date is on or before the original date — no compliance issue.',
      compliant: true,
    };
  }

  const daysShifted = Math.floor((requestedD.getTime() - originalD.getTime()) / (24 * 60 * 60 * 1000));

  if (alreadyFiled) {
    risks.push('Invoice already filed with tax authorities. Changing dates creates a mismatch that may trigger audit.');
  }

  if (daysShifted > 0) {
    risks.push(`Re-issuing with new dates affects: 1) GST filing timing (may shift to different return period), 2) Revenue recognition (shifts to different quarter), 3) Payment terms reset.`);
    compliant = false;
  }

  if (invoiceAmount > 500000) {
    risks.push(`High-value invoice (₹${invoiceAmount.toLocaleString('en-IN')}). Date changes on invoices >₹5L may attract scrutiny from GST officers.`);
  }

  recommendation = 'Add \'Invoice dates are final\' clause to contracts. If unavoidable, issue credit note + new invoice to maintain audit trail.';

  return {
    originalDate,
    requestedDate,
    risks,
    recommendation,
    compliant,
  };
}

// ─── 5. HubSpot Cost Warning (Q3-C1) ──

const CRM_ALTERNATIVES: CRMCostWarning['alternatives'] = [
  { name: 'Zoho CRM', monthlyCostINR: 1200, annualCostINR: 14400, notes: '₹1,200/user/month with native GST integration. Best for Indian SMBs.' },
  { name: 'Custom CRM', monthlyCostINR: 0, annualCostINR: 1500000, notes: '₹15-30L build cost, ₹2L/month maintenance. Payback in 18-24 months at 20+ users.' },
];

export function warnHubSpotScalingCost(teamSize: number): CRMCostWarning {
  const hubspotPerSeatINR = 3800;
  const hubspotBaseINR = 67200;
  const monthlyCost = hubspotBaseINR + teamSize * hubspotPerSeatINR;
  const annualCost = monthlyCost * 12;

  const alternatives = CRM_ALTERNATIVES.map((alt) => ({
    ...alt,
    monthlyCostINR: teamSize * alt.monthlyCostINR,
    annualCostINR: teamSize * alt.annualCostINR,
  }));

  let warningMessage = '';
  if (teamSize >= 20) {
    warningMessage = `At ${teamSize} users, HubSpot costs ~₹${(monthlyCost / 1000).toFixed(1)}L/month (₹${(annualCost / 100000).toFixed(1)}L/year). Consider alternatives below — especially Zoho CRM for native GST integration.`;
  } else if (teamSize >= 10) {
    warningMessage = `At ${teamSize} users, HubSpot costs ~₹${(monthlyCost / 1000).toFixed(1)}L/month. Monitor closely — costs escalate quickly as you add seats.`;
  } else {
    warningMessage = `HubSpot is competitive at ${teamSize} users (~₹${(monthlyCost / 1000).toFixed(1)}L/month). Re-evaluate when your team exceeds 10 users.`;
  }

  return {
    currentTool: 'HubSpot',
    teamSize,
    monthlyCostINR: monthlyCost,
    annualCostINR: annualCost,
    alternatives,
    warningMessage,
  };
}

// ─── 9. WhatsApp API Verification Timeline Warning ──

export interface VerificationTimelineWarning {
  estimatedDays: number;
  interimSolution: string;
  warningMessage: string;
  checklist: string[];
}

export function warnAPIVerificationTimeline(
  businessVerified: boolean = false,
  hasExistingNumber: boolean = false
): VerificationTimelineWarning {
  let estimatedDays = 14;
  const blockers: string[] = [];

  if (!businessVerified) {
    estimatedDays += 7;
    blockers.push('Business verification not completed — add 7 days');
  }

  if (hasExistingNumber) {
    estimatedDays += 5;
    blockers.push('Phone number previously active on WhatsApp consumer app — add 5 days for migration');
  }

  const delayNote = blockers.length > 0 ? ` Delays: ${blockers.join('; ')}.` : '';
  const warningMessage = `WhatsApp Cloud API verification typically takes ${estimatedDays} business days in 2026.${delayNote} For immediate messaging, start with the free WhatsApp Business app and migrate later.`;

  const interimSolution = 'Use the free WhatsApp Business app for immediate customer communication. When API is approved, migrate conversations to the Cloud API for automation and templates.';

  const checklist = [
    '1. Ensure legal business name matches Business Manager exactly',
    '2. Have GSTIN and business registration documents ready',
    '3. Use a phone number NOT previously active on WhatsApp consumer app',
    '4. Submit business verification in Meta Business Manager first',
    '5. Prepare message templates in advance (approval takes 24-48 hours)',
    '6. Test with a small batch before scaling to full campaign',
  ];

  return { estimatedDays, interimSolution, warningMessage, checklist };
}

// ─── 7. WhatsApp INR Billing Migration Warning ──

export interface INRMigrationWarning {
  needsMigration: boolean;
  deadline: string;
  daysUntilDeadline: number;
  urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
  warnings: string[];
  steps: string[];
}

export function checkINRBillingMigration(
  currentDate: string = new Date().toISOString(),
  hasMigrated: boolean = false
): INRMigrationWarning {
  const deadline = '2026-12-31';
  const deadlineDate = new Date(deadline);
  const today = new Date(currentDate);
  const daysUntilDeadline = Math.max(0, Math.floor((deadlineDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)));

  if (hasMigrated) {
    return { needsMigration: false, deadline, daysUntilDeadline, urgencyLevel: 'low', warnings: [], steps: [] };
  }

  const warnings: string[] = [
    'Meta requires all India-based WABAs to use INR billing by December 31, 2026.',
    'After January 1, 2027, Meta will stop delivering messages for non-INR WABAs.',
  ];

  let urgencyLevel: INRMigrationWarning['urgencyLevel'] = 'low';
  if (daysUntilDeadline <= 30) {
    urgencyLevel = 'critical';
    warnings.push(`URGENT: Only ${daysUntilDeadline} days left before message delivery stops!`);
  } else if (daysUntilDeadline <= 90) {
    urgencyLevel = 'high';
    warnings.push(`Only ${daysUntilDeadline} days left. Migration should be completed immediately.`);
  } else if (daysUntilDeadline <= 180) {
    urgencyLevel = 'medium';
    warnings.push(`${daysUntilDeadline} days remaining. Plan migration within the next quarter.`);
  }

  const steps = [
    '1. Log into Meta Business Manager → WhatsApp Business Accounts',
    '2. Check if your WABAs are eligible for INR billing migration',
    '3. Use Meta Migration API (available since June 1, 2026) or migrate via Business Manager UI',
    '4. Update BSP contract to ensure INR-based billing is reflected',
    '5. Verify all payment methods are INR-denominated',
    '6. Test a message send after migration to confirm delivery',
  ];

  return { needsMigration: true, deadline, daysUntilDeadline, urgencyLevel, warnings, steps };
}

// ─── 8. Template Reclassification Alert ──

export type TemplateCategory = 'marketing' | 'utility' | 'authentication' | 'service';

export interface ReclassificationAlert {
  templateName: string;
  originalCategory: TemplateCategory;
  newCategory: TemplateCategory;
  costMultiplier: number;
  estimatedMonthlyImpactINR: number;
  alertLevel: 'info' | 'warning' | 'critical';
  recommendation: string;
}

const CATEGORY_COST_INDEX: Record<TemplateCategory, number> = {
  service: 0, utility: 1, authentication: 1.2, marketing: 4.5,
};

export function detectReclassification(
  templateName: string,
  originalCategory: TemplateCategory,
  newCategory: TemplateCategory,
  monthlyVolume: number,
  utilityCostPerMsgINR: number = 0.75
): ReclassificationAlert {
  if (originalCategory === newCategory) {
    return {
      templateName, originalCategory, newCategory,
      costMultiplier: 1, estimatedMonthlyImpactINR: 0, alertLevel: 'info',
      recommendation: `Template "${templateName}" category unchanged (${originalCategory}). No action required.`,
    };
  }

  const originalCost = CATEGORY_COST_INDEX[originalCategory] * utilityCostPerMsgINR;
  const newCost = CATEGORY_COST_INDEX[newCategory] * utilityCostPerMsgINR;
  const costMultiplier = originalCost > 0 ? newCost / originalCost : Infinity;

  const monthlyOriginalCost = monthlyVolume * originalCost;
  const monthlyNewCost = monthlyVolume * newCost;
  const estimatedMonthlyImpactINR = Math.round((monthlyNewCost - monthlyOriginalCost) * 100) / 100;

  let alertLevel: ReclassificationAlert['alertLevel'] = 'info';
  let recommendation = '';
  const multiplierDisplay = costMultiplier === Infinity ? '\u221e' : costMultiplier.toFixed(1);

  if (newCategory === 'marketing' && originalCategory !== 'marketing') {
    alertLevel = 'critical';
    recommendation = `Template "${templateName}" reclassified from ${originalCategory} to MARKETING. This increases cost ${multiplierDisplay}x. Monthly impact: +₹${estimatedMonthlyImpactINR.toLocaleString('en-IN')}. Action: 1) Review template content for promotional language, 2) Remove CTAs that trigger marketing classification, 3) Resubmit as ${originalCategory} with compliant wording, 4) Consider pausing campaign until reclassified.`;
  } else if (costMultiplier > 1.5) {
    alertLevel = 'warning';
    recommendation = `Template "${templateName}" reclassified from ${originalCategory} to ${newCategory}. Cost increased ${multiplierDisplay}x. Monthly impact: +₹${estimatedMonthlyImpactINR.toLocaleString('en-IN')}. Review template content and resubmit if unintended.`;
  } else {
    alertLevel = 'info';
    recommendation = `Template "${templateName}" reclassified from ${originalCategory} to ${newCategory}. Minor cost change. No immediate action required.`;
  }

  return {
    templateName, originalCategory, newCategory,
    costMultiplier: Math.round(costMultiplier * 10) / 10,
    estimatedMonthlyImpactINR, alertLevel, recommendation,
  };
}

export function estimateReclassificationImpact(
  templates: Array<{ name: string; originalCategory: TemplateCategory; currentCategory: TemplateCategory; monthlyVolume: number }>,
  utilityCostPerMsgINR: number = 0.75
): { alerts: ReclassificationAlert[]; totalMonthlyImpactINR: number; criticalCount: number } {
  const alerts = templates.map((t) =>
    detectReclassification(t.name, t.originalCategory, t.currentCategory, t.monthlyVolume, utilityCostPerMsgINR)
  );
  const totalMonthlyImpactINR = Math.round(alerts.reduce((sum, a) => sum + a.estimatedMonthlyImpactINR, 0) * 100) / 100;
  const criticalCount = alerts.filter((a) => a.alertLevel === 'critical').length;
  return { alerts, totalMonthlyImpactINR, criticalCount };
}

// ─── 6. Tier-2/3 Budget Adjustment (Q3-A3) ──

const TIER_BUDGETS: Record<number, { averageRange: { min: number; max: number }; cities: string[] }> = {
  1: { averageRange: { min: 50000, max: 200000 }, cities: ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Kolkata', 'Hyderabad', 'Pune'] },
  2: { averageRange: { min: 10000, max: 30000 }, cities: ['Lucknow', 'Jaipur', 'Bhopal', 'Indore', 'Nagpur', 'Surat', 'Ahmedabad', 'Chandigarh', 'Kochi', 'Coimbatore'] },
  3: { averageRange: { min: 5000, max: 15000 }, cities: ['Varanasi', 'Patna', 'Ranchi', 'Raipur', 'Guwahati', 'Jodhpur', 'Udaipur', 'Mysore', 'Madurai', 'Vijayawada'] },
};

export function getTierBudgetRecommendation(city: string): TierBudgetRecommendation {
  const normalizedCity = city.trim();
  let tier: 1 | 2 | 3 = 3;
  for (const [tierNum, data] of Object.entries(TIER_BUDGETS)) {
    if (data.cities.some((c) => c.toLowerCase() === normalizedCity.toLowerCase())) {
      tier = Number(tierNum) as 1 | 2 | 3;
      break;
    }
  }
  const tierData = TIER_BUDGETS[tier];
  if (!tierData) return { city: normalizedCity, tier, averageBudgetRange: { min: 0, max: 0 }, recommendedPackage: '', packagePrice: 0, notes: 'Unknown tier' };
  const budgetRange = tierData.averageRange;
  const recommendedPrice = Math.round((budgetRange.min + budgetRange.max) / 2);
  const packages: Record<number, string> = {
    1: 'Full-service SEO + Meta Ads + Google Ads (₹50,000-₹2,00,000/month)',
    2: 'Basic SEO + Google My Business + WhatsApp outreach (₹10,000-₹30,000/month)',
    3: 'GMB optimization + Local SEO + Social media (₹5,000-₹15,000/month)',
  };
  return {
    city: normalizedCity, tier, averageBudgetRange: budgetRange,
    recommendedPackage: packages[tier] ?? 'Custom package', packagePrice: recommendedPrice,
    notes: tier === 1 ? 'Tier-1 market — full-service packages viable'
      : tier === 2 ? 'Tier-2 market — focus on local SEO and WhatsApp-first strategies'
      : 'Tier-3 market — keep packages affordable, prioritize GMB and local listings',
  };
}

// ═══════════════════════════════════════
// NEW: Remaining Q3 Scenarios
// ═══════════════════════════════════════

// ─── 10. Green Tick Verification Checklist (Q3-W4) ──

export function getGreenTickChecklist(
  businessVerified: boolean = false,
  twoFactorEnabled: boolean = false,
  messagesSent30Days: number = 0,
  accountActiveDays: number = 0,
  metaBusinessVerification: boolean = false
): GreenTickChecklist {
  const met: string[] = [];
  const pending: string[] = [];

  if (businessVerified) { met.push('Business verification complete'); } else { pending.push('Complete business verification in Meta Business Manager'); }
  if (twoFactorEnabled) { met.push('Two-factor authentication enabled'); } else { pending.push('Enable two-factor authentication on WhatsApp Business account'); }
  if (messagesSent30Days >= 1000) { met.push(`1000+ messages sent in last 30 days (${messagesSent30Days})`); } else { pending.push(`Send at least 1000 messages in last 30 days (currently ${messagesSent30Days})`); }
  if (accountActiveDays >= 30) { met.push(`Account active for 30+ days (${accountActiveDays} days)`); } else { pending.push(`Wait until account has been active for 30+ days (currently ${accountActiveDays} days)`); }
  if (metaBusinessVerification) { met.push('Meta Business Verification submitted'); } else { pending.push('Submit Meta Business Verification application'); }

  const eligible = pending.length === 0;

  return {
    eligible,
    requirementsMet: met,
    requirementsPending: pending,
    estimatedTimeline: eligible ? 'Apply immediately — typically approved within 1-2 weeks' : `${pending.length} requirement(s) remaining. Complete them before applying.`,
    steps: [
      '1. Complete all requirements above',
      '2. Go to WhatsApp Manager → Business Profile → Verified Badge',
      '3. Submit application with business documentation',
      '4. Wait for Meta review (1-2 weeks typically)',
      '5. If rejected, address feedback and resubmit',
    ],
  };
}

// ─── 11. Zoho Fragmentation Warning (Q3-C2) ──

export function warnZohoFragmentation(
  appsInUse: string[]
): ZohoFragmentationWarning {
  const knownApps = ['CRM', 'Books', 'Projects', 'Desk', 'Campaigns', 'Analytics', 'People'];
  const activeApps = appsInUse.filter(a => knownApps.some(k => a.toLowerCase().includes(k.toLowerCase())));

  if (activeApps.length <= 1) {
    return {
      hasFragmentationRisk: false,
      affectedApps: [],
      integrationOptions: [],
      recommendation: 'Single Zoho app — no fragmentation risk. If scaling to multiple apps, plan integration early.',
    };
  }

  const integrationOptions = [
    { name: 'Zoho Flow', cost: 'Free tier (100 tasks/month), then $9/month', setupComplexity: 'low' as const, notes: 'Built-in automation between Zoho apps. Best for simple sync.' },
    { name: 'Zoho CRM + Books native integration', cost: 'Included with both products', setupComplexity: 'low' as const, notes: 'Direct data sync for contacts, invoices, and deals.' },
    { name: 'Zapier', cost: '$20/month for 750 tasks', setupComplexity: 'medium' as const, notes: 'For cross-platform integrations beyond Zoho ecosystem.' },
    { name: 'Custom API integration', cost: '₹50,000-₹1,50,000 setup + maintenance', setupComplexity: 'high' as const, notes: 'Best for complex workflows. Requires developer.' },
  ];

  return {
    hasFragmentationRisk: activeApps.length >= 2,
    affectedApps: activeApps,
    integrationOptions,
    recommendation: activeApps.length >= 3
      ? `You're using ${activeApps.length} Zoho apps (${activeApps.join(', ')}). This creates data silos. Recommendation: Use Zoho Flow for basic sync, or consolidate into fewer apps if possible. Consider HubSpot's unified platform if native sync is critical.`
      : `Using ${activeApps.length} Zoho apps. Data sync between ${activeApps.join(' and ')} is manageable with Zoho Flow. Monitor for fragmentation as you add more apps.`,
  };
}

// ─── 12. Custom CRM ROI Calculator (Q3-C3) ──

export function calculateCRMRoi(
  teamSize: number,
  buildCostINR: number = 2250000, // ₹22.5L midpoint
  monthlyMaintenanceINR: number = 200000, // ₹2L/month
  saasPerSeatINR: number = 3800
): CRMRoiAnalysis {
  const saasAnnualCost = teamSize * saasPerSeatINR * 12;
  const customAnnualMaintenance = monthlyMaintenanceINR * 12;

  // Payback: build cost / (SaaS annual - custom maintenance)
  const annualSavings = saasAnnualCost - customAnnualMaintenance;
  const paybackMonths = annualSavings > 0 ? Math.round((buildCostINR / annualSavings) * 12) : 999;    const breakEvenYear = paybackMonths >= 999 ? 999 : Math.round(paybackMonths / 12 * 10) / 10;

  let recommendation = '';
  if (teamSize < 10) {
    recommendation = `At ${teamSize} users, SaaS is more cost-effective. Custom CRM ROI is negative. Use Zoho CRM (₹1,200/user/month with native GST).`;
  } else if (paybackMonths <= 24) {
    recommendation = `Custom CRM pays back in ${paybackMonths} months (${breakEvenYear} years). Viable if you have in-house developers and can tolerate feature gaps.`;
  } else if (paybackMonths <= 36) {
    recommendation = `Custom CRM takes ${paybackMonths} months to pay back. Consider hybrid: use SaaS for 12 months, build custom only if SaaS costs exceed ₹${(saasAnnualCost / 100000).toFixed(0)}L/year.`;
  } else {
    recommendation = `Custom CRM is not cost-effective at this scale. At ${teamSize} users, SaaS costs ₹${(saasAnnualCost / 100000).toFixed(1)}L/year vs custom maintenance ₹${(customAnnualMaintenance / 100000).toFixed(1)}L/year + ₹${(buildCostINR / 100000).toFixed(1)}L build cost.`;
  }

  return {
    buildCostINR,
    annualMaintenanceINR: customAnnualMaintenance,
    saasAnnualCostINR: saasAnnualCost,
    paybackMonths,
    breakEvenYear,
    recommendation,
  };
}

// ─── 13. Upfront Payment Policy (Q3-P2) ──

export function getUpfrontPaymentPolicy(
  projectValueINR: number
): UpfrontPaymentPolicy {
  const milestoneStructure = projectValueINR <= 50000
    ? [
        { name: 'Advance', percent: 100, trigger: 'Before work begins' },
      ]
    : projectValueINR <= 200000
      ? [
          { name: 'Advance', percent: 50, trigger: 'Before work begins' },
          { name: 'Final', percent: 50, trigger: 'On delivery and approval' },
        ]
      : [
          { name: 'Advance', percent: 30, trigger: 'Before work begins' },
          { name: 'Milestone 1', percent: 30, trigger: 'After design approval' },
          { name: 'Milestone 2', percent: 20, trigger: 'After development complete' },
          { name: 'Final', percent: 20, trigger: 'On delivery and approval' },
        ];

  const enforcementSteps = [
    '1. Add payment terms to proposal before sending',
    '2. Auto-hold project if advance payment not received within 7 days',
    '3. Send automated reminder at day 3 and day 5',
    '4. Escalate to manual follow-up at day 7',
    '5. Pause all deliverables until payment received',
  ];

  const escalationTemplate = `Dear {{client_name}},\n\nI notice we haven't received the advance payment for project "{{project_name}}" (₹{{amount}}) which was due on {{due_date}}.\n\nPer our agreement, work will commence once the advance payment is received. Please process the payment at your earliest convenience.\n\nFor your reference:\n- Invoice: {{invoice_number}}\n- Amount: ₹{{amount}}\n- Payment link: {{payment_link}}\n\nThank you,\n{{agency_name}}`;

  return {
    recommendedPercent: 50,
    milestoneStructure,
    enforcementSteps,
    escalationTemplate,
  };
}

// ─── 14. AI-Native Value Framing (Q3-A1) ──

export function getAINativeValueFrame(): AINativeValueFrame {
  return {
    positioningFramework: 'AI handles 60% of research/drafting. Our strategists add 40% human expertise: market analysis, brand alignment, conversion optimization, performance tracking. That\'s what you\'re paying for. Present as "AI-augmented" not "AI-generated".',
    talkingPoints: [
      'Our AI drafts initial content — then human strategists optimize it for your specific market',
      'We combine AI speed with human insight for better results in less time',
      'AI handles research and first drafts; humans ensure quality, brand alignment, and local context',
      'You get 3x faster delivery without sacrificing quality — that\'s the AI advantage',
    ],
    differentiationStrategies: [
      'Results-based pricing (not hourly) — charge for outcomes, not time',
      'Niche specialization — be the expert in one vertical (dental clinics, restaurants, etc.)',
      'Performance guarantees with SLAs — back your work with measurable commitments',
      'Custom AI training with client data — AI that knows YOUR brand and audience',
      'Transparent reporting — show exactly how AI and human work combine in deliverables',
    ],
    pricingJustification: 'When clients question pricing, frame it as: "We invest ₹X in AI tools and human expertise to deliver ₹Y in measurable results. The value is in the outcome, not the process."',
  };
}

// ─── 15. Vernacular Content Guidance (Q3-A2) ──

export function getVernacularContentGuidance(
  language: string,
  targetAudience: string = 'general'
): VernacularContentGuidance {
  const guidelines: Record<string, { toneGuidance: string; examples: string[]; warnings: string[] }> = {
    hindi: {
      toneGuidance: targetAudience === 'urban'
        ? 'Use Hinglish (mix of Hindi + English) for urban audiences. Casual, conversational tone. Avoid formal "shuddh" Hindi unless for government/legal context.'
        : 'Use conversational Hindi with simple vocabulary. Avoid English loanwords for rural audiences. Use local dialects where appropriate.',
      examples: targetAudience === 'urban'
        ? ['Aaj ka special: Butter Chicken aur Naan 🔥', 'Aapka business grow karne ka plan hai? Let\'s talk!', 'Dhamakedar offer — Sirf aaj ke liye!']
        : ['आज का ऑफर — सबसे सस्ता और सबसे अच्छा!', 'हमारी सेवा आपके शहर में अब उपलब्ध है।', 'जल्दी करें, सीमित समय के लिए!'],
      warnings: [
        'Never use textbook/formal Hindi for social media or WhatsApp',
        'Avoid mixing too much English — keep it 70% Hindi, 30% English for urban',
        'Test with native speakers before publishing — regional dialects vary significantly',
      ],
    },
    tamil: {
      toneGuidance: 'Use spoken Tamil, not literary Tamil. Mix with English for tech/business context. Keep sentences short.',
      examples: ['இன்றைய சிறப்பு ஆஃபர்! 🔥', 'உங்க பிசினஸை grow பண்ண தயாரா?'],
      warnings: ['Avoid formal/literary Tamil for casual content', 'Regional slang varies between Chennai, Coimbatore, and Madurai'],
    },
    bengali: {
      toneGuidance: 'Use conversational Bengali. Mix with English naturally. Friendly and warm tone works well.',
      examples: ['আজকের বিশেষ অফার! 🎉', 'আপনার ব্যবসাকে এগিয়ে নিতে প্রস্তুত?'],
      warnings: ['Avoid overly formal Bengali', 'East Bengali vs West Bengali vocabulary differences'],
    },
  };

  const defaultGuideline = {
    toneGuidance: `For ${language} content: Use conversational, colloquial form. Avoid formal/literary register. Mix with English where appropriate for business context.`,
    examples: [`[${language} example 1 — conversational]`, `[${language} example 2 — business]`],
    warnings: [`Test ${language} content with native speakers before publishing`, `Regional dialects may differ significantly from standard ${language}`],
  };

  const guideline = guidelines[language.toLowerCase()] ?? defaultGuideline;

  return {
    detectedLanguage: language,
    targetAudience,
    toneGuidance: guideline.toneGuidance,
    examples: guideline.examples,
    warnings: guideline.warnings,
  };
}

// ─── 16. Human Polish Pipeline (Q3-A4) ──

const CONTENT_POLISH_GUIDES: Record<string, { aiContribution: number; checklist: string[]; timeEstimate: string; gates: string[] }> = {
  blog: {
    aiContribution: 70,
    checklist: [
      'Add local examples and case studies (replace generic ones)',
      'Inject brand voice — rewrite any stiff/formal paragraphs',
      'Add local slang, cultural references, and colloquialisms',
      'Verify all factual claims (stats, dates, names)',
      'Add personal anecdotes or agency-specific insights',
      'Check for AI tells: "delve", "tapestry", "in the realm of"',
      'Optimize headings for SEO (target Indian search intent)',
    ],
    timeEstimate: '30-45 minutes per 1000 words',
    gates: ['Brand voice check', 'Fact verification', 'AI-tell removal', 'Local context injection'],
  },
  social: {
    aiContribution: 60,
    checklist: [
      'Replace generic hashtags with India-specific trending tags',
      'Add emojis and formatting that match platform culture',
      'Ensure captions sound conversational, not scripted',
      'Add location tags and local references',
      'Check image-text alignment for Indian audience',
      'Add call-to-action relevant to Indian market',
    ],
    timeEstimate: '15-20 minutes per post',
    gates: ['Platform-native formatting', 'Local hashtags', 'CTA relevance'],
  },
  email: {
    aiContribution: 65,
    checklist: [
      'Personalize opening with client-specific details',
      'Add Indian business etiquette touches (respectful tone)',
      'Verify pricing and currency in INR',
      "Check for Western idioms that don't translate",
      'Add local holidays/events as context hooks',
      'Ensure subject line complies with Indian email norms',
    ],
    timeEstimate: '20-30 minutes per email',
    gates: ['Personalization check', 'Cultural sensitivity', 'INR pricing'],
  },
  proposal: {
    aiContribution: 55,
    checklist: [
      "Customize case studies to match client's industry",
      'Add India-specific compliance notes (GST, TDS, RERA)',
      'Include local market data and benchmarks',
      'Adjust pricing to Tier-2/3 budget expectations',
      'Add team introduction with Indian market expertise',
      'Include SLA terms with Indian business hours',
      'Remove any Western-centric examples or references',
    ],
    timeEstimate: '45-60 minutes per proposal',
    gates: ['Industry relevance', 'Local compliance', 'Budget alignment', 'Cultural appropriateness'],
  },
};

const DEFAULT_POLISH_GUIDE = {
  aiContribution: 65,
  checklist: [
    'Replace generic content with India-specific examples',
    'Verify brand voice and tone consistency',
    'Add local cultural references and context',
    'Check for factual accuracy of all claims',
    'Remove AI-tell phrases and robotic language',
    'Ensure pricing is in INR with Indian number formatting',
  ],
  timeEstimate: '30-45 minutes per deliverable',
  gates: ['Brand voice', 'Fact check', 'Local context', 'AI-tell removal'],
};

export function getHumanPolishPipeline(contentType: string): HumanPolishPipeline {
  const guide = CONTENT_POLISH_GUIDES[contentType.toLowerCase()] ?? DEFAULT_POLISH_GUIDE;
  return {
    contentType,
    estimatedAiContribution: guide.aiContribution,
    polishChecklist: guide.checklist,
    timeEstimate: guide.timeEstimate,
    qualityGates: guide.gates,
  };
}

// ─── 17. Commodity Differentiation (Q3-A5) ──

export function getCommodityDifferentiation(
  averageProjectValueINR: number,
  aiAdoptionPercent: number = 50
): CommodityDifferentiation {
  const riskFactors: string[] = [];
  let threatLevel: CommodityDifferentiation['currentThreatLevel'] = 'low';

  if (aiAdoptionPercent >= 70) {
    threatLevel = 'high';
    riskFactors.push('High AI adoption in your market (>70%) — clients likely comparing AI-generated alternatives');
    riskFactors.push('Race-to-the-bottom pricing pressure from AI-native competitors');
  } else if (aiAdoptionPercent >= 40) {
    threatLevel = 'medium';
    riskFactors.push('Moderate AI adoption (40-70%) — differentiation window is closing');
    riskFactors.push('Clients beginning to question human-only pricing models');
  } else {
    riskFactors.push('Low AI adoption (<40%) — current pricing model still defensible');
  }

  if (averageProjectValueINR < 20000) {
    riskFactors.push('Low project value (sub-₹20K) — highest commoditization risk');
  }

  const defensiveStrategies = [
    'Position as AI-augmented, not AI-generated: We use AI tools + human expertise',
    'Results-based pricing: charge for outcomes (leads, revenue) not hours or deliverables',
    'Niche specialization: become the go-to expert for one vertical (dental, restaurants, SaaS)',
    'Performance guarantees with SLAs — competitors using AI alone cannot offer this',
    'Transparent reporting: show clients the AI+human workflow in every deliverable',
    'Build proprietary AI models trained on client data — lock-in through customization',
    'Offer strategy + execution bundles — AI commoditizes execution, not strategy',
  ];

  if (threatLevel === 'high') {
    defensiveStrategies.push('Urgent: Restructure pricing within 90 days before client churn begins');
    defensiveStrategies.push('Add mandatory strategy layer to every project — make it impossible to compare apples-to-apples');
  }

  const pricingRecommendation = threatLevel === 'high'
    ? `At ₹${averageProjectValueINR.toLocaleString('en-IN')} average project value with high AI commoditization risk: Shift to outcome-based pricing. Example: Instead of ₹30,000/month for SEO, charge ₹15,000 base + ₹500 per qualified lead generated. This makes AI-only alternatives impossible to compare.`
    : threatLevel === 'medium'
    ? `At ₹${averageProjectValueINR.toLocaleString('en-IN')} average project value: Start adding value-based components now. Keep base pricing but add performance bonuses, strategy retainers, and reporting tiers that AI-only competitors cannot replicate.`
    : `At ₹${averageProjectValueINR.toLocaleString('en-IN')} average project value with low commoditization risk: Current pricing model is defensible. Monitor AI adoption trends quarterly and prepare contingency pricing models.`;

  const clientEducationScript = [
    'When a client says AI can do this for free/cheap:',
    '',
    '1. Acknowledge: You are right that AI tools are powerful and accessible.',
    '2. Reframe: What you are paying for is the 40% that AI cannot do -- market strategy, brand alignment, conversion optimization, and accountability.',
    '3. Evidence: Here is a case where AI-generated content missed specific local context and we caught it -- saving the client from a specific consequence.',
    '4. Guarantee: We guarantee results. If we do not deliver a specific metric, you do not pay for that portion.',
    '',
    'Never compete on price with AI. Compete on outcomes, trust, and expertise.',
  ].join('\n');

  return {
    currentThreatLevel: threatLevel,
    riskFactors,
    defensiveStrategies,
    pricingRecommendation,
    clientEducationScript,
  };
}
