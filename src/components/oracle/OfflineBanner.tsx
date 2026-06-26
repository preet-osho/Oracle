'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Shows a persistent banner when the browser is offline.
 * Auto-hides when connectivity is restored.
 */
export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Set initial state
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="relative z-50 flex items-center justify-center gap-2 bg-[var(--oracle-warning)]/15 border-b border-[var(--oracle-warning)]/30 px-4 py-2"
          role="alert"
          aria-live="assertive"
        >
          <span className="text-sm" aria-hidden="true">📡</span>
          <p className="text-[12px] font-medium text-[var(--oracle-warning)]">
            You&apos;re offline — AI responses will be unavailable until you reconnect.
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
