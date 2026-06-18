'use client';

import React from 'react';

// ─── Base Skeleton Line ────────────────

export function SkeletonLine({ className = '', width, height }: { className?: string; width?: string | number; height?: string | number }) {
  return (
    <div
      className={`oracle-shimmer rounded-md ${className}`}
      style={{ width: width || '100%', height: height || '12px' }}
    />
  );
}

// ─── Chat Message Skeleton ─────────────

export function ChatMessageSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {Array.from({ length: count }).map((_, i) => {
        const isUser = i % 2 === 0;
        return (
          <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[75%] space-y-2 rounded-2xl px-4 py-3 ${
                isUser ? 'oracle-msg-user rounded-br-md' : 'oracle-msg-agent rounded-bl-md'
              }`}
            >
              <SkeletonLine width={isUser ? '60%' : '90%'} height="14px" />
              <SkeletonLine width={isUser ? '40%' : '75%'} height="14px" />
              {!isUser && <SkeletonLine width="50%" height="14px" />}
              {!isUser && (
                <div className="flex gap-2 pt-1">
                  <SkeletonLine width="40px" height="10px" className="rounded-full" />
                  <SkeletonLine width="50px" height="10px" className="rounded-full" />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Card Skeleton ─────────────────────

export function CardSkeleton({ lines = 4, hasAvatar = false }: { lines?: number; hasAvatar?: boolean }) {
  return (
    <div className="oracle-glass rounded-xl p-4 space-y-3">
      {hasAvatar && (
        <div className="flex items-center gap-3">
          <SkeletonLine width="40px" height="40px" className="!rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <SkeletonLine width="60%" height="14px" />
            <SkeletonLine width="40%" height="10px" />
          </div>
        </div>
      )}
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine
          key={i}
          width={i === lines - 1 ? '55%' : '100%'}
          height="12px"
        />
      ))}
    </div>
  );
}

// ─── Table Skeleton ────────────────────

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex gap-4 px-3">
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonLine key={i} width="80px" height="10px" className="flex-shrink-0" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 items-center rounded-lg px-3 py-2 hover:bg-[var(--oracle-card-hover)]">
          {Array.from({ length: cols }).map((_, j) => (
            <SkeletonLine
              key={j}
              width={j === 0 ? '120px' : '60px'}
              height="12px"
              className="flex-shrink-0"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Stats Skeleton ────────────────────

export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="oracle-glass rounded-xl p-3 space-y-2">
          <SkeletonLine width="50%" height="10px" />
          <SkeletonLine width="70%" height="20px" />
        </div>
      ))}
    </div>
  );
}
