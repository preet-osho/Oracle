'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NeverStopRouter } from '@/lib/router';
import { transitions } from '@/styles/design-tokens';
import { useRouterStore } from '@/stores/router.store';
import { conversationsApi, knowledgeDocsApi, projectsApi, memoriesApi } from '@/lib/api';
import { processDocument, retrieveRelevant, chunkText, indexDocument } from '@/lib/rag';
import { sanitizeDocumentContent, sanitizeSearchResults, sanitizeExternalContext } from '@/lib/prompt-sanitizer';
import { getMemories, formatMemoryForContext } from '@/lib/memory';
import { QUALITY_SCORING_PROMPT } from '@/lib/system-prompt';
import { saveQualityScore } from '@/lib/quality';
import { runHallucinationGuard, recordLearning, loadGuardConfig } from '@/lib/hallucination-guard';
import { calculateAllCosts } from '@/lib/token-budget';
import { buildOptimizedContext, type ContextMessage } from '@/lib/context-manager';
import { estimateTokens } from '@/lib/utils';
import { exportChatToPDF, exportChatToWord } from '@/lib/export-utils';
import { formatSearchResults } from '@/lib/search';
import { csrfHeaders } from '@/lib/csrf';
import { recordTask } from '@/lib/self-training';
import { recordProviderHealth } from '@/lib/provider-health';
import { attachQualityToTraining, recordMessageFeedback } from '@/lib/feedback-bridge';
import { getAdjacentServices } from '@/lib/cross-domain-thinking';
import { recogniseTaskPatterns } from '@/lib/pattern-recognition';

import toast from 'react-hot-toast';
import { TOAST_DEFAULTS } from '@/lib/toast-config';
import { DailyUsageIndicator, useSubscriptionState } from '@/components/oracle/FeatureGate';
import { GuardStatsPanel } from '@/components/oracle/GuardStatsPanel';
import { AGENT_TYPES, AGENT_SYSTEM_PROMPTS, type AgentType, type ConversationSummary, type ProjectSummary } from '@/components/oracle/agent-config';
import { ChatHeader } from '@/components/oracle/ChatHeader';
import { ChatInputArea } from '@/components/oracle/ChatInputArea';
import { EmptyState } from '@/components/oracle/EmptyState';
import { MessageBubble, type ChatMessage } from '@/components/oracle/MessageBubble';
import type { QualityScore, KnowledgeDocument, MemoryItem, HallucinationCheckResult } from '@/types';
import { nanoid } from 'nanoid';

// ─── Chat Panel ────────────────────────

interface ChatPanelProps {
  onSidebarToggle?: () => void;
  sidebarOpen?: boolean;
  activeProjectId?: string | null;
  webSearchEnabled?: boolean;
}

