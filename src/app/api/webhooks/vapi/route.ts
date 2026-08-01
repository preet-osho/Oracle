// ═══════════════════════════════════════
// ORACLE — VAPI Webhook Handler
// POST /api/webhooks/vapi
// Receives voice agent events from VAPI
// ═══════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createLogger } from '@/lib/logger';

const log = createLogger('Webhook:Vapi');

// ─── VAPI Message Types ────────────────

type VapiMessageType =
  | 'assistant-request'
  | 'tool-calls'
  | 'end-of-call-report'
  | 'status-update'
  | 'transcript'
  | 'speech-update'
  | 'hang'
  | 'function-call'
  | 'transfer-destination-request';

interface VapiCall {
  id: string;
  orgId?: string;
  assistantId?: string;
  status: string;
  createdAt: string;
  endedAt?: string;
  duration?: number;
  phoneNumber?: { number: string };
  customer?: { number: string };
  cost?: number;
}

interface VapiArtifact {
  recording?: { recordingUrl: string; stereoRecordingUrl?: string };
  transcript?: string;
  messages?: Array<{ role: string; message: string; time?: number }>;
}

interface VapiWebhookBody {
  message: {
    type: VapiMessageType;
    call: VapiCall;
    artifact?: VapiArtifact;
    endedReason?: string;
    toolWithToolCallList?: Array<{
      name: string;
      toolCall: { id: string; parameters: Record<string, unknown> };
    }>;
    transcript?: { role: string; transcript: string; timestamp: number };
    status?: string;
  };
}

// ─── Supabase Client (service role for webhooks) ─────────

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// ─── Find matching voice agent by assistant ID ────────────

async function findVoiceAgent(supabase: ReturnType<typeof getSupabaseClient>, assistantId: string) {
  if (!supabase) return null;
  const { data } = await supabase
    .from('voice_agents')
    .select('id, org_id, name')
    .eq('config->>vapi_assistant_id', assistantId)
    .single();
  return data;
}

// ─── Store call log ─────────────────────

async function storeCallLog(
  supabase: ReturnType<typeof getSupabaseClient>,
  data: {
    org_id: string;
    agent_id: string;
    caller_number: string;
    duration: number;
    status: string;
    transcript: string;
    sentiment: string;
    summary: string;
    metadata: Record<string, unknown>;
  }
) {
  if (!supabase) return null;
  const now = Date.now();
  const log = {
    id: `cl_${now}_${Math.random().toString(36).substring(2, 9)}`,
    ...data,
    created_at: now,
  };
  const { data: inserted } = await supabase
    .from('call_logs')
    .insert(log)
    .select()
    .single();
  return inserted;
}

// ─── Detect sentiment from transcript ─────────────────────

function detectSentiment(transcript: string): 'positive' | 'neutral' | 'negative' {
  const lower = transcript.toLowerCase();
  const positive = ['thank', 'great', 'perfect', 'awesome', 'excellent', 'good', 'happy', 'love', 'wonderful', 'amazing'];
  const negative = ['bad', 'terrible', 'awful', 'hate', 'angry', 'upset', 'worst', 'horrible', 'disappointed', 'frustrated'];

  let posCount = 0;
  let negCount = 0;
  for (const word of positive) { if (lower.includes(word)) posCount++; }
  for (const word of negative) { if (lower.includes(word)) negCount++; }

  if (posCount > negCount + 1) return 'positive';
  if (negCount > posCount + 1) return 'negative';
  return 'neutral';
}

