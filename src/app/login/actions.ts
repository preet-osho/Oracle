// ═══════════════════════════════════════
// ORACLE — Auth Server Actions
// Login · Signup · Logout · Magic Link
// ═══════════════════════════════════════

'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import {
  checkRateLimit,
  getClientIp,
  LOGIN_RATE_LIMIT,
  SIGNUP_RATE_LIMIT,
  MAGIC_LINK_RATE_LIMIT,
} from '@/lib/rate-limit';

// ─── Login with Email/Password ─────────

export async function loginWithEmail(formData: FormData) {
  const ip = getClientIp(await headers());
  const rateLimit = await checkRateLimit(`login:${ip}`, LOGIN_RATE_LIMIT);
  if (!rateLimit.allowed) {
    redirect(`/login?error=${encodeURIComponent(`Too many login attempts. Please try again in ${Math.ceil((rateLimit.resetAt - Date.now()) / 60000)} minutes.`)}`);
  }

  const supabase = await createClient();

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  };

  const { error } = await supabase.auth.signInWithPassword(data);

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath('/', 'layout');
  redirect('/');
}

// ─── Sign Up with Email/Password ───────

export async function signupWithEmail(formData: FormData) {
  const ip = getClientIp(await headers());
  const rateLimit = await checkRateLimit(`signup:${ip}`, SIGNUP_RATE_LIMIT);
  if (!rateLimit.allowed) {
    redirect(`/login?error=${encodeURIComponent(`Too many signup attempts. Please try again in ${Math.ceil((rateLimit.resetAt - Date.now()) / 60000)} minutes.`)}`);
  }

  const supabase = await createClient();

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  };

  const { error } = await supabase.auth.signUp(data);

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  // Show a confirmation message — user needs to verify email
  redirect('/login?message=Check your email for a verification link.');
}

// ─── Send Magic Link ───────────────────

export async function sendMagicLink(formData: FormData) {
  const ip = getClientIp(await headers());
  const rateLimit = await checkRateLimit(`magic:${ip}`, MAGIC_LINK_RATE_LIMIT);
  if (!rateLimit.allowed) {
    redirect(`/login?error=${encodeURIComponent(`Too many magic link requests. Please try again in ${Math.ceil((rateLimit.resetAt - Date.now()) / 60000)} minutes.`)}`);
  }

  const supabase = await createClient();

  const email = formData.get('email') as string;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`,
    },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect('/login?message=Check your email for the magic link.');
}

// ─── Logout ────────────────────────────

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}
