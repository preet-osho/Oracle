// ═══════════════════════════════════════
// ORACLE — Forgot Password Form (Client Component)
// Enter email to receive a password reset link
// ═══════════════════════════════════════

'use client';

import React, { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { sendPasswordReset } from './actions';

function ForgotPasswordContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const message = searchParams.get('message');
  const [loading, setLoading] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--oracle-bg)] px-4">
      <div className="pointer-events-none fixed inset-0 oracle-bg-radial" aria-hidden="true" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl oracle-gradient-bg oracle-glow">
            <span className="text-3xl">🔑</span>
          </div>
          <h1 className="oracle-gradient-text text-[28px] font-black tracking-tight">
            Reset Password
          </h1>
          <p className="mt-1 text-[13px] text-[var(--oracle-text-muted)]">
            Enter your email and we&apos;ll send you a reset link
          </p>
        </div>

        {/* Status banners */}
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

        {/* Card */}
        <div className="oracle-glass oracle-card-shadow rounded-2xl p-6 sm:p-8">
          <form
            action={sendPasswordReset}
            onSubmit={() => setLoading(true)}
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

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl oracle-gradient-bg py-3 text-[14px] font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Sending reset link...
                </span>
              ) : (
                'Send Reset Link'
              )}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 border-t border-[var(--oracle-border)]" />
            <span className="text-[11px] text-[var(--oracle-text-muted)]">OR</span>
            <div className="flex-1 border-t border-[var(--oracle-border)]" />
          </div>

          <p className="text-center text-[13px] text-[var(--oracle-text-3)]">
            Remember your password?{' '}
            <Link
              href="/login"
              className="font-medium text-[var(--oracle-primary-l)] hover:text-[var(--oracle-primary-xl)] transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>

        <p className="mt-6 text-center text-[11px] text-[var(--oracle-text-muted)]">
          Protected by Supabase Auth · Session-based security
        </p>
      </motion.div>
    </div>
  );
}

function ForgotPasswordFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--oracle-bg)]">
      <div className="oracle-spinner">
        <div className="oracle-spinner-ring" />
        <span className="oracle-spinner-text">LOADING</span>
      </div>
    </div>
  );
}

export function ForgotPasswordForm() {
  return (
    <Suspense fallback={<ForgotPasswordFallback />}>
      <ForgotPasswordContent />
    </Suspense>
  );
}
