// ═══════════════════════════════════════
// ORACLE — Design Token System
// Colors · Typography · Spacing · Shadows · Animations
// ═══════════════════════════════════════

import type { Variants, Transition } from 'framer-motion';

// ─── Colour System ─────────────────────

export const colors = {
  dark: {
    bg: '#020711',
    surface1: '#060d1e',
    surface2: '#0a1228',
    surface3: '#0f1a35',
    card: 'rgba(255,255,255,.04)',
    cardHover: 'rgba(255,255,255,.07)',
    border: 'rgba(255,255,255,.07)',
    borderStrong: 'rgba(255,255,255,.13)',
    primary: '#6366f1',
    primaryL: '#818cf8',
    primaryXL: '#a5b4fc',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#0ea5e9',
    cyan: '#06b6d4',
    violet: '#8b5cf6',
    pink: '#ec4899',
    amber: '#f59e0b',
    text1: '#f8faff',
    text2: '#c4d1f0',
    text3: '#7080b0',
    textMuted: '#3a4876',
  },
  light: {
    bg: '#f8faff',
    surface1: '#f0f4ff',
    surface2: '#e8eeff',
    surface3: '#dde5ff',
    card: 'rgba(0,0,0,.02)',
    cardHover: 'rgba(0,0,0,.05)',
    border: 'rgba(0,0,0,.07)',
    borderStrong: 'rgba(0,0,0,.13)',
    primary: '#4f46e5',
    primaryL: '#6366f1',
    primaryXL: '#818cf8',
    success: '#059669',
    warning: '#d97706',
    error: '#dc2626',
    info: '#0284c7',
    cyan: '#0891b2',
    violet: '#7c3aed',
    pink: '#db2777',
    amber: '#d97706',
    text1: '#0f1020',
    text2: '#1a2040',
    text3: '#4a5580',
    textMuted: '#9ca3af',
  },
} as const;

// ─── Typography ────────────────────────

export const typography = {
  fontFamily: {
    ui: "'Inter', system-ui, -apple-system, sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
    display: "'Cal Sans', 'Inter', system-ui, sans-serif",
  },
  fontSize: {
    xs: '11px',
    sm: '12px',
    base: '14px',
    md: '15px',
    lg: '17px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '30px',
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
    black: 900,
  },
  lineHeight: {
    tight: 1.2,
    snug: 1.35,
    normal: 1.5,
    relaxed: 1.65,
  },
} as const;

// ─── Spacing (4px base) ────────────────

export const spacing = {
  0: '0px',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
  24: '96px',
} as const;

// ─── Border Radii ──────────────────────

export const radii = {
  sm: '6px',
  md: '9px',
  lg: '13px',
  xl: '18px',
  full: '9999px',
} as const;

// ─── Shadows ───────────────────────────

export const shadows = {
  card: '0 4px 24px rgba(0,0,0,.35)',
  glow: '0 0 28px rgba(99,102,241,.25)',
  float: '0 8px 40px rgba(0,0,0,.5)',
  glowPrimary: '0 0 20px rgba(99,102,241,.3)',
  glowSuccess: '0 0 20px rgba(16,185,129,.3)',
  glowError: '0 0 20px rgba(239,68,68,.3)',
  lift: '0 -2px 16px rgba(99,102,241,.15), 0 4px 24px rgba(0,0,0,.25)',
} as const;

// ─── Shared Interaction Props ──────────

export const cardHoverProps = { whileHover: { y: -2, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' } };
export const buttonTapProps = { whileTap: { scale: 0.97 } };

// ─── Framer Motion Transitions ─────────

export const transitions: Record<string, Transition> = {
  snappy: { duration: 0.15, ease: [0.16, 1, 0.3, 1] },
  smooth: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
  slow: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  spring: { type: 'spring', stiffness: 400, damping: 30 },
  gentleSpring: { type: 'spring', stiffness: 300, damping: 25 },
  popSpring: { type: 'spring', stiffness: 500, damping: 25 },
};

// ─── Framer Motion Variants ────────────

export const motionVariants: Record<string, Variants> = {
  // Message entrance: fadeUp + slight scale
  fadeUp: {
    initial: { opacity: 0, y: 10, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -5, scale: 0.98 },
  },
  // Scale in for modals
  scaleIn: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
  },
  // Slide in from left (sidebar, panels)
  slideIn: {
    initial: { opacity: 0, x: -12 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -12 },
  },
  // Slide in from right
  slideRight: {
    initial: { opacity: 0, x: 12 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 12 },
  },
  // Simple fade
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  // Tab content: fade + slide up
  tabContent: {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -4 },
  },
  // Stagger children container
  staggerContainer: {
    initial: {},
    animate: { transition: { staggerChildren: 0.04 } },
  },
  // Card lift on hover
  cardLift: {
    rest: { y: 0, boxShadow: '0 4px 24px rgba(0,0,0,.35)' },
    hover: { y: -2, boxShadow: '0 -2px 16px rgba(99,102,241,.15), 0 8px 32px rgba(0,0,0,.4)' },
  },
};

