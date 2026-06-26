// ═══════════════════════════════════════
// ORACLE — Invoice by ID API
// GET / PUT / DELETE a single invoice (user-scoped)
// ═══════════════════════════════════════

import { NextRequest } from 'next/server';
import { validateAuth } from '@/lib/supabase/validate';
import { validateBody, UpdateInvoiceSchema } from '@/lib/validations';
import { writeAuditLog, AUDIT_ACTIONS } from '@/lib/audit-log';
import { enforceRateLimit } from '@/lib/rate-limit';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ─── GET /api/invoices/[id] ──────────

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  if (!auth.org) return Response.json({ error: "No organization found. Create or join an organization first." }, { status: 400 });

  const { id } = await params;
  const { supabase } = auth;

  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .eq('org_id', auth.org.orgId)
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: error.code === 'PGRST116' ? 404 : 500 });
  }

  return Response.json(data);
}

// ─── PUT /api/invoices/[id] ──────────

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  if (!auth.org) return Response.json({ error: "No organization found. Create or join an organization first." }, { status: 400 });
  const rl = await enforceRateLimit('invoices', auth.user.id);
  if (rl) return rl;

  const { id } = await params;
  const { supabase } = auth;

  const rawBody = await request.json();
  const validation = validateBody(rawBody, UpdateInvoiceSchema);
  if (validation.error) return validation.error;
  const body = validation.data;

  const updateData: Record<string, unknown> = { updated_at: Date.now() };
  if (body.clientId !== undefined || body.client_id !== undefined) updateData.client_id = body.clientId || body.client_id;
  if (body.clientName !== undefined || body.client_name !== undefined) updateData.client_name = body.clientName || body.client_name;
  if (body.items !== undefined) updateData.items = body.items;
  if (body.subtotal !== undefined) updateData.subtotal = body.subtotal;
  if (body.gst !== undefined) updateData.gst = body.gst;
  if (body.total !== undefined) updateData.total = body.total;
  if (body.status !== undefined) updateData.status = body.status;
  if (body.dueAt !== undefined || body.due_at !== undefined) updateData.due_at = body.dueAt || body.due_at;
  if (body.notes !== undefined) updateData.notes = body.notes;

  const { data, error } = await supabase
    .from('invoices')
    .update(updateData)
    .eq('id', id)
    .eq('org_id', auth.org.orgId)
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  writeAuditLog({
    userId: auth.user.id,
    action: AUDIT_ACTIONS.UPDATE,
    entityType: 'invoice',
    entityId: id,
    newValue: body,
  });

  return Response.json(data);
}

// ─── DELETE /api/invoices/[id] ───────

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  if (!auth.org) return Response.json({ error: "No organization found. Create or join an organization first." }, { status: 400 });
  const rl = await enforceRateLimit('invoices', auth.user.id);
  if (rl) return rl;

  const { id } = await params;
  const { supabase } = auth;

  const { error } = await supabase
    .from('invoices')
    .delete()
    .eq('id', id)
    .eq('org_id', auth.org.orgId);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  writeAuditLog({
    userId: auth.user.id,
    action: AUDIT_ACTIONS.DELETE,
    entityType: 'invoice',
    entityId: id,
  });

  return Response.json({ success: true });
}