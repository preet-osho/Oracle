'use client';

import React from 'react';
import type { Components } from 'react-markdown';

// ─── Markdown Components ─────────────
// Custom ReactMarkdown component renderers for chat message rendering

export const mdComponents: Components = {
  code: ({ className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className || '');
    const isInline = !match;
    return isInline ? (
      <code className="rounded bg-[var(--oracle-surface-2)] px-1.5 py-0.5 text-[12px] font-mono text-[var(--oracle-primary-l)]" {...props}>
        {children}
      </code>
    ) : (
      <div className="relative my-2 overflow-hidden rounded-xl border border-[var(--oracle-border)]">
        <div className="flex items-center justify-between bg-[var(--oracle-surface-2)] px-3 py-1.5">
          <span className="text-[10px] font-medium text-[var(--oracle-text-muted)]">{match[1]}</span>
          <button
            onClick={() => { navigator.clipboard.writeText(String(children).replace(/\n$/, '')); }}
            className="text-[10px] text-[var(--oracle-text-muted)] hover:text-[var(--oracle-text-3)] transition-colors"
          >
            Copy
          </button>
        </div>
        <pre className="overflow-x-auto p-3 text-[12px] leading-relaxed">
          <code className={className} {...props}>{children}</code>
        </pre>
      </div>
    );
  },
  table: ({ children, ...props }) => (
    <div className="my-3 overflow-x-auto rounded-xl border border-[var(--oracle-border)]">
      <table className="w-full text-[12px]" {...props}>{children}</table>
    </div>
  ),
  th: ({ children, ...props }) => (
    <th className="bg-[var(--oracle-surface-2)] px-3 py-2 text-left font-semibold text-[var(--oracle-text-1)]" {...props}>{children}</th>
  ),
  td: ({ children, ...props }) => (
    <td className="border-t border-[var(--oracle-border)] px-3 py-2 text-[var(--oracle-text-2)]" {...props}>{children}</td>
  ),
  a: ({ href, children, ...props }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--oracle-primary-l)] underline hover:text-[var(--oracle-primary-xl)] transition-colors" {...props}>{children}</a>
  ),
  h1: ({ children, ...props }) => (
    <h1 className="mt-5 mb-3 text-[20px] font-bold text-[var(--oracle-text-1)]" {...props}>{children}</h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="mt-4 mb-2 text-[17px] font-bold text-[var(--oracle-text-1)]" {...props}>{children}</h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="mt-4 mb-2 text-[15px] font-bold text-[var(--oracle-text-1)]" {...props}>{children}</h3>
  ),
  h4: ({ children, ...props }) => (
    <h4 className="mt-3 mb-1.5 text-[14px] font-semibold text-[var(--oracle-text-1)]" {...props}>{children}</h4>
  ),
  h5: ({ children, ...props }) => (
    <h5 className="mt-3 mb-1.5 text-[13px] font-semibold text-[var(--oracle-text-2)]" {...props}>{children}</h5>
  ),
  h6: ({ children, ...props }) => (
    <h6 className="mt-2 mb-1 text-[12px] font-semibold text-[var(--oracle-text-3)] uppercase tracking-wider" {...props}>{children}</h6>
  ),
  ul: ({ children, ...props }) => (
    <ul className="my-2 space-y-1" {...props}>{children}</ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="my-2 space-y-1 list-decimal list-inside" {...props}>{children}</ol>
  ),
  li: ({ children, ...props }) => (
    <li className="py-0.5" {...props}>{children}</li>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote className="my-2 border-l-[3px] border-[var(--oracle-primary)] pl-3 text-[var(--oracle-text-3)] italic" {...props}>{children}</blockquote>
  ),
  p: ({ children, ...props }) => (
    <p className="py-1" {...props}>{children}</p>
  ),
  strong: ({ children, ...props }) => (
    <strong className="font-semibold text-[var(--oracle-text-1)]" {...props}>{children}</strong>
  ),
  hr: () => (
    <hr className="my-3 border-[var(--oracle-border)]" />
  ),
};
