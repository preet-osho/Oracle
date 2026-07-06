// ═══════════════════════════════════════
// ORACLE — Multi-Step Automation Workflows
// Lead Capture, Client Onboarding, Client Reporting
// Durable, retryable, step-by-step execution
//
// NOTE: Inngest v4 wraps step.run() return types in Jsonify<>,
// which strips optional properties. We use explicit type assertions
// to work around this safely.
// ═══════════════════════════════════════

import { inngest } from '@/lib/inngest/client';
import { getInngestServiceClient } from '@/lib/inngest/supabase';
import { createLogger } from '@/lib/logger';

const log = createLogger('InngestWorkflows');

// ═══════════════════════════════════════
// 1. LEAD CAPTURE WORKFLOW
// Triggered when a new lead is added.
// Steps: Research → Score → Generate Outreach → Schedule Follow-Up
// ═══════════════════════════════════════

export const leadCaptureWorkflow = inngest.createFunction(
  {
    id: 'lead-capture-workflow',
    name: 'Lead Capture Workflow',
    retries: 2,
    triggers: [{ event: 'app/lead.capture' }],
  },
  async ({ event, step }) => {
    const d = event.data;
    log.info('Lead capture workflow started', { leadId: d.leadId, businessName: d.businessName });

    // ── Step 1: Research the lead ──
    type ResearchResult =
      | { researched: false }
      | {
          researched: true;
          analysis: {
            hasWebsite: boolean;
            hasEmail: boolean;
            hasPhone: boolean;
            rating: number;
            reviewCount: number;
            industry: string;
            city: string;
            source: string;
            painPoints: string[];
          };
        };

    const research = (await step.run('research-lead', async (): Promise<ResearchResult> => {
      const supabase = await getInngestServiceClient();
      if (!supabase) return { researched: false };

      const { data: lead } = await supabase
        .from('leads')
        .select('*')
        .eq('id', d.leadId)
        .single();

      if (!lead) return { researched: false };

      const analysis = {
        hasWebsite: Boolean(lead.website),
        hasEmail: Boolean(lead.email),
        hasPhone: Boolean(lead.phone),
        rating: lead.rating || 0,
        reviewCount: lead.review_count || 0,
        industry: lead.industry || d.industry || 'unknown',
        city: lead.city || d.city || 'unknown',
        source: lead.source || d.source || 'manual',
        painPoints: [] as string[],
      };

      if (analysis.rating > 0 && analysis.rating < 4.0) {
        analysis.painPoints.push('Low Google rating needs reputation management');
      }
      if (analysis.reviewCount < 10) {
        analysis.painPoints.push('Insufficient reviews for local SEO');
      }
      if (!analysis.hasWebsite) {
        analysis.painPoints.push('No website — needs web development');
      }

      return { researched: true, analysis };
    })) as ResearchResult;

    // ── Step 2: Score the lead ──
    type ScoringResult = { score: number; priority: string };

    const scoring = (await step.run('score-lead', async (): Promise<ScoringResult> => {
      if (!research.researched) return { score: 0, priority: 'low' };

      const a = research.analysis;
      let score = 50;

      if (a.hasWebsite) score += 10;
      if (a.hasEmail) score += 5;
      if (a.hasPhone) score += 5;
      if (a.rating > 4.0) score += 15;
      if (a.reviewCount > 50) score += 10;
      score += a.painPoints.length * 10;

      const highValueIndustries = ['healthcare', 'legal', 'real-estate', 'finance', 'education'];
      if (highValueIndustries.includes(a.industry.toLowerCase())) {
        score += 15;
      }

      const priority = score >= 80 ? 'high' : score >= 60 ? 'medium' : 'low';

      const supabase = await getInngestServiceClient();
      if (supabase) {
        await supabase
          .from('leads')
          .update({ score, notes: `Auto-scored: ${priority} priority (${score}/100)` })
          .eq('id', d.leadId);
      }

      return { score, priority };
    })) as ScoringResult;

    // ── Step 3: Generate personalized outreach ──
    type OutreachResult =
      | { generated: false; reason: string }
      | { generated: false; missing: string[] }
      | { generated: true; channel: 'whatsapp' | 'email'; to: string; subject?: string; body: string };

    const outreach = (await step.run('generate-outreach', async (): Promise<OutreachResult> => {
      const { getTemplate, fillTemplate, validateTemplateVariables } = await import('@/lib/communication/templates');

      const channel = d.channel || 'WhatsApp';
      const templateId = channel === 'WhatsApp' ? 'wa-cold-outreach-local' : 'email-cold-outreach';

      const template = getTemplate(templateId);
      if (!template) return { generated: false, reason: 'Template not found' };

      const variables: Record<string, string> = {
        client_name: d.businessName.split(' ')[0] || 'there',
        business_name: d.businessName,
        sender_name: 'Preet',
        agency_name: 'Oracle Digital',
        city: d.city || 'your city',
        industry: d.industry || 'your industry',
        pain_points: research.researched
          ? research.analysis.painPoints.join('\n• ')
          : 'General digital presence improvements',
        similar_count: '5',
        result_1: '40% increase in leads within 3 months',
        result_2: 'Google Maps top 3 ranking for key services',
        start_timeframe: 'within 1 week',
        suggested_time: 'tomorrow afternoon',
        phone: '+91 98765 43210',
      };

      const validation = validateTemplateVariables(template, variables);
      if (!validation.valid) return { generated: false, missing: validation.missing };

      const filledBody = fillTemplate(template.body, variables);
      const filledSubject = template.subject ? fillTemplate(template.subject, variables) : undefined;

      return {
        generated: true,
        channel: channel.toLowerCase() as 'whatsapp' | 'email',
        to: channel === 'WhatsApp' ? d.contactPhone || '' : d.contactEmail || '',
        subject: filledSubject,
        body: filledBody,
      };
    })) as OutreachResult;

    // ── Step 4: Log outreach and schedule follow-up ──
    await step.run('schedule-follow-up', async () => {
      const supabase = await getInngestServiceClient();
      if (!supabase) return;

      if (outreach.generated && outreach.to) {
        const { sendMessage } = await import('@/lib/communication/hub');
        await sendMessage(d.userId, {
          channel: outreach.channel,
          to: outreach.to,
          subject: outreach.subject,
          body: outreach.body,
          leadId: d.leadId,
          metadata: { workflow: 'lead-capture', step: 'initial-outreach' },
        });
        // Note: sendMessage already logs via logMessage internally
      }

      const followUpDate = Date.now() + 3 * 24 * 60 * 60 * 1000;
      await supabase
        .from('leads')
        .update({ follow_up_date: new Date(followUpDate).toISOString() })
        .eq('id', d.leadId);
    });

    log.info('Lead capture workflow completed', {
      leadId: d.leadId,
      score: scoring.score,
      priority: scoring.priority,
    });

    return {
      leadId: d.leadId,
      research: research.researched ? research.analysis : null,
      scoring,
      outreach: { generated: outreach.generated },
    };
  },
);