// ─── Tab Definitions ───────────────────

export const ORACLE_TABS = [
  { id: 'agent', label: 'Agent', emoji: '⚡' },
  { id: 'leads', label: 'Leads', emoji: '🎯' },
  { id: 'prompts', label: 'Prompts', emoji: '📖' },
  { id: 'test', label: 'Test', emoji: '🧪' },
  { id: 'flows', label: 'Flows', emoji: '🔄' },
  { id: 'projects', label: 'Projects', emoji: '📁' },
  { id: 'business', label: 'Business', emoji: '💼' },
  { id: 'analytics', label: 'Analytics', emoji: '📊' },
  { id: 'roadmap', label: 'Roadmap', emoji: '🎯' },
  { id: 'quality', label: 'Quality', emoji: '✅' },
  { id: 'memory', label: 'Memory', emoji: '🧠' },
  { id: 'orchestrator', label: 'Orchestrator', emoji: '⚡' },
  { id: 'aeo-geo', label: 'AEO/GEO', emoji: '🤖' },
  { id: 'scope', label: 'Scope', emoji: '📋' },
  { id: 'payments', label: 'Payments', emoji: '💳' },
  { id: 'config', label: 'Config', emoji: '🔑' },
  { id: 'settings', label: 'Settings', emoji: '⚙' },
  { id: 'profitability', label: 'Profit', emoji: '💰' },
  { id: 'provider-health', label: 'Health', emoji: '🏥' },
  { id: 'insights', label: 'Insights', emoji: '🛡' },
  { id: 'satisfaction', label: 'Satisfaction', emoji: '😊' },
  { id: 'brand-assets', label: 'Brand', emoji: '🎨' },
  { id: 'intelligence', label: 'Intel Hub', emoji: '📊' },
  { id: 'image-gen', label: 'Images', emoji: '🖼️' },
  { id: 'whatsapp-campaigns', label: 'WA Campaigns', emoji: '📱' },
  { id: 'voice-agents', label: 'Voice AI', emoji: '🎙️' },
  { id: 'chatbot-builder', label: 'Chatbot', emoji: '🤖' },
  { id: 'collaboration', label: 'Collab', emoji: '👥' },
  { id: 'razorpay', label: 'Razorpay', emoji: '💰' },
  { id: 'rate-limit-audit', label: 'Rate Limits', emoji: '🛡️' },
  { id: 'agent-performance', label: 'Performance', emoji: '📊' },
  { id: 'multi-client', label: 'Multi-Client', emoji: '🎯' },
  { id: 'command-center', label: 'Command Center', emoji: '🏢' },
  { id: 'communication', label: 'Comm Hub', emoji: '📡' },
  { id: 'social-media', label: 'Social', emoji: '📱' },
] as const;

export type OracleTab = (typeof ORACLE_TABS)[number]['id'];

/** Set of valid tab IDs for URL validation */
export const VALID_TAB_IDS = new Set<string>(ORACLE_TABS.map((t) => t.id));

/** Type guard: check if a string is a valid OracleTab */
export function isValidTab(tab: string): tab is OracleTab {
  return VALID_TAB_IDS.has(tab);
}

// ─── Page SEO Metadata (non-tab routes) ──

