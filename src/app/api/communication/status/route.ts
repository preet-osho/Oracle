// ═══════════════════════════════════════
// ORACLE — Communication Channel Status
// GET /api/communication/status
// Check which channels are configured
// ═══════════════════════════════════════

import { NextResponse } from 'next/server';
import { validateAuth } from '@/lib/supabase/validate';
import { getChannelStatus } from '@/lib/communication/hub';
import { DEFAULT_TEMPLATES, getTemplatesByChannel } from '@/lib/communication/templates';

export async function GET() {
  // Auth
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;

  const channels = getChannelStatus();

  return NextResponse.json({
    channels,
    templates: {
      total: DEFAULT_TEMPLATES.length,
      whatsapp: getTemplatesByChannel('whatsapp').length,
      email: getTemplatesByChannel('email').length,
    },
    envVars: {
      whatsapp: {
        WHATSAPP_PHONE_NUMBER_ID: !!process.env.WHATSAPP_PHONE_NUMBER_ID,
        WHATSAPP_ACCESS_TOKEN: !!process.env.WHATSAPP_ACCESS_TOKEN,
        WHATSAPP_WABA_ID: !!process.env.WHATSAPP_WABA_ID,
        WHATSAPP_VERIFY_TOKEN: !!process.env.WHATSAPP_VERIFY_TOKEN,
        WHATSAPP_APP_SECRET: !!process.env.WHATSAPP_APP_SECRET,
      },
      email: {
        RESEND_API_KEY: !!process.env.RESEND_API_KEY,
        EMAIL_FROM_ADDRESS: !!process.env.EMAIL_FROM_ADDRESS,
        EMAIL_FROM_NAME: !!process.env.EMAIL_FROM_NAME,
      },
    },
  });
}
