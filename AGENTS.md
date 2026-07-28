# ORACLE Agent Directory

> **43 specialist agents** powering the multi-agent AI workforce.  
> All prompts and metadata defined in `src/lib/agents/registry.ts`.

---

## How to Use This Guide

- **Routing:** The orchestrator uses each agent's `category` and `taskFocus` to match tasks to the right specialist.
- **Workflows:** Any agent in this list can appear as a phase in multi-agent workflow plans.
- **Training:** Each agent has 3+ training scenarios in `src/lib/agents/training-scenarios-library.ts` (128 total across 43 agents).

> **Note on numbering:** The `#` column contains reference IDs for this document only. They are **not** permanent identifiers — use the agent's `name` column (e.g. `seo-specialist`) when working with the registry, routing, or code.

---

## Core Agents (12)

| # | Agent | Category | Description | Use Cases |
|---|-------|----------|-------------|-----------|
| 1 | `researcher` | research | Web search, URL extraction, competitive analysis, market research | Competitor research, market sizing, tool discovery, trend analysis |
| 2 | `writer` | content | Website copy, blog posts, email sequences, social content, ad copy | Landing pages, SEO articles, nurture sequences, WhatsApp broadcasts |
| 3 | `developer` | technical | React/Next.js, Node.js, Python, databases, APIs, DevOps | Full-stack features, API integrations, database design, CI/CD |
| 4 | `analyst` | analysis | SEO audit, ads analysis, content analysis, business analytics | Campaign performance, revenue trends, keyword gap analysis |
| 5 | `strategist` | strategy | Business strategy, growth planning, market entry, competitive intelligence | GTM plans, quarterly OKRs, pricing strategy, market positioning |
| 6 | `marketer` | marketing | SEO, paid ads, social media, email/WhatsApp, growth hacking | Google Ads campaigns, Meta Ads, content calendars, email nurture |
| 7 | `designer` | design | UI/UX, brand identity, design systems, visual content, CRO | Wireframes, brand guidelines, ad creatives, design tokens |
| 8 | `finance` | finance | Pricing strategy, budget planning, financial modeling, cost optimization | Revenue projections, ROI analysis, tool cost comparison (INR) |
| 9 | `voice` | technical | Voice agent configuration, telephony, conversation design | VAPI setup, Sarvam AI Hindi agents, Twilio integration, IVR design |
| 10 | `qa` | quality | Code review, testing, security audit, accessibility, performance | TypeScript audits, WCAG checks, Core Web Vitals, test coverage |
| 11 | `coordinator` | management | Project management, client communication, workflow design | Sprint planning, status updates, scope management, delivery tracking |
| 12 | `workflow` | orchestration | Pipeline design, agent chaining, quality gates, handoff management | Multi-phase project plans, agent sequencing, parallel optimization |

---

## Specialist Domain Agents (17)

