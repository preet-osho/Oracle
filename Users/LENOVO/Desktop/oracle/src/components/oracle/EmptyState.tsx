'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { motionVariants, transitions, QUICK_START_CARDS, buttonTapProps } from '@/styles/design-tokens';

interface EmptyStateProps {
  onQuickStart: (prompt: string) => void;
}

export function EmptyState({ onQuickStart }: EmptyStateProps) {
  return (
    <motion.div
      className="flex h-full flex-col items-center justify-center px-4"
      variants={motionVariants.fadeUp}
      initial="initial"
      animate="animate"
      transition={transitions.smooth}
    >
      <div className="mb-6 flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl oracle-gradient-bg oracle-glow">
        <span className="text-3xl sm:text-4xl" aria-hidden="true">⚡</span>
      </div>
      <h2 className="mb-2 text-[20px] sm:text-[24px] font-bold text-[var(--oracle-text-1)]">
        Describe any agency task
      </h2>
      <p className="mb-6 sm:mb-8 max-w-sm text-center text-[13px] sm:text-[14px] text-[var(--oracle-text-3)]">
        ORACLE will plan, execute, and deliver — like a senior partner at your fingertips.
      </p>
      <div className="grid max-w-lg grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3" role="list" aria-label="Quick start options">
        {QUICK_START_CARDS.map((card) => (
          <motion.button
            key={card.label}
            whileHover={{ scale: 1.02, y: -2 }}
            {...buttonTapProps}
            onClick={() => onQuickStart(card.label)}
            className="oracle-glass oracle-glass-hover rounded-xl px-4 py-3 text-left transition-all duration-200 min-h-[44px]"
            role="listitem"
          >
            <span className="text-xl" aria-hidden="true">{card.emoji}</span>
            <p className="mt-1.5 text-[13px] font-semibold text-[var(--oracle-text-2)]">
              {card.label}
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--oracle-text-muted)]">
              {card.description}
            </p>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
