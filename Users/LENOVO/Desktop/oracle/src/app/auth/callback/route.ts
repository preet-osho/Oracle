// ═══════════════════════════════════════
// ORACLE — Auth Callback Route
// Handles magic link + OAuth redirect exchanges
// Returns HTML with OG meta tags + auto-redirect for social crawlers
// ═══════════════════════════════════════

import { createClient } from '@/lib/supabase/server';
import { buildOgRedirectPage } from '@/lib/og-redirect';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // Handle auth errors from the provider
  if (error) {
    const errorMessage = errorDescription || error;
    const dest = `${origin}/login?error=${encodeURIComponent(errorMessage)}`;
    return buildOgRedirectPage(dest, 'auth-callback');
  }

  if (code) {
    const supabase = await createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (!exchangeError) {
      // Successfully authenticated — redirect to the intended page
      const forwardedHost = request.headers.get('x-forwarded-host');
      const isLocalEnv = process.env.NODE_ENV === 'development';

      let dest: string;
      if (isLocalEnv) {
        dest = `${origin}${next}`;
      } else if (forwardedHost) {
        dest = `https://${forwardedHost}${next}`;
      } else {
        dest = `${origin}${next}`;
      }

      return buildOgRedirectPage(dest, 'auth-callback');
    }
  }

  // Fallback: redirect to login with error
  const dest = `${origin}/login?error=${encodeURIComponent('Authentication failed. Please try again.')}`;
  return buildOgRedirectPage(dest, 'auth-callback');
}