// ═══════════════════════════════════════
// 2. CLIENT ONBOARDING WORKFLOW
// Triggered when a lead converts to a client (project created).
// Steps: Create Checklist → Set Up Memory → Generate Welcome → Notify Team
// ═══════════════════════════════════════

export const clientOnboardingWorkflow = inngest.createFunction(
  {
    id: 'client-onboarding-workflow',
    name: 'Client Onboarding Workflow',
    retries: 2,
    triggers: [{ event: 'app/client.onboard' }],
  },
  async ({ event, step }) => {
    const d = event.data;
    log.info('Client onboarding workflow started', { projectId: d.projectId, clientName: d.clientName });

    // ── Step 1: Create onboarding checklist ──
    type ChecklistResult = { items: Array<{ task: string; status: string; priority: string }>; total: number };

    const checklist = (await step.run('create-checklist', async (): Promise<ChecklistResult> => {
      const items = [
        { task: 'Collect website login credentials', status: 'pending', priority: 'high' },
        { task: 'Collect Google Business Profile access', status: 'pending', priority: 'high' },
        { task: 'Collect social media account access', status: 'pending', priority: 'medium' },
        { task: 'Define KPIs and success metrics', status: 'pending', priority: 'high' },
        { task: 'Set up Google Analytics / Search Console', status: 'pending', priority: 'high' },
        { task: 'Document brand guidelines and voice', status: 'pending', priority: 'medium' },
        { task: 'Create content calendar template', status: 'pending', priority: 'low' },
        { task: 'Set up communication cadence (weekly sync)', status: 'pending', priority: 'medium' },
        { task: 'Send welcome package to client', status: 'pending', priority: 'high' },
        { task: 'Schedule kickoff meeting', status: 'pending', priority: 'high' },
      ];

      const supabase = await getInngestServiceClient();
      if (supabase) {
        await supabase.from('memories').insert({
          client_id: d.projectId,
          content: `ONBOARDING CHECKLIST:\n${items.map((i, idx) => `${idx + 1}. [${i.status}] ${i.task} (${i.priority})`).join('\n')}`,
          category: 'onboarding',
          importance: 3,
          created_at: Date.now(),
        });
      }

      return { items, total: items.length };
    })) as ChecklistResult;

    // ── Step 2: Initialize client memory ──
    type MemoryResult = { initialized: boolean; memoriesCount: number };

    const memory = (await step.run('init-memory', async (): Promise<MemoryResult> => {
      const supabase = await getInngestServiceClient();
      if (!supabase) return { initialized: false, memoriesCount: 0 };

      const memories = [
        { content: `Client: ${d.clientName}`, category: 'fact', importance: 3 },
        { content: `Industry: ${d.industry || 'Not specified'}`, category: 'fact', importance: 2 },
        { content: `Service: ${d.service || 'Not specified'}`, category: 'fact', importance: 2 },
        { content: `Contract value: ${d.value || 'Not specified'}`, category: 'fact', importance: 2 },
        { content: `Contact email: ${d.contactEmail || 'Not provided'}`, category: 'contact', importance: 2 },
        { content: `Contact phone: ${d.contactPhone || 'Not provided'}`, category: 'contact', importance: 2 },
        { content: 'Communication preference: WhatsApp-first (Indian market)', category: 'preference', importance: 2 },
        { content: 'All deliverables must be client-ready (₹50k+ quality bar)', category: 'decision', importance: 3 },
      ];

      const rows = memories.map((m) => ({
        client_id: d.projectId,
        content: m.content,
        category: m.category,
        importance: m.importance,
        created_at: Date.now(),
      }));

      await supabase.from('memories').insert(rows);
      return { initialized: true, memoriesCount: rows.length };
    })) as MemoryResult;

    // ── Step 3: Generate welcome message ──
    await step.run('generate-welcome', async () => {
      const { sendMessage } = await import('@/lib/communication/hub');

      const channel = d.contactPhone ? 'whatsapp' : 'email';
      const to = d.contactPhone || d.contactEmail || '';
      if (!to) return;

      const firstName = d.clientName.split(' ')[0] || 'there';

      const welcomeBody = channel === 'whatsapp'
        ? `Namaste ${firstName}! 🙏\n\nWelcome to Oracle Digital! We're excited to work with you.\n\nHere's what happens next:\n1. We'll send you a welcome package with all details\n2. Our team will reach out to collect access credentials\n3. We'll schedule a kickoff meeting within 48 hours\n4. Your dedicated project manager will be in touch\n\n有任何问题随时联系！ 🚀`
        : `<h2>Welcome to Oracle Digital!</h2><p>Hi ${firstName},</p><p>We're thrilled to have you on board. Here's what happens next:</p><ol><li>Welcome package with project details</li><li>Access credential collection</li><li>Kickoff meeting within 48 hours</li><li>Dedicated project manager assignment</li></ol><p>Looking forward to a successful partnership!</p>`;

      await sendMessage(d.userId, {
        channel: channel as 'whatsapp' | 'email',
        to,
        body: welcomeBody,
        clientId: d.projectId,
        metadata: { workflow: 'client-onboarding', step: 'welcome' },
      });
    });

    // ── Step 4: Create initial task plan ──
    type TaskPlanResult = { created: boolean; tasksCount: number };

    const taskPlan = (await step.run('create-task-plan', async (): Promise<TaskPlanResult> => {
      const supabase = await getInngestServiceClient();
      if (!supabase) return { created: false, tasksCount: 0 };

      const tasks = [
        { title: 'SEO Audit', description: `Complete SEO audit for ${d.clientName}`, category: 'seo', priority: 'high' },
        { title: 'Competitor Analysis', description: `Analyze top 5 competitors for ${d.clientName}`, category: 'research', priority: 'medium' },
        { title: 'Content Strategy', description: `Develop content strategy for ${d.clientName}`, category: 'content', priority: 'medium' },
        { title: 'Google Business Profile Setup', description: `Optimize GBP for ${d.clientName}`, category: 'local-seo', priority: 'high' },
      ];

      const rows = tasks.map((t) => ({
        task_id: `onboard-${d.projectId}-${t.category}`,
        client_name: d.clientName,
        synthesis: `${t.title}\n\n${t.description}`,
        agent_results: [],
        status: 'pending',
        created_at: Date.now(),
      }));

      await supabase.from('task_executions').insert(rows);
      return { created: true, tasksCount: rows.length };
    })) as TaskPlanResult;

    log.info('Client onboarding workflow completed', {
      projectId: d.projectId,
      clientName: d.clientName,
      checklistItems: checklist.total,
      memoriesCreated: memory.memoriesCount,
    });

    return {
      projectId: d.projectId,
      checklist: { total: checklist.total },
      memory: { memoriesCount: memory.memoriesCount },
      taskPlan: { tasksCount: taskPlan.tasksCount },
    };
  },
);

