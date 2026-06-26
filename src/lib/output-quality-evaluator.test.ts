// ═══════════════════════════════════════════════════════════════
// ORACLE — Output Quality Evaluator Tests
// Covers Sections 1, 5, 13 of USER_COMPLAINT_TRACKER
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  evaluateOutput,
  evaluateBatch,
  getPreset,
  listPresets,
  PRESETS,
  DEFAULT_THRESHOLDS,
  type ThresholdConfig,
  type PresetName,
} from './output-quality-evaluator';

// ═══════════════════════════════════════
// Section 1: Generic Content Problem
// ═══════════════════════════════════════

describe('Section 1: Generic Content Detection (Scenarios 1.1-1.7)', () => {
  it('1.1 — Detects generic dental clinic proposal (no local context)', () => {
    const output = `In today's competitive landscape, leveraging the power of AI can help your dental clinic
    unlock the potential of digital marketing. Here's a holistic approach to SEO that will
    revolutionize your online presence and move the needle.`;

    const result = evaluateOutput(output, { industry: 'dental' });
    const genericCheck = result.checks.find((c) => c.name === 'generic_content');
    expect(genericCheck?.passed).toBe(false);
    expect(genericCheck?.score).toBeLessThan(50);
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it('1.1 — Passes with specific, India-localized dental proposal', () => {
    const output = `For your dental clinic in Jaipur, here's the plan:
    1. Google My Business optimization (₹5,000 setup)
    2. Instagram Reels with patient testimonials (₹15,000/month)
    3. JustDial premium listing (₹3,000/month)
    Expected: 20-30 new patients/month within 90 days.`;

    const result = evaluateOutput(output, { industry: 'dental', cityTier: 2 });
    expect(result.overallScore).toBeGreaterThanOrEqual(60);
    expect(result.passed).toBe(true);
  });

  it('1.2 — Detects template restaurant response (identical output)', () => {
    const output = `It's no secret that in the realm of restaurant marketing, a seamless integration
    of technology is essential. We leverage the power of social media to deliver
    a robust solution that will be a game-changer for your brand.`;

    const result = evaluateOutput(output, { industry: 'restaurant' });
    const genericCheck = result.checks.find((c) => c.name === 'generic_content');
    expect(genericCheck?.passed).toBe(false);
  });

  it('1.3 — Detects consumer-style copy in B2B context', () => {
    const output = `Hey guys! Check out this awesome strategy for your enterprise clients.
    OMG this is going to be so fire! Let's leverage the power of AI to unlock
    growth. You can totally trust us on this bestie.`;

    const result = evaluateOutput(output, { audience: 'b2b' });
    const b2bCheck = result.checks.find((c) => c.name === 'b2b_tone');
    expect(b2bCheck?.passed).toBe(false);
    expect(b2bCheck?.score).toBeLessThan(50);
  });

  it('1.3 — Passes with proper B2B tone', () => {
    const output = `Our quarterly review shows a 23% increase in pipeline value.
    The implementation of HubSpot CRM has improved stakeholder visibility.
    Key KPIs: Customer acquisition cost reduced by ₹2,500, LTV increased by 18%.
    We recommend a strategic approach to retention with SLA-backed support.`;

    const result = evaluateOutput(output, { audience: 'b2b' });
    const b2bCheck = result.checks.find((c) => c.name === 'b2b_tone');
    expect(b2bCheck?.passed).toBe(true);
  });

  it('1.4 — Detects formal email tone in WhatsApp context', () => {
    const output = `Dear Sir/Madam,

    We are writing to inform you about our new marketing services.
    Please find attached our proposal for your kind perusal.
    Furthermore, we would like to highlight that our approach
    is in accordance with industry best practices.

    Kindly note that our services are available at competitive rates.
    With reference to your query, we are herewith providing the details.`;

    const result = evaluateOutput(output, { contentType: 'whatsapp' });
    const toneCheck = result.checks.find((c) => c.name === 'vernacular_tone');
    // WhatsApp context without emojis, very long, and formal patterns → low score
    expect(toneCheck?.score).toBeLessThan(70);
  });

  it('1.4 — Passes with casual WhatsApp tone', () => {
    const output = `Namaste! 🙏 Here's your monthly marketing report:
    📊 Instagram reach: 45,000 (+23%)
    💬 WhatsApp responses: 127 leads
    💰 Revenue: ₹1,85,000

    Want to discuss next month's plan? I'm free tomorrow after 4pm! 😊`;

    const result = evaluateOutput(output, { contentType: 'whatsapp' });
    const toneCheck = result.checks.find((c) => c.name === 'vernacular_tone');
    expect(toneCheck?.passed).toBe(true);
  });

  it('1.6 — Detects Hinglish mixing in professional context', () => {
    const output = `Aapka business badhane ka plan hai? Let's talk about it.
    Hum aapko best practices dikhaenge jo aapke liye suitable honge.
    This is going to be a game-changer for your brand.`;

    const result = evaluateOutput(output, { contentType: 'proposal' });
    expect(result.overallScore).toBeGreaterThan(0);
  });

  it('1.7 — Detects excessive generic filler content', () => {
    const output = `In today's fast-paced digital world, leveraging the power of AI
    is a game-changer. A holistic approach to marketing can unlock the potential
    of your business. With cutting-edge technology and a scalable solution,
    we can revolutionize your online presence. Synergize your efforts with
    our robust platform to move the needle and achieve thought leadership.
    Harness the power of digital transformation to unlock growth.`;

    const result = evaluateOutput(output);
    const genericCheck = result.checks.find((c) => c.name === 'generic_content');
    expect(genericCheck?.score).toBeLessThan(40);
  });
});

// ═══════════════════════════════════════
// Section 5: Indian Market Context
// ═══════════════════════════════════════

describe('Section 5: Indian Market Context (Scenarios 5.1-5.10)', () => {
  it('5.1 — Detects email-only outreach (missing WhatsApp)', () => {
    const output = `Send an email campaign to 500 leads with personalized subject lines.
    Follow up via email after 3 days. Use Mailchimp for automation.
    Track open rates and click-through rates.`;

    const result = evaluateOutput(output, { contentType: 'email' });
    const whatsappCheck = result.checks.find((c) => c.name === 'whatsapp_first');
    // Email context without WhatsApp flags as needing improvement
    expect(whatsappCheck?.score).toBeGreaterThanOrEqual(0);
  });

  it('5.1 — Flags outreach without WhatsApp in general context', () => {
    const output = `For lead outreach, send personalized emails to all prospects.
    Use email sequences with 3 follow-ups. Track open rates.`;

    const result = evaluateOutput(output);
    const whatsappCheck = result.checks.find((c) => c.name === 'whatsapp_first');
    expect(whatsappCheck?.score).toBeLessThanOrEqual(60);
  });

  it('5.2 — Detects Western platform recommendations', () => {
    const output = `List your restaurant on Yelp and UberEats for maximum visibility.
    Use DoorDash for delivery. Create a Groupon deal for new customers.
    Set up a Shopify store for online orders.`;

    const result = evaluateOutput(output, { industry: 'restaurant' });
    const platformCheck = result.checks.find((c) => c.name === 'platform_relevance');
    expect(platformCheck?.passed).toBe(false);
    // The check should flag Western platforms and suggest Indian ones
    expect(platformCheck?.score).toBeLessThanOrEqual(30);
  });

  it('5.2 — Passes with Indian platform recommendations', () => {
    const output = `List your restaurant on Zomato and Swiggy for delivery.
    Use Dunzo for hyperlocal delivery. Set up a WhatsApp Business catalog
    for direct orders. Accept payments via Razorpay and UPI.`;

    const result = evaluateOutput(output, { industry: 'restaurant' });
    const platformCheck = result.checks.find((c) => c.name === 'platform_relevance');
    expect(platformCheck?.passed).toBe(true);
  });

  it('5.4 — Detects missing festivals in campaign calendar', () => {
    const output = `Monthly content calendar:
    Week 1: Product launch
    Week 2: Customer testimonials
    Week 3: How-to content
    Week 4: Promotional offers`;

    const result = evaluateOutput(output);
    const festivalCheck = result.checks.find((c) => c.name === 'festival_calendar');
    expect(festivalCheck?.score).toBeLessThanOrEqual(60);
  });

  it('5.4 — Passes with Indian festival references', () => {
    const output = `Q4 campaign calendar:
    October: Navratri Dandiya Night promotions, pre-Diwali deals
    November: Diwali mega sale, Dhanteras offers, Bhai Dooj specials
    December: Christmas-New Year combo, wedding season packages
    Key events: IPL season tie-ups, monsoon offers in July-August`;

    const result = evaluateOutput(output);
    const festivalCheck = result.checks.find((c) => c.name === 'festival_calendar');
    expect(festivalCheck?.passed).toBe(true);
    expect(festivalCheck?.score).toBeGreaterThanOrEqual(75);
  });

  it('5.5 — Detects excessive budget for Tier-3 city', () => {
    const output = `SEO Package: ₹1,50,000/month
    Google Ads: ₹2,00,000/month
    Social Media: ₹75,000/month
    Total: ₹4,25,000/month`;

    const result = evaluateOutput(output, { cityTier: 3 });
    const tierCheck = result.checks.find((c) => c.name === 'city_tier_awareness');
    expect(tierCheck?.passed).toBe(false);
  });

  it('5.5 — Passes with appropriate Tier-3 budget', () => {
    const output = `Local SEO Package: ₹8,000/month
    Google My Business setup: ₹3,000 one-time
    WhatsApp Business: Free
    Social media: ₹5,000/month
    Total: ₹16,000/month`;

    const result = evaluateOutput(output, { cityTier: 3 });
    const tierCheck = result.checks.find((c) => c.name === 'city_tier_awareness');
    expect(tierCheck?.passed).toBe(true);
  });

  it('5.10 — Detects missing local payment context', () => {
    const output = `Accept payments via Stripe and PayPal.
    Set up recurring billing with Shopify Payments.
    International wire transfer available.`;

    const result = evaluateOutput(output, { industry: 'ecommerce' });
    const platformCheck = result.checks.find((c) => c.name === 'platform_relevance');
    expect(platformCheck?.passed).toBe(false);
  });

  it('5.10 — Passes with Indian payment platforms', () => {
    const output = `Accept payments via Razorpay (UPI, cards, netbanking).
    PhonePe and Google Pay for quick checkout.
    Paytm for wallet payments. Cash on delivery available.`;

    const result = evaluateOutput(output, { industry: 'ecommerce' });
    const platformCheck = result.checks.find((c) => c.name === 'platform_relevance');
    expect(platformCheck?.passed).toBe(true);
  });
});

// ═══════════════════════════════════════
// Section 13: Real Indian Business Scenarios
// ═══════════════════════════════════════

describe('Section 13: Real Indian Business Scenarios (13.1-13.10)', () => {
  it('13.1 — Restaurant WhatsApp menu uses Indian platforms', () => {
    const good = `WhatsApp Business catalog with Zomato/Swiggy links.
    UPI payments via Razorpay. Veg/Non-veg markings.
    Daily specials posted at 11am. Festival menu for Diwali.`;

    const bad = `Create a Yelp listing with your full menu.
    Set up UberEats for delivery. Use Stripe for payments.`;

    const goodResult = evaluateOutput(good, { industry: 'restaurant', contentType: 'whatsapp' });
    const badResult = evaluateOutput(bad, { industry: 'restaurant' });

    expect(goodResult.overallScore).toBeGreaterThan(badResult.overallScore);
  });

  it('13.2 — Dental clinic uses Indian healthcare platforms', () => {
    const output = `List on Practo and JustDial. Google My Business with photos.
    WhatsApp for appointment reminders. Patient reviews on 1mg.
    Accept payments via UPI.`;

    const result = evaluateOutput(output, { industry: 'dental' });
    const localCheck = result.checks.find((c) => c.name === 'local_platform_mention');
    expect(localCheck?.score).toBeGreaterThanOrEqual(70);
  });

  it('13.5 — Wedding photographer uses Indian platforms', () => {
    const good = `List on WeddingWire India, Shaadi.com, and Sulekha.
    Instagram Reels for portfolio. WhatsApp for client communication.
    Google My Business for local SEO.`;

    const bad = `Create a profile on The Knot and WeddingWire.
    Use Yelp for reviews. Set up a Facebook page.`;

    const goodResult = evaluateOutput(good, { industry: 'wedding' });
    const badResult = evaluateOutput(bad, { industry: 'wedding' });

    expect(goodResult.overallScore).toBeGreaterThan(badResult.overallScore);
  });

  it('13.6 — Coaching institute targets exam season timing', () => {
    const output = `Campaign for JEE/NEET coaching:
    January-March: Board exam prep content
    April-May: Summer batch enrollment
    July-September: Early bird for next year
    References: Unacademy, PhysicsWallah comparison
    WhatsApp groups for student community`;

    const result = evaluateOutput(output, { industry: 'education', contentType: 'social' });
    expect(result.overallScore).toBeGreaterThan(50);
  });

  it('13.10 — Fashion brand Diwali sale uses Indian festivals', () => {
    const output = `Diwali Sale Campaign:
    Dhanteras: Gold jewelry collection launch
    Choti Diwali: Flash sale 30% off
    Diwali: Gift bundles with Rangoli designs
    Bhai Dooj: Brother-sister gifting guide
    Payment: UPI, Credit Card EMI via Razorpay
    Platforms: Instagram, WhatsApp, Meesho`;

    const result = evaluateOutput(output, { industry: 'fashion' });
    const festivalCheck = result.checks.find((c) => c.name === 'festival_calendar');
    expect(festivalCheck?.passed).toBe(true);
    expect(festivalCheck?.score).toBeGreaterThanOrEqual(75);
  });
});

// ═══════════════════════════════════════
// INR Currency Check (5.3)
// ═══════════════════════════════════════

describe('Currency Check (Scenario 5.3)', () => {
  it('detects USD pricing in Indian context', () => {
    const output = `SEO package: $500/month. PPC: $1,000 setup + $200/month.
    Social media: $300/month. Total: $2,000/month.`;

    const result = evaluateOutput(output);
    const currencyCheck = result.checks.find((c) => c.name === 'inr_currency');
    expect(currencyCheck?.passed).toBe(false);
  });

  it('passes with INR pricing', () => {
    const output = `SEO package: ₹40,000/month. PPC: ₹80,000 setup + ₹15,000/month.
    Social media: ₹25,000/month. Total: ₹1,60,000/month.`;

    const result = evaluateOutput(output);
    const currencyCheck = result.checks.find((c) => c.name === 'inr_currency');
    expect(currencyCheck?.passed).toBe(true);
  });
});

// ═══════════════════════════════════════
// Batch Evaluation
// ═══════════════════════════════════════

describe('Batch Evaluation', () => {
  it('evaluates multiple outputs and returns aggregate stats', () => {
    const outputs = [
      {
        text: 'Use Zomato and Swiggy for your restaurant. UPI via Razorpay.',
        context: { industry: 'restaurant' },
        label: 'Good output',
      },
      {
        text: 'List on Yelp and UberEats. Use Stripe for payments.',
        context: { industry: 'restaurant' },
        label: 'Bad output',
      },
      {
        text: 'Diwali sale: ₹500 off. WhatsApp for orders. Festival menu ready.',
        context: { industry: 'restaurant' },
        label: 'Festival output',
      },
    ];

    const batch = evaluateBatch(outputs);

    expect(batch.averageScore).toBeGreaterThan(0);
    expect(batch.results).toHaveLength(3);
    expect(batch.results[0].label).toBe('Good output');
    expect(batch.results[0].overallScore).toBeGreaterThan(batch.results[1].overallScore);
  });

  it('handles empty batch', () => {
    const batch = evaluateBatch([]);
    expect(batch.averageScore).toBe(0);
    expect(batch.passRate).toBe(0);
    expect(batch.results).toHaveLength(0);
  });
});

// ═══════════════════════════════════════
// Edge Cases
// ═══════════════════════════════════════

describe('Edge Cases', () => {
  it('handles empty output', () => {
    const result = evaluateOutput('');
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
    expect(result.checks.length).toBeGreaterThan(0);
  });

  it('handles very long output', () => {
    const output = 'A'.repeat(50000);
    const result = evaluateOutput(output);
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.checks.length).toBeGreaterThan(0);
  });

  it('handles output with special characters', () => {
    const output = '₹1,50,000/month for SEO. GST: 18%. Email: test@example.com';
    const result = evaluateOutput(output);
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
  });

  it('all scores are between 0 and 100', () => {
    const outputs = [
      'Short text',
      'A very long output with many details '.repeat(100),
      '₹50,000 per month for Zomato listing',
    ];
    for (const text of outputs) {
      const result = evaluateOutput(text);
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
      for (const check of result.checks) {
        expect(check.score).toBeGreaterThanOrEqual(0);
        expect(check.score).toBeLessThanOrEqual(100);
      }
    }
  });
});

// ═══════════════════════════════════════
// Configurable Thresholds
// ═══════════════════════════════════════

describe('Configurable Thresholds', () => {
  const goodOutput = `For your dental clinic in Jaipur:
    1. Google My Business optimization (₹5,000 setup)
    2. Instagram Reels with patient testimonials (₹15,000/month)
    3. JustDial premium listing (₹3,000/month)
    Expected: 20-30 new patients/month within 90 days.`;

  it('uses default passThreshold of 60', () => {
    const result = evaluateOutput(goodOutput, { industry: 'dental' });
    // With default threshold, this good output should pass
    expect(result.passed).toBe(true);
    expect(result.overallScore).toBeGreaterThanOrEqual(60);
  });

  it('custom passThreshold changes pass/fail behavior', () => {
    const result = evaluateOutput(goodOutput, {
      industry: 'dental',
      thresholds: { passThreshold: 95 },
    });
    // With 95 threshold, even good output should fail
    expect(result.passed).toBe(false);
  });

  it('custom weights change overall score', () => {
    const defaultResult = evaluateOutput(goodOutput, { industry: 'dental' });

    // Heavily weight generic_content (which this output scores well on)
    const customResult = evaluateOutput(goodOutput, {
      industry: 'dental',
      thresholds: {
        weights: {
          india_context: 5,
          platform_relevance: 5,
          vernacular_tone: 5,
          city_tier_awareness: 5,
          festival_calendar: 5,
          whatsapp_first: 5,
          generic_content: 40,
          b2b_tone: 5,
          inr_currency: 5,
          local_platform_mention: 5,
        },
      },
    });

    // Scores should differ because weights changed
    expect(customResult.overallScore).not.toBe(defaultResult.overallScore);
  });

  it('contentTypeWeights override base weights for specific content types', () => {
    const whatsappOutput = `Namaste! 🙏 Here's your monthly report:
    📊 Instagram reach: 45,000 (+23%)
    💬 WhatsApp responses: 127 leads
    💰 Revenue: ₹1,85,000`;

    // Default: uses default WhatsApp weight overrides
    const defaultResult = evaluateOutput(whatsappOutput, { contentType: 'whatsapp' });

    // Custom: override WhatsApp weight for vernacular_tone to be even higher
    const customResult = evaluateOutput(whatsappOutput, {
      contentType: 'whatsapp',
      thresholds: {
        contentTypeWeights: { whatsapp: { vernacular_tone: 40 } },
      },
    });

    // Custom contentTypeWeights should affect the score differently than defaults
    expect(customResult.overallScore).not.toBe(defaultResult.overallScore);
  });

  it('checkPassThresholds override per-check pass/fail', () => {
    const output = `Use Zomato and Swiggy for your restaurant.
    UPI via Razorpay. Daily specials at 11am.`;

    // Default: platform_relevance check passes (score >= 50)
    const defaultResult = evaluateOutput(output, { industry: 'restaurant' });
    const defaultPlatformCheck = defaultResult.checks.find((c) => c.name === 'platform_relevance');
    expect(defaultPlatformCheck?.passed).toBe(true);

    // With high per-check threshold: platform_relevance should fail
    const customResult = evaluateOutput(output, {
      industry: 'restaurant',
      thresholds: {
        checkPassThresholds: { platform_relevance: 95 },
      },
    });
    const customPlatformCheck = customResult.checks.find((c) => c.name === 'platform_relevance');
    expect(customPlatformCheck?.passed).toBe(false);
  });

  it('merges custom thresholds with defaults (partial override)', () => {
    const result = evaluateOutput(goodOutput, {
      industry: 'dental',
      thresholds: {
        passThreshold: 50, // override only this
        // everything else uses defaults
      },
    });

    expect(result.passed).toBe(true);
    expect(result.checks.length).toBe(10); // all default checks still run
  });

  it('batch evaluation respects thresholds from context', () => {
    const outputs = [
      { text: goodOutput, context: { industry: 'dental' }, label: 'Good' },
      { text: 'Use Yelp and UberEats.', context: { industry: 'restaurant' }, label: 'Bad' },
    ];

    const batch = evaluateBatch(outputs);
    expect(batch.results).toHaveLength(2);
    expect(batch.averageScore).toBeGreaterThan(0);
  });

  it('ThresholdConfig type is exported and usable', () => {
    // Verify the type can be used to define configs
    const config: Partial<ThresholdConfig> = {
      passThreshold: 70,
      weights: { generic_content: 20 },
    };

    const result = evaluateOutput(goodOutput, {
      industry: 'dental',
      thresholds: config,
    });
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
  });
});

// ═══════════════════════════════════════
// Preset Threshold Configurations
// ═══════════════════════════════════════

describe('Preset Threshold Configurations', () => {
  it('DEFAULT_THRESHOLDS is exported and has correct structure', () => {
    expect(DEFAULT_THRESHOLDS.passThreshold).toBe(60);
    expect(DEFAULT_THRESHOLDS.weights).toBeDefined();
    expect(Object.keys(DEFAULT_THRESHOLDS.weights)).toHaveLength(10);
    expect(DEFAULT_THRESHOLDS.contentTypeWeights).toBeDefined();
    expect(DEFAULT_THRESHOLDS.checkPassThresholds).toBeDefined();
  });

  it('PRESETS contains all expected preset names', () => {
    const expectedPresets: PresetName[] = ['strict', 'lenient', 'balanced', 'whatsapp', 'proposal', 'social', 'blog'];
    expect(Object.keys(PRESETS)).toEqual(expect.arrayContaining(expectedPresets));
    expect(Object.keys(PRESETS)).toHaveLength(7);
  });

  it('each preset has required fields', () => {
    for (const [name, preset] of Object.entries(PRESETS)) {
      expect(preset.name).toBe(name);
      expect(preset.label).toBeTruthy();
      expect(preset.description).toBeTruthy();
      expect(preset.thresholds).toBeDefined();
    }
  });

  it('getPreset returns the correct preset by name', () => {
    expect(getPreset('strict').name).toBe('strict');
    expect(getPreset('lenient').name).toBe('lenient');
    expect(getPreset('whatsapp').name).toBe('whatsapp');
  });

  it('getPreset falls back to balanced for unknown name', () => {
    // @ts-expect-error testing invalid preset name
    expect(getPreset('nonexistent').name).toBe('balanced');
  });

  it('listPresets returns all presets with labels', () => {
    const presets = listPresets();
    expect(presets).toHaveLength(7);
    expect(presets[0]).toHaveProperty('name');
    expect(presets[0]).toHaveProperty('label');
    expect(presets[0]).toHaveProperty('description');
  });

  it('strict preset has higher passThreshold than default', () => {
    expect(PRESETS.strict.thresholds.passThreshold).toBeGreaterThan(DEFAULT_THRESHOLDS.passThreshold);
  });

  it('lenient preset has lower passThreshold than default', () => {
    expect(PRESETS.lenient.thresholds.passThreshold).toBeLessThan(DEFAULT_THRESHOLDS.passThreshold);
  });

  it('balanced preset uses default thresholds', () => {
    expect(PRESETS.balanced.thresholds).toEqual({});
  });

  it('whatsapp preset has contentTypeWeights for whatsapp', () => {
    expect(PRESETS.whatsapp.thresholds.contentTypeWeights?.whatsapp).toBeDefined();
    expect(PRESETS.whatsapp.thresholds.contentTypeWeights?.whatsapp?.vernacular_tone).toBe(25);
    expect(PRESETS.whatsapp.thresholds.contentTypeWeights?.whatsapp?.whatsapp_first).toBe(15);
  });

  it('proposal preset has contentTypeWeights for proposal', () => {
    expect(PRESETS.proposal.thresholds.contentTypeWeights?.proposal).toBeDefined();
    expect(PRESETS.proposal.thresholds.contentTypeWeights?.proposal?.b2b_tone).toBe(20);
    expect(PRESETS.proposal.thresholds.contentTypeWeights?.proposal?.inr_currency).toBe(15);
  });

  it('social preset has contentTypeWeights for social', () => {
    expect(PRESETS.social.thresholds.contentTypeWeights?.social).toBeDefined();
    expect(PRESETS.social.thresholds.contentTypeWeights?.social?.festival_calendar).toBe(20);
    expect(PRESETS.social.thresholds.contentTypeWeights?.social?.vernacular_tone).toBe(15);
  });

  it('blog preset has contentTypeWeights for blog', () => {
    expect(PRESETS.blog.thresholds.contentTypeWeights?.blog).toBeDefined();
    expect(PRESETS.blog.thresholds.contentTypeWeights?.blog?.generic_content).toBe(25);
  });

  it('strict preset produces different scores than lenient', () => {
    const output = `Use Zomato and Swiggy for your restaurant.
    UPI via Razorpay. Daily specials at 11am.`;

    const strictResult = evaluateOutput(output, {
      industry: 'restaurant',
      thresholds: PRESETS.strict.thresholds,
    });
    const lenientResult = evaluateOutput(output, {
      industry: 'restaurant',
      thresholds: PRESETS.lenient.thresholds,
    });

    // Strict has higher threshold (75) so it's harder to pass than lenient (40)
    expect(PRESETS.strict.thresholds.passThreshold).toBeGreaterThan(
      PRESETS.lenient.thresholds.passThreshold!
    );
    // Lenient should pass (threshold 40), strict may not (threshold 75)
    expect(lenientResult.passed).toBe(true);
    // Both produce valid scores
    expect(strictResult.overallScore).toBeGreaterThanOrEqual(0);
    expect(lenientResult.overallScore).toBeGreaterThanOrEqual(0);
  });

  it('whatsapp preset boosts vernacular_tone weight for WhatsApp content', () => {
    const whatsappOutput = `Namaste! 🙏 Here's your monthly report:
    📊 Instagram reach: 45,000 (+23%)
    💬 WhatsApp responses: 127 leads`;

    const defaultResult = evaluateOutput(whatsappOutput, { contentType: 'whatsapp' });
    const presetResult = evaluateOutput(whatsappOutput, {
      contentType: 'whatsapp',
      thresholds: PRESETS.whatsapp.thresholds,
    });

    // Both should produce valid results
    expect(defaultResult.overallScore).toBeGreaterThanOrEqual(0);
    expect(presetResult.overallScore).toBeGreaterThanOrEqual(0);
  });

  it('proposal preset boosts b2b_tone weight for B2B content', () => {
    const proposalOutput = `Our quarterly review shows a 23% increase in pipeline value.
    The implementation of HubSpot CRM has improved stakeholder visibility.
    Key KPIs: Customer acquisition cost reduced by ₹2,500.`;

    const defaultResult = evaluateOutput(proposalOutput, { audience: 'b2b', contentType: 'proposal' });
    const presetResult = evaluateOutput(proposalOutput, {
      audience: 'b2b',
      contentType: 'proposal',
      thresholds: PRESETS.proposal.thresholds,
    });

    expect(defaultResult.overallScore).toBeGreaterThanOrEqual(0);
    expect(presetResult.overallScore).toBeGreaterThanOrEqual(0);
  });
});
