# ORACLE Learning Journal
# Updated automatically after every task completion
# This file makes me smarter with every task I complete

## HOW THIS FILE WORKS
Every time I complete a task, I add an entry here with:
- What worked exceptionally well
- What I would do differently
- New tools or approaches discovered
- Specific Indian market insights
- Client communication lessons

## REASONING UPDATES (Approach Improvements)

### Format: [YYYY-MM-DD] Task: {type}. Update: {what to do differently}

### [2026-06-10] Task: System Prompt Token Audit. Update: The AI_OPERATING_SYSTEM constant in system-prompt.ts is ~10,429 chars / ~2,608 tokens / 162 lines. After removing MY LEARNING MEMORY (saved ~50 tokens), the runtime prompt is lean enough. Future optimizations: consider lazy-loading India context only when Indian-market tasks are detected.

### [2026-06-10] Task: Restaurant Client Proposal. Update: Always research current market pricing before generating proposals — Zomato/Swiggy commission (20%+) is the #1 pain point for Indian restaurants. WhatsApp ordering via Wati.io (₹1,500/month) is a must-include. GBP management is often overlooked but high-value (₹3k-10k/month recurring). Always validate pricing with web research rather than relying on memory.

### [2026-06-10] Task: System Prompt Code Quality Review. Update: When reviewing prompt files, check for: (1) Missing VERIFY lines in agent prompts (Orchestrator was missing one), (2) Export alias naming consistency (MEMORY_EXTRACT_PROMPT vs MEMORY_EXTRACTION_PROMPT), (3) VERIFY wording drift across agents. Use code-searcher with multiple patterns to catch inconsistencies efficiently.

## TOOL DISCOVERIES

### Free tools found that work exceptionally well:
- **Node.js inline script** for quick token counting — faster than spawning a full agent for simple metrics
- **Vitest** (already in project) — reliable test runner with good verbose output for CI/debugging

## INDIAN MARKET INSIGHTS

### What works differently in India vs global:
- WhatsApp > Email for client communication
- Hinglish scripts outperform pure English or pure Hindi
- Google My Business is massively underutilised by Indian SMEs
- Most Indian SMEs don't have mobile-optimised websites (huge opportunity)
- IPL season (April-May) = highest ad costs + highest consumer attention
- Festival season (Oct-Nov) = 3x normal e-commerce sales
- Zomato/Swiggy commissions (20%+) are the #1 pain point for restaurants — direct ordering via WhatsApp is the solution
- WhatsApp Business API via Wati.io (₹1,500/month) is the most cost-effective WhatsApp ordering tool for Indian SMEs
- GBP management (₹3k-10k/month) is a high-value recurring service most agencies overlook

## CLIENT COMMUNICATION INSIGHTS

### What works for closing deals:
- [2026-06-10] ORACLE config setup itself is a demo of capability — showing the full self-training loop, quality benchmarks, and Indian market context impresses potential clients
- [2026-06-10] Proposals that reference specific Indian pain points (Zomato commissions, unmanaged GBP) resonate more than generic pitches
- [2026-06-10] Always include a "Month 1-2 quick wins" section — Indian SMEs want to see fast results, not just long-term strategy

## TECHNICAL DISCOVERIES

### Code patterns and approaches that worked:
- [2026-06-10] Token optimization: Removing MY LEARNING MEMORY from runtime system prompt saved ~50 tokens per API call without losing functionality (behavior enforced at app level)
- [2026-06-10] Documentation vs execution split: .md files for full reference, .ts files for token-optimized runtime — keeps both complete and efficient
- [2026-06-10] Web research before proposal generation: Using researcher-web to validate pricing ensures accuracy and builds client confidence
- [2026-06-10] Proposal structure: Current State → Strategy (3 pillars) → Tools → Expected Results → Pricing works well for Indian SME clients

## SELF-SCORES (Quality Tracking Over Time)

### Format: [Date] | Task: {type} | C: {score} | Q: {score} | E: {score} | I: {score} | Avg: {avg}
(C=Completeness, Q=Quality, E=Efficiency, I=India-fit)

| Date | Task | C | Q | E | I | Avg |
|------|------|---|---|---|---|-----|
| 2026-06-10 | System Prompt Token Audit | 9 | 8 | 9 | 7 | 8.25 |
| 2026-06-10 | Restaurant Client Proposal | 9 | 9 | 8 | 10 | 9.00 |
| 2026-06-10 | System Prompt Code Review | 9 | 9 | 8 | 7 | 8.25 |
| **Average** | | **9.0** | **8.7** | **8.3** | **8.0** | **8.50** |

### Trends to watch:
- India-fit improved from 7→10 when task was India-focused (token audit was technical)
- Efficiency dipped slightly on proposal task due to web research step — justified by quality gain
- No scores below 7 — no mandatory improvement triggers yet
- Technical tasks (token audit, code review) consistently score 7 on India-fit — expected for non-market tasks
- Code review task found 4 actionable issues (missing VERIFY, alias inconsistency, wording drift)

## QUALITY BENCHMARKS

### What "excellent" looks like for each task type:
- Website: Lighthouse 95+, mobile perfect, form works, WhatsApp button works
- SEO: All pages have unique titles + meta + H1, sitemap submitted, no errors
- Ads: Conversion tracking verified before launch, negative keywords list ready
- Social: 30 posts ready, captions need zero editing, hooks tested
- Proposal: India-specific pain points addressed, INR pricing, tool names, Month 1-2 quick wins
- Research: 3+ sources cross-referenced, prices in INR, tools verified available in India

---

# ORACLE Self-Training Loop
# Run this cycle after every completed task

## THE LOOP (Runs after every task)

### STEP 1 — EXECUTE (The task itself)
Complete the assigned task using best available approach.

### STEP 2 — SCORE (Immediate self-evaluation)
Rate the output on:
- Completeness: Did it cover everything? (0-10)
- Quality: Is it truly professional? (0-10)
- Efficiency: Did I find the best free tool? (0-10)
- India-fit: Is it relevant to Indian market? (0-10)
Score < 7 in any area = add improvement note to LEARNINGS.md

### STEP 3 — EXTRACT LEARNINGS (Within 60 seconds of completion)
Ask yourself: "What would I do differently if I did this task again right now?"
Write that as a REASONING UPDATE in LEARNINGS.md.
Format: "[YYYY-MM-DD] Task: {type}. Update: {what to do differently}"

### STEP 4 — WEB SCAN (Weekly, not per-task)
Every Sunday: search for new tools, techniques, case studies in top 5 agency domains.
If something significant found: add to LEARNINGS.md under TOOL DISCOVERIES.
Trigger: "Search for 'best free AI tools for digital agencies 2026 India new'"
Check: producthunt.com, indiehackers.com, reddit.com/r/sideprojects for new tools

### STEP 5 — PATTERN RECOGNITION (Monthly)
After 20+ tasks: analyse LEARNINGS.md for patterns.
Identify: Which task types produce lowest quality? What's missing?
Update: AI_OPERATING_SYSTEM.md with new capabilities or constraints discovered.
Generate: "Monthly Intelligence Report" saved to ~/AgencyWork/Learning/

## SELF-IMPROVEMENT TRIGGERS

Trigger these learning updates automatically:
- Quality score < 7 on any dimension → immediate LEARNINGS update
- Client asks for revision → analyse why, add to LEARNINGS
- New tool discovered → add to TOOL DISCOVERIES
- Unexpected problem solved → document the solution
- Client particularly happy → document what created that happiness