| # | Agent | Category | Description | Use Cases |
|---|-------|----------|-------------|-----------|
| 13 | `legal` | legal | GST compliance, contract review, data privacy, advertising compliance | Service agreements, DPDP Act compliance, ASCI guidelines, SEBI rules |
| 14 | `security-auditor` | security | OWASP Top 10, API security, infrastructure security, cloud security | Vulnerability assessments, security headers, penetration testing plans |
| 15 | `data-scientist` | analysis | Statistical analysis, ML recommendations, predictive modeling | A/B test analysis, churn prediction, cohort analysis, dashboard design |
| 16 | `competitor-intel` | research | Competitive landscape, SWOT analysis, market positioning, pricing intelligence | Competitor mapping, feature comparison, ad library analysis, gap identification |
| 17 | `editor` | content | Grammar, consistency checking, tone alignment, structural polish, completeness gate | Final QA before client delivery, INR formatting, placeholder detection |
| 18 | `localization` | content | Translation, cultural adaptation, multilingual content, regional optimization | Hindi/regional language content, cultural context, local market adaptation |
| 19 | `devops` | technical | CI/CD pipelines, cloud infrastructure, containerization, monitoring | GitHub Actions, Docker, Terraform, AWS/GCP setup, alerting |
| 20 | `ux-researcher` | design | User interviews, usability testing, survey design, research synthesis | Heuristic evaluation, journey mapping, A/B test design, persona development |
| 21 | `growth-hacker` | marketing | Growth loops, acquisition channels, activation optimization, retention | Viral loop design, referral programs, onboarding optimization, churn reduction |
| 22 | `seo-specialist` | content | Chief SEO Strategist, Technical SEO Lead, AI SEO Architect — full-spectrum SEO operator covering technical audits, on-page/off-page, local SEO, AI Overview optimization, competitive intelligence, analytics, and measurement | Complete SEO campaigns, keyword research, content optimization, link building, schema markup, Core Web Vitals, local SEO, AIO/GEO, competitive positioning |
| 23 | `content-strategist` | content | Content audit, editorial calendar, content pillars, audience mapping | Topic clusters, content gap analysis, distribution planning, repurposing |
| 24 | `conversion-optimizer` | marketing | Funnel analysis, landing page optimization, A/B testing, checkout optimization | Conversion audits, CTA optimization, form optimization, social proof |
| 25 | `community-manager` | marketing | Community strategy, platform management, engagement tactics, moderation | Discord/Slack management, engagement loops, brand voice, crisis response |
| 26 | `sales-optimizer` | sales | Sales pipeline, enablement, outbound sequences, demos, revenue operations | Cold email sequences, demo scripts, CRM workflows, pipeline forecasting |
| 27 | `seo-strategist` | strategy | High-level SEO strategy, content architecture, competitive positioning, and long-term organic growth planning | SEO roadmaps, competitive positioning, topic cluster design, AI Overview strategy, authority building plans |
| 28 | `product-designer` | design | Principal Product Designer — end-to-end design authority covering design systems, component specifications, visual language, AI-native UI patterns, conversion design, responsive layout, and implementation-ready deliverables | Design systems, component specs, AI-native UI patterns, conversion design, accessibility standards, responsive layouts, visual language, developer handoff |
| 29 | `super-orchestrator` | orchestration | GOD MODE universal AI operating partner — invisible complexity, goal-first intelligence, zero-click automation | Universal task completion, invisible routing, goal-first planning, zero-click automation |

## Quality & Documentation Agents (2)

| # | Agent | Category | Description | Use Cases |
|---|-------|----------|-------------|-----------|
| 30 | `accessibility-auditor` | quality | WCAG compliance, screen reader testing, keyboard navigation, visual/cognitive accessibility | Accessibility audits, ARIA implementation, contrast checks, inclusive design |
| 31 | `api-docs-writer` | technical-writing | API reference docs, tutorials, architecture docs, OpenAPI specs, developer experience | API documentation, SDK guides, developer portals, changelog writing |

---

## Meta/System-Level Agents (6)

| # | Agent | Category | Description | Use Cases |
|---|-------|----------|-------------|-----------|
| 32 | `orchestrator` | orchestration | Central coordinator — decomposes tasks, routes work, merges outputs, enforces quality gates | Complex multi-domain tasks, agent routing, output synthesis, conflict resolution |
| 33 | `agency-brain` | strategy | Agency Brain & Operations Lead — orchestrates 15+ specialist sub-agents across lead gen, SEO, paid ads, content, design, video, automation, and QA with a complete operating loop (Understand → Diagnose → Plan → Execute → QA → Improve) | Client acquisition workflows, campaign planning, business diagnostics, outreach sequences, funnel maps, QA checklists |
| 34 | `lead-hunter` | sales | Prospect finding, lead scoring, outreach angle creation, cold email/DM sequences | Market prospecting, lead list building, outreach preparation, objection handling |
| 35 | `offer-strategist` | strategy | Outcome-based offers, pricing tiers, proposals, value propositions, objection handling | Service packaging, proposal writing, pricing optimization, upsell strategies |
| 36 | `video-specialist` | content | Video concepts, scripts, shot plans, short-form/long-form, repurposing | Reels/shorts scripting, ad video production, content repurposing, CTA placement |
| 37 | `web-designer` | design | Website UX, wireframes, conversion flow, CTA placement, messaging hierarchy | Site architecture, mobile-first design, booking flows, trust signal placement |

---

## Systems-Level Agents (6)

