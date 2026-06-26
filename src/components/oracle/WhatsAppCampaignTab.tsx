'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { motionVariants, transitions, buttonTapProps } from '@/styles/design-tokens';
import toast from 'react-hot-toast';
import { TOAST_DEFAULTS } from '@/lib/toast-config';
import { nanoid } from 'nanoid';

// ─── Types ─────────────────────────────

interface Campaign {
  id: string;
  name: string;
  type: 'broadcast' | 'template' | 'chatbot';
  status: 'draft' | 'scheduled' | 'sent' | 'active';
  audience: string;
  message: string;
  templateName?: string;
  scheduledAt?: number;
  sentAt?: number;
  stats: { sent: number; delivered: number; read: number; replied: number };
  createdAt: number;
}

interface ChatbotFlow {
  id: string;
  name: string;
  trigger: string;
  nodes: FlowNode[];
  isActive: boolean;
  createdAt: number;
}

interface FlowNode {
  id: string;
  type: 'message' | 'question' | 'condition' | 'action';
  content: string;
  options?: { label: string; nextNodeId: string }[];
  nextNodeId?: string;
}

interface MessageTemplate {
  id: string;
  name: string;
  category: string;
  language: string;
  body: string;
  buttons: string[];
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
}

// ─── Mock Data ─────────────────────────

const TEMPLATES_CATEGORIES = ['Marketing', 'Transactional', 'Utility', 'Authentication'];

const SAMPLE_TEMPLATES: MessageTemplate[] = [
  { id: '1', name: 'order_confirmation', category: 'Transactional', language: 'en', body: 'Hi {{1}}, your order #{{2}} of ₹{{3}} has been confirmed! 🎉 Track it here: {{4}}', buttons: ['Track Order', 'Contact Us'], status: 'approved', createdAt: Date.now() },
  { id: '2', name: 'appointment_reminder', category: 'Utility', language: 'en', body: 'Hi {{1}}, this is a reminder for your appointment on {{2}} at {{3}}. Please reply YES to confirm or NO to reschedule.', buttons: ['Confirm', 'Reschedule'], status: 'approved', createdAt: Date.now() },
  { id: '3', name: 'festival_offer', category: 'Marketing', language: 'en', body: '🎉 Happy {{1}}! Get {{2}}% OFF on all services. Limited time offer valid till {{3}}. Reply YES to know more!', buttons: ['View Offer', 'No Thanks'], status: 'pending', createdAt: Date.now() },
];

const SAMPLE_FLOWS: ChatbotFlow[] = [
  { id: '1', name: 'Lead Qualification', trigger: 'New inquiry', isActive: true, createdAt: Date.now(), nodes: [
    { id: 'n1', type: 'message', content: 'Hi! 👋 Welcome to Oracle Digital. What service are you looking for?', options: [{ label: 'Website', nextNodeId: 'n2' }, { label: 'SEO', nextNodeId: 'n2' }, { label: 'Ads', nextNodeId: 'n2' }, { label: 'Other', nextNodeId: 'n2' }] },
    { id: 'n2', type: 'question', content: 'Great choice! What\'s your monthly budget range?', options: [{ label: '₹5K-15K', nextNodeId: 'n3' }, { label: '₹15K-50K', nextNodeId: 'n3' }, { label: '₹50K+', nextNodeId: 'n3' }] },
    { id: 'n3', type: 'message', content: 'Perfect! Let me connect you with our team. Please share your name and phone number.', nextNodeId: 'n4' },
    { id: 'n4', type: 'action', content: 'Save lead to CRM and notify sales team' },
  ]},
  { id: '2', name: 'Order Status', trigger: 'Track order', isActive: true, createdAt: Date.now(), nodes: [
    { id: 'n1', type: 'question', content: 'Please share your order number (e.g., ORD-12345):', nextNodeId: 'n2' },
    { id: 'n2', type: 'action', content: 'Fetch order status from API' },
    { id: 'n3', type: 'message', content: 'Your order #{{order_id}} is: {{status}}. Expected delivery: {{date}}' },
  ]},
];

// ─── WhatsApp Campaign Tab ─────────────

