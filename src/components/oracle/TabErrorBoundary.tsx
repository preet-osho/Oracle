'use client';

import React from 'react';

interface TabErrorBoundaryProps {
  tabName: string;
  children: React.ReactNode;
}

interface TabErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

const MAX_RETRIES = 3;

/**
 * Error boundary that catches rendering errors in lazy-loaded tab components
 * and displays a fallback UI instead of crashing the entire app.
 */
export class TabErrorBoundary extends React.Component<TabErrorBoundaryProps, TabErrorBoundaryState> {
  constructor(props: TabErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<TabErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error(`[TabErrorBoundary] ${this.props.tabName} crashed:`, error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState((prev) => ({ hasError: false, error: null, retryCount: prev.retryCount + 1 }));
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex h-full items-center justify-center">
          <div className="oracle-glass oracle-card-shadow rounded-2xl p-8 max-w-md text-center">
            <div className="mb-4 flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-[var(--oracle-error)]/10">
              <span className="text-2xl">⚠️</span>
            </div>
            <h3 className="mb-2 text-[16px] font-bold text-[var(--oracle-text-1)]">
              {this.props.tabName} failed to load
            </h3>
            <p className="mb-5 text-[13px] text-[var(--oracle-text-3)] leading-relaxed">
              {this.state.error?.message || 'An unexpected error occurred while loading this section.'}
            </p>
            <div className="flex justify-center gap-3">
              {this.state.retryCount < MAX_RETRIES ? (
                <button
                  onClick={this.handleRetry}
                  className="rounded-xl oracle-gradient-bg px-5 py-2 text-[13px] font-semibold text-white transition-all hover:scale-105"
                >
                  Try Again ({this.state.retryCount + 1}/{MAX_RETRIES})
                </button>
              ) : (
                <span className="rounded-xl bg-[var(--oracle-surface-2)] px-5 py-2 text-[13px] font-medium text-[var(--oracle-text-muted)]">
                  Max retries reached
                </span>
              )}
              <button
                onClick={() => window.location.reload()}
                className="rounded-xl border border-[var(--oracle-border)] px-5 py-2 text-[13px] font-medium text-[var(--oracle-text-3)] hover:bg-[var(--oracle-card-hover)] transition-colors"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