export function ChatPanel({ onSidebarToggle, sidebarOpen, activeProjectId, webSearchEnabled: webSearchProp }: ChatPanelProps) {
  // Core state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [attachments, setAttachments] = useState<Array<{ name: string; content: string }>>([]);

  // Conversation state
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [conversationTitle, setConversationTitle] = useState('New Chat');

  // Agent state
  const [agentType, setAgentType] = useState<AgentType>('orchestrator');
  const [showAgentSelector, setShowAgentSelector] = useState(false);
  const [showConversationList, setShowConversationList] = useState(false);

  // Project state
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('oracle_selected_project_id');
    }
    return null;
  });
  const [showProjectSelector, setShowProjectSelector] = useState(false);

  // Context state
  const [knowledgeDocs, setKnowledgeDocs] = useState<KnowledgeDocument[]>([]);
  const [clientMemories, setClientMemories] = useState<MemoryItem[]>([]);

  // Quality state
  const [qualityScores, setQualityScores] = useState<Record<string, QualityScore>>({});

  // Hallucination guard state
  const [guardResults, setGuardResults] = useState<Record<string, HallucinationCheckResult>>({});

  // Feedback state (persisted in localStorage)
  const [feedback, setFeedback] = useState<Record<string, 'good' | 'bad'>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('oracle_message_feedback');
        return raw ? JSON.parse(raw) : {};
      } catch { return {}; }
    }
    return {};
  });

  // Cost estimation state
  const [estimatedCost, setEstimatedCost] = useState<{ inr: number; usd: number; isFree: boolean } | null>(null);

  // Web search state
  const [webSearchEnabled, setWebSearchEnabled] = useState(webSearchProp ?? false);
  const [searchContext, setSearchContext] = useState('');

  // Cross-domain suggestions state
  const [crossDomainSuggestions, setCrossDomainSuggestions] = useState<Array<{ service: string; relevance: number; rationale: string; value: string }>>([]);

  // Pattern recognition state
  const [detectedPatterns, setDetectedPatterns] = useState<Array<{ category: string; confidence: number; matchedKeywords: string[] }>>([]);

  // Drag-and-drop state
  const [isDragging, setIsDragging] = useState(false);

  // Daily usage state
  const [dailyUsage, setDailyUsage] = useState<{ used: number; limit: number } | null>(null);
  const dailyUsageRef = useRef<{ used: number; limit: number } | null>(null);
  const { plan } = useSubscriptionState();

  // Star reactions (persisted in localStorage)
  const [starredMessages, setStarredMessages] = useState<Record<string, boolean>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('oracle_starred_messages');
        return raw ? JSON.parse(raw) : {};
      } catch { return {}; }
    }
    return {};
  });

  // Refs
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Store
  const { streamingEnabled, addCost, addUsageRecord, configuredProviders } = useRouterStore();

  // ── Fetch daily usage on mount and after each message ──
  const fetchDailyUsage = useCallback(async () => {
    try {
      const res = await fetch('/api/subscription/status');
      if (res.ok) {
        const data = await res.json();
        if (data.usage) {
          const usage = { used: data.usage.used ?? 0, limit: data.usage.limit ?? -1 };
          setDailyUsage(usage);
          dailyUsageRef.current = usage;

          // Show warning toast at 80% (only once per threshold)
          if (usage.limit > 0) {
            const pct = (usage.used / usage.limit) * 100;
            const prevPct = dailyUsageRef.current
              ? (dailyUsageRef.current.used / dailyUsageRef.current.limit) * 100
              : 0;
            if (pct >= 80 && prevPct < 80) {
              toast(`⚠️ You've used ${usage.used}/${usage.limit} daily requests. Upgrade for unlimited.`, {
                duration: 6000,
                icon: '⚠️',
              });
            }
          }
        }
      }
    } catch {
      // Non-critical — fail silently
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchDailyUsage();
  }, [fetchDailyUsage]);

  // ── Load conversations on mount ──
  useEffect(() => {
    conversationsApi.list().then((rows) => {
      setConversations(rows.map((r) => ({
        id: r.id,
        title: r.title,
        agentType: r.agent_type,
        messageCount: Array.isArray(r.messages) ? r.messages.length : 0,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })));
    }).catch(() => { toast.error('❌ Failed to load conversations', TOAST_DEFAULTS); });

    knowledgeDocsApi.list().then((rows) => {
      setKnowledgeDocs(rows.map((r) => ({
        id: r.id,
        name: r.name,
        content: r.content,
        chunks: chunkText(r.content),
        source: r.source as 'upload',
        createdAt: r.created_at,
        tags: r.tags || [],
      })));
    }).catch(() => { toast.error('❌ Failed to load knowledge docs', TOAST_DEFAULTS); });

    projectsApi.list().then(async (rows) => {
      const projectList = rows.map((r) => ({
        id: r.id,
        clientName: r.client_name,
        industry: r.industry,
        service: r.service,
        status: r.status as ProjectSummary['status'],
        memoryCount: 0,
      }));
      setProjects(projectList);
      const counts = await Promise.all(
        projectList.map(async (p) => {
          try {
            const memories = await memoriesApi.list(p.id);
            return { id: p.id, count: memories.length };
          } catch (err) {
            toast.error('❌ Failed to load project memories', TOAST_DEFAULTS);
            return { id: p.id, count: 0 };
          }
        })
      );
      const updated = projectList.map((p) => {
        const found = counts.find((c) => c.id === p.id);
        return found ? { ...p, memoryCount: found.count } : p;
      });
      setProjects(updated);
      window.dispatchEvent(new CustomEvent('oracle-projects-update', { detail: { projects: updated } }));
    }).catch(() => { toast.error('❌ Failed to load projects', TOAST_DEFAULTS); });
  }, []);

  // ── Auto-scroll ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Cross-domain & pattern recognition on input change (debounced) ──
  useEffect(() => {
    if (!input.trim() || input.length < 10) {
      setCrossDomainSuggestions([]);
      setDetectedPatterns([]);
      return;
    }
    const timer = setTimeout(() => {
      const patterns = recogniseTaskPatterns(input, 3);
      setDetectedPatterns(patterns.map((p) => ({
        category: p.category,
        confidence: p.confidence,
        matchedKeywords: p.matchedKeywords,
      })));

      const serviceKeywords = ['seo', 'website', 'ads', 'social media', 'email', 'content', 'crm', 'brand', 'analytics'];
      const mentionedServices = serviceKeywords.filter((s) => input.toLowerCase().includes(s));
      if (mentionedServices.length > 0) {
        const suggestions = getAdjacentServices(mentionedServices[0], 70).slice(0, 3);
        setCrossDomainSuggestions(suggestions.map((s) => ({
          service: s.adjacentService,
          relevance: s.relevance,
          rationale: s.rationale,
          value: s.estimatedValue,
        })));
      } else {
        setCrossDomainSuggestions([]);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [input]);

  // ── Cost estimation when input changes ──
  const cheapestModelCost = useMemo(() => {
    const costs = calculateAllCosts();
    const freeModels = costs.filter((c) => c.isFree);
    const cheapestFree = freeModels.length > 0
      ? freeModels.reduce((a, b) => (a.fullRequestCostINR <= b.fullRequestCostINR ? a : b))
      : null;
    if (cheapestFree) return { inr: 0, usd: 0, isFree: true };
    const cheapest = costs.reduce((a, b) => (a.fullRequestCostINR <= b.fullRequestCostINR ? a : b));
    return { inr: cheapest.fullRequestCostINR, usd: cheapest.fullRequestCostUSD, isFree: false };
  }, []);

  useEffect(() => {
    if (!input.trim()) { setEstimatedCost(null); return; }
    if (cheapestModelCost.isFree) {
      setEstimatedCost({ inr: 0, usd: 0, isFree: true });
    } else {
      const inputTokens = estimateTokens(input);
      const ratio = inputTokens / 500;
      setEstimatedCost({
        inr: Math.round(cheapestModelCost.inr * ratio * 100) / 100,
        usd: Math.round(cheapestModelCost.usd * ratio * 10000) / 10000,
        isFree: false,
      });
    }
  }, [input, cheapestModelCost]);

  // ── Persist feedback to localStorage ──
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('oracle_message_feedback', JSON.stringify(feedback));
    }
  }, [feedback]);

  // ── Persist starred messages ──
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('oracle_starred_messages', JSON.stringify(starredMessages));
    }
  }, [starredMessages]);

  // ── Persist selected project to localStorage ──
  useEffect(() => {
    if (selectedProjectId) {
      localStorage.setItem('oracle_selected_project_id', selectedProjectId);
    } else {
      localStorage.removeItem('oracle_selected_project_id');
    }
  }, [selectedProjectId]);

  // ── Load memories when project changes ──
  const effectiveProjectId = selectedProjectId || activeProjectId;
  useEffect(() => {
    if (effectiveProjectId) {
      getMemories(effectiveProjectId).then(setClientMemories).catch(() => { toast('⚠️ Failed to load client memories', TOAST_DEFAULTS); setClientMemories([]); });
    } else {
      setClientMemories([]);
    }
    window.dispatchEvent(new CustomEvent('oracle-project-select', { detail: { projectId: effectiveProjectId } }));
  }, [effectiveProjectId]);

  // ── Load conversation ──
  const loadConversation = useCallback(async (id: string) => {
    try {
      const convo = await conversationsApi.get(id);
      setMessages(convo.messages.map((m) => ({
        ...m,
        isStreaming: false,
        agentType: (m.agentType || 'orchestrator') as AgentType,
      })));
      setActiveConversationId(id);
      setConversationTitle(convo.title);
      setAgentType((convo.agent_type as AgentType) || 'orchestrator');
      setShowConversationList(false);
      // Reset persist tracking — all loaded messages are already in the DB
      persistedCountRef.current = convo.messages.length;
    } catch {
      toast.error('❌ Failed to load conversation', TOAST_DEFAULTS);
    }
  }, []);

  // ── New conversation ──
  const newConversation = useCallback(() => {
    setMessages([]);
    setActiveConversationId(null);
    setConversationTitle('New Chat');
    setAgentType('orchestrator');
    setQualityScores({});
    setGuardResults({});
    setShowConversationList(false);
    persistedCountRef.current = 0;
  }, []);

  // ── Refresh conversation list ──
  const refreshConversations = useCallback(async () => {
    try {
      const rows = await conversationsApi.list();
      setConversations(rows.map((r) => ({
        id: r.id,
        title: r.title,
        agentType: r.agent_type,
        messageCount: Array.isArray(r.messages) ? r.messages.length : 0,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })));
    } catch {
      toast.error('❌ Failed to refresh conversations', TOAST_DEFAULTS);
    }
  }, []);

  // ── Save conversation ──
  // Track which messages have already been persisted to avoid re-sending them.
  const persistedCountRef = useRef(0);
  // When branching/regenerating, the DB state diverges from our incremental count;
  // this flag forces a full array replacement on the next save.
  const needsFullSyncRef = useRef(false);

  const saveConversation = useCallback(async (msgs: ChatMessage[], title: string, agent: string) => {
    const serializable = msgs.map((m) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: m.content,
      timestamp: m.timestamp,
      provider: m.provider,
      model: m.model,
      tokensUsed: m.tokensUsed,
      qualityScore: m.qualityScore,
      agentType: m.agentType,
    }));

    try {
      if (activeConversationId) {
        if (needsFullSyncRef.current) {
          // Branch/regenerate: DB state diverged, replace entire array
          await conversationsApi.update(activeConversationId, {
            title,
            messages: serializable,
            agent_type: agent,
          });
          needsFullSyncRef.current = false;
          persistedCountRef.current = serializable.length;
        } else {
          // Normal flow: incremental append of new messages only
          const newMsgs = serializable.slice(persistedCountRef.current);
          if (newMsgs.length > 0) {
            await conversationsApi.appendMessages(activeConversationId, newMsgs);
            persistedCountRef.current = serializable.length;
          }
        }
      } else {
        const created = await conversationsApi.create({
          title,
          messages: serializable,
          agent_type: agent,
        });
        setActiveConversationId(created.id);
        persistedCountRef.current = serializable.length;
        refreshConversations();
      }
    } catch {
      toast.error('❌ Failed to save conversation', TOAST_DEFAULTS);
    }
  }, [activeConversationId, refreshConversations]);

  // ── Build context for AI ──
  const buildAIContext = useCallback(async (userMessage: string): Promise<{ systemPrompt?: string; documents: string[]; searchUsed: boolean }> => {
    const parts: string[] = [];
    const documents: string[] = [];
    let searchUsed = false;

    if (knowledgeDocs.length > 0) {
      const relevantChunks = await retrieveRelevant(userMessage, knowledgeDocs, 3);
      if (relevantChunks.length > 0) {
        // Sanitize each chunk to prevent document-based prompt injection
        const sanitizedChunks = relevantChunks.map((chunk, i) => {
          const result = sanitizeDocumentContent(chunk, `knowledge_base_${i}`);
          return result.sanitized;
        });
        parts.push('## Knowledge Base Context\n' + sanitizedChunks.join('\n\n'));
        documents.push(...sanitizedChunks);
      }
    }

    if (clientMemories.length > 0) {
      const memoryContext = formatMemoryForContext(clientMemories);
      if (memoryContext) {
        parts.push('## Client Memory\n' + memoryContext);
      }
    }

    const agentSystemPrompt = AGENT_SYSTEM_PROMPTS[agentType];
    if (agentSystemPrompt) {
      const agentInfo = AGENT_TYPES.find((a) => a.id === agentType);
      parts.push(`## Agent Mode: ${agentInfo?.label || agentType}\n\n${agentSystemPrompt}`);
    }

    if (webSearchEnabled && userMessage.length > 5) {
      try {
        const proxyResponse = await fetch('/api/web-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
          body: JSON.stringify({ query: userMessage, provider: 'tavily', maxResults: 5 }),
        });
        if (proxyResponse.ok) {
          const data = await proxyResponse.json();
          const results = data.results || [];
          if (results.length > 0) {
            // Sanitize search results to prevent search-result-based prompt injection
            const sanitizedResults = sanitizeSearchResults(results);
            const formatted = formatSearchResults(sanitizedResults);
            parts.push('## Web Search Results\n' + formatted);
            documents.push(...sanitizedResults.map((r) => `${r.title}: ${r.snippet}`));
            setSearchContext(formatted);
            searchUsed = true;
          }
        }
      } catch {
        // Web search failed silently
      }
    } else {
      setSearchContext('');
    }

    return {
      systemPrompt: parts.length > 0 ? parts.join('\n\n') : undefined,
      documents,
      searchUsed,
    };
  }, [knowledgeDocs, clientMemories, agentType, webSearchEnabled]);

  // ── Optimize messages for context window ──
  const getOptimizedMessages = useCallback((msgs: ChatMessage[]): Array<{ role: string; content: string }> => {
    const contextMsgs: ContextMessage[] = msgs.map((m) => ({
      id: m.id, role: m.role, content: m.content, timestamp: m.timestamp,
    }));
    const managed = buildOptimizedContext(contextMsgs, { maxTokens: 8000, recentMessageCount: 10 });
    return managed.messages;
  }, []);

  // ── Export handlers ──
  const handleExportPDF = useCallback(() => {
    if (messages.length === 0) { toast.error('No messages to export', TOAST_DEFAULTS); return; }
    exportChatToPDF(messages, conversationTitle);
    toast.success('✅ PDF exported', TOAST_DEFAULTS);
  }, [messages, conversationTitle]);

  const handleExportWord = useCallback(() => {
    if (messages.length === 0) { toast.error('No messages to export', TOAST_DEFAULTS); return; }
    exportChatToWord(messages, conversationTitle);
    toast.success('✅ Word document exported', TOAST_DEFAULTS);
  }, [messages, conversationTitle]);

  // ── Star message ──
  const handleStar = useCallback((msgId: string) => {
    setStarredMessages((prev) => {
      const next = { ...prev };
      if (next[msgId]) { delete next[msgId]; } else { next[msgId] = true; }
      return next;
    });
  }, []);

  // ── Drag and drop handlers ──
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      try {
        const doc = await processDocument(file);
        indexDocument(doc).catch(() => {}); // fire-and-forget embedding indexing
        setAttachments((prev) => [...prev, { name: file.name, content: doc.content }]);
      } catch {
        toast.error(`❌ Failed to read ${file.name}`, TOAST_DEFAULTS);
      }
    }
  }, []);

  // ── Clipboard paste handler ──
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          try {
            const doc = await processDocument(file);
            indexDocument(doc).catch(() => {}); // fire-and-forget embedding indexing
            setAttachments((prev) => [...prev, { name: file.name || 'clipboard-image.png', content: doc.content }]);
            toast.success('📋 Image pasted from clipboard', TOAST_DEFAULTS);
          } catch {
            toast.error('❌ Failed to read pasted image', TOAST_DEFAULTS);
          }
        }
      }
    }
  }, []);

  // ── Record Usage ──
  const recordUsage = useCallback((provider: string, model: string, inputTokens: number, outputTokens: number, costUSD: number) => {
    const cost = NeverStopRouter.calculateCost(provider, model, inputTokens, outputTokens);
    if (costUSD > 0 || cost.inr > 0) {
      addCost(costUSD || cost.usd, cost.inr);
    }
    addUsageRecord({
      id: nanoid(),
      timestamp: Date.now(),
      provider,
      model,
      inputTokens,
      outputTokens,
      costUSD: costUSD || cost.usd,
      costINR: cost.inr,
      taskType: agentType,
    });
  }, [addCost, addUsageRecord, agentType]);

  // ── Hallucination Guard (async, non-blocking) ──
  const runGuardCheck = useCallback(async (userContent: string, aiContent: string, msgId: string, docChunks: string[]) => {
    const guardConfig = loadGuardConfig();
    if (!guardConfig.enabled) return;
    try {
      const result = await runHallucinationGuard(
        aiContent,
        userContent,
        {
          documentChunks: docChunks,
          searchResults: [],
          memory: clientMemories.map((m) => ({ content: m.content, category: m.category })),
          domain: undefined,
        },
        guardConfig,
      );
      setGuardResults((prev) => ({ ...prev, [msgId]: result }));
    } catch (err) {
      toast('⚠️ Hallucination guard check failed', TOAST_DEFAULTS);
    }
  }, [clientMemories]);

  // ── Compute average quality score ──
  useEffect(() => {
    const scores = Object.values(qualityScores);
    if (scores.length > 0) {
      const avg = Math.round(scores.reduce((s, q) => s + q.total, 0) / scores.length);
      window.dispatchEvent(new CustomEvent('oracle-quality-update', { detail: { score: avg } }));
    }
  }, [qualityScores]);

  // ── Quality Score (async, non-blocking) ──
  const scoreResponse = useCallback(async (userContent: string, aiContent: string, msgId: string) => {
    try {
      const prompt = QUALITY_SCORING_PROMPT
        .replace('{{response}}', aiContent)
        .replace('{{taskContext}}', userContent);

      const providerId = configuredProviders.length > 0 ? configuredProviders[0] : 'groq';

      const proxyResponse = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-oracle-provider-id': providerId,
          ...csrfHeaders(),
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          maxTokens: 500,
          stream: false,
        }),
      });

      if (!proxyResponse.ok) return undefined;
      const proxyResult = await proxyResponse.json();
      const text = proxyResult.text || '';

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const score = JSON.parse(jsonMatch[0]) as QualityScore;
        score.scoredAt = Date.now();
        setQualityScores((prev) => ({ ...prev, [msgId]: score }));
        saveQualityScore(score);
        return score;
      }
    } catch {
      // Quality scoring is non-critical; fail silently
    }
    return undefined;
  }, [configuredProviders]);

  // ── Send Message ──
  const handleSend = useCallback(async (overrideContent?: string) => {
    const messageText = overrideContent ?? input.trim();
    if (!messageText || isStreaming) return;

    let messageContent = messageText;
    if (!overrideContent && attachments.length > 0) {
      // Sanitize each attachment to prevent attachment-based prompt injection
      const sanitizedAttachments = attachments.map((a) => {
        const result = sanitizeExternalContext(a.content, 'attachment');
        return `[Attachment: ${a.name}]\n${result.sanitized}`;
      });
      messageContent = messageContent + '\n\n' + sanitizedAttachments.join('\n\n');
    }

    const userMessage: ChatMessage = {
      id: nanoid(),
      role: 'user',
      content: messageContent,
      timestamp: Date.now(),
      agentType,
    };

    const newMessages = [...messagesRef.current, userMessage];
    setMessages(newMessages);
    if (!overrideContent) {
      setInput('');
      setAttachments([]);
    }
    setIsStreaming(true);

    const assistantMessage: ChatMessage = {
      id: nanoid(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
      agentType,
    };

    setMessages([...newMessages, assistantMessage]);

    const title = newMessages.length <= 1
      ? userMessage.content.slice(0, 60) + (userMessage.content.length > 60 ? '...' : '')
      : conversationTitle;
    if (newMessages.length === 1) setConversationTitle(title);

    try {
      const { systemPrompt, documents, searchUsed } = await buildAIContext(userMessage.content);

      const routeMessages = getOptimizedMessages([...newMessages, assistantMessage]);
      const routeOptions = {
        messages: routeMessages,
        systemPrompt,
      };

      if (streamingEnabled) {
        let fullText = '';
        let capturedProviderId = '';
        let capturedModelId = '';
        let capturedHealth: { latencyMs: number; success: boolean } | null = null;

        const providerId = configuredProviders.length > 0 ? configuredProviders[0] : 'groq';

        const proxyResponse = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-oracle-provider-id': providerId,
            ...csrfHeaders(),
          },
          body: JSON.stringify({
            messages: routeMessages,
            systemPrompt: routeOptions.systemPrompt,
            stream: true,
          }),
        });

        if (!proxyResponse.ok) {
          const errorData = await proxyResponse.json().catch(() => ({ error: 'Proxy request failed' }));

          // Handle daily limit exceeded
          if (errorData.code === 'DAILY_LIMIT_EXCEEDED') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessage.id
                  ? { ...m, content: `📊 Daily limit reached (${errorData.used}/${errorData.limit}). Upgrade your plan for unlimited requests.`, isStreaming: false }
                  : m
              )
            );
            setIsStreaming(false);
            toast.error('🚫 Daily limit reached — Upgrade your plan for unlimited AI requests', { duration: 5000, icon: '🚫' });
            fetchDailyUsage(); // Refresh usage counter
            return;
          }

          throw new Error(errorData.error || `AI proxy error (${proxyResponse.status})`);
        }

        const reader = proxyResponse.body?.getReader();
        const decoder = new TextDecoder();
        let sseBuffer = '';

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            sseBuffer += decoder.decode(value, { stream: true });
            const lines = sseBuffer.split('\n');
            sseBuffer = lines.pop() || '';
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const data = line.slice(6).trim();
              if (data === '[DONE]') continue;
              try {
                const parsed = JSON.parse(data);
                if (parsed.error) throw new Error(parsed.error);
                if (parsed._health) {
                  capturedHealth = { latencyMs: parsed._health.latencyMs, success: parsed._health.success };
                }
                if (parsed.chunk) {
                  fullText += parsed.chunk;
                  capturedProviderId = providerId;
                  if (parsed.model) capturedModelId = parsed.model;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessage.id ? { ...m, content: fullText } : m
                    )
                  );
                }
              } catch (e) {
                if (e instanceof Error && e.message && !e.message.includes('JSON')) throw e;
              }
            }
          }
        }

        const inputTokens = estimateTokens(userMessage.content);
        const outputTokens = estimateTokens(fullText);
        const finalProvider = capturedProviderId || 'unknown';
        const finalModel = capturedModelId || 'unknown';

        const completedAssistant = {
          ...assistantMessage,
          content: fullText,
          provider: finalProvider,
          model: finalModel,
          tokensUsed: inputTokens + outputTokens,
          isStreaming: false,
          searchUsed,
        };

        setMessages((prev) =>
          prev.map((m) => m.id === assistantMessage.id ? completedAssistant : m)
        );

        recordUsage(finalProvider, finalModel, inputTokens, outputTokens, 0);

        // Record provider health (client-side, localStorage)
        recordProviderHealth({
          providerId: finalProvider,
          timestamp: Date.now(),
          latencyMs: capturedHealth?.latencyMs ?? 0,
          success: capturedHealth?.success ?? (fullText.length > 0),
          model: finalModel,
          tokensUsed: inputTokens + outputTokens,
        });

        const finalMessages = [...newMessages, completedAssistant];
        saveConversation(finalMessages, title, agentType);

        scoreResponse(userMessage.content, fullText, assistantMessage.id).then((scoredResult) => {
          if (scoredResult) attachQualityToTraining(finalProvider, finalModel, agentType, scoredResult);
        });

        runGuardCheck(userMessage.content, fullText, assistantMessage.id, documents);

        recordTask({
          taskType: agentType,
          domain: 'general',
          promptPreview: userMessage.content.slice(0, 200),
          responsePreview: fullText.slice(0, 200),
          provider: finalProvider,
          model: finalModel,
          wasSuccessful: fullText.length > 0,
          tags: [agentType, finalProvider],
        });

        // Refresh daily usage after successful request
        fetchDailyUsage();

      } else {
        const providerId = configuredProviders.length > 0 ? configuredProviders[0] : 'groq';

        const proxyResponse = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-oracle-provider-id': providerId,
            ...csrfHeaders(),
          },
          body: JSON.stringify({
            messages: routeMessages,
            systemPrompt: routeOptions.systemPrompt,
            stream: false,
          }),
        });

        if (!proxyResponse.ok) {
          const errorData = await proxyResponse.json().catch(() => ({ error: 'Proxy request failed' }));

          // Handle daily limit exceeded
          if (errorData.code === 'DAILY_LIMIT_EXCEEDED') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessage.id
                  ? { ...m, content: `📊 Daily limit reached (${errorData.used}/${errorData.limit}). Upgrade your plan for unlimited requests.`, isStreaming: false }
                  : m
              )
            );
            setIsStreaming(false);
            toast.error('🚫 Daily limit reached — Upgrade your plan for unlimited AI requests', { duration: 5000, icon: '🚫' });
            fetchDailyUsage();
            return;
          }

          throw new Error(errorData.error || `AI proxy error (${proxyResponse.status})`);
        }

        const proxyResult = await proxyResponse.json();
        const result = {
          text: proxyResult.text || '',
          provider: proxyResult.provider || providerId,
          model: proxyResult.model || providerId,
          inputTokens: proxyResult.inputTokens || 0,
          outputTokens: proxyResult.outputTokens || 0,
          costUSD: proxyResult.costUSD || 0,
        };

        const completedAssistant = {
          ...assistantMessage,
          content: result.text,
          provider: result.provider,
          model: result.model,
          tokensUsed: result.inputTokens + result.outputTokens,
          costUSD: result.costUSD,
          isStreaming: false,
          searchUsed,
        };

        setMessages((prev) =>
          prev.map((m) => m.id === assistantMessage.id ? completedAssistant : m)
        );

        recordUsage(result.provider, result.model, result.inputTokens, result.outputTokens, result.costUSD);

        // Record provider health (client-side, localStorage)
        recordProviderHealth({
          providerId: result.provider,
          timestamp: Date.now(),
          latencyMs: proxyResult._health?.latencyMs ?? 0,
          success: proxyResult._health?.success ?? (result.text.length > 0),
          model: result.model,
          tokensUsed: result.inputTokens + result.outputTokens,
        });

        const finalMessages = [...newMessages, completedAssistant];
        saveConversation(finalMessages, title, agentType);

        scoreResponse(userMessage.content, result.text, assistantMessage.id).then((scoredResult) => {
          if (scoredResult) attachQualityToTraining(result.provider, result.model, agentType, scoredResult);
        });

        runGuardCheck(userMessage.content, result.text, assistantMessage.id, documents);

        recordTask({
          taskType: agentType,
          domain: 'general',
          promptPreview: userMessage.content.slice(0, 200),
          responsePreview: result.text.slice(0, 200),
          provider: result.provider,
          model: result.model,
          wasSuccessful: result.text.length > 0,
          tags: [agentType, result.provider],
        });

        // Refresh daily usage after successful request
        fetchDailyUsage();
      }
    } catch (err) {
      // Record health on error (client-side, localStorage)
      recordProviderHealth({
        providerId: configuredProviders[0] || 'unknown',
        timestamp: Date.now(),
        latencyMs: 0,
        success: false,
        model: 'unknown',
        tokensUsed: 0,
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
      });
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessage.id
            ? { ...m, content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`, isStreaming: false }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, streamingEnabled, agentType, conversationTitle, buildAIContext, recordUsage, saveConversation, scoreResponse, runGuardCheck, attachments, getOptimizedMessages, webSearchEnabled, configuredProviders]);

  // ── Regenerate Response ──
  const handleRegenerate = useCallback((assistantMsgId: string) => {
    if (isStreaming) return;
    const msgIndex = messages.findIndex((m) => m.id === assistantMsgId);
    if (msgIndex < 0) return;
    let userMsgIndex = -1;
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') { userMsgIndex = i; break; }
    }
    if (userMsgIndex < 0) return;
    const userMessage = messages[userMsgIndex];
    const trimmedMessages = messages.slice(0, msgIndex);
    messagesRef.current = trimmedMessages;
    setMessages(trimmedMessages);
    // Mark for full sync so the trimmed DB state replaces the old array
    needsFullSyncRef.current = true;
    handleSend(userMessage.content);
  }, [messages, isStreaming, handleSend]);

  // ── Branch Conversation ──
  const handleBranch = useCallback((branchFromMsgId: string) => {
    if (isStreaming) return;
    const msgIndex = messages.findIndex((m) => m.id === branchFromMsgId);
    if (msgIndex < 0) return;
    const branchMessages = messages.slice(0, msgIndex);
    messagesRef.current = branchMessages;
    setMessages(branchMessages);
    // Mark for full sync so the branched DB state replaces the old array
    needsFullSyncRef.current = true;
    toast.success('🔀 Branched conversation — type a new message to continue from this point', TOAST_DEFAULTS);
  }, [messages, isStreaming]);

  // ── Feedback ──
  const handleFeedback = useCallback((msgId: string, type: 'good' | 'bad') => {
    setFeedback((prev) => {
      const next = { ...prev };
      if (next[msgId] === type) {
        delete next[msgId];
      } else {
        next[msgId] = type;
      }
      return next;
    });
    // Wire feedback → model performance learning
    const msg = messagesRef.current.find((m) => m.id === msgId);
    if (msg && msg.role === 'assistant' && msg.provider && msg.model) {
      recordMessageFeedback(msg.provider, msg.model, agentType, msg.qualityScore, type === 'good' ? 'good' : 'bad');
    }
  }, [agentType]);

  // ── Quick Start Card Click ──
  const handleQuickStart = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  // ── Listen for Quick Actions from Sidebar ──
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.prompt) {
        setInput(detail.prompt);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    };
    window.addEventListener('oracle-quick-action', handler);
    return () => window.removeEventListener('oracle-quick-action', handler);
  }, []);

  // ── Listen for Web Search toggle from AppShell/Sidebar ──
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail?.enabled === 'boolean') {
        setWebSearchEnabled(detail.enabled);
      }
    };
    window.addEventListener('oracle-web-search-toggle', handler);
    return () => window.removeEventListener('oracle-web-search-toggle', handler);
  }, []);

  // ── File Attachment Handler ──
  const handleFileAttach = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      try {
        const doc = await processDocument(file);
        indexDocument(doc).catch(() => {}); // fire-and-forget embedding indexing
        setAttachments((prev) => [...prev, { name: file.name, content: doc.content }]);
      } catch {
        toast.error('❌ Failed to read file', TOAST_DEFAULTS);
        const text = await file.text().catch(() => '[Could not read file]');
        setAttachments((prev) => [...prev, { name: file.name, content: text }]);
      }
    }
    e.target.value = '';
  }, []);

  return (
    <div className="flex h-full flex-col" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      {/* ── Chat Header ── */}
      <ChatHeader
        title={conversationTitle}
        agentType={agentType}
        projects={projects}
        selectedProjectId={selectedProjectId}
        showAgentSelector={showAgentSelector}
        showConversationList={showConversationList}
        showProjectSelector={showProjectSelector}
        conversations={conversations}
        onToggleAgentSelector={() => setShowAgentSelector((p) => !p)}
        onToggleConversationList={() => setShowConversationList((p) => !p)}
        onToggleProjectSelector={() => setShowProjectSelector((p) => !p)}
        onSelectAgent={(type) => { setAgentType(type); setShowAgentSelector(false); }}
        onSelectProject={(id) => { setSelectedProjectId(id); setShowProjectSelector(false); }}
        onSelectConversation={loadConversation}
        onExportPDF={handleExportPDF}
        onExportWord={handleExportWord}
        messageCount={messages.length}
        onNewChat={newConversation}
        onDeleteConversation={async (id) => {
          await conversationsApi.delete(id);
          if (activeConversationId === id) newConversation();
          refreshConversations();
        }}
      />

      {/* ── Messages Area ── */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6" role="log" aria-label="Chat messages" aria-live="polite">
        {messages.length === 0 ? (
          <EmptyState onQuickStart={handleQuickStart} />
        ) : (
          <div className="mx-auto max-w-3xl space-y-3 sm:space-y-4 md:space-y-6">
            <AnimatePresence mode="popLayout">
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  qualityScore={qualityScores[msg.id]}
                  guardResult={guardResults[msg.id]}
                  feedback={feedback[msg.id]}
                  isStarred={!!starredMessages[msg.id]}
                  onRegenerate={msg.role === 'assistant' && !isStreaming ? () => handleRegenerate(msg.id) : undefined}
                  onBranch={msg.role === 'user' && !isStreaming ? () => handleBranch(msg.id) : undefined}
                  onStar={() => handleStar(msg.id)}
                  onGood={msg.role === 'assistant' ? () => handleFeedback(msg.id, 'good') : undefined}
                  onBad={msg.role === 'assistant' ? () => handleFeedback(msg.id, 'bad') : undefined}
                />
              ))}
            </AnimatePresence>
            {/* Branded loading spinner when waiting for response */}
            {isStreaming && messages[messages.length - 1]?.content === '' && (
              <div className="flex justify-start">
                <div className="oracle-msg-agent rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="oracle-spinner" style={{ flexDirection: 'row', gap: '8px' }}>
                    <div className="oracle-spinner-ring" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                    <span className="oracle-spinner-text" style={{ fontSize: '12px' }}>Thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ── Guard Stats ── */}
      {Object.keys(guardResults).length > 0 && (
        <GuardStatsPanel guardResults={guardResults} />
      )}

      {/* ── Input Area ── */}
      <ChatInputArea
        input={input}
        setInput={setInput}
        isStreaming={isStreaming}
        agentType={agentType}
        setAgentType={setAgentType}
        attachments={attachments}
        setAttachments={setAttachments}
        estimatedCost={estimatedCost}
        detectedPatterns={detectedPatterns}
        crossDomainSuggestions={crossDomainSuggestions}
        dailyUsage={dailyUsage}
        onSend={handleSend}
        onPaste={handlePaste}
        onFileAttach={handleFileAttach}
        onSidebarToggle={onSidebarToggle}
        sidebarOpen={sidebarOpen}
      />
    </div>
  );
}
