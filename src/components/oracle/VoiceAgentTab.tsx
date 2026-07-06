'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { motionVariants, transitions, buttonTapProps } from '@/styles/design-tokens';
import toast from 'react-hot-toast';
import { TOAST_DEFAULTS } from '@/lib/toast-config';
import { nanoid } from 'nanoid';
import { copyToClipboard } from '@/lib/utils';

// ─── Types ─────────────────────────────

interface VoiceAgent {
  id: string;
  name: string;
  provider: 'vapi' | 'sarvam' | 'elevenlabs' | 'bland';
  voice: string;
  language: string;
  greeting: string;
  instructions: string;
  tools: string[];
  isActive: boolean;
  stats: { calls: number; avgDuration: number; successRate: number };
  createdAt: number;
}

interface CallLog {
  id: string;
  agentId: string;
  callerNumber: string;
  duration: number;
  status: 'completed' | 'missed' | 'failed';
  transcript: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  createdAt: number;
}

// ─── Sample Data ───────────────────────

const PROVIDERS = [
  { id: 'vapi', name: 'Vapi', color: '#6366f1', description: 'Fast setup, 50+ voices, natural conversation', free: 'Free trial available' },
  { id: 'sarvam', name: 'Sarvam AI', color: '#10b981', description: 'India-focused, Hindi + regional languages', free: 'Free tier for Indian languages' },
  { id: 'elevenlabs', name: 'ElevenLabs', color: '#8b5cf6', description: 'Ultra-realistic voices, voice cloning', free: '10K chars/month free' },
  { id: 'bland', name: 'Bland.ai', color: '#f59e0b', description: 'Simple API, quick deployment', free: 'Free credits on signup' },
];

const VOICES = [
  'Aria (Female, Professional)', 'Charlie (Male, Friendly)', 'Charlotte (Female, Warm)',
  'Harry (Male, Authoritative)', 'Liam (Male, Casual)', 'Matilda (Female, Calm)',
  'hindi-female-1 (Hindi)', 'hindi-male-1 (Hindi)', 'bengali-female-1 (Bengali)',
];

const LANGUAGES = ['English', 'Hindi', 'Bengali', 'Tamil', 'Telugu', 'Marathi', 'Gujarati', 'Kannada', 'Malayalam', 'Punjabi'];

const TOOLS_OPTIONS = ['Book Appointment', 'Send SMS/WhatsApp', 'Transfer to Human', 'CRM Lookup', 'Send Invoice', 'Collect Feedback', 'Check Order Status'];

const SAMPLE_AGENTS: VoiceAgent[] = [
  { id: '1', name: 'Receptionist Bot', provider: 'vapi', voice: 'Aria (Female, Professional)', language: 'English', greeting: 'Hi! Welcome to Oracle Digital. How can I help you today?', instructions: 'You are a receptionist. Greet callers, understand their needs, and route them to the right team.', tools: ['Book Appointment', 'Transfer to Human', 'CRM Lookup'], isActive: true, stats: { calls: 234, avgDuration: 145, successRate: 92 }, createdAt: Date.now() },
  { id: '2', name: 'Hindi Support Bot', provider: 'sarvam', voice: 'hindi-female-1 (Hindi)', language: 'Hindi', greeting: 'नमस्ते! Oracle Digital में आपका स्वागत है। मैं आपकी कैसे मदद कर सकती हूँ?', instructions: 'You are a Hindi-speaking support agent. Help callers with their queries in natural Hindi.', tools: ['Check Order Status', 'Collect Feedback', 'Send WhatsApp'], isActive: true, stats: { calls: 89, avgDuration: 180, successRate: 88 }, createdAt: Date.now() },
];

