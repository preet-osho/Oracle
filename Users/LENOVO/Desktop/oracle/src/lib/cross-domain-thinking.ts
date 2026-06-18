// ═══════════════════════════════════════
// ORACLE — Cross-Domain Thinking Engine
// Identify adjacent needs · Connect service gaps · Strategic recommendations
// ═══════════════════════════════════════

// ─── Types ─────────────────────────────

export interface CrossDomainRecommendation {
  id: string;
  primaryService: string;
  adjacentService: string;
  relevance: number; // 0-100
  rationale: string;
  estimatedValue: string;
  effort: 'quick-win' | 'moderate' | 'major';
  category: 'complementary' | 'sequential' | 'upgrade' | 'bundling';
}

// ─── Service Adjacency Map ─────────────

const ADJACENCY_MAP: Record<string, Array<{
  service: string;
  relevance: number;
  rationale: string;
  value: string;
  effort: CrossDomainRecommendation['effort'];
  category: CrossDomainRecommendation['category'];
}>> = {
  'website-development': [
    { service: 'SEO', relevance: 95, rationale: 'Every new website needs SEO to be found. Technical SEO should be built in from day one.', value: '₹8,000-40,000/month', effort: 'moderate', category: 'complementary' },
    { service: 'Google Analytics Setup', relevance: 90, rationale: 'Website without analytics is flying blind. Essential for measuring ROI.', value: '₹5,000-10,000 one-time', effort: 'quick-win', category: 'complementary' },
    { service: 'Content Marketing', relevance: 80, rationale: 'Static websites lose ranking over time. Blog content drives organic traffic.', value: '₹10,000-25,000/month', effort: 'moderate', category: 'sequential' },
    { service: 'Social Media Management', relevance: 70, rationale: 'New website needs traffic. Social media amplifies reach.', value: '₹8,000-18,000/month', effort: 'moderate', category: 'complementary' },
    { service: 'Google Ads', relevance: 75, rationale: 'Drive immediate traffic while SEO builds up. Quick ROI.', value: '₹8,000-18,000/month + ad spend', effort: 'moderate', category: 'complementary' },
    { service: 'WhatsApp Marketing', relevance: 60, rationale: 'Capture website visitors with WhatsApp integration for follow-ups.', value: '₹5,000-15,000 setup + ₹3,000/month', effort: 'quick-win', category: 'complementary' },
  ],
  'seo': [
    { service: 'Content Marketing', relevance: 95, rationale: 'SEO without content is incomplete. Content drives keyword rankings.', value: '₹10,000-25,000/month', effort: 'moderate', category: 'sequential' },
    { service: 'Google Ads', relevance: 80, rationale: 'SEO takes time. Ads provide immediate visibility while organic builds.', value: '₹8,000-18,000/month', effort: 'moderate', category: 'complementary' },
    { service: 'Website Development', relevance: 70, rationale: 'SEO audit often reveals technical issues requiring site improvements.', value: '₹8,000-40,000 one-time', effort: 'major', category: 'sequential' },
    { service: 'Analytics & Reporting', relevance: 85, rationale: 'SEO success must be measured. Monthly reports prove ROI.', value: '₹5,000-15,000/month', effort: 'quick-win', category: 'complementary' },
  ],
  'google-ads': [
    { service: 'Landing Page Optimisation', relevance: 90, rationale: 'Ads are wasted without high-converting landing pages.', value: '₹8,000-15,000 one-time', effort: 'moderate', category: 'complementary' },
    { service: 'SEO', relevance: 75, rationale: 'Paid + organic covers both short and long-term traffic.', value: '₹8,000-18,000/month', effort: 'moderate', category: 'complementary' },
    { service: 'Email Marketing', relevance: 70, rationale: 'Capture ad traffic with email sequences for nurturing.', value: '₹5,000-15,000 setup + ₹3,000/month', effort: 'moderate', category: 'sequential' },
    { service: 'Analytics Setup', relevance: 85, rationale: 'Cannot optimise what you cannot measure. Conversion tracking essential.', value: '₹5,000-10,000 one-time', effort: 'quick-win', category: 'complementary' },
  ],
  'meta-ads': [
    { service: 'Content Creation', relevance: 90, rationale: 'Meta ads need fresh creative. Content calendar fuels ad creative.', value: '₹10,000-25,000/month', effort: 'moderate', category: 'complementary' },
    { service: 'Email Marketing', relevance: 70, rationale: 'Build retargeting audiences and nurture captured leads via email.', value: '₹5,000-15,000 setup', effort: 'moderate', category: 'sequential' },
    { service: 'WhatsApp Marketing', relevance: 80, rationale: 'WhatsApp conversion from Meta ads is extremely high in India.', value: '₹5,000-15,000 setup', effort: 'quick-win', category: 'complementary' },
  ],
  'social-media-management': [
    { service: 'Content Creation', relevance: 95, rationale: 'Social media requires consistent content. Content engine is essential.', value: '₹10,000-25,000/month', effort: 'moderate', category: 'sequential' },
    { service: 'Paid Social Ads', relevance: 85, rationale: 'Organic reach is declining. Boosting key posts amplifies results.', value: '₹6,000-15,000/month + ad spend', effort: 'moderate', category: 'complementary' },
    { service: 'Influencer Marketing', relevance: 65, rationale: 'Micro-influencers amplify social proof and reach.', value: '₹10,000-30,000/campaign', effort: 'moderate', category: 'complementary' },
  ],
  'email-marketing': [
    { service: 'Content Marketing', relevance: 80, rationale: 'Email needs valuable content to drive engagement and opens.', value: '₹10,000-25,000/month', effort: 'moderate', category: 'complementary' },
    { service: 'CRM Setup', relevance: 85, rationale: 'Email data should flow into CRM for sales follow-up.', value: '₹10,000-25,000 setup', effort: 'moderate', category: 'complementary' },
    { service: 'Landing Page', relevance: 75, rationale: 'Landing pages capture email subscribers from ad traffic.', value: '₹8,000-15,000 one-time', effort: 'quick-win', category: 'complementary' },
  ],
  'content-marketing': [
    { service: 'SEO', relevance: 90, rationale: 'Content should be SEO-optimised for maximum organic visibility.', value: '₹8,000-18,000/month', effort: 'moderate', category: 'complementary' },
    { service: 'Social Media Distribution', relevance: 85, rationale: 'Content needs distribution channels to reach audience.', value: '₹8,000-18,000/month', effort: 'moderate', category: 'sequential' },
    { service: 'Email Newsletter', relevance: 70, rationale: 'Repurpose content into newsletters for existing audience.', value: '₹5,000-12,000/month', effort: 'quick-win', category: 'complementary' },
  ],
  'crm-setup': [
    { service: 'Email Marketing Automation', relevance: 90, rationale: 'CRM data powers personalised email sequences.', value: '₹10,000-20,000 setup', effort: 'moderate', category: 'sequential' },
    { service: 'Sales Training', relevance: 70, rationale: 'CRM is only useful if the team knows how to use it.', value: '₹5,000-15,000 one-time', effort: 'quick-win', category: 'complementary' },
    { service: 'Lead Generation', relevance: 80, rationale: 'CRM needs leads to manage. Lead gen feeds the pipeline.', value: '₹8,000-18,000/month', effort: 'moderate', category: 'complementary' },
  ],
  'brand-identity': [
    { service: 'Website Development', relevance: 90, rationale: 'Brand identity needs to be applied across digital touchpoints.', value: '₹8,000-40,000', effort: 'major', category: 'sequential' },
    { service: 'Social Media Branding', relevance: 85, rationale: 'Brand guidelines must be applied to all social profiles.', value: '₹3,000-8,000 one-time', effort: 'quick-win', category: 'sequential' },
    { service: 'Content Marketing', relevance: 75, rationale: 'Brand voice guidelines inform all content creation.', value: '₹10,000-25,000/month', effort: 'moderate', category: 'complementary' },
  ],
};

