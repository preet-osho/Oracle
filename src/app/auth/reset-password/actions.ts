// ═══════════════════════════════════════
// ORACLE — Reset Password Server Actions
// ═══════════════════════════════════════

'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIp, PASSWORD_UPDATE_RATE_LIMIT } from '@/lib/rate-limit';

export async function updatePassword(formData: FormData) {
  const ip = getClientIp(await headers());
  const rateLimit = await checkRateLimit(`pw-update:${ip}`, PASSWORD_UPDATE_RATE_LIMIT);
  if (!rateLimit.allowed) {
    redirect(`/auth/reset-password?error=${encodeURIComponent(`Too many password update attempts. Please try again in ${Math.ceil((rateLimit.resetAt - Date.now()) / 60000)} minutes.`)}`);
  }

  const supabase = await createClient();

  const password = formData.get('password') as string;

  if (!password || password.length < 6) {
    redirect('/auth/reset-password?error=Password must be at least 6 characters.');
  }

  const { error } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    redirect(
      `/auth/reset-password?error=${encodeURIComponent(error.message)}`
    );
  }

  revalidatePath('/', 'layout');
  redirect(
    '/login?message=Password updated successfully. Please sign in with your new password.'
  );
}
