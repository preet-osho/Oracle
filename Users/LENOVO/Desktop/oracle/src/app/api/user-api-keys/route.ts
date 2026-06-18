// ═══════════════════════════════════════
// ORACLE — User API Keys API
// GET / POST — Server-side key management
// Keys are encrypted at rest, never exposed to client
// ═══════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/supabase/validate';
import { writeAuditLog, AUDIT_ACTIONS } from '@/lib/audit-log';
import { encrypt, decrypt, maskKey } from '@/lib/encryption';

// ─── GET /api/user-api-keys ─────────────
// List all keys for the authenticated user (masked)

export async function GET() {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  const { supabase } = auth;

  const { data, error } = await supabase
    .from('user_api_keys')
    .select('id, provider_id, encrypted_key, is_active, created_at, updated_at')
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Return masked keys (never expose full keys to client)
  const maskedKeys = (data || []).map((row) => {
    const decrypted = decrypt(row.encrypted_key);
    return {
      id: row.id,
      provider_id: row.provider_id,
      key_preview: maskKey(decrypted),
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  });

  return NextResponse.json(maskedKeys);
}

// ─── POST /api/user-api-keys ────────────
// Save or update an API key for a provider

export async function POST(request: NextRequest) {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  const { supabase } = auth;

  let body: { provider_id?: string; api_key?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { provider_id, api_key } = body;

  if (!provider_id || !api_key) {
    return NextResponse.json(
      { error: 'provider_id and api_key are required' },
      { status: 400 }
    );
  }

  // Validate key format (basic length check)
  if (api_key.length < 8) {
    return NextResponse.json(
      { error: 'API key appears too short' },
      { status: 400 }
    );
  }

  // Encrypt the key server-side before storage
  const encrypted_key = encrypt(api_key);
  const key_hint = maskKey(api_key);

  // Upsert: one key per provider per user
  const { data, error } = await supabase
    .from('user_api_keys')
    .upsert(
      {
        user_id: auth.user.id,
        provider_id,
        encrypted_key,
        key_hint,
        is_active: true,
        updated_at: Date.now(),
      },
      { onConflict: 'user_id,provider_id' }
    )
    .select('id, provider_id, is_active, created_at, updated_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Audit log
  writeAuditLog({
    userId: auth.user.id,
    action: AUDIT_ACTIONS.API_KEY_UPDATE,
    entityType: 'user_api_key',
    entityId: data.id,
    metadata: { provider_id, action: 'upsert' },
  });

  return NextResponse.json({
    id: data.id,
    provider_id: data.provider_id,
    key_preview: maskKey(api_key),
    is_active: data.is_active,
    created_at: data.created_at,
    updated_at: data.updated_at,
  });
}

// ─── DELETE /api/user-api-keys ──────────
// Remove an API key for a provider

export async function DELETE(request: NextRequest) {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  const { supabase } = auth;

  const { searchParams } = new URL(request.url);
  const provider_id = searchParams.get('provider_id');

  if (!provider_id) {
    return NextResponse.json(
      { error: 'provider_id is required' },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from('user_api_keys')
    .delete()
    .eq('user_id', auth.user.id)
    .eq('provider_id', provider_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  writeAuditLog({
    userId: auth.user.id,
    action: AUDIT_ACTIONS.DELETE,
    entityType: 'user_api_key',
    metadata: { provider_id },
  });

  return NextResponse.json({ success: true });
}