export function WhatsAppCampaignTab() {
  const [activeView, setActiveView] = useState<'campaigns' | 'templates' | 'chatbot'>('campaigns');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>(SAMPLE_TEMPLATES);
  const [flows, setFlows] = useState<ChatbotFlow[]>(SAMPLE_FLOWS);
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [showNewFlow, setShowNewFlow] = useState(false);

  // New campaign form
  const [newCampaign, setNewCampaign] = useState({ name: '', type: 'broadcast' as const, audience: '', message: '' });
  // New template form
  const [newTemplate, setNewTemplate] = useState({ name: '', category: 'Marketing', body: '', buttons: '' });

  const createCampaign = useCallback(() => {
    if (!newCampaign.name.trim() || !newCampaign.message.trim()) {
      toast.error('❌ Name and message required', TOAST_DEFAULTS);
      return;
    }
    const campaign: Campaign = {
      id: nanoid(),
      name: newCampaign.name,
      type: newCampaign.type,
      status: 'draft',
      audience: newCampaign.audience || 'All contacts',
      message: newCampaign.message,
      stats: { sent: 0, delivered: 0, read: 0, replied: 0 },
      createdAt: Date.now(),
    };
    setCampaigns((prev) => [campaign, ...prev]);
    setNewCampaign({ name: '', type: 'broadcast', audience: '', message: '' });
    setShowNewCampaign(false);
    toast.success('✅ Campaign created', TOAST_DEFAULTS);
  }, [newCampaign]);

  const createTemplate = useCallback(() => {
    if (!newTemplate.name.trim() || !newTemplate.body.trim()) {
      toast.error('❌ Name and body required', TOAST_DEFAULTS);
      return;
    }
    const template: MessageTemplate = {
      id: nanoid(),
      name: newTemplate.name,
      category: newTemplate.category,
      language: 'en',
      body: newTemplate.body,
      buttons: newTemplate.buttons ? newTemplate.buttons.split(',').map((b) => b.trim()) : [],
      status: 'pending',
      createdAt: Date.now(),
    };
    setTemplates((prev) => [template, ...prev]);
    setNewTemplate({ name: '', category: 'Marketing', body: '', buttons: '' });
    setShowNewTemplate(false);
    toast.success('✅ Template created (pending Meta approval)', TOAST_DEFAULTS);
  }, [newTemplate]);

  const createFlow = useCallback(() => {
    const flow: ChatbotFlow = {
      id: nanoid(),
      name: `New Flow ${flows.length + 1}`,
      trigger: 'Manual trigger',
      isActive: false,
      createdAt: Date.now(),
      nodes: [
        { id: nanoid(), type: 'message', content: 'Hi! How can I help you today?', options: [{ label: 'Option 1', nextNodeId: '' }, { label: 'Option 2', nextNodeId: '' }] },
      ],
    };
    setFlows((prev) => [flow, ...prev]);
    toast.success('✅ Chatbot flow created', TOAST_DEFAULTS);
  }, [flows]);

  const toggleFlow = useCallback((flowId: string) => {
    setFlows((prev) => prev.map((f) => f.id === flowId ? { ...f, isActive: !f.isActive } : f));
  }, []);

  const deleteFlow = useCallback((flowId: string) => {
    setFlows((prev) => prev.filter((f) => f.id !== flowId));
    toast.success('Flow deleted', TOAST_DEFAULTS);
  }, []);

  const deleteTemplate = useCallback((templateId: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== templateId));
    toast.success('Template deleted', TOAST_DEFAULTS);
  }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-4xl">
          {/* Header */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} className="mb-6">
            <h1 className="text-[22px] font-bold text-[var(--oracle-text-1)]">📱 WhatsApp Campaign Manager</h1>
            <p className="mt-1 text-[13px] text-[var(--oracle-text-3)]">Broadcast campaigns, message templates, and chatbot flows</p>
          </motion.div>

          {/* Tab Selector */}
          <div className="mb-4 flex gap-2">
            {([
              { id: 'campaigns' as const, label: '📢 Campaigns', count: campaigns.length },
              { id: 'templates' as const, label: '📝 Templates', count: templates.length },
              { id: 'chatbot' as const, label: '🤖 Chatbot Flows', count: flows.length },
            ]).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id)}
                className={`rounded-xl border px-4 py-2 text-[12px] font-medium transition-all ${
                  activeView === tab.id
                    ? 'border-[var(--oracle-primary)] bg-[var(--oracle-primary)]/10 text-[var(--oracle-primary-l)]'
                    : 'border-[var(--oracle-border)] text-[var(--oracle-text-3)] hover:bg-[var(--oracle-card-hover)]'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>

          {/* Campaigns View */}
          {activeView === 'campaigns' && (
            <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
              <div className="mb-4 flex justify-end">
                <motion.button {...buttonTapProps} onClick={() => setShowNewCampaign(!showNewCampaign)} className="rounded-xl oracle-gradient-bg px-4 py-2 text-[12px] font-semibold text-white">
                  + New Campaign
                </motion.button>
              </div>

              <AnimatePresence>
                {showNewCampaign && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mb-4 overflow-hidden">
                    <div className="oracle-glass rounded-2xl p-5">
                      <input value={newCampaign.name} onChange={(e) => setNewCampaign((p) => ({ ...p, name: e.target.value }))} placeholder="Campaign name" className="mb-3 w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-2.5 text-[13px] text-[var(--oracle-text-1)] outline-none focus:border-[var(--oracle-primary)]" />
                      <input value={newCampaign.audience} onChange={(e) => setNewCampaign((p) => ({ ...p, audience: e.target.value }))} placeholder="Target audience (e.g., Active clients, Delhi leads)" className="mb-3 w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-2.5 text-[13px] text-[var(--oracle-text-1)] outline-none focus:border-[var(--oracle-primary)]" />
                      <textarea value={newCampaign.message} onChange={(e) => setNewCampaign((p) => ({ ...p, message: e.target.value }))} placeholder="Message content... Use {{1}}, {{2}} for variables" rows={4} className="mb-3 w-full resize-none rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-3 text-[13px] text-[var(--oracle-text-1)] outline-none focus:border-[var(--oracle-primary)]" />
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setShowNewCampaign(false)} className="rounded-lg border border-[var(--oracle-border)] px-4 py-2 text-[12px] text-[var(--oracle-text-3)]">Cancel</button>
                        <button onClick={createCampaign} className="rounded-lg oracle-gradient-bg px-4 py-2 text-[12px] font-semibold text-white">Create Campaign</button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {campaigns.length === 0 ? (
                <div className="oracle-glass rounded-2xl p-8 text-center">
                  <p className="mb-2 text-4xl">📱</p>
                  <p className="text-[15px] font-semibold text-[var(--oracle-text-2)]">No campaigns yet</p>
                  <p className="mt-1 text-[12px] text-[var(--oracle-text-muted)]">Create your first WhatsApp broadcast campaign</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {campaigns.map((c) => (
                    <div key={c.id} className="oracle-glass rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[13px] font-semibold text-[var(--oracle-text-1)]">{c.name}</p>
                          <p className="text-[11px] text-[var(--oracle-text-muted)]">Audience: {c.audience} · Created {new Date(c.createdAt).toLocaleDateString()}</p>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          c.status === 'active' ? 'bg-[var(--oracle-success)]/10 text-[var(--oracle-success)]' :
                          c.status === 'sent' ? 'bg-[var(--oracle-info)]/10 text-[var(--oracle-info)]' :
                          'bg-[var(--oracle-surface-2)] text-[var(--oracle-text-muted)]'
                        }`}>{c.status}</span>
                      </div>
                      <p className="mt-2 rounded-lg bg-[var(--oracle-surface-2)] px-3 py-2 text-[12px] text-[var(--oracle-text-3)] line-clamp-2">{c.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Templates View */}
          {activeView === 'templates' && (
            <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
              <div className="mb-4 flex justify-end">
                <motion.button {...buttonTapProps} onClick={() => setShowNewTemplate(!showNewTemplate)} className="rounded-xl oracle-gradient-bg px-4 py-2 text-[12px] font-semibold text-white">
                  + New Template
                </motion.button>
              </div>

              <AnimatePresence>
                {showNewTemplate && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mb-4 overflow-hidden">
                    <div className="oracle-glass rounded-2xl p-5">
                      <div className="mb-3 flex gap-3">
                        <input value={newTemplate.name} onChange={(e) => setNewTemplate((p) => ({ ...p, name: e.target.value }))} placeholder="Template name (e.g., order_confirm)" className="flex-1 rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-2.5 text-[13px] text-[var(--oracle-text-1)] outline-none focus:border-[var(--oracle-primary)]" />
                        <select value={newTemplate.category} onChange={(e) => setNewTemplate((p) => ({ ...p, category: e.target.value }))} className="rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[12px] text-[var(--oracle-text-2)] outline-none">
                          {TEMPLATES_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <textarea value={newTemplate.body} onChange={(e) => setNewTemplate((p) => ({ ...p, body: e.target.value }))} placeholder="Message body... Use {{1}}, {{2}} for variables" rows={4} className="mb-3 w-full resize-none rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-3 text-[13px] text-[var(--oracle-text-1)] outline-none focus:border-[var(--oracle-primary)]" />
                      <input value={newTemplate.buttons} onChange={(e) => setNewTemplate((p) => ({ ...p, buttons: e.target.value }))} placeholder="Buttons (comma-separated, e.g., Track Order, Contact Us)" className="mb-3 w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-2.5 text-[13px] text-[var(--oracle-text-1)] outline-none focus:border-[var(--oracle-primary)]" />
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setShowNewTemplate(false)} className="rounded-lg border border-[var(--oracle-border)] px-4 py-2 text-[12px] text-[var(--oracle-text-3)]">Cancel</button>
                        <button onClick={createTemplate} className="rounded-lg oracle-gradient-bg px-4 py-2 text-[12px] font-semibold text-white">Create Template</button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-3">
                {templates.map((t) => (
                  <div key={t.id} className="oracle-glass rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-semibold text-[var(--oracle-text-1)]">{t.name}</p>
                        <span className="rounded-full bg-[var(--oracle-surface-2)] px-2 py-0.5 text-[10px] text-[var(--oracle-text-muted)]">{t.category}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          t.status === 'approved' ? 'bg-[var(--oracle-success)]/10 text-[var(--oracle-success)]' :
                          t.status === 'rejected' ? 'bg-[var(--oracle-error)]/10 text-[var(--oracle-error)]' :
                          'bg-[var(--oracle-warning)]/10 text-[var(--oracle-warning)]'
                        }`}>{t.status}</span>
                      </div>
                      <button onClick={() => deleteTemplate(t.id)} className="text-[11px] text-[var(--oracle-text-muted)] hover:text-[var(--oracle-error)]">🗑</button>
                    </div>
                    <p className="mt-2 rounded-lg bg-[var(--oracle-surface-2)] px-3 py-2 text-[12px] text-[var(--oracle-text-3)]">{t.body}</p>
                    {t.buttons.length > 0 && (
                      <div className="mt-2 flex gap-2">
                        {t.buttons.map((b, i) => (
                          <span key={i} className="rounded-full border border-[var(--oracle-border)] px-2 py-0.5 text-[10px] text-[var(--oracle-text-muted)]">{b}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Chatbot Flows View */}
          {activeView === 'chatbot' && (
            <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
              <div className="mb-4 flex justify-end">
                <motion.button {...buttonTapProps} onClick={createFlow} className="rounded-xl oracle-gradient-bg px-4 py-2 text-[12px] font-semibold text-white">
                  + New Flow
                </motion.button>
              </div>

              <div className="space-y-3">
                {flows.map((flow) => (
                  <div key={flow.id} className="oracle-glass rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[13px] font-semibold text-[var(--oracle-text-1)]">{flow.name}</p>
                        <p className="text-[11px] text-[var(--oracle-text-muted)]">Trigger: {flow.trigger} · {flow.nodes.length} nodes</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleFlow(flow.id)} className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors ${flow.isActive ? 'bg-[var(--oracle-success)]/10 text-[var(--oracle-success)]' : 'bg-[var(--oracle-surface-2)] text-[var(--oracle-text-muted)]'}`}>
                          {flow.isActive ? '● Active' : '○ Inactive'}
                        </button>
                        <button onClick={() => deleteFlow(flow.id)} className="text-[11px] text-[var(--oracle-text-muted)] hover:text-[var(--oracle-error)]">🗑</button>
                      </div>
                    </div>
                    {/* Flow preview */}
                    <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
                      {flow.nodes.map((node, i) => (
                        <React.Fragment key={node.id}>
                          <div className={`shrink-0 rounded-lg border px-3 py-2 text-[10px] ${
                            node.type === 'message' ? 'border-[var(--oracle-info)]/30 bg-[var(--oracle-info)]/5 text-[var(--oracle-info)]' :
                            node.type === 'question' ? 'border-[var(--oracle-warning)]/30 bg-[var(--oracle-warning)]/5 text-[var(--oracle-warning)]' :
                            node.type === 'action' ? 'border-[var(--oracle-success)]/30 bg-[var(--oracle-success)]/5 text-[var(--oracle-success)]' :
                            'border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] text-[var(--oracle-text-muted)]'
                          }`}>
                            <span className="font-medium">{node.type === 'message' ? '💬' : node.type === 'question' ? '❓' : node.type === 'action' ? '⚡' : '🔀'}</span>
                            <span className="ml-1 max-w-[100px] truncate">{node.content}</span>
                          </div>
                          {i < flow.nodes.length - 1 && <span className="text-[var(--oracle-text-muted)]">→</span>}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
