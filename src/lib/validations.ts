// ═══════════════════════════════════════
// ORACLE — Shared Zod Validation Schemas
// Validate all API route request bodies
// ═══════════════════════════════════════

import { z } from 'zod';
import { NextResponse } from 'next/server';

// ─── Helper ─────────────────────────────

/**
 * Validate request body against a Zod schema.
 * Returns parsed data or a NextResponse with 400 error.
 */
export function validateBody<T>(
  body: unknown,
  schema: z.ZodSchema<T>
): { data: T; error?: never } | { data?: never; error: NextResponse } {
  const result = schema.safeParse(body);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    return {
      error: NextResponse.json(
        { error: `Validation failed: ${issues}` },
        { status: 400 }
      ),
    };
  }
  return { data: result.data };
}

// ─── Projects ───────────────────────────

export const CreateProjectSchema = z.object({
  id: z.string().uuid().optional(),
  clientName: z.string().max(200).optional(),
  client_name: z.string().max(200).optional(),
  industry: z.string().max(100).optional(),
  sector: z.string().max(100).optional(),
  service: z.string().max(200).optional(),
  status: z.string().max(50).optional(),
  value: z.string().max(50).optional(),
  deadline: z.string().nullable().optional(),
  city: z.string().max(100).optional(),
  notes: z.string().max(10000).optional(),
  requirements: z.array(z.string()).optional(),
  contactName: z.string().max(100).optional(),
  contact_name: z.string().max(100).optional(),
  contactPhone: z.string().max(20).optional(),
  contact_phone: z.string().max(20).optional(),
  contactEmail: z.string().email().max(200).optional(),
  contact_email: z.string().email().max(200).optional(),
  contacts: z.object({
    name: z.string().max(100).optional(),
    phone: z.string().max(20).optional(),
    email: z.string().email().max(200).optional(),
  }).optional(),
  tags: z.array(z.string()).optional(),
  totalHours: z.number().min(0).optional(),
  total_hours: z.number().min(0).optional(),
  invoiceTotal: z.number().min(0).optional(),
  invoice_total: z.number().min(0).optional(),
});

export const UpdateProjectSchema = CreateProjectSchema.partial();

// ─── Invoices ───────────────────────────

export const CreateInvoiceSchema = z.object({
  id: z.string().uuid().optional(),
  clientId: z.string().min(1).optional(),
  client_id: z.string().min(1).optional(),
  clientName: z.string().max(200).optional(),
  client_name: z.string().max(200).optional(),
  items: z.array(z.object({
    description: z.string(),
    quantity: z.number().min(0),
    rate: z.number().min(0),
    amount: z.number().min(0),
  })).optional(),
  subtotal: z.number().min(0).optional(),
  gst: z.number().min(0).optional(),
  total: z.number().min(0).optional(),
  status: z.enum(['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled']).optional(),
  createdAt: z.number().optional(),
  created_at: z.number().optional(),
  dueAt: z.number().optional(),
  due_at: z.number().optional(),
  notes: z.string().max(5000).optional(),
});

// ─── Time Entries ───────────────────────

export const CreateTimeEntrySchema = z.object({
  id: z.string().uuid().optional(),
  clientId: z.string().min(1).optional(),
  client_id: z.string().min(1).optional(),
  description: z.string().max(1000).optional(),
  hours: z.number().min(0).max(24).optional(),
  rate: z.number().min(0).optional(),
  date: z.number().optional(),
  billable: z.boolean().optional(),
});

// ─── Conversations ──────────────────────

const MessageSchema = z.object({
  id: z.string().optional(),
  role: z.enum(['user', 'assistant']),
  content: z.string().optional(),
  timestamp: z.number().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  tokensUsed: z.number().optional(),
  agentType: z.string().optional(),
  qualityScore: z.object({
    completeness: z.number(),
    specificity: z.number(),
    actionability: z.number(),
    indiaContext: z.number(),
    clientReady: z.number(),
    total: z.number(),
    notes: z.string(),
    scoredAt: z.number(),
  }).optional(),
});

export const CreateConversationSchema = z.object({
  title: z.string().max(500).optional(),
  messages: z.array(MessageSchema).optional(),
  agent_type: z.string().max(50).optional(),
  project_id: z.string().nullable().optional(),
});

export const UpdateConversationSchema = z.object({
  title: z.string().max(500).optional(),
  messages: z.array(MessageSchema).optional(),
  agent_type: z.string().max(50).optional(),
  project_id: z.string().nullable().optional(),
});

export const AppendMessagesSchema = z.object({
  messages: z.array(MessageSchema).min(1, 'At least one message required'),
});

// ─── Memories ───────────────────────────

