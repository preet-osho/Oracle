// ═══════════════════════════════════════
// ORACLE — Inngest Background Functions
// Durable, retryable, serverless-native job processing
// Inngest v4 API: createFunction(options, handler) — 2 args, trigger inside options
//
// Architecture:
//   - Event-triggered functions (runWebScan, generateReport, leadFollowUp, etc.)
//     are dispatched by automationTick or manually via dispatch helpers.
//   - automationTick is the SINGLE cron-triggered function (hourly).
//     It queries enabled schedules and dispatches the right event per-org.
// ═══════════════════════════════════════

import { inngest } from '@/lib/inngest/client';
import { createLogger } from '@/lib/logger';

const log = createLogger('Inngest');

// ─── Helper: create Supabase service-role client ──

async function getServiceClient() {
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ─── 1. Task Execution Function ────────
// Runs swarm agents for a client task. Durable steps survive Vercel timeouts.

export const executeTask = inngest.createFunction(
  {
    id: 'execute-task',
    name: 'Execute Client Task',
    retries: 3,
    triggers: [{ event: 'app/task.execute' }],
  },
  async ({ event, step }) => {
    const d = event.data;

    log.info('Task execution started', { taskId: d.taskId, clientName: d.clientName });

    // Step 1: Analyze the task
    const analysis = await step.run('analyze-task', async () => {
      const { analyzeTask } = await import('@/lib/task-analyzer');
      const fullTask = `${d.title}\n\n${d.description}`;
      const result = analyzeTask(fullTask);
      return {
        complexity: result.complexity,
        category: result.category,
        suggestedAgents: result.agents.map((a: { role: string }) => a.role),
      };
    });

    // Step 2: Select optimal agents based on approach
    const selectedAgents = await step.run('select-agents', async () => {
      if (d.approach === 'fast') {
        return [d.assignedAgents[0] || analysis.suggestedAgents[0] || 'researcher'];
      }
      if (d.approach === 'premium') {
        return d.assignedAgents.length > 0 ? d.assignedAgents : analysis.suggestedAgents;
      }
      const agents = d.assignedAgents.length > 0 ? d.assignedAgents : analysis.suggestedAgents;
      return agents.slice(0, Math.min(3, agents.length));
    });

    // Step 3: Execute swarm (the long-running part)
    const swarmResult = await step.run('run-swarm', async () => {
      const { runSwarm } = await import('@/lib/swarm');
      const { NeverStopRouter } = await import('@/lib/router');

      const isolatedTask = [
        `${d.title}\n\n${d.description}`,
        '',
        '---',
        `CLIENT: ${d.clientName}`,
        `CLIENT ISOLATION: This task is ONLY for ${d.clientName}. Do not reference or mix data from other clients.`,
        `INDUSTRY FOCUS: ${(d.category || '').replace(/-/g, ' ')}`,
      ].join('\n');

      const callAI = async (
        prompt: string,
        _systemPrompt?: string,
        _providerId?: string,
        _modelId?: string
      ): Promise<{ text: string; provider: string; model: string; tokens: number }> => {
        const result = await NeverStopRouter.callSync(
          [{ id: 'user', role: 'user', content: prompt, timestamp: Date.now() }],
          { messages: [{ role: 'user', content: prompt }], maxTokens: 2000 }
        );
        return {
          text: result.text,
          provider: result.provider,
          model: result.model,
          tokens: result.inputTokens + result.outputTokens,
        };
      };

      const swarmRes = await runSwarm(
        isolatedTask,
        selectedAgents,
        d.parallel,
        { rag: undefined, memory: undefined, project: undefined },
        callAI,
        undefined,
        d.userId
      );

      return {
        synthesis: swarmRes.synthesis,
        agentResults: swarmRes.agentResults.map(r => ({
          agent: r.agent,
          result: r.result.slice(0, 2000),
          provider: r.provider,
          model: r.model,
          tokens: r.tokens,
          timeMs: r.timeMs,
          costUsd: r.costUsd,
        })),
        totalCostUsd: swarmRes.totalCostUsd,
        totalTokens: swarmRes.agentResults.reduce((sum: number, r: { tokens: number }) => sum + r.tokens, 0),
      };
    });

    // Step 4: Persist results to Supabase (graceful if table doesn't exist yet)
    await step.run('persist-results', async () => {
      const supabase = await getServiceClient();
      if (!supabase) return;

      try {
        await supabase.from('task_executions').insert({
          task_id: d.taskId,
          client_name: d.clientName,
          synthesis: swarmResult.synthesis,
          agent_results: swarmResult.agentResults,
          total_cost_usd: swarmResult.totalCostUsd,
          total_tokens: swarmResult.totalTokens,
          status: 'completed',
          created_at: Date.now(),
        });
      } catch (err) {
        log.warn('Failed to persist task results (table may not exist)', {
          taskId: d.taskId,
          error: err instanceof Error ? err.message : 'Unknown',
        });
      }
    });

    log.info('Task execution completed', { taskId: d.taskId, costUsd: swarmResult.totalCostUsd });

    return { taskId: d.taskId, status: 'completed', synthesis: swarmResult.synthesis, costUsd: swarmResult.totalCostUsd };
  }
);

// ─── 2. Memory Extraction Function ─────

export const extractMemories = inngest.createFunction(
  {
    id: 'extract-memories',
    name: 'Extract Client Memories',
    retries: 2,
    triggers: [{ event: 'app/memory.extract' }],
  },
  async ({ event, step }) => {
    const { clientId, conversation } = event.data;
    log.info('Memory extraction started', { clientId });

    await step.run('extract-facts', async () => {
      const { extractAndSaveMemories } = await import('@/lib/memory');
      await extractAndSaveMemories(clientId, conversation);
    });

    log.info('Memory extraction completed', { clientId });
    return { clientId, extracted: true };
  }
);

// ─── 3. Quality Scoring Function ────────

export const scoreQuality = inngest.createFunction(
  {
    id: 'score-quality',
    name: 'Score Response Quality',
    retries: 2,
    triggers: [{ event: 'app/quality.score' }],
  },
  async ({ event, step }) => {
    const { responseText, conversationId } = event.data;

    const score = await step.run('score-response', async () => {
      const { scoreResponse } = await import('@/lib/quality');
      const { NeverStopRouter } = await import('@/lib/router');

      const callAI = async (prompt: string): Promise<string> => {
        const result = await NeverStopRouter.callSync(
          [{ id: 'score', role: 'user', content: prompt, timestamp: Date.now() }],
          { messages: [{ role: 'user', content: prompt }], maxTokens: 1000 }
        );
        return result.text;
      };

      return scoreResponse(responseText, callAI);
    });

    if (conversationId && score) {
      await step.run('persist-score', async () => {
        const supabase = await getServiceClient();
        if (!supabase) return;

        try {
          await supabase.from('quality_scores').insert({
            conversation_id: conversationId,
            score_data: score,
            total: score.total,
            created_at: Date.now(),
          });
        } catch (err) {
          log.warn('Failed to persist quality score (table may not exist)', {
            conversationId,
            error: err instanceof Error ? err.message : 'Unknown',
          });
        }
      });
    }

    return { score };
  }
);

// ─── 4. Web Scan Function ───────────────
// Event-triggered only — dispatched by automationTick or manually.

export const runWebScan = inngest.createFunction(
  {
    id: 'web-scan',
    name: 'Weekly Web Scan',
    retries: 2,
    triggers: [{ event: 'app/webscan.run' }],
  },
  async ({ event, step }) => {
    const categories = event.data.categories;
    log.info('Web scan started', { categories });

    const results = await step.run('scan-web', async () => {
      const { getKnownTools, getEmergingTrends, getDiscoveryStats } = await import('@/lib/weekly-web-scan');
      const tools = getKnownTools();
      const trends = getEmergingTrends();
      const stats = getDiscoveryStats();
      return { scanned: true, tools: tools.length, trends: trends.length, stats, timestamp: Date.now() };
    });

    log.info('Web scan completed');
    return results;
  }
);

// ─── 5. Report Generation Function ──────
// Event-triggered only — dispatched by automationTick or manually.

export const generateReport = inngest.createFunction(
  {
    id: 'generate-report',
    name: 'Generate Intelligence Report',
    retries: 2,
    triggers: [{ event: 'app/report.generate' }],
  },
  async ({ event, step }) => {
    const userId = event.data.userId;
    const rawPeriod = event.data.period;
    const period = rawPeriod === 'monthly' ? 'monthly' : 'weekly';
    log.info('Report generation started', { userId, period });

    const report = await step.run('generate-report', async () => {
      const supabase = await getServiceClient();
      if (!supabase) return { generated: false };

      const now = Date.now();
      const periodMs = period === 'weekly' ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
      const since = now - periodMs;

      const [costs, conversations] = await Promise.all([
        supabase.from('ai_usage_records')
          .select('cost_usd, cost_inr, provider_id, model_id, success')
          .eq('user_id', userId)
          .gte('created_at', since),
        supabase.from('conversations')
          .select('id, title, agent_type, created_at')
          .eq('user_id', userId)
          .gte('created_at', since),
      ]);

      const costData = costs.data || [];
      const convoData = conversations.data || [];

      return {
        generated: true,
        period,
        totalCostUsd: costData.reduce((sum: number, r: { cost_usd?: number }) => sum + (r.cost_usd || 0), 0),
        totalCostInr: costData.reduce((sum: number, r: { cost_inr?: number }) => sum + (r.cost_inr || 0), 0),
        totalRequests: costData.length,
        successRate: costData.length > 0
          ? (costData.filter((r: { success?: boolean }) => r.success).length / costData.length) * 100
          : 0,
        conversations: convoData.length,
        generatedAt: now,
      };
    });

    log.info('Report generation completed', { userId, period });
    return report;
  }
);

// ─── 6. Lead Follow-Up Function ─────────
// Event-triggered only — dispatched by automationTick or manually.
// Finds stale leads and creates follow-up task executions.

export const leadFollowUp = inngest.createFunction(
  {
    id: 'lead-follow-up',
    name: 'Automated Lead Follow-Up',
    retries: 2,
    triggers: [{ event: 'app/lead.followup' }],
  },
  async ({ event, step }) => {
    const orgId = event.data.orgId;
    const followUpType = event.data.followUpType || 'stale-lead-check';
    log.info('Lead follow-up started', { orgId, followUpType });

    // Step 1: Find stale leads (no activity in 7+ days)
    const staleLeads = await step.run('find-stale-leads', async () => {
      const supabase = await getServiceClient();
      if (!supabase) return [];

      try {
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const { data, error } = await supabase
          .from('leads')
          .select('id, name, email, status, last_contacted_at')
          .eq('org_id', orgId)
          .not('status', 'eq', 'converted')
          .not('status', 'eq', 'lost')
          .or(`last_contacted_at.is.null,last_contacted_at.lt.${sevenDaysAgo}`)
          .limit(50);

        if (error) {
          log.warn('Failed to query leads for follow-up', { error: error.message });
          return [];
        }

        return data ?? [];
      } catch (err) {
        log.warn('Failed to find stale leads', {
          error: err instanceof Error ? err.message : 'Unknown',
        });
        return [];
      }
    });

    if (staleLeads.length === 0) {
      log.info('No stale leads found', { orgId });
      return { orgId, staleLeads: 0, followUpsCreated: 0 };
    }

    // Step 2: Create follow-up task executions for each stale lead
    const followUpsCreated = await step.run('create-follow-ups', async () => {
      const supabase = await getServiceClient();
      if (!supabase) return 0;

      let count = 0;
      for (const lead of staleLeads) {
        const daysSince = lead.last_contacted_at
          ? Math.floor((Date.now() - new Date(lead.last_contacted_at).getTime()) / (24 * 60 * 60 * 1000))
          : 999;

        const priority = daysSince > 14 ? 'high' : daysSince > 7 ? 'medium' : 'low';

        try {
          await supabase.from('task_executions').insert({
            task_id: `followup-${lead.id}-${Date.now()}`,
            client_name: `Follow-up: ${lead.name || 'Lead'}`,
            synthesis: [
              `Lead: ${lead.name || 'Unknown'} (${lead.email || 'no email'})`,
              `Status: ${lead.status || 'new'}`,
              `Last contacted: ${lead.last_contacted_at ? `${daysSince} days ago` : 'never'}`,
              `Priority: ${priority}`,
              `Action: Send a personalised follow-up message to re-engage this lead.`,
            ].join('\n'),
            agent_results: [],
            status: 'pending',
            created_at: Date.now(),
          });
          count++;
        } catch {
          // Table might not exist — continue
        }
      }

      return count;
    });

    log.info('Lead follow-up completed', { orgId, staleLeads: staleLeads.length, followUpsCreated });

    return {
      orgId,
      staleLeads: staleLeads.length,
      followUpsCreated,
      leads: staleLeads.map(l => ({ id: l.id, name: l.name })),
    };
  }
);

// ─── 7. Automation Tick Function ────────
// The SINGLE cron-triggered function (hourly).
// Queries enabled schedules, checks next_run_at, and dispatches the
// appropriate event for each org. This avoids double-cron conflicts
// and gives proper per-org execution.

export const automationTick = inngest.createFunction(
  {
    id: 'automation-tick',
    name: 'Automation Tick',
    retries: 1,
    triggers: [{ cron: '0 * * * *' }], // Every hour on the hour
  },
  async ({ step }) => {
    log.info('Automation tick started');

    // Step 1: Find all enabled schedules that are due to run
    const dueSchedules = await step.run('find-due-schedules', async () => {
      const supabase = await getServiceClient();
      if (!supabase) return [];

      try {
        const now = Date.now();
        const { data, error } = await supabase
          .from('automation_schedules')
          .select('id, org_id, type, cron_expression, config')
          .eq('enabled', true)
          .or(`next_run_at.is.null,next_run_at.lte.${now}`)
          .limit(100);

        if (error) {
          log.warn('Failed to query automation schedules', { error: error.message });
          return [];
        }

        return data ?? [];
      } catch {
        // Table may not exist yet
        return [];
      }
    });

    if (dueSchedules.length === 0) {
      log.info('No schedules due to run');
      return { checked: 0, dispatched: 0 };
    }

    // Step 2: Dispatch events for each due schedule
    const dispatchResult = await step.run('dispatch-schedules', async () => {
      let dispatched = 0;
      const supabase = await getServiceClient();

      for (const schedule of dueSchedules) {
        try {
          const eventType = getScheduleEventType(schedule.type);
          if (!eventType) {
            log.warn('Unknown schedule type', { type: schedule.type, scheduleId: schedule.id });
            continue;
          }

          // Build event payload based on schedule type
          const payload = buildEventPayload(schedule.type, schedule.org_id, schedule.config);

          // Dispatch via Inngest
          await inngest.send({
            name: eventType as any,
            data: payload,
          });

      // Update next_run_at based on cron expression
      const { estimateNextRun } = await import('@/lib/automation/scheduler');
      const nextRun = estimateNextRun(schedule.cron_expression);

      if (supabase) {
        await supabase
          .from('automation_schedules')
          .update({
            last_run_at: Date.now(),
            next_run_at: nextRun.getTime(),
            updated_at: Date.now(),
          })
          .eq('id', schedule.id);
      }

          dispatched++;
          log.info('Schedule dispatched', { scheduleId: schedule.id, type: schedule.type, orgId: schedule.org_id });
        } catch (err) {
          log.error('Failed to dispatch schedule', {
            scheduleId: schedule.id,
            error: err instanceof Error ? err.message : 'Unknown',
          });
        }
      }

      return dispatched;
    });

    log.info('Automation tick completed', { checked: dueSchedules.length, dispatched: dispatchResult });

    return { checked: dueSchedules.length, dispatched: dispatchResult };
  }
);

// ─── Helpers for automationTick ─────────

/**
 * Row shape returned by queryOrgRecentConversations.
 * Both callers access different subsets of columns.
 */
interface ConversationRow {
  id: string;
  title?: string;
  messages?: unknown;
  client_id?: string;
  created_at?: number;
}

/**
 * Query recent conversations for an org.
 * Shared by batchQualityReview and batchMemoryExtraction.
 */
async function queryOrgRecentConversations(
  orgId: string,
  maxItems: number,
  select: string,
  lookbackDays = 7,
): Promise<ConversationRow[] | null> {
  const supabase = await getServiceClient();
  if (!supabase) return null;

  const since = Date.now() - lookbackDays * 24 * 60 * 60 * 1000;
  const { data, error } = await supabase
    .from('conversations')
    .select(select)
    .eq('org_id', orgId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(maxItems * 3);

  if (error) {
    log.warn('Failed to query org conversations', { orgId, error: error.message });
    return null;
  }
  return (data ?? []) as unknown as ConversationRow[];
}

function getScheduleEventType(type: string): string | null {
  const mapping: Record<string, string> = {
    'web-scan': 'app/webscan.run',
    'lead-followup': 'app/lead.followup',
    'report-weekly': 'app/report.generate',
    'report-monthly': 'app/report.generate',
    'quality-review': 'app/quality.batch-review',
    'memory-extraction': 'app/memory.batch-extract',
  };
  return mapping[type] ?? null;
}

/**
 * Resolve a real userId from an orgId by looking up an org member.
 * Prefers the owner, falls back to any member.
 * Returns null if no members found (org has no users yet).
 */
async function resolveOrgUserId(orgId: string): Promise<string | null> {
  try {
    const supabase = await getServiceClient();
    if (!supabase) return null;

    // Try to find the org owner first
    const { data: owner } = await supabase
      .from('organization_memberships')
      .select('user_id')
      .eq('org_id', orgId)
      .eq('role', 'owner')
      .limit(1)
      .maybeSingle();

    if (owner?.user_id) return owner.user_id;

    // Fall back to any member
    const { data: anyMember } = await supabase
      .from('organization_memberships')
      .select('user_id')
      .eq('org_id', orgId)
      .limit(1)
      .maybeSingle();

    return anyMember?.user_id ?? null;
  } catch {
    return null;
  }
}

async function buildEventPayload(type: string, orgId: string, config: Record<string, unknown>): Promise<Record<string, unknown>> {
  switch (type) {
    case 'web-scan':
      return { categories: config.categories || ['ai-model', 'marketing', 'automation'], orgId };
    case 'lead-followup':
      return { orgId, followUpType: 'stale-lead-check' as const };
    case 'report-weekly': {
      const userId = await resolveOrgUserId(orgId);
      if (!userId) {
        log.warn('No org member found for weekly report', { orgId });
        return { userId: orgId, period: 'weekly' as const };
      }
      return { userId, period: 'weekly' as const };
    }
    case 'report-monthly': {
      const userId = await resolveOrgUserId(orgId);
      if (!userId) {
        log.warn('No org member found for monthly report', { orgId });
        return { userId: orgId, period: 'monthly' as const };
      }
      return { userId, period: 'monthly' as const };
    }
    case 'quality-review':
      return { orgId, maxItems: 10 };
    case 'memory-extraction':
      return { orgId, maxItems: 10 };
    default:
      return { orgId };
  }
}

// ─── 8. Batch Quality Review Function ─────────
// Queries recent unscored conversations and scores them.
// Triggered by automationTick for the 'quality-review' schedule type.

export const batchQualityReview = inngest.createFunction(
  {
    id: 'batch-quality-review',
    name: 'Batch Quality Review',
    retries: 2,
    triggers: [{ event: 'app/quality.batch-review' }],
  },
  async ({ event, step }) => {
    const { orgId, maxItems = 10 } = event.data;
    log.info('Batch quality review started', { orgId, maxItems });

    // Step 1: Find conversations without quality scores from the last 7 days
    const unscoredConversations = await step.run('find-unscored', async () => {
      try {
        const conversations = await queryOrgRecentConversations(
          orgId, maxItems, 'id, title, messages, created_at',
        );
        if (!conversations) {
          log.warn('Failed to query conversations for quality review');
          return [];
        }

        if (conversations.length === 0) return [];

        // Step 2: Check which of THIS org's conversations have been scored
        const supabase = await getServiceClient();
        if (!supabase) return [];
        const orgConvoIds = conversations.map((c) => c.id);
        const { data: scored } = await supabase
          .from('quality_scores')
          .select('conversation_id')
          .in('conversation_id', orgConvoIds);
        const scoredIds = new Set((scored ?? []).map((r: { conversation_id: string }) => r.conversation_id));

        // Filter out already-scored conversations and extract last assistant response
        return conversations
          .filter((c) => !scoredIds.has(c.id))
          .map((c) => {
            // Extract the last assistant message from the messages JSONB array
            const messages = Array.isArray(c.messages) ? c.messages : [];
            const assistantMsgs = messages
              .filter((m: any) => m?.role === 'assistant' && typeof m.content === 'string')
              .map((m: any) => m.content || '');
            const responseText = assistantMsgs.length > 0
              ? assistantMsgs[assistantMsgs.length - 1]
              : c.title || '';
            return { id: c.id, responseText, created_at: c.created_at };
          })
          .filter((c) => c.responseText.length >= 50)
          .slice(0, maxItems);
      } catch (err) {
        log.warn('Failed to find unscored conversations', {
          error: err instanceof Error ? err.message : 'Unknown',
        });
        return [];
      }
    });

    if (unscoredConversations.length === 0) {
      log.info('No unscored conversations found', { orgId });
      return { orgId, scored: 0, skipped: 0 };
    }

    // Step 2: Score each conversation
    const results = await step.run('score-conversations', async () => {
      const { scoreResponse } = await import('@/lib/quality');
      const { NeverStopRouter } = await import('@/lib/router');
      const supabase = await getServiceClient();
      if (!supabase) return { scored: 0, skipped: unscoredConversations.length };

      const callAI = async (prompt: string): Promise<string> => {
        const result = await NeverStopRouter.callSync(
          [{ id: 'score', role: 'user', content: prompt, timestamp: Date.now() }],
          { messages: [{ role: 'user', content: prompt }], maxTokens: 1000 }
        );
        return result.text;
      };

      let scored = 0;
      for (const convo of unscoredConversations) {
        try {
          const score = await scoreResponse(convo.responseText, callAI);
          if (score) {
            await supabase.from('quality_scores').insert({
              conversation_id: convo.id,
              score_data: score,
              total: score.total,
              created_at: Date.now(),
            });
            scored++;
          }
        } catch (err) {
          log.warn('Failed to score conversation', {
            conversationId: convo.id,
            error: err instanceof Error ? err.message : 'Unknown',
          });
        }
      }

      return { scored, skipped: unscoredConversations.length - scored };
    });

    log.info('Batch quality review completed', { orgId, ...results });
    return { orgId, ...results };
  }
);

// ─── 9. Batch Memory Extraction Function ──
// Queries recent conversations without memory extraction.
// Triggered by automationTick for the 'memory-extraction' schedule type.

export const batchMemoryExtraction = inngest.createFunction(
  {
    id: 'batch-memory-extraction',
    name: 'Batch Memory Extraction',
    retries: 2,
    triggers: [{ event: 'app/memory.batch-extract' }],
  },
  async ({ event, step }) => {
    const { orgId, maxItems = 10 } = event.data;
    log.info('Batch memory extraction started', { orgId, maxItems });

    // Step 1: Find clients with recent conversations that may need memory extraction
    const clientsToProcess = await step.run('find-clients', async () => {
      try {
        const conversations = await queryOrgRecentConversations(
          orgId, maxItems, 'id, title, messages, client_id, created_at',
        );
        if (!conversations) {
          log.warn('Failed to query conversations for memory extraction');
          return [];
        }

        // Get unique client IDs from conversations
        const clientIds = [...new Set(
          conversations
            .map((c) => c.client_id)
            .filter((id): id is string => Boolean(id))
        )];

        if (clientIds.length === 0) return [];

        // Get existing memory counts per client
        const supabase = await getServiceClient();
        if (!supabase) return [];
        const { data: memoryCounts } = await supabase
          .from('memories')
          .select('client_id')
          .in('client_id', clientIds);

        const countByClient: Record<string, number> = {};
        for (const row of (memoryCounts ?? []) as { client_id: string }[]) {
          countByClient[row.client_id] = (countByClient[row.client_id] || 0) + 1;
        }

        // Return clients with room for more memories, using actual conversation text
        return clientIds
          .filter(id => (countByClient[id] || 0) < 100)
          .slice(0, maxItems)
          .map(id => {
            const convo = conversations.find((c) => c.client_id === id);
            // Concatenate all user and assistant messages into a conversation transcript
            const messages = convo && Array.isArray(convo.messages) ? convo.messages : [];
            const transcript = messages
              .filter((m: any) => m?.role && typeof m.content === 'string')
              .map((m: any) => `[${m.role}]: ${m.content}`)
              .join('\n---\n');
            const conversationText = transcript.length >= 50 ? transcript : convo?.title || '';
            return { clientId: id, conversation: conversationText };
          });
      } catch (err) {
        log.warn('Failed to find clients for memory extraction', {
          error: err instanceof Error ? err.message : 'Unknown',
        });
        return [];
      }
    });

    if (clientsToProcess.length === 0) {
      log.info('No clients need memory extraction', { orgId });
      return { orgId, extracted: 0, clients: 0 };
    }

    // Step 2: Extract memories for each client
    const results = await step.run('extract-memories', async () => {
      const { extractAndSaveMemories } = await import('@/lib/memory');

      let extracted = 0;
      for (const client of clientsToProcess) {
        try {
          if (client.conversation.length < 50) continue;
          await extractAndSaveMemories(client.clientId, client.conversation);
          extracted++;
        } catch (err) {
          log.warn('Failed to extract memories for client', {
            clientId: client.clientId,
            error: err instanceof Error ? err.message : 'Unknown',
          });
        }
      }

      return { extracted, clients: clientsToProcess.length };
    });

    log.info('Batch memory extraction completed', { orgId, ...results });
    return { orgId, ...results };
  }
);

// ─── 10. Daily Usage Cleanup Function ─────────
// Cron-triggered daily cleanup of old daily_usage rows (>90 days).
// Prevents unbounded table growth.

export const cleanupDailyUsage = inngest.createFunction(
  {
    id: 'cleanup-daily-usage',
    name: 'Cleanup Old Daily Usage',
    retries: 2,
    triggers: [{ cron: '0 3 * * *' }], // Every day at 03:00 UTC
  },
  async ({ step }) => {
    const result = await step.run('cleanup-old-rows', async () => {
      const { cleanupOldDailyUsage } = await import('@/lib/subscription');
      return cleanupOldDailyUsage();
    });

    log.info('Daily usage cleanup completed', { rowsDeleted: result });
    return { rowsDeleted: result };
  }
);

// ─── Export all functions for the serve endpoint ──

export const inngestFunctions = [
  executeTask,
  extractMemories,
  scoreQuality,
  runWebScan,
  generateReport,
  leadFollowUp,
  automationTick,
  batchQualityReview,
  batchMemoryExtraction,
  cleanupDailyUsage,
];
