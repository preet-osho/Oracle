// ═══════════════════════════════════════
// ORACLE — Invoices API Route
// ═══════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/supabase/validate';
import { validateBody, CreateInvoiceSchema } from '@/lib/validations';
import { enforceRateLimit } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  const { supabase } = auth;
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('client_id');

    let query = supabase.from('invoices').select('*').eq('user_id', auth.user.id).order('created_at', { ascending: false });

    if (clientId) {
      query = query.eq('client_id', clientId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch invoices' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  const rl = await enforceRateLimit('invoices', auth.user.id);
  if (rl) return rl;
  const { supabase } = auth;
  try {
    const rawBody = await request.json();
    const validation = validateBody(rawBody, CreateInvoiceSchema);
    if (validation.error) return validation.error;
    const body = validation.data;

    const { data, error } = await supabase
      .from('invoices')
      .insert({
        id: body.id || crypto.randomUUID(),
        user_id: auth.user.id,
        client_id: body.clientId || body.client_id,
        client_name: body.clientName || body.client_name || '',
        items: body.items || [],
        subtotal: body.subtotal || 0,
        gst: body.gst || 0,
        total: body.total || 0,
        status: body.status || 'Draft',
        created_at: body.createdAt || body.created_at || Date.now(),
        due_at: body.dueAt || body.due_at || Date.now() + 30 * 24 * 60 * 60 * 1000,
        notes: body.notes,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create invoice' },
      { status: 500 }
    );
  }
}
