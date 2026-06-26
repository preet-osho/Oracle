'use client';

import React, { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    document.title = 'Something Went Wrong | ORACLE';
  }, []);

  return (
    <div className="flex h-screen items-center justify-center bg-[var(--oracle-bg)]">
      <div className="oracle-glass oracle-card-shadow rounded-2xl p-8 max-w-md text-center">
        <div className="mb-4 flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-[var(--oracle-error)]/10">
          <span className="text-3xl">⚠️</span>
        </div>
        <h2 className="mb-2 text-[20px] font-bold text-[var(--oracle-text-1)]">
          Something went wrong
        </h2>
        <p className="mb-6 text-[14px] text-[var(--oracle-text-3)]">
          {error.message || 'An unexpected error occurred while loading ORACLE.'}
        </p>
        <div className="flex justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-xl oracle-gradient-bg px-6 py-2.5 text-[14px] font-semibold text-white transition-all hover:scale-105"
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="rounded-xl border border-[var(--oracle-border)] px-6 py-2.5 text-[14px] font-medium text-[var(--oracle-text-3)] hover:bg-[var(--oracle-card-hover)] transition-colors"
          >
            Reload Page
          </button>
        </div>
        {error.digest && (
          <p className="mt-4 text-[11px] font-mono text-[var(--oracle-text-muted)]">
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
