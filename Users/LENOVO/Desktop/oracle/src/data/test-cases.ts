// ═══════════════════════════════════════
// ORACLE — 8 Client Test Cases
// ═══════════════════════════════════════

import type { TestCase } from '@/types';

export const TEST_CASES: TestCase[] = [
  // ── Test Case 1: D2C Skincare Brand ──
  {
    id: 'tc-1-d2c-skincare',
    clientName: 'GlowUp Naturals',
    industry: 'D2C / Beauty',
    city: 'Mumbai',
    contact: {
      name: 'Priya Sharma',
      phone: '+91 98765 43210',
      email: 'priya@glownaturals.in',
      designation: 'Founder & CEO',
    },
    brief:
      'D2C skincare brand selling Ayurvedic products through Shopify. 500 orders/month, 12K Instagram followers. Need help scaling to 2000 orders/month with Meta Ads, influencer marketing, and email automation. Currently spending ₹1.5L/month on Meta with 1.8x ROAS — want to hit 4x.',
    requirements: [
      'Meta Ads optimization: reduce CAC from ₹350 to ₹150',
      'Influencer seeding program: 50 micro-influencers/month',
      'Klaviyo email flows: welcome, abandoned cart, post-purchase',
      'Instagram content calendar: 20 posts/month',
      'Subscription model for repeat purchases',
    ],
    suggestedPrompts: [
      'prompt-meta-ads-optimization',
      'prompt-influencer-outreach',
      'prompt-email-flow-builder',
      'prompt-content-calendar',
    ],
    testQuestions: [
      'What\'s the current customer acquisition cost and how can we reduce it by 50%?',
      'Which influencer tier gives the best ROI for Ayurvedic skincare?',
      'Build a 5-email welcome sequence that converts browsers to buyers.',
      'Design a subscription model that increases customer lifetime value by 3x.',
    ],
  },

  // ── Test Case 2: SaaS Startup ──
  {
    id: 'tc-2-saas-startup',
    clientName: 'TaskFlow AI',
    industry: 'SaaS / Productivity',
    city: 'Bangalore',
    contact: {
      name: 'Arjun Mehta',
      phone: '+91 98451 23456',
      email: 'arjun@taskflow.ai',
      designation: 'CTO & Co-founder',
    },
    brief:
      'AI-powered project management SaaS. 200 free users, 15 paid users at ₹999/month. Built on Next.js + Supabase. Need landing page redesign, onboarding optimization, and content marketing to reach 1000 free users and 100 paid users in 3 months.',
    requirements: [
      'Landing page redesign with social proof and demo video',
      'Onboarding flow optimization: reduce time-to-value from 15min to 3min',
      'Content marketing: 8 blog posts/month targeting PM keywords',
      'SEO strategy for project management and productivity keywords',
      'Product Hunt launch preparation',
    ],
    suggestedPrompts: [
      'prompt-landing-page-copy',
      'prompt-onboarding-flow',
      'prompt-seo-content-plan',
      'prompt-product-hunt-launch',
    ],
    testQuestions: [
      'Write a landing page hero section that converts visitors to free trial signups.',
      'What onboarding steps should we prioritize to reduce churn in the first week?',
      'Create a content calendar targeting "project management tools" and related keywords.',
      'What\'s the optimal Product Hunt launch strategy for a B2B SaaS tool?',
    ],
  },

  // ── Test Case 3: Local Restaurant Chain ──
  {
    id: 'tc-3-restaurant-chain',
    clientName: 'Spice Route Kitchen',
    industry: 'Hospitality / F&B',
    city: 'Delhi NCR',
    contact: {
      name: 'Vikram Singh',
      phone: '+91 98112 34567',
      email: 'vikram@spiceroute.in',
      designation: 'Operations Director',
    },
    brief:
      'Restaurant chain with 5 outlets across Delhi NCR. Heavy dependence on Zomato/Swiggy (70% orders). Want to increase direct orders to 40% through Google My Business optimization, WhatsApp marketing, and loyalty program. Instagram 8K followers, zero email marketing.',
    requirements: [
      'Google My Business optimization for all 5 outlets',
      'WhatsApp marketing: order updates, offers, loyalty rewards',
      'Loyalty program design: points-based system',
      'Instagram strategy: food photography, reels, UGC campaign',
      'Zomato/Swiggy profile optimization for better ranking',
    ],
    suggestedPrompts: [
      'prompt-gmb-optimization',
      'prompt-whatsapp-marketing',
      'prompt-loyalty-program',
      'prompt-restaurant-social-media',
    ],
    testQuestions: [
      'How should we optimize Google My Business for each of our 5 outlets?',
      'Design a WhatsApp marketing strategy that drives direct orders.',
      'What loyalty program structure works best for multi-outlet restaurants?',
      'Create a 30-day Instagram content calendar for a restaurant chain.',
    ],
  },

  // ── Test Case 4: Manufacturing B2B ──
  {
    id: 'tc-4-manufacturing-b2b',
    clientName: 'Precision Parts India',
    industry: 'Manufacturing / B2B',
    city: 'Pune',
    contact: {
      name: 'Rajesh Kulkarni',
      phone: '+91 98234 56789',
      email: 'rajesh@precisionparts.in',
      designation: 'Managing Director',
    },
    brief:
      'CNC precision parts manufacturer for automotive and aerospace. 150 clients, ₹25Cr annual revenue. Need LinkedIn marketing for lead generation, IndiaMART optimization, and email automation for RFQ follow-ups. Currently zero digital marketing — all business from referrals.',
    requirements: [
      'LinkedIn company page optimization and content strategy',
      'IndiaMART listing optimization with product catalog',
      'Email automation for RFQ acknowledgment and follow-up',
      'Google Ads targeting industrial precision parts keywords',
      'Case studies and certifications showcase website',
    ],
    suggestedPrompts: [
      'prompt-linkedin-b2b-strategy',
      'prompt-indiamart-optimization',
      'prompt-rfq-email-automation',
      'prompt-b2b-case-studies',
    ],
    testQuestions: [
      'How should we structure LinkedIn content to attract automotive OEM buyers?',
      'What product information should we add to IndiaMART for maximum visibility?',
      'Design an automated email sequence from RFQ receipt to order confirmation.',
      'What case study format works best for manufacturing clients?',
    ],
  },

  // ── Test Case 5: EdTech Platform ──
  {
    id: 'tc-5-edtech-platform',
    clientName: 'CodeNinja Academy',
    industry: 'Education / EdTech',
    city: 'Hyderabad',
    contact: {
      name: 'Sneha Reddy',
      phone: '+91 98765 67890',
      email: 'sneha@codeninja.academy',
      designation: 'Head of Marketing',
    },
    brief:
      'Coding bootcamp offering 6-month full-stack development program at ₹85,000. Current enrollment: 40 students/batch, 6 batches/year. Need to double enrollment to 80 students/batch using Google Ads, YouTube content marketing, and WhatsApp-based counseling automation.',
    requirements: [
      'Google Ads campaign targeting coding bootcamp keywords',
      'YouTube channel: free coding tutorials as lead magnets',
      'WhatsApp automation: inquiry → info session → counseling → enrollment',
      'Student testimonial and placement story content creation',
      'Referral program for current students and alumni',
    ],
    suggestedPrompts: [
      'prompt-google-ads-education',
      'prompt-youtube-content-strategy',
      'prompt-whatsapp-enrollment-funnel',
      'prompt-student-testimonials',
    ],
    testQuestions: [
      'What Google Ads keywords should we target for coding bootcamp enrollments?',
      'Design a YouTube content strategy that generates 500+ qualified leads/month.',
      'Build a WhatsApp automation flow from inquiry to enrollment completion.',
      'How should we collect and showcase student placement stories?',
    ],
  },

  // ── Test Case 6: Healthcare Clinic ──
  {
    id: 'tc-6-healthcare-clinic',
    clientName: 'CareFirst Dental',
    industry: 'Healthcare / Dental',
    city: 'Chennai',
    contact: {
      name: 'Dr. Anitha Krishnan',
      phone: '+91 98412 34567',
      email: 'dr.anitha@carefirstdental.in',
      designation: 'Principal Dentist & Owner',
    },
    brief:
      'Multi-specialty dental clinic with 3 branches in Chennai. 200 patients/month, but 60% from walk-ins and references. Want to increase online-sourced patients to 50% through Google Ads, review management, WhatsApp appointment booking, and dental education content.',
    requirements: [
      'Google My Business optimization for all 3 branches',
      'Google Ads: "dentist near me" and "dental clinic in Chennai"',
      'Review generation system: automated post-visit Google review requests',
      'WhatsApp appointment booking and follow-up system',
      'Dental education content: blog posts, Instagram infographics',
    ],
    suggestedPrompts: [
      'prompt-dental-google-ads',
      'prompt-review-generation',
      'prompt-whatsapp-appointment-booking',
      'prompt-dental-content-marketing',
    ],
    testQuestions: [
      'How should we structure Google Ads campaigns for each dental specialty?',
      'Design a review generation system that gets 50+ Google reviews per month.',
      'Build a WhatsApp flow for appointment booking and pre-visit instructions.',
      'What dental education content performs best on Instagram?',
    ],
  },

  // ── Test Case 7: PropTech Real Estate ──
  {
    id: 'tc-7-proptech-realestate',
    clientName: 'DreamHome Realty',
    industry: 'Real Estate / PropTech',
    city: 'Gurugram',
    contact: {
      name: 'Amit Bansal',
      phone: '+91 98101 23456',
      email: 'amit@dreamhomerealty.in',
      designation: 'Sales & Marketing Head',
    },
    brief:
      'Residential real estate developer with 3 active projects: GreenVista (2BHK ₹45L-55L), Skyline Towers (3BHK ₹85L-1.2Cr), and Royal Estates (4BHK ₹1.4Cr-1.8Cr). Targeting young professionals and upgrade buyers in Gurugram. Currently spending ₹3L/month on Google Ads with low-quality leads. Need property listing copy, Google Ads optimization for property buyers, Instagram Reels showcasing properties, and WhatsApp follow-up sequences for site visit leads.',
    requirements: [
      'Property listing copy for all 3 projects across portals',
      'Google Ads optimization: target high-intent property buyers',
      'Instagram Reels strategy: property walkthroughs, drone shots, neighborhood tours',
      'WhatsApp follow-up sequence: inquiry → site visit booking → post-visit nurture',
      'Virtual tour integration on website and listings',
    ],
    suggestedPrompts: [
      'prompt-property-listing-copy',
      'prompt-real-estate-google-ads',
      'prompt-instagram-reels-strategy',
      'prompt-whatsapp-site-visit-funnel',
    ],
    testQuestions: [
      'Write compelling property listing copy for GreenVista 2BHK that differentiates from 100+ competing listings.',
      'How should we structure Google Ads campaigns to reduce cost per qualified lead from ₹800 to ₹300?',
      'Design a 30-day Instagram Reels calendar showcasing all 3 property projects.',
      'Build a WhatsApp follow-up sequence that converts site visit leads to bookings within 14 days.',
    ],
  },

  // ── Test Case 8: Restaurant Chain (Hospitality) ──
  {
    id: 'tc-8-restaurant-biryani',
    clientName: 'Biryani House',
    industry: 'Hospitality / F&B',
    city: 'Hyderabad',
    contact: {
      name: 'Fatima Khan',
      phone: '+91 98998 76543',
      email: 'fatima@biryanihouse.in',
      designation: 'Brand Manager',
    },
    brief:
      'Biryani House is a premium biryani restaurant chain with 4 outlets across Hyderabad (Jubilee Hills, Madhapur, Secunderabad, Ameerpet). Heavy dependence on Zomato/Swiggy (75% of orders). Instagram has 12K followers but low engagement. Wants to grow direct orders by 3x, build a strong Google My Business presence for all 4 outlets, develop a delivery marketing strategy, create a menu photography brief, and build a monthly campaign calendar that aligns with Hyderabad food culture and local events.',
    requirements: [
      'Google My Business optimization for all 4 outlets with updated photos, hours, and menu',
      'Delivery marketing strategy: direct order incentives vs platform dependency',
      'Menu photography brief: shot list, styling guide, photographer recommendations',
      'Monthly campaign calendar: Ramadan specials, monsoon offers, Hyderabad food festivals',
      'Instagram content strategy: food reels, behind-the-kitchen, customer spotlights',
      'WhatsApp marketing for order updates and loyalty program',
    ],
    suggestedPrompts: [
      'prompt-biryani-house-gmb',
      'prompt-delivery-marketing-strategy',
      'prompt-menu-photography-brief',
      'prompt-hyderabad-food-campaign-calendar',
    ],
    testQuestions: [
      'Write optimized Google My Business descriptions for all 4 Biryani House outlets with location-specific keywords.',
      'Design a delivery marketing strategy that shifts 30% of orders from Zomato/Swiggy to direct channels within 6 months.',
      'Create a comprehensive menu photography brief covering every biryani variant, appetizer, and dessert with styling notes.',
      'Build a 12-month campaign calendar for Biryani House aligned with Hyderabad food culture, local events, and seasonal specials.',
    ],
  },
];