// ─── Engine ────────────────────────────

export function getAdjacentServices(
  currentService: string,
  minRelevance: number = 50
): CrossDomainRecommendation[] {
  const normalisedService = currentService.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');

  // Try exact match first, then fuzzy
  let adjacencies = ADJACENCY_MAP[normalisedService];
  if (!adjacencies) {
    // Fuzzy match
    for (const [key, value] of Object.entries(ADJACENCY_MAP)) {
      if (normalisedService.includes(key) || key.includes(normalisedService)) {
        adjacencies = value;
        break;
      }
    }
  }

  if (!adjacencies) return [];

  return adjacencies
    .filter((a) => a.relevance >= minRelevance)
    .map((a, i) => ({
      id: `adj-${normalisedService}-${i}-${Date.now()}`,
      primaryService: currentService,
      adjacentService: a.service,
      relevance: a.relevance,
      rationale: a.rationale,
      estimatedValue: a.value,
      effort: a.effort,
      category: a.category,
    }));
}

export function getUpgradeOpportunities(
  activeServices: string[]
): CrossDomainRecommendation[] {
  const upgrades: CrossDomainRecommendation[] = [];

  for (const service of activeServices) {
    const adjacent = getAdjacentServices(service, 70);
    for (const rec of adjacent) {
      // Only include if not already in active services
      if (!activeServices.some((s) =>
        s.toLowerCase().includes(rec.adjacentService.toLowerCase().slice(0, 5))
      )) {
        upgrades.push(rec);
      }
    }
  }

  // Deduplicate and sort by relevance
  const seen = new Set<string>();
  return upgrades
    .filter((u) => {
      const key = u.adjacentService.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 5);
}

// ─── Service Bundles ───────────────────

export const SERVICE_BUNDLES = [
  {
    name: 'Starter Digital Presence',
    services: ['Website Development', 'SEO', 'Google My Business'],
    savings: '15%',
    description: 'Complete online presence for businesses just starting their digital journey.',
    priceRange: '₹25,000-60,000 setup',
  },
  {
    name: 'Growth Accelerator',
    services: ['Google Ads', 'SEO', 'Content Marketing', 'Email Marketing'],
    savings: '20%',
    description: 'Multi-channel growth strategy combining paid and organic for maximum reach.',
    priceRange: '₹35,000-80,000/month',
  },
  {
    name: 'Full-Stack Marketing',
    services: ['Social Media Management', 'Google Ads', 'Meta Ads', 'Content Marketing', 'Email Marketing'],
    savings: '25%',
    description: 'Complete marketing department outsourced. We handle everything.',
    priceRange: '₹50,000-1,20,000/month',
  },
  {
    name: 'Lead Machine',
    services: ['Lead Generation', 'CRM Setup', 'Email Marketing', 'WhatsApp Marketing'],
    savings: '15%',
    description: 'End-to-end lead generation and nurturing system.',
    priceRange: '₹30,000-70,000 setup + ₹20,000-40,000/month',
  },
];