const SAMPLE_LOGS: CallLog[] = [
  { id: '1', agentId: '1', callerNumber: '+91 98XXX XXX12', duration: 120, status: 'completed', transcript: 'Caller: Hi, I need help with my website order.\nBot: Of course! Can you share your order number?\nCaller: ORD-2847\nBot: Found it! Your order is confirmed and will be delivered by Friday.', sentiment: 'positive', createdAt: Date.now() - 3600000 },
  { id: '2', agentId: '2', callerNumber: '+91 87XXX XXX45', duration: 95, status: 'completed', transcript: 'Caller: मुझे अपने प्रोजेक्ट के बारे में जानना है।\nBot: बिल्कुल! आपका प्रोजेक्ट नंबर क्या है?\nCaller: PRJ-156\nBot: आपका प्रोजेक्ट अगले हफ्ते तक पूरा हो जाएगा।', sentiment: 'neutral', createdAt: Date.now() - 7200000 },
];

// ─── Voice Agent Tab ───────────────────

export function VoiceAgentTab() {
  const [agents, setAgents] = useState<VoiceAgent[]>(SAMPLE_AGENTS);
  const [selectedAgent, setSelectedAgent] = useState<VoiceAgent | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [activeView, setActiveView] = useState<'agents' | 'logs'>('agents');
  const [newAgent, setNewAgent] = useState({
    name: '', provider: 'vapi' as const, voice: VOICES[0], language: 'English', greeting: '', instructions: '', tools: [] as string[],
  });

  const createAgent = useCallback(() => {
    if (!newAgent.name.trim()) { toast.error('❌ Name required', TOAST_DEFAULTS); return; }
    const agent: VoiceAgent = {
      id: nanoid(), name: newAgent.name, provider: newAgent.provider, voice: newAgent.voice,
      language: newAgent.language, greeting: newAgent.greeting || `Hi! Welcome to ${newAgent.name}. How can I help?`,
      instructions: newAgent.instructions, tools: newAgent.tools, isActive: false,
      stats: { calls: 0, avgDuration: 0, successRate: 0 }, createdAt: Date.now(),
    };
    setAgents((prev) => [agent, ...prev]);
    setShowCreate(false);
    setNewAgent({ name: '', provider: 'vapi', voice: VOICES[0], language: 'English', greeting: '', instructions: '', tools: [] });
    toast.success('✅ Voice agent created', TOAST_DEFAULTS);
  }, [newAgent]);

  const toggleAgent = useCallback((id: string) => {
    setAgents((prev) => prev.map((a) => a.id === id ? { ...a, isActive: !a.isActive } : a));
  }, []);

  const deleteAgent = useCallback((id: string) => {
    setAgents((prev) => prev.filter((a) => a.id !== id));
    if (selectedAgent?.id === id) setSelectedAgent(null);
    toast.success('Agent deleted', TOAST_DEFAULTS);
  }, [selectedAgent]);

  const formatDuration = (seconds: number) => `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-4xl">
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} className="mb-6">
            <h1 className="text-[22px] font-bold text-[var(--oracle-text-1)]">🎙️ Voice Agent Builder</h1>
            <p className="mt-1 text-[13px] text-[var(--oracle-text-3)]">Create AI voice agents for inbound/outbound calls with VAPI, Sarvam, ElevenLabs & Bland.ai</p>
          </motion.div>

          {/* Provider Cards */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} className="mb-6">
            <p className="mb-2 text-[11px] font-medium text-[var(--oracle-text-muted)] uppercase tracking-wider">Supported Providers</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {PROVIDERS.map((p) => (
                <div key={p.id} className="oracle-glass rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: p.color }} />
                    <span className="text-[12px] font-semibold text-[var(--oracle-text-1)]">{p.name}</span>
                  </div>
                  <p className="text-[10px] text-[var(--oracle-text-muted)] mb-1">{p.description}</p>
                  <span className="text-[9px] font-medium" style={{ color: p.color }}>{p.free}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* View Tabs */}
          <div className="mb-4 flex gap-2">
            {(['agents', 'logs'] as const).map((v) => (
              <button key={v} onClick={() => setActiveView(v)} className={`rounded-xl border px-4 py-2 text-[12px] font-medium transition-all ${activeView === v ? 'border-[var(--oracle-primary)] bg-[var(--oracle-primary)]/10 text-[var(--oracle-primary-l)]' : 'border-[var(--oracle-border)] text-[var(--oracle-text-3)] hover:bg-[var(--oracle-card-hover)]'}`}>
                {v === 'agents' ? '🤖 Agents' : '📞 Call Logs'}
              </button>
            ))}
            <div className="ml-auto">
              <motion.button {...buttonTapProps} onClick={() => setShowCreate(!showCreate)} className="rounded-xl oracle-gradient-bg px-4 py-2 text-[12px] font-semibold text-white">+ New Agent</motion.button>
            </div>
          </div>

          {/* Create Form */}
          <AnimatePresence>
            {showCreate && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mb-4 overflow-hidden">
                <div className="oracle-glass rounded-2xl p-5">
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <input value={newAgent.name} onChange={(e) => setNewAgent((p) => ({ ...p, name: e.target.value }))} placeholder="Agent name" className="rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-2.5 text-[13px] text-[var(--oracle-text-1)] outline-none focus:border-[var(--oracle-primary)]" />
                    <select value={newAgent.provider} onChange={(e) => setNewAgent((p) => ({ ...p, provider: e.target.value as typeof p.provider }))} className="rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[12px] text-[var(--oracle-text-2)] outline-none">
                      {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <select value={newAgent.voice} onChange={(e) => setNewAgent((p) => ({ ...p, voice: e.target.value }))} className="rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[12px] text-[var(--oracle-text-2)] outline-none">
                      {VOICES.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                    <select value={newAgent.language} onChange={(e) => setNewAgent((p) => ({ ...p, language: e.target.value }))} className="rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[12px] text-[var(--oracle-text-2)] outline-none">
                      {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <textarea value={newAgent.greeting} onChange={(e) => setNewAgent((p) => ({ ...p, greeting: e.target.value }))} placeholder="Greeting message..." rows={2} className="mb-3 w-full resize-none rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-2.5 text-[13px] text-[var(--oracle-text-1)] outline-none focus:border-[var(--oracle-primary)]" />
                  <textarea value={newAgent.instructions} onChange={(e) => setNewAgent((p) => ({ ...p, instructions: e.target.value }))} placeholder="Agent instructions (what it should do, how it should behave)..." rows={3} className="mb-3 w-full resize-none rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-2.5 text-[13px] text-[var(--oracle-text-1)] outline-none focus:border-[var(--oracle-primary)]" />
                  <div className="mb-3">
                    <p className="mb-1 text-[11px] font-medium text-[var(--oracle-text-muted)]">Tools</p>
                    <div className="flex flex-wrap gap-2">
                      {TOOLS_OPTIONS.map((tool) => (
                        <button key={tool} onClick={() => setNewAgent((p) => ({ ...p, tools: p.tools.includes(tool) ? p.tools.filter((t) => t !== tool) : [...p.tools, tool] }))} className={`rounded-lg border px-2 py-1 text-[10px] font-medium transition-all ${newAgent.tools.includes(tool) ? 'border-[var(--oracle-primary)] bg-[var(--oracle-primary)]/10 text-[var(--oracle-primary-l)]' : 'border-[var(--oracle-border)] text-[var(--oracle-text-muted)]'}`}>
                          {tool}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setShowCreate(false)} className="rounded-lg border border-[var(--oracle-border)] px-4 py-2 text-[12px] text-[var(--oracle-text-3)]">Cancel</button>
                    <button onClick={createAgent} className="rounded-lg oracle-gradient-bg px-4 py-2 text-[12px] font-semibold text-white">Create Agent</button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Agents List */}
          {activeView === 'agents' && (
            <div className="space-y-3">
              {agents.map((agent) => (
                <div key={agent.id} className="oracle-glass rounded-xl p-4 cursor-pointer hover:bg-[var(--oracle-card-hover)] transition-colors" onClick={() => setSelectedAgent(selectedAgent?.id === agent.id ? null : agent)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: PROVIDERS.find((p) => p.id === agent.provider)?.color + '20' }}>
                        <span className="text-lg">🎙️</span>
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold text-[var(--oracle-text-1)]">{agent.name}</p>
                        <p className="text-[11px] text-[var(--oracle-text-muted)]">{agent.provider} · {agent.voice} · {agent.language}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="text-[11px] text-[var(--oracle-text-muted)]">{agent.stats.calls} calls · {agent.stats.successRate}% success</p>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); toggleAgent(agent.id); }} className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors ${agent.isActive ? 'bg-[var(--oracle-success)]/10 text-[var(--oracle-success)]' : 'bg-[var(--oracle-surface-2)] text-[var(--oracle-text-muted)]'}`}>
                        {agent.isActive ? '● Live' : '○ Off'}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); deleteAgent(agent.id); }} className="text-[11px] text-[var(--oracle-text-muted)] hover:text-[var(--oracle-error)]">🗑</button>
                    </div>
                  </div>
                  {/* Expanded details */}
                  {selectedAgent?.id === agent.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-3 border-t border-[var(--oracle-border)] pt-3">
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div><p className="text-[10px] text-[var(--oracle-text-muted)]">Greeting</p><p className="text-[12px] text-[var(--oracle-text-3)]">{agent.greeting}</p></div>
                        <div><p className="text-[10px] text-[var(--oracle-text-muted)]">Instructions</p><p className="text-[12px] text-[var(--oracle-text-3)] line-clamp-3">{agent.instructions}</p></div>
                      </div>
                      <div className="mb-3"><p className="text-[10px] text-[var(--oracle-text-muted)] mb-1">Tools</p><div className="flex flex-wrap gap-1">{agent.tools.map((t) => <span key={t} className="rounded-full bg-[var(--oracle-surface-2)] px-2 py-0.5 text-[9px] text-[var(--oracle-text-muted)]">{t}</span>)}</div></div>
                      <div className="flex gap-2">
                        <button onClick={(e) => { e.stopPropagation(); copyToClipboard(`npx vapi create --agent ${agent.id}`).then((ok) => ok ? toast.success('Command copied', TOAST_DEFAULTS) : toast.error('❌ Clipboard access denied', TOAST_DEFAULTS)); }} className="rounded-lg border border-[var(--oracle-border)] px-3 py-1.5 text-[10px] text-[var(--oracle-text-3)]">📋 Copy Deploy Cmd</button>
                        <button onClick={(e) => { e.stopPropagation(); toast.success('Test call initiated (simulated)', TOAST_DEFAULTS); }} className="rounded-lg oracle-gradient-bg px-3 py-1.5 text-[10px] font-medium text-white">📞 Test Call</button>
                      </div>
                    </motion.div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Call Logs */}
          {activeView === 'logs' && (
            <div className="space-y-3">
              {SAMPLE_LOGS.map((log) => (
                <div key={log.id} className="oracle-glass rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-medium text-[var(--oracle-text-1)]">{log.callerNumber}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${log.status === 'completed' ? 'bg-[var(--oracle-success)]/10 text-[var(--oracle-success)]' : log.status === 'missed' ? 'bg-[var(--oracle-warning)]/10 text-[var(--oracle-warning)]' : 'bg-[var(--oracle-error)]/10 text-[var(--oracle-error)]'}`}>{log.status}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] ${log.sentiment === 'positive' ? 'bg-[var(--oracle-success)]/10 text-[var(--oracle-success)]' : log.sentiment === 'negative' ? 'bg-[var(--oracle-error)]/10 text-[var(--oracle-error)]' : 'bg-[var(--oracle-surface-2)] text-[var(--oracle-text-muted)]'}`}>{log.sentiment}</span>
                    </div>
                    <span className="text-[11px] text-[var(--oracle-text-muted)]">{formatDuration(log.duration)} · {new Date(log.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="rounded-lg bg-[var(--oracle-surface-2)] px-3 py-2 text-[11px] text-[var(--oracle-text-3)] whitespace-pre-line max-h-24 overflow-y-auto">{log.transcript}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
