// ═══════════════════════════════════════
// ORACLE — Complete TypeScript Types
// ═══════════════════════════════════════

import type { AgentName } from '@/lib/agents/registry';

// ─── AI Providers ──────────────────────

export interface ModelProvider {
  id: string;
  name: string;
  models: ModelOption[];
  baseUrl: string;
  keyFormat: string;
  keyLabel: string;
  docsUrl: string;
  signupUrl: string;
  freeLimit?: string;
  color: string;
  logo?: string;
  supportsStreaming: boolean;
  supportsMCP: boolean;
  costPer1kTokens?: {
    input: number;
    output: number;
    currency: 'USD' | 'INR';
  };
}

export interface ModelOption {
  id: string;
  name: string;
  contextWindow: number;
  bestFor: string[];
  isFree: boolean;
  costPer1k?: {
    input: number;
    output: number;
  };
}

export interface SelectedModel {
  providerId: string;
  modelId: string;
}

// ─── Messages ──────────────────────────

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  provider?: string;
  model?: string;
  toolsUsed?: string[];
  qualityScore?: QualityScore;
  tokensUsed?: number;
  costUSD?: number;
  costINR?: number;
  isStreaming?: boolean;
  attachments?: Attachment[];
  agentType?: AgentName;
}

export interface Attachment {
  id: string;
  name: string;
  type: 'pdf' | 'docx' | 'xlsx' | 'image' | 'text';
  content: string;
  size: number;
}

// ─── Quality ───────────────────────────

export interface QualityScore {
  completeness: number;
  specificity: number;
  actionability: number;
  indiaContext: number;
  clientReady: number;
  total: number;
  notes: string;
  scoredAt: number;
}

// ─── RAG / Knowledge ───────────────────

export interface KnowledgeDocument {
  id: string;
  name: string;
  content: string;
  chunks: string[];
  source: 'upload' | 'web' | 'manual';
  clientId?: string;
  createdAt: number;
  tags: string[];
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
}

// ─── Agent Memory ──────────────────────

export interface AgentMemory {
  clientId: string;
  memories: MemoryItem[];
}

export interface MemoryItem {
  id: string;
  content: string;
  category: 'preference' | 'fact' | 'feedback' | 'decision' | 'contact';
  importance: 1 | 2 | 3;
  createdAt: number;
}

// ─── Projects ──────────────────────────

export interface ClientProject {
  id: string;
  clientName: string;
  industry: string;
  sector: string;
  service: string;
  status: 'Active' | 'Paused' | 'Complete' | 'On Hold' | 'Prospect';
  value: string;
  deadline?: string;
  city: string;
  notes: string;
  requirements: string[];
  contacts: {
    name: string;
    phone: string;
    email: string;
  };
  tags: string[];
  totalHours?: number;
  invoiceTotal?: number;
  createdAt: number;
  updatedAt: number;
  memories?: MemoryItem[];
}

// ─── Time Tracking ─────────────────────

export interface TimeEntry {
  id: string;
  clientId: string;
  description: string;
  hours: number;
  rate: number;
  date: number;
  billable: boolean;
}

// ─── Invoice ───────────────────────────

export interface Invoice {
  id: string;
  clientId: string;
  clientName: string;
  items: InvoiceItem[];
  subtotal: number;
  gst: number;
  total: number;
  status: 'Draft' | 'Sent' | 'Paid' | 'Overdue';
  createdAt: number;
  dueAt: number;
  notes?: string;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

// ─── Prompts ───────────────────────────

export interface PromptItem {
  id: string;
  title: string;
  category: string;
  domain: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  timeEstimate: string;
  tools: string[];
  description: string;
  prompt: string;
  claudeCodeCmd?: string;
  userRating?: number;
  useCount?: number;
  lastUsed?: number;
}

// ─── Workflows ─────────────────────────

export interface Workflow {
  id: string;
  name: string;
  description: string;
  color: string;
  estimatedTime: string;
  domains: string[];
  steps: WorkflowStep[];
}

export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  prompt: string;
  agentType?: string;
  mcpTools?: string[];
  webSearch?: boolean;
  maxTokens?: number;
}

// ─── Cost Tracking ─────────────────────

export interface UsageRecord {
  id: string;
  timestamp: number;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUSD: number;
  costINR: number;
  taskType: string;
}

// ─── Agency Domains ────────────────────