// ═══════════════════════════════════════
// 3. CLIENT REPORTING WORKFLOW
// Triggered on schedule (weekly/monthly) or manually.
// Steps: Gather Data → Generate Insights → Build Report → Send to Client
// ═══════════════════════════════════════

export const clientReportingWorkflow = inngest.createFunction(
  {
    id: 'client-reporting-workflow',
    name: 'Client Reporting Workflow',
    retries: 2,
    triggers: [{ event: 'app/client.report' }],
  },
  async ({ event, step }) => {
    const d = event.data;
    const period = d.period || 'monthly';
    log.info('Client reporting workflow started', {
      projectId: d.projectId,
      clientName: d.clientName,
      period,
    });

    // ── Step 1: Gather performance data ──
    type GatheredData = {
      gathered: true;
      period: string;
      tasks: { total: number; completed: number; pending: number };
      communication: { total: number; outbound: number; inbound: number; byChannel: { whatsapp: number; email: number } };
      memories: number;
      aiUsage: { totalRequests: number; totalCostUsd: number; totalCostInr: number; successRate: number };
    };

    type GatherResult = { gathered: false } | GatheredData;

    const data = (await step.run('gather-data', async (): Promise<GatherResult> => {
      const supabase = await getInngestServiceClient();
      if (!supabase) return { gathered: false };

      const now = Date.now();
      const periodMs = period === 'weekly' ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
      const since = now - periodMs;

      const [tasks, messages, memories, usage] = await Promise.all([
        supabase
          .from('task_executions')
          .select('id, status, created_at')
          .eq('client_name', d.clientName)
          .gte('created_at', since),
        supabase
          .from('message_logs')
          .select('id, channel, direction, status, created_at')
          .eq('client_id', d.projectId)
          .gte('created_at', since),
        supabase
          .from('memories')
          .select('id, content, category')
          .eq('client_id', d.projectId)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('ai_usage_records')
          .select('cost_usd, cost_inr, provider_id, model_id, success')
          .eq('user_id', d.userId)
          .gte('created_at', since),
      ]);

      const taskData = tasks.data || [];
      const msgData = messages.data || [];
      const usageData = usage.data || [];

      return {
        gathered: true,
        period,
        tasks: {
          total: taskData.length,
          completed: taskData.filter((t: { status: string }) => t.status === 'completed').length,
          pending: taskData.filter((t: { status: string }) => t.status === 'pending').length,
        },
        communication: {
          total: msgData.length,
          outbound: msgData.filter((m: { direction: string }) => m.direction === 'outbound').length,
          inbound: msgData.filter((m: { direction: string }) => m.direction === 'inbound').length,
          byChannel: {
            whatsapp: msgData.filter((m: { channel: string }) => m.channel === 'whatsapp').length,
            email: msgData.filter((m: { channel: string }) => m.channel === 'email').length,
          },
        },
        memories: (memories.data || []).length,
        aiUsage: {
          totalRequests: usageData.length,
          totalCostUsd: usageData.reduce((sum: number, r: { cost_usd?: number }) => sum + (r.cost_usd || 0), 0),
          totalCostInr: usageData.reduce((sum: number, r: { cost_inr?: number }) => sum + (r.cost_inr || 0), 0),
          successRate: usageData.length
            ? (usageData.filter((r: { success?: boolean }) => r.success).length / usageData.length) * 100
            : 0,
        },
      };
    })) as GatherResult;

    // Early return if data gathering failed
    if (!data.gathered) {
      return { projectId: d.projectId, period, status: 'data-gathering-failed' };
    }

    // ── Step 2: Generate insights ──
    type InsightsResult = { findings: string[]; recommendations: string[]; summary: string };

    const insights = (await step.run('generate-insights', async (): Promise<InsightsResult> => {
      const findings: string[] = [];

      if (data.tasks.total > 0) {
        const completionRate = (data.tasks.completed / data.tasks.total) * 100;
        if (completionRate >= 80) {
          findings.push(`✅ Strong task completion rate: ${completionRate.toFixed(0)}% (${data.tasks.completed}/${data.tasks.total})`);
        } else if (completionRate >= 50) {
          findings.push(`⚠️ Moderate task completion: ${completionRate.toFixed(0)}% (${data.tasks.completed}/${data.tasks.total})`);
        } else {
          findings.push(`🔴 Low task completion: ${completionRate.toFixed(0)}% (${data.tasks.completed}/${data.tasks.total}) — needs attention`);
        }
      }

      if (data.communication.total > 0) {
        findings.push(`📞 ${data.communication.total} messages exchanged (${data.communication.outbound} outbound, ${data.communication.inbound} inbound)`);
        if (data.communication.byChannel.whatsapp > data.communication.byChannel.email) {
          findings.push('📱 WhatsApp is the primary communication channel');
        }
      }

      if (data.aiUsage.totalRequests > 0) {
        findings.push(`🤖 AI used ${data.aiUsage.totalRequests} times with ${data.aiUsage.successRate.toFixed(0)}% success rate`);
        if (data.aiUsage.totalCostInr > 0) {
          findings.push(`💰 AI cost: ₹${data.aiUsage.totalCostInr.toFixed(2)} (${data.aiUsage.totalCostUsd.toFixed(4)} USD)`);
        }
      }

      if (data.memories > 0) {
        findings.push(`🧠 ${data.memories} knowledge items stored for this client`);
      }

      const recommendations: string[] = [];
      if (data.tasks.pending > data.tasks.completed) {
        recommendations.push('Prioritize completing pending tasks to maintain momentum');
      }
      if (data.communication.inbound === 0) {
        recommendations.push('Consider proactive outreach to increase client engagement');
      }
      if (data.aiUsage.successRate < 90) {
        recommendations.push('Review AI provider health — success rate is below 90%');
      }

      return {
        findings,
        recommendations,
        summary: `${period.charAt(0).toUpperCase() + period.slice(1)} report for ${d.clientName}: ${data.tasks.completed} tasks completed, ${data.communication.total} messages, ₹${data.aiUsage.totalCostInr.toFixed(0)} AI cost.`,
      };
    })) as InsightsResult;

    // ── Step 3: Build report ──
    await step.run('build-report', async () => {
      const supabase = await getInngestServiceClient();
      if (!supabase) return;

      await supabase.from('memories').insert({
        client_id: d.projectId,
        content: `REPORT (${period}):\n${insights.summary}\n\nFindings:\n${insights.findings.join('\n')}\n\nRecommendations:\n${insights.recommendations.join('\n')}`,
        category: 'report',
        importance: 3,
        created_at: Date.now(),
      });
    });

    // ── Step 4: Send report to client ──
    await step.run('send-report', async () => {
      if (!d.sendEmail) return;

      const supabase = await getInngestServiceClient();
      if (!supabase) return;

      const { data: project } = await supabase
        .from('client_projects')
        .select('contact_email, contact_name')
        .eq('id', d.projectId)
        .single();

      if (!project?.contact_email) return;

      const { sendMessage } = await import('@/lib/communication/hub');
      const reportTitle = `${period.charAt(0).toUpperCase() + period.slice(1)} Performance Report — ${d.clientName}`;

      const emailBody = `
<h2>${reportTitle}</h2>
<p>${insights.summary}</p>
<h3>Key Metrics</h3>
<ul>
  <li><strong>Tasks:</strong> ${data.tasks.completed} completed / ${data.tasks.total} total</li>
  <li><strong>Communication:</strong> ${data.communication.total} messages</li>
  <li><strong>AI Usage:</strong> ${data.aiUsage.totalRequests} requests, ₹${data.aiUsage.totalCostInr.toFixed(0)} cost</li>
</ul>
<h3>Insights</h3>
<ul>${insights.findings.map((f) => `<li>${f}</li>`).join('')}</ul>
<h3>Recommendations</h3>
<ul>${insights.recommendations.map((r) => `<li>${r}</li>`).join('')}</ul>
<p style="color:#94a3b8;font-size:12px;">Generated by ORACLE — AI Operating System for Digital Agencies</p>`;

      await sendMessage(d.userId, {
        channel: 'email',
        to: project.contact_email,
        subject: reportTitle,
        body: emailBody,
        clientId: d.projectId,
        metadata: { workflow: 'client-reporting', period },
      });
    });

    log.info('Client reporting workflow completed', {
      projectId: d.projectId,
      period,
      tasksCompleted: data.tasks.completed,
      insightsCount: insights.findings.length,
    });

    return {
      projectId: d.projectId,
      period,
      tasks: data.tasks,
      insightsCount: insights.findings.length,
      recommendationsCount: insights.recommendations.length,
    };
  },
);
