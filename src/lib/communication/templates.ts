// ═══════════════════════════════════════
// ORACLE — Message Templates
// Pre-built templates for agency outreach
// across WhatsApp and Email channels
// ═══════════════════════════════════════

import type { MessageTemplate } from './types';

// ─── Default Templates ─────────────────

export const DEFAULT_TEMPLATES: MessageTemplate[] = [
  // ── Cold Outreach (WhatsApp) ──
  {
    id: 'wa-cold-outreach-local',
    name: 'Local Business Cold Outreach',
    category: 'cold-outreach',
    channel: 'whatsapp',
    body: `Hi {{client_name}} 👋

I noticed {{business_name}} on Google and had a quick look at your online presence.

I'm {{sender_name}} from {{agency_name}} — we help businesses like yours get more customers through Google, social media, and WhatsApp marketing.

Here's what I spotted:
{{pain_points}}

We've helped similar businesses in {{city}} increase their leads by 40-60% within 3 months.

Would you be open to a quick 10-minute call this week to discuss how we can help {{business_name}} grow?

No sales pitch — just a honest assessment of what's working and what's not.`,
    variables: ['client_name', 'business_name', 'sender_name', 'agency_name', 'pain_points', 'city'],
    language: 'en',
    description: 'Cold outreach for local businesses with personalized pain points',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'wa-cold-outreach-hinglish',
    name: 'Hinglish Cold Outreach',
    category: 'cold-outreach',
    channel: 'whatsapp',
    body: `Namaste {{client_name}} 🙏

Main {{sender_name}} bol raha hu {{agency_name}} se.

Aapka {{business_name}} dekha Google pe — accha hai! Lekin kuch improvements ho sakte hain jo aapko 2-3x zyada customers la sake.

Humne {{city}} mein similar businesses ko help kiya hai:
{{pain_points}}

Kya aapko 10 minute ka call ho sakta hai is hafte? Free mein dikhaunga kya change karke aapko fayda hoga.`,
    variables: ['client_name', 'business_name', 'sender_name', 'agency_name', 'pain_points', 'city'],
    language: 'hinglish',
    description: 'Hinglish cold outreach for Hindi-speaking business owners',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // ── Follow-up (WhatsApp) ──
  {
    id: 'wa-followup-1',
    name: 'First Follow-up',
    category: 'follow-up',
    channel: 'whatsapp',
    body: `Hi {{client_name}}, just following up on my message from {{days_ago}}.

I know you're busy running {{business_name}} — just wanted to make sure my message didn't get lost.

We recently helped a {{similar_business}} in {{city}}:
✅ {{result_1}}
✅ {{result_2}}

Happy to share the full case study if you're interested. No obligation.

Would {{suggested_time}} work for a quick chat?`,
    variables: ['client_name', 'business_name', 'days_ago', 'similar_business', 'city', 'result_1', 'result_2', 'suggested_time'],
    language: 'en',
    description: 'First follow-up with social proof',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'wa-followup-2',
    name: 'Second Follow-up',
    category: 'follow-up',
    channel: 'whatsapp',
    body: `Hi {{client_name}} — last message from my side 🙏

I understand if the timing isn't right. Just wanted to leave you with this:

📊 Businesses in {{city}} that improve their Google presence see {{stat}} more leads on average.

If you ever want to revisit this, just drop me a message. No pressure.

Wishing {{business_name}} continued success! 🚀`,
    variables: ['client_name', 'city', 'stat', 'business_name'],
    language: 'en',
    description: 'Final follow-up — leave door open',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // ── Proposal (WhatsApp) ──
  {
    id: 'wa-proposal-send',
    name: 'Send Proposal',
    category: 'proposal',
    channel: 'whatsapp',
    body: `Hi {{client_name}} 👋

Great chatting with you! As promised, here's the proposal for {{service}}:

📋 *What's included:*
{{deliverables}}

💰 *Investment:* {{price_range}}
📅 *Timeline:* {{timeline}}

I've shared the detailed proposal document here: {{proposal_link}}

Take your time reviewing it. Happy to answer any questions.

Looking forward to working together and growing your business! 🤝`,
    variables: ['client_name', 'service', 'deliverables', 'price_range', 'timeline', 'proposal_link'],
    language: 'en',
    description: 'Send proposal with key highlights',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // ── Review Request (WhatsApp) ──
  {
    id: 'wa-review-request',
    name: 'Google Review Request',
    category: 'review-request',
    channel: 'whatsapp',
    body: `Hi {{client_name}} 🙏

Thank you for choosing {{agency_name}} for {{service}}. It was a pleasure working with you!

If you're happy with the results, would you mind leaving us a quick Google review? It takes less than 2 minutes and helps other businesses find us:

⭐ {{review_link}}

Your support means the world to us. Thank you! ❤️`,
    variables: ['client_name', 'agency_name', 'service', 'review_link'],
    language: 'en',
    description: 'Request Google review from satisfied client',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // ── Email Templates ──
  {
    id: 'email-cold-outreach',
    name: 'Cold Outreach Email',
    category: 'cold-outreach',
    channel: 'email',
    subject: 'Quick idea for {{business_name}} — increase leads by 40%+',
    body: `Hi {{client_name}},

I came across {{business_name}} and was impressed by what you've built.

I'm {{sender_name}} from {{agency_name}} — we specialize in helping businesses in {{industry}} grow through digital marketing.

Here's what caught my eye:
{{pain_points}}

We recently helped a similar business:
• {{result_1}}
• {{result_2}}

I have a few specific ideas for {{business_name}} that could drive more leads. Would you be open to a 15-minute call this week?

No strings attached — just a honest conversation about growth opportunities.

Best,
{{sender_name}}
{{agency_name}}
{{phone}}`,
    variables: ['client_name', 'business_name', 'sender_name', 'agency_name', 'industry', 'pain_points', 'result_1', 'result_2', 'phone'],
    language: 'en',
    description: 'Professional cold outreach email with specific value prop',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'email-proposal',
    name: 'Proposal Email',
    category: 'proposal',
    channel: 'email',
    subject: 'Your {{service}} proposal from {{agency_name}}',
    body: `Hi {{client_name}},

Thank you for taking the time to discuss your requirements for {{business_name}}.

Please find attached the detailed proposal for {{service}}.

Here's a quick summary:

Service: {{service}}
Investment: {{price_range}}
Timeline: {{timeline}}
Key Deliverables: {{deliverables}}

I've included everything in the attached document — scope, timeline, pricing, and terms.

Please review and let me know if you have any questions. I'm happy to hop on a call to walk through it together.

Looking forward to partnering with {{business_name}}! 🚀

Best regards,
{{sender_name}}
{{agency_name}}`,
    variables: ['client_name', 'business_name', 'service', 'agency_name', 'price_range', 'timeline', 'deliverables', 'sender_name'],
    language: 'en',
    description: 'Professional proposal follow-up email',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'email-followup',
    name: 'Follow-up Email',
    category: 'follow-up',
    channel: 'email',
    subject: 'Following up — {{service}} for {{business_name}}',
    body: `Hi {{client_name}},

Just wanted to follow up on my previous email about {{service}} for {{business_name}}.

I understand you're busy, so I'll keep this brief:

1. We've helped {{similar_count}} similar businesses in {{city}}
2. Average results: {{result_1}} and {{result_2}}
3. We can start within {{start_timeframe}}

Would {{suggested_time}} work for a quick 15-minute call?

No pressure at all — just want to make sure you have all the information you need to make the best decision for {{business_name}}.

Best,
{{sender_name}}`,
    variables: ['client_name', 'business_name', 'service', 'similar_count', 'city', 'result_1', 'result_2', 'start_timeframe', 'suggested_time', 'sender_name'],
    language: 'en',
    description: 'Professional follow-up with social proof',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

// ─── Template Helpers ──────────────────

/**
 * Get template by ID.
 */
export function getTemplate(id: string): MessageTemplate | undefined {
  return DEFAULT_TEMPLATES.find((t) => t.id === id);
}

/**
 * Get templates by category.
 */
export function getTemplatesByCategory(category: MessageTemplate['category']): MessageTemplate[] {
  return DEFAULT_TEMPLATES.filter((t) => t.category === category);
}

/**
 * Get templates by channel.
 */
export function getTemplatesByChannel(channel: 'whatsapp' | 'email'): MessageTemplate[] {
  return DEFAULT_TEMPLATES.filter((t) => t.channel === channel || t.channel === 'both');
}

/**
 * Fill template variables in a message body.
 * Variables use {{variable_name}} syntax.
 */
export function fillTemplate(
  template: string,
  variables: Record<string, string>,
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}

/**
 * Extract unfilled variables from a template body.
 */
export function extractVariables(template: string): string[] {
  const matches = template.match(/\{\{(\w+)\}\}/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '')))];
}

/**
 * Validate that all required variables are provided.
 */
export function validateTemplateVariables(
  template: MessageTemplate,
  variables: Record<string, string>,
): { valid: boolean; missing: string[] } {
  const missing = template.variables.filter((v) => !variables[v] || variables[v].trim() === '');
  return { valid: missing.length === 0, missing };
}