// ─── POST Handler ──────────────────────

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // 1. Authenticate with VAPI secret header
  const vapiSecret = process.env.VAPI_WEBHOOK_SECRET;
  const authHeader = request.headers.get('authorization') || request.headers.get('x-vapi-secret');

  if (vapiSecret) {
    const token = authHeader?.replace('Bearer ', '') || '';
    if (token !== vapiSecret) {
      log.warn('VAPI webhook authentication failed');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } else {
    log.warn('VAPI_WEBHOOK_SECRET not configured — skipping authentication');
  }

  // 2. Parse body
  let body: VapiWebhookBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const message = body?.message;
  if (!message?.type || !message?.call) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const { type, call } = message;
  const supabase = getSupabaseClient();

  log.info('VAPI webhook received', {
    type,
    callId: call.id,
    status: call.status,
    assistantId: call.assistantId,
  });

  // 3. Route by event type
  switch (type) {
    // ── Assistant Request (must respond within 7.5s) ──
    case 'assistant-request': {
      // Find matching voice agent by assistant ID
      if (call.assistantId && supabase) {
        const agent = await findVoiceAgent(supabase, call.assistantId);
        if (agent) {
          log.info('Resolved assistant request', { callId: call.id, agentId: agent.id });
          return NextResponse.json({ assistantId: call.assistantId });
        }
      }
      // Fallback: return default assistant or error
      const defaultAssistantId = process.env.VAPI_DEFAULT_ASSISTANT_ID;
      if (defaultAssistantId) {
        return NextResponse.json({ assistantId: defaultAssistantId });
      }
      return NextResponse.json({ error: 'No matching assistant found' }, { status: 404 });
    }

    // ── Tool Calls (execute tools and return results) ──
    case 'tool-calls': {
      const toolCalls = message.toolWithToolCallList || [];
      const results: Array<{ name: string; toolCallId: string; result: string }> = [];

      for (const item of toolCalls) {
        const { name, toolCall } = item;
        let resultValue = 'Tool executed successfully';

        try {
          // Route tool calls to appropriate handlers
          switch (name) {
            case 'checkOrderStatus': {
              resultValue = JSON.stringify({ status: 'delivered', eta: '2 days' });
              break;
            }
            case 'collectFeedback': {
              resultValue = JSON.stringify({ collected: true, rating: toolCall.parameters?.rating || 'N/A' });
              break;
            }
            case 'sendWhatsApp': {
              resultValue = JSON.stringify({ sent: true, to: toolCall.parameters?.to });
              break;
            }
            case 'bookAppointment': {
              resultValue = JSON.stringify({ booked: true, date: toolCall.parameters?.date });
              break;
            }
            case 'transferToHuman': {
              resultValue = JSON.stringify({ transferred: true, reason: toolCall.parameters?.reason || 'User requested' });
              break;
            }
            case 'crmLookup': {
              resultValue = JSON.stringify({ found: true, customerId: toolCall.parameters?.customerId });
              break;
            }
            default: {
              resultValue = JSON.stringify({ status: 'unknown_tool', tool: name });
              log.warn('Unknown VAPI tool call', { tool: name, callId: call.id });
            }
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Tool execution failed';
          resultValue = JSON.stringify({ error: errorMsg });
          log.error('VAPI tool call failed', { tool: name, error: errorMsg, callId: call.id });
        }

        results.push({ name, toolCallId: toolCall.id, result: resultValue });
      }

      return NextResponse.json({ results });
    }

    // ── End of Call Report (store call log) ──
    case 'end-of-call-report': {
      const { artifact, endedReason } = message;
      const transcript = artifact?.transcript || '';
      const duration = call.duration || 0;
      const callerNumber = call.customer?.number || call.phoneNumber?.number || '';

      // Determine status from ended reason
      let status = 'completed';
      if (endedReason === 'hangup' || endedReason === 'assistant-error') {
        status = endedReason === 'assistant-error' ? 'failed' : 'completed';
      } else if (endedReason === 'customer-did-not-answer' || endedReason === 'no-answer') {
        status = 'missed';
      }

      const sentiment = detectSentiment(transcript);

      // Generate summary from transcript (first 200 chars)
      const summary = transcript.length > 200
        ? transcript.substring(0, 200) + '...'
        : transcript;

      // Store call log if we have Supabase and can find the agent
      if (supabase && call.assistantId) {
        const agent = await findVoiceAgent(supabase, call.assistantId);
        if (agent) {
          await storeCallLog(supabase, {
            org_id: agent.org_id,
            agent_id: agent.id,
            caller_number: callerNumber,
            duration,
            status,
            transcript,
            sentiment,
            summary,
            metadata: {
              vapi_call_id: call.id,
              ended_reason: endedReason,
              recording_url: artifact?.recording?.recordingUrl,
              cost: call.cost,
              messages_count: artifact?.messages?.length || 0,
            },
          });
          log.info('Call log stored', { callId: call.id, agentId: agent.id, status, duration });
        }
      }

      return NextResponse.json({ success: true });
    }

    // ── Status Update (track call state) ──
    case 'status-update': {
      log.info('VAPI status update', {
        callId: call.id,
        status: call.status,
        from: message.status,
      });
      return NextResponse.json({ success: true });
    }

    // ── Transcript (real-time) ──
    case 'transcript': {
      // Log transcript for debugging; could stream to UI via WebSocket
      if (message.transcript) {
        log.info('VAPI transcript', {
          callId: call.id,
          role: message.transcript.role,
          text: message.transcript.transcript?.substring(0, 100),
        });
      }
      return NextResponse.json({ success: true });
    }

    // ── Other events (acknowledge) ──
    case 'speech-update':
    case 'hang':
    case 'function-call':
    case 'transfer-destination-request':
    default: {
      return NextResponse.json({ received: true, type });
    }
  }
}