export interface AgencyDomain {
  id: string;
  name: string;
  emoji: string;
  color: string;
  category: 'Digital Marketing' | 'Development' | 'Content' | 'Finance' | 'Industry Vertical' | 'Operations';
  completeMeans: string;
  requiredInfo: string[];
  expertApproach: string[];
  blunders: string[];
  freeTools: string[];
  typicalINRPrice: {
    setup: string;
    monthly?: string;
  };
  claudeCodeUse: boolean;
}

// ─── Prompt Versioning ─────────────────

export interface PromptVersion {
  id: string;
  name: string;
  description: string;
  content: string;
  hash: string;
  createdAt: number;
  tags: string[];
}

export interface PromptABTest {
  id: string;
  name: string;
  versions: string[]; // PromptVersion IDs
  trafficSplit: number[]; // Percentage per version (must sum to 100)
  isActive: boolean;
  createdAt: number;
  results: {
    versionId: string;
    requestCount: number;
    avgQualityScore: number;
    avgCostUSD: number;
  }[];
}

export interface PromptVersionLog {
  id: string;
  versionId: string;
  testId?: string;
  timestamp: number;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUSD: number;
  qualityScore?: number;
}

// ─── Test Cases ────────────────────────

export interface TestCase {
  id: string;
  clientName: string;
  industry: string;
  city: string;
  contact: {
    name: string;
    phone: string;
    email: string;
    designation: string;
  };
  brief: string;
  requirements: string[];
  suggestedPrompts: string[];
  testQuestions: string[];
}

// ─── Conversations ───────────────────

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  provider?: string;
  model?: string;
  tokensUsed?: number;
  qualityScore?: QualityScore;
  agentType?: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  agentType: string;
  messageCount: number;
  createdAt: number;
  updatedAt: number;
}

// ─── Multi-Agent Orchestration ───────
export type {
  AgentStatus,
  AgentTask,
  WorkflowDefinition,
  WorkflowTaskDef,
  OrchestrationConfig,
  OrchestrationResult,
  StreamingChunk,
  StreamingOptions,
} from '@/lib/agents/orchestration-engine';

// ─── MCP Servers ─────────────────────
export type {
  MCPTool,
  MCPHealthStatus,
  MCPHealthCheckResult,
  MCPServerDefinition,
  MCPToolCall,
  MCPToolResult,
} from '@/lib/agents/mcp-servers';

// ─── Memory System ───────────────────
// Note: 'MemoryItem' is also defined locally for per-client memory (simpler shape).
// The agent system version with agentId/tags/embedding lives in memory-system.ts.
export type {
  MemoryCategory,
  MemoryImportance,
  MemorySearchResult,
  MemoryStats,
  ShortTermMemory,
} from '@/lib/agents/memory-system';
export type { MemoryItem as AgentMemoryItem } from '@/lib/agents/memory-system';

// ─── Learning Loop ───────────────────
export type {
  TaskOutcome,
  TaskScores,
  LearningEntry,
  Reflection,
  ToolPerformance,
  MistakeReport,
  SuccessReport,
  OptimizationPlan,
} from '@/lib/agents/learning-loop';

// ─── Evaluation Framework ────────────
export type {
  EvaluationDimension,
  EvaluationResult,
  EvaluationFlag,
  EvaluationConfig,
} from '@/lib/agents/evaluation-framework';

// ─── Failure Detection ───────────────
export type {
  FailureType,
  FailureSeverity,
  FailureDetection,
  RecoveryAction,
  FailureReport,
} from '@/lib/agents/failure-detection';

// ─── Hallucination Guard ──────────────

export interface HallucinationCheckResult {
  /** Overall confidence score (0-100) */
  confidence: number;
  /** Whether the output passes the quality gate */
  passed: boolean;
  /** Whether output should be flagged for user review */
  flagged: boolean;
  /** Individual check results */
  checks: ValidationCheck[];
  /** Detected hallucination patterns */
  hallucinationPatterns: HallucinationPattern[];
  /** Grounded claims (verified against context) */
  groundedClaims: GroundedClaim[];
  /** Ungrounded claims (not verified) */
  ungroundedClaims: UngroundedClaim[];
  /** Self-verification notes from the AI */
  selfVerification: SelfVerification | null;
  /** Overall assessment */
  assessment: string;
  /** Suggested actions for the user */
  suggestions: string[];
  /** Timestamp */
  checkedAt: number;
  /** Model used for verification */
  verificationModel: string;
}