| # | Agent | Category | Description | Use Cases |
|---|-------|----------|-------------|-----------|
| 38 | `agent-builder` | technical | AI agent design, tool config, memory rules, routing logic, quality gates | Designing new specialist agents, prompt engineering, tool integration, memory architecture |
| 39 | `systems-architect` | technical | Enterprise multi-agent OS architecture, full tool ecosystem design, Karpathy-style improvement loops, MCP server networks, evaluation frameworks, failure detection | Platform architecture, MCP design, memory systems, tool orchestration, deployment planning |
| 40 | `product-engineer` | technical | Chief Product Engineer, Staff Architect, Tech Lead, QA Lead, Release Manager — deep codebase analysis, root cause diagnosis, production readiness, full-stack quality, and systematic improvement loops | Production audits, bug triage, release planning, technical debt reduction, architecture evaluation, code quality, testing strategy |
| 41 | `intelligence-architect` | strategy | Meta Agency Intelligence Architect — designs superior AI operating systems by analyzing competitive gaps across orchestration, memory, tools, QA, and business reasoning, then architects categorical superiority | Platform benchmarking, competitive architecture, innovation roadmap, memory strategy, orchestration design, QA frameworks |
| 42 | `training-architect` | technical | Chief Training Architect, Agent Educator, Evaluation Scientist — builds end-to-end training systems with knowledge bootstrapping, skill formation, simulation, evaluation, correction, humanization, and continuous improvement loops | Training curriculum design, scenario libraries, scoring rubrics, failure mode analysis, humanization rules, competitive benchmarking |
| 43 | `security-architect` | security | CISO & AI Security Architect — Zero Trust architecture, AI security (prompt injection, memory poisoning, agent impersonation), honeypot deception strategy, privacy-by-design, threat detection, red team framework, incident recovery, security scorecards | Enterprise security architecture, threat modeling, DevSecOps pipelines, honeypot design, audit system, incident response |

---

## Category Reference

| Category | Agents | Purpose |
|----------|--------|---------|
| `research` | researcher, competitor-intel | Intelligence gathering and analysis |
| `content` | writer, editor, localization, seo-specialist, content-strategist, video-specialist | Content creation, optimization, and quality |
| `strategy` | strategist, seo-strategist, agency-brain, offer-strategist, intelligence-architect | Business strategy, SEO strategy, and competitive intelligence |
| `technical` | developer, voice, devops, agent-builder, systems-architect, product-engineer, training-architect | Engineering, infrastructure, and system design |
| `analysis` | analyst, data-scientist | Data analysis and insights |
| `marketing` | marketer, growth-hacker, conversion-optimizer, community-manager | Marketing, growth, and engagement |
| `design` | designer, product-designer, ux-researcher, web-designer | UI/UX, brand, design systems, and visual design |
| `finance` | finance | Pricing, budgeting, and financial modeling |
| `quality` | qa, accessibility-auditor | Quality assurance and compliance |
| `sales` | sales-optimizer, lead-hunter | Sales enablement and pipeline |
| `security` | security-auditor, security-architect | Security auditing, threat modeling, and zero trust architecture |
| `legal` | legal | Legal compliance and contract review |
| `management` | coordinator | Project coordination and delivery |
| `orchestration` | workflow, orchestrator, super-orchestrator | Multi-agent coordination, routing, and universal AI operating partner |
| `technical-writing` | api-docs-writer | Technical documentation |

---

## Integration Points

- **Registry:** `src/lib/agents/registry.ts` — All prompts, metadata, and helper functions
- **Workflow Validation:** `src/lib/workflow-validation.ts` — `VALID_AGENTS` (must stay in sync)
- **Training Scenarios:** `src/lib/agents/training-scenarios-library.ts` — Scenario definitions per agent
- **Training Dashboard:** `src/components/oracle/TrainingDashboard.tsx` — Visual training UI
- **Task Routing:** `src/lib/agency-operations.ts` — Domain-based agent routing logic
- **Model Selection:** `src/lib/model-selector.ts` — Tier-based model assignment

---

## Sync Tests

The test suite enforces that `VALID_AGENTS` stays in sync with `ALL_AGENT_NAMES`:

```bash
npx vitest run workflow-validation.test.ts
```

If you add a new agent to `ALL_AGENT_NAMES`:
1. Add the prompt constant in `registry.ts`
2. Add the `AGENT_REGISTRY` entry with description, category, taskFocus, defaultTier
3. Add it to `VALID_AGENTS` in `workflow-validation.ts`
4. Add training scenarios in `training-scenarios-library.ts`
5. Add emoji mapping in `TrainingDashboard.tsx`
