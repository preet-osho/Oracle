/**
 * Shared email utilities for React Email templates.
 */

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

/**
 * Format a number as currency with locale-aware formatting.
 */
export function formatCurrency(amount: number, currency = 'INR'): string {
  const symbol = CURRENCY_SYMBOLS[currency] || currency + ' ';
  return `${symbol}${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Format a number as currency without decimal places.
 */
export function formatCurrencyCompact(amount: number, currency = 'INR'): string {
  const symbol = CURRENCY_SYMBOLS[currency] || currency + ' ';
  return `${symbol}${amount.toLocaleString('en-IN')}`;
}

/**
 * Get an emoji for a client status.
 */
export function statusEmoji(status: 'on-track' | 'at-risk' | 'completed'): string {
  switch (status) {
    case 'completed': return '✅';
    case 'on-track': return '🟢';
    case 'at-risk': return '🟡';
    default: return '⚪';
  }
}
