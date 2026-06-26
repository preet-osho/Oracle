// ═══════════════════════════════════════
// ORACLE — 55+ Pre-built Prompts
// Organized by: Digital Marketing, Development, Content, Finance, Industry Verticals, Operations
// ═══════════════════════════════════════

import type { PromptItem } from '@/types';

export const PROMPT_CATEGORIES = [
  'Digital Marketing',
  'Development',
  'Content',
  'Finance',
  'Industry Verticals',
  'Operations',
] as const;

export const CATEGORY_COLORS: Record<string, string> = {
  'Digital Marketing': '#8b5cf6',
  'Development': '#3b82f6',
  'Content': '#10b981',
  'Finance': '#f59e0b',
  'Industry Verticals': '#ef4444',
  'Operations': '#06b6d4',
};

export const PROMPTS: PromptItem[] = [
  // ── DIGITAL MARKETING ─────────────────
  {
    id: 'prompt-seo-audit',
    title: 'Complete SEO Audit',
    category: 'Digital Marketing',
    domain: 'Complete SEO',
    difficulty: 'Medium',
    timeEstimate: '15 min',
    tools: ['Google Search Console', 'Screaming Frog', 'Ahrefs'],
    description: 'Run a comprehensive SEO audit covering technical health, on-page optimization, content gaps, and competitor analysis for any website.',
    prompt: `Run a complete SEO audit for [CLIENT WEBSITE URL]. Include:

1. TECHNICAL SEO
   - Core Web Vitals (LCP, FID, CLS)
   - Mobile responsiveness
   - Crawlability and indexation issues
   - Schema markup status
   - SSL and security headers

2. ON-PAGE SEO
   - Title tags and meta descriptions (sample 20 pages)
   - Header hierarchy (H1-H6)
   - Internal linking structure
   - Image alt text coverage
   - URL structure analysis

3. CONTENT ANALYSIS
   - Top 10 performing pages by traffic
   - Thin content pages (< 300 words)
   - Duplicate content check
   - Content gap vs top 3 competitors

4. OFF-PAGE ANALYSIS
   - Backlink profile overview
   - Domain authority trend
   - Toxic backlinks

5. LOCAL SEO (if applicable)
   - Google Business Profile status
   - NAP consistency
   - Local citation audit

OUTPUT: Numbered findings with severity (Critical/High/Medium/Low), estimated impact, and specific fix for each issue.`,
    useCount: 247,
    userRating: 5,
  },
  {
    id: 'prompt-meta-ads',
    title: 'Meta Ads Campaign Setup',
    category: 'Digital Marketing',
    domain: 'Meta Ads',
    difficulty: 'Hard',
    timeEstimate: '20 min',
    tools: ['Meta Business Suite', 'Canva', 'Meta Ads Library'],
    description: 'Design a complete Meta Ads campaign structure with audience targeting, creative strategy, and budget allocation.',
    prompt: `Design a complete Meta Ads campaign for [CLIENT BUSINESS] selling [PRODUCT/SERVICE] in [CITY].

BUDGET: ₹[AMOUNT]/month
TARGET AUDIENCE: [AGE, GENDER, INTERESTS]

Create:

1. CAMPAIGN STRUCTURE
   - Campaign 1: Awareness (video views + reach)
   - Campaign 2: Consideration (traffic + engagement)
   - Campaign 3: Conversion (leads + purchases)
   For each: objective, budget split, bidding strategy

2. AUDIENCE BUILDING
   - Core audience 1: [interest-based]
   - Core audience 2: [behavior-based]
   - Lookalike 1%: Based on [source]
   - Retargeting: Website visitors (7/14/30 day)
   - Retargeting: Engaged users (90 day)

3. AD CREATIVE BRIEFS (3 per campaign)
   - Hook (first 3 seconds)
   - Visual direction
   - Copy (primary text, headline, description)
   - CTA
   - Format (reel, story, feed)

4. BUDGET ALLOCATION
   - Daily budgets per campaign
   - Expected CPM, CPC, CPL
   - Break-even ROAS calculation

5. MEASUREMENT
   - Primary KPIs per campaign
   - Attribution window
   - Weekly optimization checklist

All prices in INR. Specific tool names. Ready to execute.`,    useCount: 189,
    userRating: 4,
  },
  {
    id: 'prompt-google-ads',
    title: 'Google Ads Campaign Blueprint',
    category: 'Digital Marketing',
    domain: 'Google Ads',
    difficulty: 'Hard',
    timeEstimate: '20 min',
    tools: ['Google Ads Editor', 'Keyword Planner', 'Google Analytics'],
    description: 'Build a full Google Ads campaign with keyword strategy, ad copy variations, and conversion tracking setup.',
    prompt: `Design a complete Google Ads campaign for [CLIENT BUSINESS] targeting [TARGET LOCATION].

MONTHLY BUDGET: ₹[AMOUNT]
PRIMARY GOAL: [Leads/Sales/Bookings]
WEBSITE: [URL]

Deliver:

1. KEYWORD STRATEGY
   - 50 keywords organized by intent (informational, commercial, transactional)
   - Match types for each keyword group
   - Negative keyword list (50+ terms)
   - Estimated search volume and competition for each group

2. CAMPAIGN ARCHITECTURE
   - Campaign 1: Brand (exact match brand terms)
   - Campaign 2: Non-brand Search (thematic ad groups)
   - Campaign 3: Display (remarketing + prospecting)
   - Campaign 4: YouTube (if applicable)
   For each: structure, bid strategy, budget allocation

3. AD COPY (5 variations per ad group)
   - Responsive search ads: 15 headlines, 4 descriptions
   - Ad extensions: sitelinks, callouts, structured snippets, call, location
   - All copy with psychological triggers and India-specific context

4. LANDING PAGE REQUIREMENTS
   - Above-the-fold structure
   - Trust signals needed
   - Form/CTA optimization
   - Mobile-specific considerations

5. CONVERSION TRACKING SETUP
   - Events to track
   - Enhanced conversions setup
   - Call tracking configuration
   - Offline conversion import

All pricing in INR. Specific numbers, not estimates.`,    useCount: 176,
    userRating: 5,
  },
  {
    id: 'prompt-email-sequence',
    title: 'Email Nurture Sequence Builder',
    category: 'Digital Marketing',
    domain: 'Email Marketing',
    difficulty: 'Medium',
    timeEstimate: '12 min',
    tools: ['Brevo', 'Mailchimp', 'Klaviyo'],
    description: 'Create a multi-email nurture sequence that converts leads into customers with specific subject lines, content, and timing.',
    prompt: `Build a [NUMBER]-email nurture sequence for [BUSINESS TYPE] targeting [AUDIENCE].

SEQUENCE TYPE: [Welcome/Abandoned Cart/Post-Purchase/Re-engagement]
GOAL: [Primary conversion action]
SEND PLATFORM: [Mailchimp/Brevo/Klaviyo]

For EACH email, provide:

1. SEND TIMING (days after trigger)
2. SUBJECT LINE (3 A/B test variations)
3. PREVIEW TEXT
4. EMAIL BODY
   - Opening hook (personalized)
   - Main content/value
   - Social proof element
   - Clear CTA
   - P.S. line
5. DESIGN NOTES
   - Layout suggestion
   - Mobile optimization notes
   - Image requirements

6. AUTOMATION RULES
   - Entry trigger
   - Exit conditions
   - Branching logic (if applicable)

7. PERFORMANCE BENCHMARKS
   - Expected open rate
   - Expected click rate
   - Expected conversion rate

Use Indian pricing context. Specific subject lines ready to use.`,    useCount: 143,
    userRating: 4,
  },
  {
    id: 'prompt-whatsapp-campaign',
    title: 'WhatsApp Marketing Strategy',
    category: 'Digital Marketing',
    domain: 'WhatsApp Marketing',
    difficulty: 'Medium',
    timeEstimate: '10 min',
    tools: ['WhatsApp Business API', 'WATI', 'AiSensy'],
    description: 'Design a WhatsApp marketing campaign with broadcast sequences, chatbot flows, and automation rules.',
    prompt: `Design a complete WhatsApp marketing strategy for [BUSINESS] in [CITY].

CONTACT DATABASE: [SIZE] contacts
BUSINESS TYPE: [Type]
PRIMARY GOAL: [Goal]

Deliver:

1. SEGMENTATION STRATEGY
   - Segment 1: [Criteria]
   - Segment 2: [Criteria]
   - Segment 3: [Criteria]
   - Tagging system for contacts

2. BROADCAST SEQUENCES
   - Campaign 1: [Purpose] - 5 messages with timing
   - Campaign 2: [Purpose] - 5 messages with timing
   For each: template text, media requirements, CTA

3. CHATBOT FLOWS
   - Flow 1: FAQ handling (decision tree)
   - Flow 2: Lead qualification (questions + routing)
   - Flow 3: Order/booking confirmation
   - Flow 4: Support ticket creation

4. TEMPLATE MESSAGES (for API approval)
   - 5 pre-approved template formats
   - Header, body, footer, buttons for each

5. COMPLIANCE
   - Opt-in strategy
   - Opt-out mechanism
   - Meta policy compliance checklist

6. METRICS
   - KPIs to track
   - Benchmarks for Indian market
   - Weekly reporting format

Ready to execute with specific message copy.`,    useCount: 134,
    userRating: 4,
  },
  {
    id: 'prompt-social-media',
    title: 'Social Media Content Calendar',
    category: 'Digital Marketing',
    domain: 'Social Media Marketing',
    difficulty: 'Medium',
    timeEstimate: '15 min',
    tools: ['Buffer', 'Canva', 'Meta Business Suite'],
    description: 'Generate a 30-day social media content calendar with post copy, hashtags, and visual briefs for Instagram, LinkedIn, and Twitter.',
    prompt: `Create a 30-day social media content calendar for [BUSINESS] on [PLATFORMS].

BRAND VOICE: [Professional/Friendly/Casual/Luxury]
TARGET AUDIENCE: [Description]
CONTENT PILLARS: [3-4 themes]

FOR EACH DAY, provide:
1. POST TYPE (Reel/Carousel/Story/Static/Thread)
2. CAPTION (complete, ready to post)
3. HASHTAGS (15-20 relevant hashtags)
4. VISUAL BRIEF (shot description, styling notes)
5. BEST POSTING TIME (India timezone)
6. ENGAGEMENT STRATEGY (question/poll/CTA)

CONTENT MIX:
- 40% Educational (tips, how-tos, industry insights)
- 25% Entertaining (memes, behind-the-scenes, trends)
- 20% Promotional (product, offer, testimonial)
- 15% UGC/Community (reposts, features, collaborations)

INCLUDE:
- Monthly theme alignment
- Festival/event tie-ins (Diwali, IPL, etc.)
- Trending audio/format suggestions
- Instagram algorithm optimization tips

All copy ready to copy-paste. India-specific references.`,    useCount: 167,
    userRating: 5,
  },
  {
    id: 'prompt-gmb-optimization',
    title: 'Google My Business Optimization',
    category: 'Digital Marketing',
    domain: 'Local SEO',
    difficulty: 'Easy',
    timeEstimate: '8 min',
    tools: ['Google Business Profile', 'Canva'],
    description: 'Optimize Google My Business listing for maximum local visibility and review generation.',
    prompt: `Optimize the Google Business Profile for [BUSINESS NAME] at [ADDRESS].

BUSINESS TYPE: [Category]
OPERATING HOURS: [Hours]
SERVICE AREA: [Areas served]

Provide:

1. BUSINESS DESCRIPTION
   - 750-word optimized description with keywords
   - Primary and secondary categories
   - Service areas listed

2. SERVICES/PRODUCTS LIST
   - All services with descriptions
   - Pricing where applicable
   - Custom attributes

3. PHOTO STRATEGY
   - 20+ photo types needed (exterior, interior, team, product, action)
   - Photo optimization tips (naming, geotagging)
   - Monthly photo upload schedule

4. POST STRATEGY
   - Weekly Google Posts schedule
   - Post types: offers, updates, events, products
   - CTA for each post type

5. REVIEW GENERATION
   - 5 review request message templates
   - QR code strategy for in-store
   - Response templates for positive/negative reviews
   - Review velocity targets

6. Q&A SECTION
   - 20 seed questions and answers
   - Monitoring schedule

Ready to implement immediately.`,    useCount: 112,
    userRating: 4,
  },
  {
    id: 'prompt-landing-page',
    title: 'High-Converting Landing Page',
    category: 'Digital Marketing',
    domain: 'Website Development',
    difficulty: 'Hard',
    timeEstimate: '18 min',
    tools: ['Figma', 'Next.js', 'Vercel'],
    description: 'Write complete landing page copy with above-the-fold, features, social proof, FAQ, and CTA sections.',
    prompt: `Write a high-converting landing page for [PRODUCT/SERVICE] targeting [AUDIENCE].

PAGE GOAL: [Primary conversion]
PRICE POINT: ₹[AMOUNT]
KEY DIFFERENTIATOR: [What makes it unique]

Write the complete page structure:

1. HERO SECTION
   - Headline (10 words max)
   - Subheadline (25 words max)
   - Primary CTA button text
   - Hero image/video description
   - Trust badge line

2. SOCIAL PROOF BAR
   - 3-4 proof points (clients served, rating, awards, media)

3. PROBLEM SECTION
   - 3 pain points with icons
   - Emotional connection copy

4. SOLUTION SECTION
   - Product/service overview
   - 6 key features with benefit-driven descriptions
   - Feature comparison table (us vs competitor)

5. TESTIMONIALS
   - 3 detailed testimonials with names, designations, companies
   - Before/after results

6. PRICING
   - 3-tier pricing table
   - Recommended tier highlighted
   - Money-back guarantee text

7. FAQ
   - 8 common questions with answers

8. FINAL CTA
   - Urgency element
   - Risk reversal
   - Final CTA button

9. FOOTER
   - Trust elements, contact info, legal

All copy professional, India-specific pricing, conversion-optimized.`,    useCount: 156,
    userRating: 5,
  },

  // ── DEVELOPMENT ────────────────────────
  {
    id: 'prompt-react-component',
    title: 'React Component Generator',
    category: 'Development',
    domain: 'Website Development',
    difficulty: 'Medium',
    timeEstimate: '8 min',
    tools: ['React', 'TypeScript', 'Tailwind CSS'],
    description: 'Generate a complete, production-ready React component with TypeScript, Tailwind styling, and proper accessibility.',
    prompt: `Build a production-ready React component for [COMPONENT PURPOSE].

REQUIREMENTS:
- [List specific features and behaviors]
- Responsive design (mobile-first)
- Accessible (ARIA labels, keyboard navigation)
- TypeScript with strict types

DELIVER:
1. Complete component file with all imports
2. Props interface with JSDoc comments
3. State management (useState/useReducer as needed)
4. Event handlers
5. Responsive Tailwind classes
6. Loading and error states
7. Unit test file
8. Usage example

FOLLOW:
- Single Responsibility Principle
- Composition over inheritance
- Proper TypeScript (no 'any' types)
- Semantic HTML
- Framer Motion animations where appropriate
- Consistent naming (camelCase functions, PascalCase components)

Include all imports. Complete code only — no placeholders.`,    useCount: 201,
    userRating: 5,
  },
  {
    id: 'prompt-api-design',
    title: 'REST API Design',
    category: 'Development',
    domain: 'SaaS Development',
    difficulty: 'Hard',
    timeEstimate: '15 min',
    tools: ['Node.js', 'Express', 'PostgreSQL'],
    description: 'Design a complete REST API with endpoints, auth, validation, and database schema.',
    prompt: `Design a complete REST API for [APPLICATION NAME].

DOMAIN: [Business domain]
USERS: [User types and roles]
DATA: [Key entities and relationships]

DELIVER:

1. API ENDPOINTS
   For each: method, path, description, auth required, request body, response format, status codes

2. DATABASE SCHEMA
   - All tables with columns, types, constraints
   - Relationships (foreign keys)
   - Indexes for performance
   - Migration SQL

3. AUTHENTICATION
   - JWT strategy
   - Refresh token flow
   - Role-based access control (RBAC)
   - Rate limiting rules

4. VALIDATION
   - Request validation schemas (Zod)
   - Error response format
   - Input sanitization

5. MIDDLEWARE
   - Auth middleware
   - Error handler
   - Request logger
   - CORS configuration

6. OPENAPI SPEC
   - Swagger-compatible documentation

Include all TypeScript types. Production-ready code.`,    useCount: 134,
    userRating: 4,
  },
  {
    id: 'prompt-nextjs-fullstack',
    title: 'Full-Stack Next.js App',
    category: 'Development',
    domain: 'SaaS Development',
    difficulty: 'Hard',
    timeEstimate: '25 min',
    tools: ['Next.js', 'Prisma', 'Supabase', 'Stripe'],
    description: 'Scaffold a complete Next.js application with auth, database, API routes, and deployment config.',
    prompt: `Build a full-stack Next.js application for [APP NAME].

DESCRIPTION: [What the app does]
AUTH: [Email/Google/GitHub]
DATABASE: [PostgreSQL/Supabase]
PAYMENTS: [Stripe/Razorpay]

DELIVER:

1. PROJECT STRUCTURE
   - App Router layout with route groups
   - Component hierarchy
   - Lib/utils organization

2. AUTHENTICATION
   - NextAuth.js setup with providers
   - Protected routes middleware
   - Session management
   - Login/Register pages

3. DATABASE
   - Prisma schema with all models
   - Seed data script
   - Migration files

4. API ROUTES
   - CRUD endpoints for each entity
   - Server Actions for form handling
   - File upload handling

5. PAGES
   - Dashboard with stats
   - CRUD list/detail pages
   - Settings page
   - Error and loading states

6. UI
   - Responsive layout with sidebar
   - Data tables with sorting/filtering
   - Form components with validation
   - Toast notifications

7. DEPLOYMENT
   - Vercel config
   - Environment variables template
   - GitHub Actions CI/CD

Complete, runnable code. All imports included.`,    useCount: 118,
    userRating: 5,
  },
  {
    id: 'prompt-shopify-store',
    title: 'Shopify Store Optimization',
    category: 'Development',
    domain: 'E-Commerce (Shopify)',
    difficulty: 'Medium',
    timeEstimate: '12 min',
    tools: ['Shopify', 'Liquid', 'JavaScript'],
    description: 'Optimize a Shopify store with custom sections, speed improvements, and conversion rate optimization.',
    prompt: `Optimize the Shopify store for [STORE NAME] selling [PRODUCTS].

CURRENT ISSUES: [List any known issues]
TARGET AUDIENCE: [Customer profile]

DELIVER:

1. THEME CUSTOMIZATION
   - Custom section code (Liquid) for hero, features, testimonials
   - Mobile-first responsive design
   - Speed optimization (lazy loading, code splitting)

2. PRODUCT PAGE OPTIMIZATION
   - SEO-friendly product descriptions (5 products)
   - Image alt text strategy
   - Schema markup for products
   - Cross-sell and upsell recommendations

3. CHECKOUT OPTIMIZATION
   - Trust signals placement
   - Cart abandonment reduction tactics
   - Express checkout setup (Google Pay, PhonePe)

4. ESSENTIAL APPS
   - Review app setup (Judge.me/Loox)
   - Email marketing integration
   - Analytics setup (GA4 + Meta Pixel)

5. SEO
   - Collection page optimization
   - Blog content strategy
   - Internal linking structure

6. SPEED
   - Image compression strategy
   - Critical CSS inlining
   - Third-party script audit

Include all code. Ready to implement.`,    useCount: 98,
    userRating: 4,
  },
  {
    id: 'prompt-wordpress-site',
    title: 'WordPress Site Builder',
    category: 'Development',
    domain: 'WordPress Development',
    difficulty: 'Medium',
    timeEstimate: '12 min',
    tools: ['WordPress', 'Elementor', 'ACF'],
    description: 'Build or optimize a WordPress website with Elementor, essential plugins, and performance tuning.',
    prompt: `Build/optimize a WordPress site for [BUSINESS NAME].

BUSINESS TYPE: [Type]
PAGES NEEDED: [List pages]
FUNCTIONALITY: [Required features]

DELIVER:

1. HOSTING SETUP
   - Recommended hosting provider and plan
   - WordPress installation steps
   - SSL configuration

2. THEME & DESIGN
   - Theme recommendation with reasoning
   - Elementor page layouts for each page
   - Brand color/font integration

3. ESSENTIAL PLUGINS
   - SEO: Yoast/RankMath configuration
   - Security: Wordfence setup
   - Caching: WP Super Cache/W3TC
   - Forms: WPForms configuration
   - Backup: UpdraftPlus setup

4. PAGE CONTENT
   - Complete copy for each page
   - Image recommendations
   - CTA placement

5. TECHNICAL SEO
   - XML sitemap setup
   - Schema markup
   - Page speed optimization
   - Mobile responsiveness

6. MAINTENANCE
   - Update schedule
   - Backup schedule
   - Security monitoring

Ready to implement. India-specific hosting recommendations.`,    useCount: 87,
    userRating: 4,
  },

  // ── CONTENT ────────────────────────────
  {
    id: 'prompt-blog-post',
    title: 'SEO Blog Post Writer',
    category: 'Content',
    domain: 'Content Marketing',
    difficulty: 'Medium',
    timeEstimate: '10 min',
    tools: ['WordPress', 'Grammarly', 'Hemingway'],
    description: 'Write a comprehensive, SEO-optimized blog post targeting specific keywords with proper structure and internal linking.',
    prompt: `Write a 2000-word SEO-optimized blog post for [WEBSITE].

TARGET KEYWORD: [Primary keyword]
SECONDARY KEYWORDS: [2-3 related keywords]
AUDIENCE: [Reader profile]
GOAL: [Educational/Comparison/How-to/Listicle]

STRUCTURE:

1. TITLE OPTIONS
   - 3 headline variations (with power words and numbers)

2. META DATA
   - Meta title (60 chars max)
   - Meta description (155 chars max)
   - URL slug

3. BLOG POST
   - Introduction with hook (150 words)
   - H2/H3 structured body with:
     - Short paragraphs (2-3 sentences)
     - Bullet points and numbered lists
     - Bold key insights
     - Internal link suggestions (3-5)
     - External authority links (2-3)
   - Conclusion with CTA

4. ON-PAGE SEO CHECKLIST
   - Keyword density (1-2%)
   - H1 contains primary keyword
   - First 100 words contain keyword
   - Image alt text suggestions (5)
   - FAQ section (5 questions)

5. CONTENT PROMOTION
   - 5 social media posts to promote the blog
   - Email newsletter snippet
   - Quora/Reddit angle

India-specific examples. Ready to publish.`,    useCount: 178,
    userRating: 5,
  },
  {
    id: 'prompt-case-study',
    title: 'Client Case Study Writer',
    category: 'Content',
    domain: 'Content Marketing',
    difficulty: 'Medium',
    timeEstimate: '12 min',
    tools: ['Google Docs', 'Canva'],
    description: 'Create a compelling client case study that showcases results and builds trust with prospects.',
    prompt: `Write a client case study for [CLIENT NAME] in [INDUSTRY].

PROJECT: [What was done]
RESULTS: [Key metrics and outcomes]
TIMELINE: [Duration]

CASE STUDY STRUCTURE:

1. HEADLINE
   - Result-focused headline (e.g., "How [Client] Increased Revenue by 300% in 6 Months")

2. CLIENT PROFILE (200 words)
   - Company background
   - Industry and market position
   - Challenge they faced

3. THE CHALLENGE (300 words)
   - Detailed problem description
   - Previous attempts that failed
   - Business impact of the problem
   - Why they chose us

4. THE SOLUTION (400 words)
   - Our approach and methodology
   - Key strategies implemented
   - Timeline with milestones
   - Tools and technologies used

5. THE RESULTS (300 words)
   - Before vs After metrics (table format)
   - Specific numbers and percentages
   - Client testimonial quote
   - Visual data representation suggestions

6. KEY TAKEAWAYS (200 words)
   - 3-5 lessons from this project
   - What others in this industry can learn

7. CTA
   - "Facing similar challenges? Let's talk."
   - Contact information

Professional tone. Data-driven. Client-ready.`,    useCount: 123,
    userRating: 4,
  },
  {
    id: 'prompt-ad-copy',
    title: 'Ad Copy Generator',
    category: 'Content',
    domain: 'Google Ads',
    difficulty: 'Easy',
    timeEstimate: '5 min',
    tools: ['Google Ads', 'Meta Ads'],
    description: 'Generate high-converting ad copy for Google, Meta, and LinkedIn with A/B testing variations.',
    prompt: `Generate ad copy for [BUSINESS] promoting [PRODUCT/SERVICE].

PLATFORM: [Google/Meta/LinkedIn/All]
TARGET AUDIENCE: [Description]
BUDGET RANGE: ₹[AMOUNT]
GOAL: [Leads/Sales/Brand Awareness]

DELIVER PER PLATFORM:

GOOGLE ADS (Responsive Search Ads):
- 15 headlines (30 chars each)
- 4 descriptions (90 chars each)
- 3 ad extensions (sitelinks)
- 3 callout extensions
- 2 structured snippets

META ADS:
- 3 primary text variations (125 chars)
- 3 headline variations (40 chars)
- 3 description variations (30 chars)
- CTA button recommendation
- 3 creative briefs (visual direction)

LINKEDIN ADS:
- 3 ad variations (introductory headline + body)
- CTA recommendation
- Audience targeting suggestions

FOR EACH AD, INCLUDE:
- Psychological trigger used
- Expected CTR benchmark
- A/B test hypothesis

India-specific. Hinglish where appropriate. Ready to upload.`,    useCount: 198,
    userRating: 5,
  },
  {
    id: 'prompt-video-script',
    title: 'Video Script Writer',
    category: 'Content',
    domain: 'Video Marketing',
    difficulty: 'Medium',
    timeEstimate: '8 min',
    tools: ['YouTube', 'Instagram Reels', 'CapCut'],
    description: 'Write engaging video scripts for YouTube, Reels, and Shorts with hooks, content structure, and CTAs.',
    prompt: `Write a video script for [VIDEO TOPIC].

PLATFORM: [YouTube/Reels/Shorts/All]
DURATION: [Length]
AUDIENCE: [Viewer profile]
GOAL: [Educate/Entertain/Sell]

SCRIPT STRUCTURE:

1. HOOK (0-5 seconds)
   - Pattern interrupt opening line
   - Visual direction
   - Text overlay suggestion

2. INTRO (5-15 seconds)
   - Credibility statement
   - What viewer will learn/gain
   - Preview of structure

3. MAIN CONTENT
   For each section:
   - Script text (natural speaking style)
   - B-roll suggestion
   - Text overlay/graphics
   - Transition direction

4. CTA (last 10 seconds)
   - Subscribe/follow prompt
   - Link in bio reference
   - Next video teaser

5. POST-PRODUCTION NOTES
   - Thumbnail concept (3 variations)
   - Title options (SEO-optimized)
   - Description with timestamps
   - Hashtags
   - Best posting time

Include Indian references, trending formats. Natural Hinglish where appropriate.`,    useCount: 145,
    userRating: 4,
  },
  {
    id: 'prompt-brand-voice',
    title: 'Brand Voice Guide',
    category: 'Content',
    domain: 'Brand Identity',
    difficulty: 'Medium',
    timeEstimate: '10 min',
    tools: ['Notion', 'Google Docs'],
    description: 'Define a comprehensive brand voice guide with tone attributes, writing examples, and do/dont guidelines.',
    prompt: `Create a comprehensive brand voice guide for [BRAND NAME].

INDUSTRY: [Industry]
TARGET AUDIENCE: [Audience description]
COMPETITORS: [2-3 competitor brands]
BRAND VALUES: [3-5 core values]

DELIVER:

1. BRAND PERSONALITY
   - 5 personality traits with scores (1-10)
   - Brand archetype (hero, sage, etc.)
   - Brand in 3 words
   - "We are... / We are not..." statements

2. TONE SPECTRUM
   - Formality level (1-10 scale)
   - Humor level (1-10 scale)
   - Warmth level (1-10 scale)
   - Authority level (1-10 scale)
   - Tone shifts by context (social, email, website, support)

3. WRITING GUIDELINES
   - Sentence structure preferences
   - Vocabulary (words we use / words we avoid)
   - Punctuation rules
   - Emoji usage guidelines
   - Capitalization rules

4. VOICE IN ACTION
   For each channel, show BEFORE (generic) and AFTER (on-brand):
   - Instagram caption
   - Website headline
   - Email subject line
   - Customer support response
   - WhatsApp message
   - Error message

5. DO / DON'T TABLE
   - 10 "Do this" examples
   - 10 "Don't do this" examples

6. COMPETITOR COMPARISON
   - How our voice differs from [competitor 1]
   - How our voice differs from [competitor 2]

Ready to share with content team.`,    useCount: 89,
    userRating: 4,
  },

  // ── FINANCE ────────────────────────────
  {
    id: 'prompt-investment-plan',
    title: 'Investment Portfolio Planner',
    category: 'Finance',
    domain: 'Investment Analysis',
    difficulty: 'Hard',
    timeEstimate: '15 min',
    tools: ['Screener.in', 'Groww', 'Zerodha Kite'],
    description: 'Create a diversified investment portfolio with asset allocation, fund recommendations, and rebalancing strategy.',
    prompt: `Create a comprehensive investment plan for [INVESTOR PROFILE].

MONTHLY INVESTMENT: ₹[AMOUNT]
AGE: [Age]
RISK TOLERANCE: [Conservative/Moderate/Aggressive]
GOALS: [Retirement/House/Child Education/Wealth Building]
TIME HORIZON: [Years]

DELIVER:

1. ASSET ALLOCATION
   - Equity: [X]%
   - Debt: [X]%
   - Gold: [X]%
   - Alternatives: [X]%
   - Reasoning for allocation

2. SPECIFIC RECOMMENDATIONS
   For each investment:
   - Fund/Stock name and ticker
   - Why this pick
   - Allocation percentage
   - Expected returns (realistic)
   - Risk factors

3. SIP SCHEDULE
   - Monthly SIP amounts per fund
   - Date selection strategy
   - Step-up plan (annual increase)

4. TAX OPTIMIZATION
   - ELSS recommendations (Section 80C)
   - NPS allocation (Section 80CCD)
   - LTCG planning
   - Tax-harvesting strategy

5. REBALANCING RULES
   - When to rebalance (threshold triggers)
   - How to rebalance (specific steps)
   - Frequency review

6. MONITORING
   - Key metrics to track
   - Review schedule
   - Red flags to watch for

DISCLAIMER: Educational only. Not SEBI-registered advice.`,    useCount: 112,
    userRating: 4,
  },
  {
    id: 'prompt-pricing-strategy',
    title: 'Pricing Strategy Builder',
    category: 'Finance',
    domain: 'Operations',
    difficulty: 'Medium',
    timeEstimate: '10 min',
    tools: ['Google Sheets', 'Competitor analysis'],
    description: 'Design a pricing strategy with competitor analysis, value-based pricing, and tier structure.',
    prompt: `Design a pricing strategy for [PRODUCT/SERVICE].

CURRENT PRICE: ₹[AMOUNT]
COST STRUCTURE: [Fixed + Variable costs]
TARGET MARGIN: [X]%
COMPETITORS: [List 3-5 competitors with their pricing]

DELIVER:

1. COMPETITOR ANALYSIS TABLE
   - Competitor name
   - Their pricing
   - What's included
   - Their positioning

2. PRICING MODEL SELECTION
   - Compare: Cost-plus vs Value-based vs Competitor-based vs Dynamic
   - Recommended model with reasoning
   - Price elasticity considerations

3. TIER STRUCTURE
   - Tier 1 (Basic): ₹[Price] — [What's included]
   - Tier 2 (Growth): ₹[Price] — [What's included]
   - Tier 3 (Premium): ₹[Price] — [What's included]
   - Recommended tier with reasoning

4. PSYCHOLOGICAL PRICING
   - Charm pricing alternatives
   - Anchor pricing strategy
   - Bundle pricing opportunities

5. IMPLEMENTATION
   - Price change communication plan
   - Grandfathering for existing customers
   - A/B testing plan

6. REVENUE PROJECTIONS
   - Conservative/Moderate/Optimistic scenarios
   - Break-even analysis
   - Unit economics

India-specific pricing psychology. All amounts in INR.`,    useCount: 134,
    userRating: 4,
  },
  {
    id: 'prompt-financial-report',
    title: 'Monthly Financial Dashboard',
    category: 'Finance',
    domain: 'Data Analytics',
    difficulty: 'Medium',
    timeEstimate: '10 min',
    tools: ['Google Sheets', 'Looker Studio'],
    description: 'Create a monthly financial report template with KPIs, revenue analysis, and actionable insights.',
    prompt: `Create a monthly financial report template for [BUSINESS NAME].

BUSINESS TYPE: [Type]
REVENUE STREAMS: [List revenue sources]
REPORTING PERIOD: [Month/Quarter]

DELIVER:

1. EXECUTIVE SUMMARY
   - Revenue vs Target (with % achievement)
   - Key wins and concerns
   - One-sentence outlook

2. REVENUE ANALYSIS
   - Revenue by stream (table with MoM and YoY comparison)
   - Revenue by client/segment
   - Top 5 clients by revenue
   - Revenue forecast for next month

3. COST ANALYSIS
   - Fixed vs Variable breakdown
   - Cost as % of revenue
   - Top 5 expenses
   - Cost optimization opportunities

4. PROFITABILITY
   - Gross margin by service/stream
   - Net margin trend
   - Client profitability ranking
   - Project-level profitability

5. CASH FLOW
   - Outstanding receivables (aging analysis)
   - Upcoming payables
   - Cash runway projection
   - Working capital needs

6. KPI DASHBOARD
   - Revenue per employee
   - Client acquisition cost
   - Client lifetime value
   - Utilization rate
   - Average project size

7. ACTION ITEMS
   - 3 specific actions for next month
   - Risks to monitor

Professional format. INR throughout. Copy-paste ready.`,    useCount: 78,
    userRating: 4,
  },

  // ── INDUSTRY VERTICALS ────────────────
  {
    id: 'prompt-real-estate-listing',
    title: 'Property Listing Copy',
    category: 'Industry Verticals',
    domain: 'Real Estate Marketing',
    difficulty: 'Medium',
    timeEstimate: '8 min',
    tools: ['99acres', 'MagicBricks', 'Housing.com'],
    description: 'Write compelling property listing copy that stands out on portals and generates qualified leads.',
    prompt: `Write property listing copy for [PROJECT NAME].

PROJECT TYPE: [Apartment/Villa/Plot]
LOCATION: [Area, City]
CONFIGURATIONS: [2BHK/3BHK/4BHK]
PRICE RANGE: ₹[X] - ₹[Y]
TARGET BUYER: [Young professional/Family/Investor]

DELIVER:

1. LISTING HEADLINES (5 variations)
   - Benefit-focused
   - Location-focused
   - Price-focused
   - Lifestyle-focused
   - Urgency-focused

2. PROPERTY DESCRIPTION (300 words)
   - Opening hook
   - Location advantages
   - Key features and amenities
   - Construction quality highlights
   - Neighborhood benefits
   - CTA

3. PORTAL OPTIMIZATION
   - 99acres description
   - MagicBricks description
   - Housing.com description
   - Each platform's unique requirements

4. AMENITIES SHOWCASE
   - Top 10 amenities with benefit descriptions
   - Lifestyle narrative

5. LOCATION ADVANTAGES
   - Distance to key landmarks
   - Infrastructure highlights
   - Future development potential

6. SOCIAL MEDIA ADAPTATION
   - Instagram caption
   - WhatsApp broadcast message
   - Facebook ad copy

India-specific. INR pricing. Ready to upload to portals.`,    useCount: 156,
    userRating: 5,
  },
  {
    id: 'prompt-dental-marketing',
    title: 'Dental Clinic Marketing',
    category: 'Industry Verticals',
    domain: 'Healthcare & Medical',
    difficulty: 'Medium',
    timeEstimate: '12 min',
    tools: ['Google Business Profile', 'Practo', 'Instagram'],
    description: 'Create a complete marketing plan for a dental clinic with patient acquisition and retention strategies.',
    prompt: `Create a marketing plan for [CLINIC NAME] dental clinic.

LOCATION: [City, Area]
SPECIALTIES: [List dental services]
CLINIC SIZE: [X dentists, X chairs]
TARGET: [Families/Young adults/Cosmetic patients]

DELIVER:

1. GOOGLE PRESENCE
   - GBP optimization checklist
   - Service-specific landing pages
   - "Dentist near me" keyword strategy

2. PATIENT ACQUISITION
   - Google Ads campaign structure
   - Instagram content calendar (30 days)
   - Referral program design
   - Practo/JustDial optimization

3. PATIENT RETENTION
   - WhatsApp appointment reminders
   - Post-treatment follow-up sequence
   - Birthday/anniversary campaigns
   - Loyalty program structure

4. CONTENT STRATEGY
   - Educational content topics (20 ideas)
   - Before/after showcase strategy
   - Patient testimonial collection
   - Doctor thought leadership posts

5. REPUTATION MANAGEMENT
   - Review generation system
   - Response templates
   - Negative review handling

6. BUDGET ALLOCATION
   - Monthly marketing budget breakdown (INR)
   - Expected patient acquisition cost
   - ROI projections

India dental market specific. INR throughout.`,    useCount: 87,
    userRating: 4,
  },
  {
    id: 'prompt-restaurant-marketing',
    title: 'Restaurant Marketing Plan',
    category: 'Industry Verticals',
    domain: 'Hospitality & Tourism',
    difficulty: 'Medium',
    timeEstimate: '12 min',
    tools: ['Zomato', 'Swiggy', 'Instagram', 'Google Business Profile'],
    description: 'Build a restaurant marketing plan covering delivery platforms, direct orders, and social media.',
    prompt: `Create a marketing plan for [RESTAURANT NAME].

CUISINE: [Type]
LOCATION: [Area, City]
OUTLETS: [Number]
AVERAGE ORDER: ₹[Amount]
PLATFORMS: [Zomato/Swiggy/Both]

DELIVER:

1. DELIVERY PLATFORM OPTIMIZATION
   - Zomato profile optimization
   - Swiggy profile optimization
   - Menu photography brief
   - Rating improvement strategy
   - Sponsored listing budget

2. DIRECT ORDER STRATEGY
   - WhatsApp ordering system
   - Website with online ordering
   - "Order Direct, Save 10%" campaign
   - Loyalty program design

3. SOCIAL MEDIA
   - Instagram content pillars
   - Food photography guide
   - Reels ideas (15 specific concepts)
   - User-generated content strategy
   - Influencer collaboration plan

4. LOCAL SEO
   - Google Business Profile optimization for each outlet
   - "Restaurant near me" strategy
   - Review generation system

5. SEASONAL CAMPAIGNS
   - Festival-specific promotions (Diwali, Eid, Christmas)
   - Monsoon specials
   - Summer menu launches
   - IPL tie-ins

6. BUDGET & METRICS
   - Monthly marketing budget (INR)
   - Target metrics by channel
   - Weekly tracking dashboard

India restaurant market specific. INR pricing. Ready to execute.`,    useCount: 134,
    userRating: 5,
  },
  {
    id: 'prompt-edtech-enrollment',
    title: 'EdTech Student Acquisition',
    category: 'Industry Verticals',
    domain: 'Education & EdTech',
    difficulty: 'Hard',
    timeEstimate: '15 min',
    tools: ['Google Ads', 'YouTube', 'WhatsApp'],
    description: 'Design a student acquisition funnel for an educational institution or online course platform.',
    prompt: `Design a student acquisition funnel for [INSTITUTION NAME].

COURSES: [List courses and prices]
TARGET STUDENTS: [Age, profile]
CURRENT ENROLLMENT: [Number per batch]
GOAL: [Target enrollment]

DELIVER:

1. FUNNEL ARCHITECTURE
   - Awareness → Interest → Consideration → Enrollment → Retention
   - For each stage: channels, content, metrics

2. GOOGLE ADS STRATEGY
   - Campaign structure
   - 50 keywords with search volume
   - Ad copy variations
   - Budget allocation

3. YOUTUBE STRATEGY
   - 10 free tutorial topics (lead magnets)
   - Channel optimization
   - Ad campaign for course promotion

4. WHATSAPP AUTOMATION
   - Inquiry → Info session → Counseling → Enrollment flow
   - 10 message templates
   - Chatbot flow diagram

5. CONTENT MARKETING
   - Blog topics (10 SEO-optimized)
   - Student success stories template
   - Parent-focused content

6. REFERRAL PROGRAM
   - Student referral incentives
   - Alumni ambassador program
   - Corporate tie-up strategy

7. BUDGET & PROJECTIONS
   - Monthly marketing budget (INR)
   - Expected cost per enrollment
   - Enrollment projections by month

India EdTech market specific. INR throughout.`,    useCount: 98,
    userRating: 4,
  },

  // ── OPERATIONS ─────────────────────────
  {
    id: 'prompt-client-onboarding',
    title: 'Client Onboarding Workflow',
    category: 'Operations',
    domain: 'CRM & Sales Systems',
    difficulty: 'Easy',
    timeEstimate: '8 min',
    tools: ['Notion', 'Slack', 'Tally'],
    description: 'Design a seamless client onboarding process from signed contract to project kickoff.',
    prompt: `Design a client onboarding workflow for [AGENCY NAME].

SERVICE TYPE: [What you deliver]
TYPICAL CLIENT: [Client profile]
TEAM SIZE: [Number of people involved]

DELIVER:

1. PRE-ONBOARDING (Before Day 1)
   - Welcome email template
   - Document collection checklist
   - Access requirements list
   - Payment collection process

2. DAY 1: KICKOFF
   - Welcome call agenda (30 min)
   - Project brief template
   - Communication channels setup
   - Team introductions

3. WEEK 1: FOUNDATION
   - Discovery questions (20 questions)
   - Brand asset collection list
   - Competitor analysis request
   - Timeline and milestones confirmation

4. TOOLS & TEMPLATES
   - Client intake form (Tally/Typeform)
   - Project brief template
   - Communication plan template
   - Status update template

5. AUTOMATION
   - Email sequence: Days 1, 3, 7, 14
   - Slack channel setup
   - Notion project template
   - Calendar invites for recurring meetings

6. SUCCESS METRICS
   - Onboarding completion rate
   - Time to first deliverable
   - Client satisfaction score
   - Feedback collection process

Ready to implement. All templates included.`,    useCount: 167,
    userRating: 5,
  },
  {
    id: 'prompt-proposal-writer',
    title: 'Client Proposal Generator',
    category: 'Operations',
    domain: 'Operations',
    difficulty: 'Hard',
    timeEstimate: '15 min',
    tools: ['Google Docs', 'Canva'],
    description: 'Generate a professional client proposal with scope, pricing, timeline, and terms.',
    prompt: `Generate a professional client proposal for [CLIENT NAME].

SERVICE: [What you're proposing]
CLIENT INDUSTRY: [Industry]
ESTIMATED BUDGET: ₹[Amount]
TIMELINE: [Duration]

PROPOSAL STRUCTURE:

1. COVER PAGE
   - Agency name and logo placeholder
   - Client name
   - Proposal title
   - Date and validity

2. EXECUTIVE SUMMARY (1 page)
   - Understanding of client's needs
   - Our proposed solution (3 sentences)
   - Expected outcomes
   - Why choose us

3. CURRENT STATE ANALYSIS (1 page)
   - What we observed
   - Key challenges identified
   - Opportunities we see

4. SCOPE OF WORK (2-3 pages)
   For each deliverable:
   - Description
   - Specifications
   - Quantity/format
   - Timeline

5. TIMELINE (1 page)
   - Gantt chart-style timeline
   - Milestones with dates
   - Dependencies

6. INVESTMENT (1 page)
   - Package options (3 tiers)
   - What's included in each
   - Payment terms
   - Additional costs if any

7. WHY US (1 page)
   - Relevant experience
   - Case studies (brief)
   - Team expertise
   - Client testimonials

8. TERMS & CONDITIONS
   - Intellectual property
   - Confidentiality
   - Revision policy
   - Termination clause
   - Payment schedule

9. NEXT STEPS
   - How to get started
   - Contact information
   - Validity period

Professional. INR pricing. Client-ready.`,    useCount: 189,
    userRating: 5,
  },
  {
    id: 'prompt-sop-creator',
    title: 'SOP Documentation',
    category: 'Operations',
    domain: 'Operations',
    difficulty: 'Easy',
    timeEstimate: '10 min',
    tools: ['Notion', 'Google Docs'],
    description: 'Create a standard operating procedure document for any agency process with step-by-step instructions.',
    prompt: `Create an SOP for [PROCESS NAME].

PURPOSE: [What this SOP achieves]
AUDIENCE: [Who will follow it]
FREQUENCY: [How often this process runs]

DELIVER:

1. DOCUMENT HEADER
   - SOP title and number
   - Version and date
   - Author and reviewer
   - Effective date

2. PURPOSE & SCOPE
   - Why this SOP exists
   - When to use it
   - Who is responsible

3. PREREQUISITES
   - Tools needed
   - Access required
   - Training needed

4. STEP-BY-STEP PROCEDURE
   For each step:
   - Step number and action
   - Detailed instructions
   - Screenshot/diagram placeholder
   - Expected outcome
   - Time estimate
   - Common mistakes to avoid

5. QUALITY CHECKPOINTS
   - Verification steps
   - Acceptance criteria
   - Escalation process

6. TROUBLESHOOTING
   - Common issues and solutions
   - Who to contact for help

7. REVISION HISTORY
   - Change log table
   - Review schedule

Clear, numbered steps. Actionable. Ready for team use.`,    useCount: 98,
    userRating: 4,
  },
  {
    id: 'prompt-invoice-template',
    title: 'Professional Invoice Generator',
    category: 'Operations',
    domain: 'Operations',
    difficulty: 'Easy',
    timeEstimate: '5 min',
    tools: ['Google Sheets', 'Invoice generators'],
    description: 'Generate a professional invoice with proper Indian tax formatting, GST, and payment details.',
    prompt: `Generate a professional invoice for [AGENCY NAME].

INVOICE DETAILS:
- Invoice Number: [Number]
- Date: [Date]
- Due Date: [Date]

CLIENT DETAILS:
- Client Name: [Name]
- Company: [Company]
- Address: [Address]
- GSTIN: [If applicable]

SERVICES PROVIDED:
[List services with descriptions, quantity, rate]

DELIVER:

1. INVOICE FORMAT
   - Professional header with agency details
   - Client billing information
   - Itemized service table
   - Subtotal, discount (if any), GST (18%), Total
   - Amount in words
   - Payment terms and methods

2. INDIAN COMPLIANCE
   - GST breakdown (CGST + SGST or IGST)
   - Proper INR formatting (₹1,50,000 not ₹150,000)
   - PAN/GSTIN fields
   - TDS mention if applicable

3. PAYMENT DETAILS
   - Bank transfer details
   - UPI QR code placeholder
   - Razorpay/payment link option

4. NOTES SECTION
   - Payment terms
   - Late payment policy
   - Thank you note

Ready to customize and send. Professional format.`,    useCount: 112,
    userRating: 4,
  },
  {
    id: 'prompt-reporting-template',
    title: 'Monthly Client Report',
    category: 'Operations',
    domain: 'Data Analytics',
    difficulty: 'Medium',
    timeEstimate: '10 min',
    tools: ['Google Data Studio', 'Google Analytics'],
    description: 'Create a comprehensive monthly client report template with KPIs, insights, and recommendations.',
    prompt: `Create a monthly client report for [CLIENT NAME].

SERVICES PROVIDED: [List active services]
REPORTING PERIOD: [Month/Year]
KEY METRICS: [Primary KPIs]

REPORT STRUCTURE:

1. EXECUTIVE SUMMARY
   - Performance highlights (3 bullet points)
   - Key metric changes
   - One-sentence narrative

2. SEO PERFORMANCE
   - Organic traffic (graph data)
   - Keyword rankings (top 10 movements)
   - New vs returning visitors
   - Top performing content

3. PAID CAMPAIGNS
   - Google Ads: spend, clicks, conversions, CPA
   - Meta Ads: spend, reach, engagement, CPL
   - ROAS for each campaign
   - Budget recommendations

4. SOCIAL MEDIA
   - Follower growth
   - Engagement rates by platform
   - Top performing posts
   - Content performance insights

5. WEBSITE ANALYTICS
   - Traffic overview
   - Conversion rate
   - Top pages
   - User behavior flow

6. LEADS & CONVERSIONS
   - Total leads generated
   - Lead quality assessment
   - Conversion funnel analysis
   - Cost per lead by channel

7. RECOMMENDATIONS
   - What to continue
   - What to change
   - What to test
   - Next month's priorities

Professional format. Data placeholders with [X] for easy filling. INR for financial data.`,    useCount: 145,
    userRating: 5,
  },
  {
    id: 'prompt-hiring-process',
    title: 'Hiring Pipeline Builder',
    category: 'Operations',
    domain: 'Recruitment & HR',
    difficulty: 'Medium',
    timeEstimate: '10 min',
    tools: ['LinkedIn', 'Naukri', 'Google Forms'],
    description: 'Design a complete hiring pipeline from job posting to offer letter for agency roles.',
    prompt: `Design a hiring pipeline for [ROLE] at [AGENCY NAME].

ROLE: [Job title]
EXPERIENCE: [Years]
SALARY RANGE: ₹[X] - ₹[Y]
LOCATION: [City/Remote]
TEAM SIZE: [Current team size]

DELIVER:

1. JOB DESCRIPTION
   - Compelling headline
   - About the role (150 words)
   - Responsibilities (10 items)
   - Requirements (must-have and nice-to-have)
   - What we offer
   - How to apply

2. SOURCING STRATEGY
   - LinkedIn job post + outreach template
   - Naukri posting optimization
   - Referral program design
   - Community channels (Slack, Discord, etc.)

3. SCREENING PROCESS
   - Resume screening checklist
   - Phone screen questions (10)
   - Skills assessment design

4. INTERVIEW PROCESS
   - Round 1: Technical/Portfolio review
   - Round 2: Culture fit
   - Round 3: Final with founder
   For each: questions, evaluation criteria, scoring

5. OFFER PROCESS
   - Offer letter template
   - Salary negotiation guidelines
   - Onboarding checklist

6. TIMELINE
   - Ideal hiring timeline (days per stage)
   - Interview scheduling template
   - Communication cadence with candidates

India job market specific. INR salary ranges. Ready to implement.`,    useCount: 67,
    userRating: 3,
  },
  {
    id: 'prompt-automation-setup',
    title: 'n8n/Zapier Automation Builder',
    category: 'Operations',
    domain: 'CRM & Sales Systems',
    difficulty: 'Hard',
    timeEstimate: '12 min',
    tools: ['n8n', 'Zapier', 'Make'],
    description: 'Design automated workflows for repetitive agency tasks using no-code automation tools.',
    prompt: `Design automation workflows for [AGENCY NAME].

CURRENT MANUAL PROCESSES: [List repetitive tasks]
TOOLS IN USE: [List current tools]
BUDGET FOR AUTOMATION: ₹[Amount]/month

DELIVER TOP 10 AUTOMATIONS:

For each automation:
1. TRIGGER
   - What starts the workflow
   - Which app/service

2. ACTIONS
   - Step-by-step actions
   - Data transformations
   - Conditional logic

3. INTEGRATIONS
   - Apps connected
   - API requirements
   - Authentication setup

4. ERROR HANDLING
   - What happens if a step fails
   - Retry logic
   - Alert notification

PRIORITY AUTOMATIONS:
1. Lead capture → CRM entry → Welcome email
2. Client signed contract → Project creation → Team notification
3. Invoice due → Payment reminder → Follow-up
4. Social media mention → Alert → Response queue
5. Meeting scheduled → Prep document → Calendar invite
6. Form submission → Qualification → Assignment
7. Content approved → Publish → Analytics tracking
8. Monthly report → Generation → Delivery
9. Client feedback → Ticket → Resolution tracking
10. New inquiry → Response within 5 min → Follow-up sequence

Include n8n workflow JSON or Zapier step descriptions. Ready to build.`,    useCount: 89,
    userRating: 4,
  },
];
