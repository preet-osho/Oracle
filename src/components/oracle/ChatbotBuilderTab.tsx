'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {motionVariants, transitions} from '@/styles/design-tokens';
import toast from 'react-hot-toast';
import { TOAST_DEFAULTS } from '@/lib/toast-config';
import { nanoid } from 'nanoid';

// ─── Types ─────────────────────────────

interface ChatbotNode {
  id: string;
  type: 'start' | 'message' | 'question' | 'condition' | 'action' | 'end';
  label: string;
  content: string;
  options?: { label: string; targetId: string | null }[];
  targetId?: string | null;
  x: number;
  y: number;
}

interface ChatbotFlowDef {
  id: string;
  name: string;
  description: string;
  trigger: string;
  nodes: ChatbotNode[];
  isActive: boolean;
  createdAt: number;
  stats: { conversations: number; completionRate: number };
}

const NODE_TYPES = [
  { type: 'message' as const, emoji: '💬', label: 'Message', color: 'var(--oracle-info)' },
  { type: 'question' as const, emoji: '❓', label: 'Question', color: 'var(--oracle-warning)' },
  { type: 'condition' as const, emoji: '🔀', label: 'Condition', color: 'var(--oracle-violet)' },
  { type: 'action' as const, emoji: '⚡', label: 'Action', color: 'var(--oracle-success)' },
  { type: 'end' as const, emoji: '🏁', label: 'End', color: 'var(--oracle-error)' },
];

const ACTION_OPTIONS = ['Save to CRM', 'Send Email', 'Send WhatsApp', 'Create Ticket', 'Notify Team', 'Generate Invoice', 'Book Calendar'];

// ─── Sample Flows ──────────────────────

const SAMPLE_FLOWS: ChatbotFlowDef[] = [
  {
    id: '1', name: 'Lead Capture Bot', description: 'Captures leads from website and qualifies them', trigger: 'Website widget click',
    isActive: true, createdAt: Date.now(), stats: { conversations: 342, completionRate: 78 },
    nodes: [
      { id: 'n1', type: 'start', label: 'Start', content: '', x: 50, y: 20, targetId: 'n2' },
      { id: 'n2', type: 'message', label: 'Welcome', content: 'Hi! 👋 Welcome to Oracle Digital. I\'m here to help you find the right service.', x: 50, y: 80, targetId: 'n3' },
      { id: 'n3', type: 'question', label: 'Service Need', content: 'What service are you looking for?', options: [{ label: 'Website', targetId: 'n4' }, { label: 'SEO', targetId: 'n4' }, { label: 'Ads', targetId: 'n4' }, { label: 'Other', targetId: 'n4' }], x: 50, y: 160 },
      { id: 'n4', type: 'question', label: 'Budget', content: 'What\'s your monthly budget?', options: [{ label: '₹5K-15K', targetId: 'n5' }, { label: '₹15K-50K', targetId: 'n5' }, { label: '₹50K+', targetId: 'n5' }], x: 50, y: 240 },
      { id: 'n5', type: 'action', label: 'Save Lead', content: 'Save to CRM', x: 50, y: 320, targetId: 'n6' },
      { id: 'n6', type: 'message', label: 'Thank You', content: 'Thanks! Our team will contact you within 2 hours. 🎉', x: 50, y: 400, targetId: 'n7' },
      { id: 'n7', type: 'end', label: 'End', content: '', x: 50, y: 460 },
    ],
  },
];

// ─── Chatbot Builder Tab ───────────────

