// ═══════════════════════════════════════
// ORACLE — Email Verification Confirm Route
// Handles token_hash verification from Supabase signup emails
// Returns HTML with OG meta tags + auto-redirect for social crawlers
// ═══════════════════════════════════════

import { type EmailOtpType } from '@supabase/supabase-js';
import { type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIp, EMAIL_VERIFY_RATE_LIMIT } from '@/lib/rate-limit';
import { buildOgRedirectPage } from '@/lib/og-redirect';

export async function GET(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rateLimit = await checkRateLimit(`email-verify:${ip}`, EMAIL_VERIFY_RATE_LIMIT);

  if (!rateLimit.allowed) {
    const dest = `${new URL(request.url).origin}/login?error=${encodeURIComponent(
      `Too many verification attempts. Please try again in ${Math.ceil((rateLimit.resetAt - Date.now()) / 60000)} minutes.`
    )}`;
    return buildOgRedirectPage(dest, 'auth-confirm');
  }

  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next') ?? '/';
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // Handle errors from Supabase (e.g., expired link)
  if (error) {
    const errorMessage = errorDescription || error;
    const dest = `${origin}/login?error=${encodeURIComponent(errorMessage)}`;
    return buildOgRedirectPage(dest, 'auth-confirm');
  }

  // Verify the token hash
  if (tokenHash && type) {
    const supabase = await createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });

    if (!verifyError) {
      // Email verified successfully — redirect to the intended page
      const forwardedHost = request.headers.get('x-forwarded-host');
      const isLocalEnv = process.env.NODE_ENV === 'development';
      const base = isLocalEnv
        ? origin
        : forwardedHost
        ? `https://${forwardedHost}`
        : origin;

      const dest = `${base}${next}`;
      return buildOgRedirectPage(dest, 'auth-confirm');
    }
  }

  // Fallback: verification failed
  const dest = `${origin}/login?error=${encodeURIComponent(
    'Email verification failed. The link may have expired or already been used. Please try signing up again.'
  )}`;
  return buildOgRedirectPage(dest, 'auth-confirm');
}
