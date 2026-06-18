// ═══════════════════════════════════════
// ORACLE — Forgot Password Server Actions
// ═══════════════════════════════════════

'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIp, LOGIN_RATE_LIMIT } from '@/lib/rate-limit';
import { headers } from 'next/headers';

export async function sendPasswordReset(formData: FormData) {
  const ip = getClientIp(await headers());
  const rateLimit = await checkRateLimit(`reset:${ip}`, LOGIN_RATE_LIMIT);
  if (!rateLimit.allowed) {
    redirect(
      `/auth/forgot-password?error=${encodeURIComponent(
        `Too many reset requests. Please try again in ${Math.ceil(
          (rateLimit.resetAt - Date.now()) / 60000
        )} minutes.`
      )}`
    );
  }

  const supabase = await createClient();
  const email = formData.get('email') as string;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/reset-password`,
  });

  if (error) {
    redirect(
      `/auth/forgot-password?error=${encodeURIComponent(error.message)}`
    );
  }

  // Always show success to prevent email enumeration
  redirect(
    '/auth/forgot-password?message=If an account exists with that email, you will receive a password reset link shortly.'
  );
}