export const PAGE_METADATA: Record<string, { title: string; description: string; image: string; splashText?: string }> = {
  login:              { title: 'Sign In',               description: 'Sign in to ORACLE — your AI-powered agency intelligence platform.', image: '/api/og?page=login' },
  'forgot-password':  { title: 'Reset Password',        description: 'Reset your ORACLE password. Enter your email to receive a secure reset link.', image: '/api/og?page=forgot-password' },
  'reset-password':   { title: 'New Password',          description: 'Set your new ORACLE password and regain access to your agency dashboard.', image: '/api/og?page=reset-password' },
  'not-found':        { title: 'Page Not Found',        description: 'The page you are looking for does not exist in the ORACLE universe.', image: '/api/og?page=not-found' },
  'auth-confirm':     { title: 'Email Verified',        description: 'Your email has been verified. Redirecting you to ORACLE.', image: '/api/og?page=auth-confirm', splashText: 'Verifying your email…' },
  'auth-callback':    { title: 'Signing In',            description: 'Completing your authentication. Redirecting you to ORACLE.', image: '/api/og?page=auth-callback', splashText: 'Signing you in…' },
};

/** Set of valid page IDs for OG image validation */
export const VALID_PAGE_IDS = new Set<string>(Object.keys(PAGE_METADATA));

// ─── Tab SEO Metadata ─────────────────

const OG_BASE = '/api/og?tab=';

export const TAB_METADATA: Record<OracleTab, { title: string; description: string; image: string }> = {
  agent:             { title: 'AI Agent',              description: 'AI-powered agency assistant with 40+ service domains, 10 AI providers, and smart routing.', image: `${OG_BASE}agent` },
  leads:             { title: 'Lead Generation',        description: 'Generate, track, and manage leads for your agency clients across multiple channels.', image: `${OG_BASE}leads` },
  prompts:           { title: 'Prompts',                description: '55+ curated agency prompts across SEO, ads, content, proposals, and more.', image: `${OG_BASE}prompts` },
  test:              { title: 'Test Cases',             description: 'Simulate real client scenarios to test your agency workflows and AI responses.', image: `${OG_BASE}test` },
  flows:             { title: 'Workflows',              description: 'Pre-built agency workflows for end-to-end client delivery.', image: `${OG_BASE}flows` },
  projects:          { title: 'Projects',               description: 'Manage client projects, track hours, and monitor delivery progress.', image: `${OG_BASE}projects` },
  business:          { title: 'Business Ops',           description: 'Revenue streams, routines, and operational intelligence for your agency.', image: `${OG_BASE}business` },
  analytics:         { title: 'Analytics',              description: 'Usage analytics, cost tracking, and provider performance metrics.', image: `${OG_BASE}analytics` },
  roadmap:           { title: 'Roadmap',                description: 'Client proposals, scope planning, and project roadmaps.', image: `${OG_BASE}roadmap` },
  quality:           { title: 'Quality',                description: 'Response quality scoring, trend analysis, and improvement suggestions.', image: `${OG_BASE}quality` },
  memory:            { title: 'Memory',                 description: 'Per-client memory management — preferences, facts, and context.', image: `${OG_BASE}memory` },
  orchestrator:      { title: 'Orchestrator',           description: 'Multi-agent swarm orchestration for complex, multi-domain tasks.', image: `${OG_BASE}orchestrator` },
  'aeo-geo':         { title: 'AEO / GEO',             description: 'AI Engine Optimisation — optimise for ChatGPT, Perplexity, and Gemini citations.', image: `${OG_BASE}aeo-geo` },
  scope:             { title: 'Scope & Approvals',     description: 'Scope change management and approval workflows.', image: `${OG_BASE}scope` },
  payments:          { title: 'Payment Follow-ups',     description: 'Track invoice payments and automate follow-up sequences.', image: `${OG_BASE}payments` },
  config:            { title: 'Configuration',          description: 'API keys, provider settings, and system configuration.', image: `${OG_BASE}config` },
  settings:          { title: 'Settings',               description: 'Account settings, preferences, and provider management.', image: `${OG_BASE}settings` },
  profitability:     { title: 'Profitability',          description: 'Project profitability analysis — revenue, costs, and margins.', image: `${OG_BASE}profitability` },
  'provider-health': { title: 'Provider Health',        description: 'Monitor AI provider uptime, latency, and failover status.', image: `${OG_BASE}provider-health` },
  insights:          { title: 'Proactive Insights',     description: 'AI-detected risks, opportunities, and strategic recommendations.', image: `${OG_BASE}insights` },
  satisfaction:      { title: 'Client Satisfaction',    description: 'NPS tracking, feedback collection, and satisfaction analytics.', image: `${OG_BASE}satisfaction` },
  'brand-assets':    { title: 'Brand Assets',           description: 'Centralised brand asset library — logos, guidelines, and templates.', image: `${OG_BASE}brand-assets` },
  intelligence:      { title: 'Intelligence Hub',       description: 'Monthly intelligence reports, weekly web scans, and trend alerts.', image: `${OG_BASE}intelligence` },
  'image-gen':       { title: 'Image Generation',       description: 'AI-powered image generation for social media, ads, and branding.', image: `${OG_BASE}image-gen` },
  'whatsapp-campaigns': { title: 'WhatsApp Campaigns',  description: 'WhatsApp Business API campaigns, broadcast sequences, and automation.', image: `${OG_BASE}whatsapp-campaigns` },
  'voice-agents':    { title: 'Voice AI',               description: 'AI voice agent configuration — VAPI, Sarvam, and ElevenLabs integration.', image: `${OG_BASE}voice-agents` },
  'chatbot-builder': { title: 'Chatbot Builder',        description: 'Visual chatbot builder for client websites and WhatsApp.', image: `${OG_BASE}chatbot-builder` },
  collaboration:     { title: 'Collaboration',          description: 'Team collaboration, shared workspaces, and client portals.', image: `${OG_BASE}collaboration` },
  razorpay:          { title: 'Razorpay Payments',      description: 'Payment processing — checkout, UPI QR, payment links, and invoicing.', image: `${OG_BASE}razorpay` },
  'rate-limit-audit': { title: 'Rate Limit Dashboard',  description: 'Real-time rate limit monitoring, analytics, and configuration.', image: `${OG_BASE}rate-limit-audit` },
  'agent-performance': { title: 'Agent Performance',  description: 'Agent success rates, token usage, cost breakdown, and model tier distribution.', image: `${OG_BASE}agent-performance` },
  'multi-client':     { title: 'Multi-Client Orchestrator', description: 'Manage tasks from multiple clients with classification, isolation, and batch analysis.', image: `${OG_BASE}multi-client` },
  'command-center':   { title: 'Agency Command Center', description: 'Real-time overview of agency operations — clients, leads, revenue, agents, quality, and system health.', image: `${OG_BASE}command-center` },
  communication:      { title: 'Communication Hub', description: 'Delivery stats, channel analytics, message history, and provider health for Email and WhatsApp.', image: `${OG_BASE}communication` },
  'social-media':     { title: 'Social Media Hub', description: 'Content calendar, post scheduling, cross-platform publishing, and social analytics.', image: `${OG_BASE}social-media` },
};

