// ═══════════════════════════════════════
// ORACLE — Login / Signup Form (Client Component)
// Email + Password · Magic Link · Error Handling
// ═══════════════════════════════════════

'use client';

import React, { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { loginWithEmail, signupWithEmail, sendMagicLink } from './actions';

// ─── Loading Fallback ─────────────────
function LoginFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--oracle-bg)]">
      <div className="oracle-spinner">
        <div className="oracle-spinner-ring" />
        <span className="oracle-spinner-text">LOADING</span>
      </div>
    </div>
  );
}

// ─── Inner Component (uses useSearchParams) ──
function LoginFormInner() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const message = searchParams.get('message');

  const [mode, setMode] = useState<'login' | 'signup' | 'magic'>('login');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    // The form action handles submission — just show loading state
    // The redirect from the server action will navigate away
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--oracle-bg)] px-4">
      {/* ── Background Radial ── */}
      <div className="pointer-events-none fixed inset-0 oracle-bg-radial" aria-hidden="true" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        {/* ── Logo ── */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl oracle-gradient-bg oracle-glow">
            <span className="text-3xl">⚡</span>
          </div>
          <h1 className="oracle-gradient-text text-[28px] font-black tracking-tight">
            ORACLE
          </h1>
          <p className="mt-1 text-[13px] text-[var(--oracle-text-muted)]">
            Universal Agency Intelligence
          </p>
        </div>

        {/* ── Error/Message Banner ── */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 rounded-xl border border-[var(--oracle-error)]/30 bg-[var(--oracle-error)]/10 px-4 py-3 text-[13px] text-[var(--oracle-error)]"
          >
            {error}
          </motion.div>
        )}
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 rounded-xl border border-[var(--oracle-success)]/30 bg-[var(--oracle-success)]/10 px-4 py-3 text-[13px] text-[var(--oracle-success)]"
          >
            {message}
          </motion.div>
        )}

        {/* ── Auth Card ── */}
        <div className="oracle-glass oracle-card-shadow rounded-2xl p-6 sm:p-8">
          {/* ── Mode Tabs ── */}
          <div className="mb-6 flex rounded-xl bg-[var(--oracle-surface-2)] p-1">
            {(['login', 'signup', 'magic'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 rounded-lg py-2 text-[13px] font-medium transition-all ${
                  mode === m
                    ? 'bg-[var(--oracle-primary)] text-white shadow-sm'
                    : 'text-[var(--oracle-text-3)] hover:text-[var(--oracle-text-2)]'
                }`}
              >
                {m === 'login' ? 'Sign In' : m === 'signup' ? 'Sign Up' : 'Magic Link'}
              </button>
            ))}
          </div>

          {/* ── Email + Password Forms ── */}
          {mode !== 'magic' && (
            <form
              action={mode === 'login' ? loginWithEmail : signupWithEmail}
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-[12px] font-medium text-[var(--oracle-text-3)]"
                >
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="you@agency.com"
                  autoComplete="email"
                  className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-3 text-[14px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none transition-colors focus:border-[var(--oracle-primary)] focus:ring-1 focus:ring-[var(--oracle-primary)]/30"
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="text-[12px] font-medium text-[var(--oracle-text-3)]"
                  >
                    Password
                  </label>
                  {mode === 'login' && (
                    <Link
                      href="/auth/forgot-password"
                      className="text-[11px] text-[var(--oracle-primary-l)] hover:text-[var(--oracle-primary-xl)] transition-colors"
                    >
                      Forgot password?
                    </Link>
                  )}
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-3 text-[14px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none transition-colors focus:border-[var(--oracle-primary)] focus:ring-1 focus:ring-[var(--oracle-primary)]/30"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl oracle-gradient-bg py-3 text-[14px] font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    {mode === 'login' ? 'Signing in...' : 'Creating account...'}
                  </span>
                ) : mode === 'login' ? (
                  'Sign In'
                ) : (
                  'Create Account'
                )}
              </button>
            </form>
          )}

          {/* ── Magic Link Form ── */}
          {mode === 'magic' && (
            <form action={sendMagicLink} onSubmit={handleSubmit} className="space-y-4">
              <p className="text-[13px] text-[var(--oracle-text-3)]">
                Enter your email and we&apos;ll send you a magic link to sign in without a password.
              </p>

              <div>
                <label
                  htmlFor="magic-email"
                  className="mb-1.5 block text-[12px] font-medium text-[var(--oracle-text-3)]"
                >
                  Email
                </label>
                <input
                  id="magic-email"
                  name="email"
                  type="email"
                  required
                  placeholder="you@agency.com"
                  autoComplete="email"
                  className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-3 text-[14px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none transition-colors focus:border-[var(--oracle-primary)] focus:ring-1 focus:ring-[var(--oracle-primary)]/30"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl oracle-gradient-bg py-3 text-[14px] font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Sending magic link...
                  </span>
                ) : (
                  'Send Magic Link'
                )}
              </button>
            </form>
          )}

          {/* ── Divider ── */}
          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 border-t border-[var(--oracle-border)]" />
            <span className="text-[11px] text-[var(--oracle-text-muted)]">OR</span>
            <div className="flex-1 border-t border-[var(--oracle-border)]" />
          </div>

          {/* ── Mode Switch Hint ── */}
          <p className="text-center text-[13px] text-[var(--oracle-text-3)]">
            {mode === 'login' ? (
              <>
                Don&apos;t have an account?{' '}
                <button
                  onClick={() => setMode('signup')}
                  className="font-medium text-[var(--oracle-primary-l)] hover:text-[var(--oracle-primary-xl)] transition-colors"
                >
                  Sign up
                </button>
              </>
            ) : mode === 'signup' ? (
              <>
                Already have an account?{' '}
                <button
                  onClick={() => setMode('login')}
                  className="font-medium text-[var(--oracle-primary-l)] hover:text-[var(--oracle-primary-xl)] transition-colors"
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                Prefer a password?{' '}
                <button
                  onClick={() => setMode('login')}
                  className="font-medium text-[var(--oracle-primary-l)] hover:text-[var(--oracle-primary-xl)] transition-colors"
                >
                  Sign in with password
                </button>
              </>
            )}
          </p>
        </div>

        {/* ── Footer ── */}
        <p className="mt-6 text-center text-[11px] text-[var(--oracle-text-muted)]">
          Protected by Supabase Auth · Session-based security
        </p>
      </motion.div>
    </div>
  );
}

// ─── Exported with Suspense boundary ──
export function LoginForm() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginFormInner />
    </Suspense>
  );
}
