// ═══════════════════════════════════════
// ORACLE — Projects API Route
// ═══════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/supabase/validate';
import { validateBody, CreateProjectSchema } from '@/lib/validations';
import { writeAuditLog, AUDIT_ACTIONS } from '@/lib/audit-log';
import { enforceRateLimit } from '@/lib/rate-limit';

export async function GET() {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  const { supabase } = auth;
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  const rl = await enforceRateLimit('projects', auth.user.id);
  if (rl) return rl;
  const { supabase } = auth;
  try {
    const rawBody = await request.json();
    const validation = validateBody(rawBody, CreateProjectSchema);
    if (validation.error) return validation.error;
    const body = validation.data;

    const now = Date.now();
    const { data, error } = await supabase
      .from('projects')
      .insert({
        id: body.id || crypto.randomUUID(),
        user_id: auth.user.id,
        client_name: body.clientName || body.client_name || '',
        industry: body.industry || '',
        sector: body.sector || '',
        service: body.service || '',
        status: body.status || 'Active',
        value: body.value || '',
        deadline: body.deadline || null,
        city: body.city || '',
        notes: body.notes || '',
        requirements: body.requirements || [],
        contact_name: body.contacts?.name || body.contact_name || '',
        contact_phone: body.contacts?.phone || body.contact_phone || '',
        contact_email: body.contacts?.email || body.contact_email || '',
        tags: body.tags || [],
        total_hours: body.totalHours || body.total_hours || 0,
        invoice_total: body.invoiceTotal || body.invoice_total || 0,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) throw error;

    // Audit log (fire-and-forget)
    writeAuditLog({
      userId: auth.user.id,
      action: AUDIT_ACTIONS.CREATE,
      entityType: 'project',
      entityId: data.id,
      newValue: data,
    });

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create project' },
      { status: 500 }
    );
  }
}