export interface ValidationCheck {
  name: string;
  passed: boolean;
  score: number; // 0-100
  message: string;
  details?: string;
}

export interface HallucinationPattern {
  type: 'unsupported_claim' | 'vague_quantification' | 'contradiction' | 'outdated_info' | 'fabricated_source' | 'overconfident_statement' | 'missing_caveat' | 'inconsistent_data';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  location: string; // snippet where pattern was found
  suggestion: string;
}

export interface GroundedClaim {
  claim: string;
  source: string;
  confidence: number; // 0-100
  sourceType: 'context' | 'web_search' | 'memory' | 'knowledge_doc';
}

export interface UngroundedClaim {
  claim: string;
  confidence: number; // 0-100
  reason: string;
  suggestion: string;
}

export interface SelfVerification {
  passed: boolean;
  issuesFound: string[];
  correctionsApplied: string[];
  confidence: number;
  notes: string;
}

export interface ConfidenceThreshold {
  /** Minimum confidence to pass without flagging */
  passThreshold: number; // default 70
  /** Minimum confidence to pass with warning flag */
  warnThreshold: number; // default 50
  /** Below this threshold, output is blocked */
  blockThreshold: number; // default 30
}



export interface GuardConfig {
  enabled: boolean;
  thresholds: ConfidenceThreshold;
  /** Maximum retries for auto-fix */
  maxRetries: number;
  /** Whether to enable self-verification */
  selfVerification: boolean;
  /** Whether to enable fact grounding */
  factGrounding: boolean;
  /** Whether to enable pattern detection */
  patternDetection: boolean;
  /** Domains where stricter checking is needed */
  strictDomains: string[];
}

// ─── Leads ────────────────────────────

export interface Lead {
  id: string;
  businessName: string;
  phone: string;
  email: string;
  website: string;
  googleMapsUrl: string;
  rating: number;
  reviewCount: number;
  address: string;
  city: string;
  category: string;
  industry: string;
  triggerCriterion: string;
  status: 'New' | 'Contacted' | 'Responded' | 'Hot' | 'Warm' | 'Cold' | 'Converted' | 'Lost';
  channel?: 'WhatsApp' | 'Email' | 'LinkedIn' | 'Phone';
  personalisedMessage?: string;
  notes: string;
  source: 'Google Maps' | 'Website Audit' | 'Funded Startup' | 'Social Listening' | 'Job Listing' | 'Manual';
  assignedTo?: string;
  followUpDate?: string;
  createdAt: number;
  updatedAt: number;
}

export interface LeadGenerationConfig {
  id: string;
  name: string;
  type: 'Google Maps' | 'Website Audit' | 'Funded Startup' | 'Social Listening' | 'Job Listing';
  city: string;
  industry: string;
  categories: string[];
  status: 'Configured' | 'Running' | 'Completed' | 'Paused';
  leadsFound: number;
  createdAt: number;
  lastRunAt?: number;
}

export interface FollowUpEntry {
  id: string;
  leadId: string;
  leadName: string;
  company: string;
  channel: 'WhatsApp' | 'Email' | 'LinkedIn' | 'Phone';
  message: string;
  status: 'Pending' | 'Sent' | 'Replied' | 'No Response';
  scheduledDate: number;
  sentDate?: number;
  replyDate?: number;
  createdAt: number;
}

// ─── Business Operations ──────────────

export interface RevenueStream {
  id: string;
  name: string;
  type: 'Service' | 'Product' | 'Retainer' | 'Affiliate' | 'SaaS';
  description: string;
  monthlyProjection: number;
  annualProjection: number;
  status: 'Planning' | 'Building' | 'Active' | 'Paused';
  margin: number;
  effort: 'Low' | 'Medium' | 'High';
  timeline: string;
  tools: string[];
  notes: string;
  createdAt: number;
}

export interface Routine {
  id: string;
  name: string;
  day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday' | 'Weekly' | 'Monthly';
  time: string;
  tasks: RoutineTask[];
  isActive: boolean;
  lastCompletedAt?: number;
  createdAt: number;
}

export interface RoutineTask {
  id: string;
  name: string;
  description: string;
  prompt?: string;
  estimatedMinutes: number;
  isCompleted: boolean;
  completedAt?: number;
}