export function ChatbotBuilderTab() {
  const [flows, setFlows] = useState<ChatbotFlowDef[]>(SAMPLE_FLOWS);
  const [selectedFlow, setSelectedFlow] = useState<ChatbotFlowDef | null>(SAMPLE_FLOWS[0]);
  const [selectedNode, setSelectedNode] = useState<ChatbotNode | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newFlowName, setNewFlowName] = useState('');

  const createFlow = useCallback(() => {
    if (!newFlowName.trim()) { toast.error('❌ Name required', TOAST_DEFAULTS); return; }
    const flow: ChatbotFlowDef = {
      id: nanoid(), name: newFlowName, description: '', trigger: 'Manual',
      isActive: false, createdAt: Date.now(), stats: { conversations: 0, completionRate: 0 },
      nodes: [
        { id: nanoid(), type: 'start', label: 'Start', content: '', x: 50, y: 20, targetId: null },
      ],
    };
    setFlows((prev) => [flow, ...prev]);
    setSelectedFlow(flow);
    setShowCreate(false);
    setNewFlowName('');
    toast.success('✅ Flow created', TOAST_DEFAULTS);
  }, [newFlowName]);

  const addNode = useCallback((type: typeof NODE_TYPES[number]['type']) => {
    if (!selectedFlow) return;
    const newNode: ChatbotNode = {
      id: nanoid(), type, label: type.charAt(0).toUpperCase() + type.slice(1),
      content: type === 'message' ? 'Enter your message...' : type === 'question' ? 'Enter your question...' : type === 'action' ? 'Select action...' : '',
      x: 50, y: (selectedFlow.nodes.length) * 80 + 20,
      options: type === 'question' ? [{ label: 'Option 1', targetId: null }, { label: 'Option 2', targetId: null }] : undefined,
      targetId: null,
    };
    const updated = { ...selectedFlow, nodes: [...selectedFlow.nodes, newNode] };
    setSelectedFlow(updated);
    setFlows((prev) => prev.map((f) => f.id === updated.id ? updated : f));
    setSelectedNode(newNode);
  }, [selectedFlow]);

  const updateNode = useCallback((nodeId: string, updates: Partial<ChatbotNode>) => {
    if (!selectedFlow) return;
    const updatedNodes = selectedFlow.nodes.map((n) => n.id === nodeId ? { ...n, ...updates } : n);
    const updated = { ...selectedFlow, nodes: updatedNodes };
    setSelectedFlow(updated);
    setFlows((prev) => prev.map((f) => f.id === updated.id ? updated : f));
    if (selectedNode?.id === nodeId) setSelectedNode({ ...selectedNode, ...updates });
  }, [selectedFlow, selectedNode]);

  const deleteNode = useCallback((nodeId: string) => {
    if (!selectedFlow) return;
    const updatedNodes = selectedFlow.nodes.filter((n) => n.id !== nodeId);
    const updated = { ...selectedFlow, nodes: updatedNodes };
    setSelectedFlow(updated);
    setFlows((prev) => prev.map((f) => f.id === updated.id ? updated : f));
    if (selectedNode?.id === nodeId) setSelectedNode(null);
  }, [selectedFlow, selectedNode]);

  const toggleFlow = useCallback((flowId: string) => {
    setFlows((prev) => prev.map((f) => f.id === flowId ? { ...f, isActive: !f.isActive } : f));
    if (selectedFlow?.id === flowId) setSelectedFlow((p) => p ? { ...p, isActive: !p.isActive } : null);
  }, [selectedFlow]);

  const deleteFlow = useCallback((flowId: string) => {
    setFlows((prev) => prev.filter((f) => f.id !== flowId));
    if (selectedFlow?.id === flowId) { setSelectedFlow(flows[0] || null); setSelectedNode(null); }
    toast.success('Flow deleted', TOAST_DEFAULTS);
  }, [selectedFlow, flows]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-6xl">
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} className="mb-6">
            <h1 className="text-[22px] font-bold text-[var(--oracle-text-1)]">🤖 Chatbot Builder</h1>
            <p className="mt-1 text-[13px] text-[var(--oracle-text-3)]">Visual drag-and-drop builder for WhatsApp and website chatbot flows</p>
          </motion.div>

          <div className="grid grid-cols-12 gap-4" style={{ minHeight: '70vh' }}>
            {/* Left Panel - Flow List */}
            <div className="col-span-3">
              <div className="oracle-glass rounded-2xl p-4 h-full">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[13px] font-semibold text-[var(--oracle-text-1)]">Flows</h3>
                  <button onClick={() => setShowCreate(true)} className="text-[var(--oracle-primary-l)] text-[11px] font-medium hover:underline">+ New</button>
                </div>

                <AnimatePresence>
                  {showCreate && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mb-3 overflow-hidden">
                      <div className="flex gap-2">
                        <input value={newFlowName} onChange={(e) => setNewFlowName(e.target.value)} placeholder="Flow name" className="flex-1 rounded-lg border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-2 py-1.5 text-[11px] text-[var(--oracle-text-1)] outline-none focus:border-[var(--oracle-primary)]" onKeyDown={(e) => e.key === 'Enter' && createFlow()} autoFocus />
                        <button onClick={createFlow} className="rounded-lg bg-[var(--oracle-primary)] px-2 py-1 text-[10px] text-white">✓</button>
                        <button onClick={() => setShowCreate(false)} className="rounded-lg bg-[var(--oracle-surface-2)] px-2 py-1 text-[10px] text-[var(--oracle-text-muted)]">✕</button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="space-y-2">
                  {flows.map((flow) => (
                    <button key={flow.id} onClick={() => { setSelectedFlow(flow); setSelectedNode(null); }} className={`w-full rounded-xl p-3 text-left transition-all ${selectedFlow?.id === flow.id ? 'bg-[var(--oracle-primary)]/10 border border-[var(--oracle-primary)]/30' : 'hover:bg-[var(--oracle-card-hover)] border border-transparent'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[12px] font-medium text-[var(--oracle-text-2)] truncate">{flow.name}</span>
                        <span className={`h-2 w-2 rounded-full ${flow.isActive ? 'bg-[var(--oracle-success)]' : 'bg-[var(--oracle-text-muted)]'}`} />
                      </div>
                      <p className="text-[10px] text-[var(--oracle-text-muted)]">{flow.nodes.length} nodes · {flow.stats.conversations} convos</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Center Panel - Visual Flow Canvas */}
            <div className="col-span-6">
              <div className="oracle-glass rounded-2xl p-4 h-full">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[13px] font-semibold text-[var(--oracle-text-1)]">{selectedFlow?.name || 'Select a flow'}</h3>
                  {selectedFlow && (
                    <div className="flex gap-2">
                      <button onClick={() => toggleFlow(selectedFlow.id)} className={`rounded-lg px-3 py-1 text-[10px] font-medium transition-colors ${selectedFlow.isActive ? 'bg-[var(--oracle-success)]/10 text-[var(--oracle-success)]' : 'bg-[var(--oracle-surface-2)] text-[var(--oracle-text-muted)]'}`}>
                        {selectedFlow.isActive ? '● Active' : '○ Off'}
                      </button>
                      <button onClick={() => deleteFlow(selectedFlow.id)} className="text-[10px] text-[var(--oracle-text-muted)] hover:text-[var(--oracle-error)]">🗑</button>
                    </div>
                  )}
                </div>

                {selectedFlow ? (
                  <div className="relative overflow-auto rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)]/50 p-4" style={{ minHeight: '400px' }}>
                    {/* Node type palette */}
                    <div className="mb-4 flex flex-wrap gap-2">
                      {NODE_TYPES.map((nt) => (
                        <button key={nt.type} onClick={() => addNode(nt.type)} className="flex items-center gap-1.5 rounded-lg border border-[var(--oracle-border)] bg-[var(--oracle-bg)] px-2.5 py-1.5 text-[10px] font-medium text-[var(--oracle-text-3)] hover:border-[var(--oracle-border-strong)] transition-colors">
                          {nt.emoji} {nt.label}
                        </button>
                      ))}
                    </div>

                    {/* Flow nodes */}
                    <div className="space-y-2">
                      {selectedFlow.nodes.map((node, i) => {
                        const nt = NODE_TYPES.find((n) => n.type === node.type);
                        return (
                          <React.Fragment key={node.id}>
                            {i > 0 && <div className="flex justify-center py-1"><span className="text-[var(--oracle-text-muted)]">↓</span></div>}
                            <div onClick={() => setSelectedNode(node)} className={`rounded-xl border-2 p-3 cursor-pointer transition-all ${selectedNode?.id === node.id ? 'border-[var(--oracle-primary)] bg-[var(--oracle-primary)]/5' : 'border-[var(--oracle-border)] hover:border-[var(--oracle-border-strong)]'}`} style={{ borderLeftColor: nt?.color, borderLeftWidth: '3px' }}>
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <span>{nt?.emoji}</span>
                                  <span className="text-[11px] font-semibold text-[var(--oracle-text-1)]">{node.label}</span>
                                </div>
                                {node.type !== 'start' && node.type !== 'end' && (
                                  <button onClick={(e) => { e.stopPropagation(); deleteNode(node.id); }} className="text-[10px] text-[var(--oracle-text-muted)] hover:text-[var(--oracle-error)]">✕</button>
                                )}
                              </div>
                              {node.content && <p className="text-[10px] text-[var(--oracle-text-3)] line-clamp-2 ml-5">{node.content}</p>}
                              {node.options && node.options.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1 ml-5">
                                  {node.options.map((opt, oi) => (
                                    <span key={oi} className="rounded-full bg-[var(--oracle-surface-2)] px-2 py-0.5 text-[9px] text-[var(--oracle-text-muted)]">{opt.label}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-64 items-center justify-center text-[12px] text-[var(--oracle-text-muted)]">Select a flow to edit</div>
                )}
              </div>
            </div>

            {/* Right Panel - Node Editor */}
            <div className="col-span-3">
              <div className="oracle-glass rounded-2xl p-4 h-full">
                <h3 className="text-[13px] font-semibold text-[var(--oracle-text-1)] mb-3">Node Editor</h3>
                {selectedNode ? (
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-[10px] font-medium text-[var(--oracle-text-muted)]">Label</label>
                      <input value={selectedNode.label} onChange={(e) => updateNode(selectedNode.id, { label: e.target.value })} className="w-full rounded-lg border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2 text-[11px] text-[var(--oracle-text-1)] outline-none focus:border-[var(--oracle-primary)]" />
                    </div>
                    {selectedNode.type !== 'start' && selectedNode.type !== 'end' && (
                      <div>
                        <label className="mb-1 block text-[10px] font-medium text-[var(--oracle-text-muted)]">Content</label>
                        <textarea value={selectedNode.content} onChange={(e) => updateNode(selectedNode.id, { content: e.target.value })} rows={4} className="w-full resize-none rounded-lg border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2 text-[11px] text-[var(--oracle-text-1)] outline-none focus:border-[var(--oracle-primary)]" />
                      </div>
                    )}
                    {selectedNode.type === 'question' && selectedNode.options && (
                      <div>
                        <label className="mb-1 block text-[10px] font-medium text-[var(--oracle-text-muted)]">Options</label>
                        <div className="space-y-1.5">
                          {selectedNode.options.map((opt, oi) => (
                            <div key={oi} className="flex gap-1.5">
                              <input value={opt.label} onChange={(e) => {
                                const newOpts = [...(selectedNode.options || [])];
                                newOpts[oi] = { ...newOpts[oi], label: e.target.value };
                                updateNode(selectedNode.id, { options: newOpts });
                              }} className="flex-1 rounded-lg border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-2 py-1.5 text-[10px] text-[var(--oracle-text-1)] outline-none" />
                              <button onClick={() => {
                                const newOpts = selectedNode.options?.filter((_, i) => i !== oi) || [];
                                updateNode(selectedNode.id, { options: newOpts });
                              }} className="text-[10px] text-[var(--oracle-text-muted)] hover:text-[var(--oracle-error)]">✕</button>
                            </div>
                          ))}
                          <button onClick={() => {
                            const newOpts = [...(selectedNode.options || []), { label: `Option ${(selectedNode.options?.length || 0) + 1}`, targetId: null }];
                            updateNode(selectedNode.id, { options: newOpts });
                          }} className="text-[10px] text-[var(--oracle-primary-l)] hover:underline">+ Add option</button>
                        </div>
                      </div>
                    )}
                    {selectedNode.type === 'action' && (
                      <div>
                        <label className="mb-1 block text-[10px] font-medium text-[var(--oracle-text-muted)]">Action</label>
                        <select value={selectedNode.content} onChange={(e) => updateNode(selectedNode.id, { content: e.target.value })} className="w-full rounded-lg border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-2 py-2 text-[11px] text-[var(--oracle-text-2)] outline-none">
                          <option value="">Select action...</option>
                          {ACTION_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-[var(--oracle-text-muted)]">Click a node to edit it</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