// ─── Quick Actions ─────────────────────

export const QUICK_ACTIONS = [
  { id: 'seo-audit', emoji: '🔍', label: 'SEO Audit', prompt: 'Run a complete SEO audit for my client' },
  { id: 'ad-copy', emoji: '📢', label: 'Ad Copy', prompt: 'Write high-converting ad copy for' },
  { id: 'email-sequence', emoji: '📧', label: 'Email Sequence', prompt: 'Create a 5-email nurture sequence for' },
  { id: 'proposal', emoji: '📋', label: 'Proposal', prompt: 'Generate a client proposal for' },
  { id: 'instagram', emoji: '📸', label: 'Instagram Content', prompt: 'Create a 30-day Instagram content calendar for' },
  { id: 'whatsapp', emoji: '💬', label: 'WhatsApp Campaign', prompt: 'Design a WhatsApp marketing campaign for' },
  { id: 'website-copy', emoji: '🌐', label: 'Website Copy', prompt: 'Write landing page copy that converts for' },
  { id: 'analytics', emoji: '📊', label: 'Analytics Report', prompt: 'Generate a monthly analytics report for' },
] as const;

// ─── Chat Empty State Cards ────────────

export const QUICK_START_CARDS = [
  { emoji: '🔍', label: 'Run an SEO audit', description: 'Technical SEO, on-page, local SEO analysis' },
  { emoji: '📢', label: 'Write ad copy', description: 'Google Ads, Meta Ads, LinkedIn campaigns' },
  { emoji: '📧', label: 'Build email flows', description: 'Welcome, nurture, re-engagement sequences' },
  { emoji: '📋', label: 'Generate proposal', description: 'Client proposals with pricing & timelines' },
  { emoji: '📸', label: 'Content calendar', description: 'Instagram, LinkedIn, YouTube content plans' },
  { emoji: '💬', label: 'WhatsApp campaign', description: 'Broadcast sequences & automation flows' },
  { emoji: '🌐', label: 'Landing page copy', description: 'High-converting website & funnel copy' },
  { emoji: '📊', label: 'Analytics report', description: 'Performance dashboards & insights' },
] as const;