export const CreateMemorySchema = z.object({
  id: z.string().uuid().optional(),
  clientId: z.string().min(1).optional(),
  client_id: z.string().min(1).optional(),
  content: z.string().min(1).max(5000),
  category: z.string().max(50).optional(),
  importance: z.number().int().min(1).max(3).optional(),
  createdAt: z.number().optional(),
  created_at: z.number().optional(),
});

// ─── Knowledge Docs ─────────────────────

export const CreateKnowledgeDocSchema = z.object({
  name: z.string().min(1).max(500),
  content: z.string().max(500000).optional(),
});

// ─── Proposals ──────────────────────────

export const CreateProposalSchema = z.object({
  brief: z.string().max(10000).optional(),
  domain: z.string().max(100).optional(),
  output: z.string().max(100000).optional(),
});

// ─── Custom Prompts ─────────────────────

export const CreatePromptSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(500),
  category: z.string().max(100).optional(),
  domain: z.string().max(100).optional(),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']).optional(),
  time_estimate: z.string().max(50).optional(),
  timeEstimate: z.string().max(50).optional(),
  tools: z.array(z.string()).optional(),
  description: z.string().max(5000).optional(),
  prompt: z.string().max(50000).optional(),
});

// ─── Favourites ─────────────────────────

export const CreateFavouriteSchema = z.object({
  prompt_id: z.string().min(1),
});

// ─── Leads ──────────────────────────────

export const CreateLeadSchema = z.object({
  id: z.string().uuid().optional(),
  businessName: z.string().max(200).optional(),
  business_name: z.string().max(200).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().max(200).optional(),
  website: z.string().url().max(500).optional(),
  googleMapsUrl: z.string().url().max(500).optional(),
  google_maps_url: z.string().url().max(500).optional(),
  rating: z.number().min(0).max(5).optional(),
  reviewCount: z.number().int().min(0).optional(),
  review_count: z.number().int().min(0).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  category: z.string().max(100).optional(),
  industry: z.string().max(100).optional(),
  triggerCriterion: z.string().max(500).optional(),
  trigger_criterion: z.string().max(500).optional(),
  status: z.enum(['New', 'Contacted', 'Responded', 'Hot', 'Warm', 'Cold', 'Converted', 'Lost']).optional(),
  channel: z.enum(['WhatsApp', 'Email', 'LinkedIn', 'Phone']).nullable().optional(),
  personalisedMessage: z.string().max(5000).optional(),
  personalised_message: z.string().max(5000).optional(),
  notes: z.string().max(5000).optional(),
  source: z.enum(['Google Maps', 'Website Audit', 'Funded Startup', 'Social Listening', 'Job Listing', 'Manual']).optional(),
  assignedTo: z.string().max(100).optional(),
  assigned_to: z.string().max(100).optional(),
  followUpDate: z.string().nullable().optional(),
  follow_up_date: z.string().nullable().optional(),
});

export const UpdateLeadSchema = CreateLeadSchema.omit({ id: true }).partial();

// ─── Revenue Streams ────────────────────

export const CreateRevenueStreamSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().max(200).optional(),
  type: z.enum(['Service', 'Product', 'Retainer', 'Affiliate', 'SaaS']).optional(),
  description: z.string().max(5000).optional(),
  monthlyProjection: z.number().min(0).optional(),
  monthly_projection: z.number().min(0).optional(),
  annualProjection: z.number().min(0).optional(),
  annual_projection: z.number().min(0).optional(),
  status: z.enum(['Planning', 'Building', 'Active', 'Paused']).optional(),
  margin: z.number().int().min(0).max(100).optional(),
  effort: z.enum(['Low', 'Medium', 'High']).optional(),
  timeline: z.string().max(200).optional(),
  tools: z.array(z.string()).optional(),
  notes: z.string().max(5000).optional(),
});

export const UpdateRevenueStreamSchema = CreateRevenueStreamSchema.omit({ id: true }).partial();

// ─── Razorpay ───────────────────────────

export const RazorpayOrderSchema = z.object({
  amount: z.number().positive('Amount must be a positive number (in INR).'),
  currency: z.string().length(3).optional(),
  receipt: z.string().max(40).optional(),
  notes: z.record(z.string()).optional(),
});

export const RazorpayVerifySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

// ─── Invoice Update ─────────────────────

export const UpdateInvoiceSchema = CreateInvoiceSchema.partial();

// ─── Admin Rate Limit Config ────────────

export const UpdateRateLimitConfigSchema = z.object({
  endpoint: z.string().min(1).max(100),
  maxRequests: z.number().int().min(1).max(10000).optional(),
  windowSeconds: z.number().int().min(1).max(86400).optional(),
});
