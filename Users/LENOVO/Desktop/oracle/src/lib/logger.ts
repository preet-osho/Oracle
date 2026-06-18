// ═══════════════════════════════════════
// ORACLE — Structured Logger
// Replace console.log/warn/error with
// a consistent, shipable logging system
// ═══════════════════════════════════════

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  module?: string;
  action?: string;
  userId?: string;
  requestId?: string;
  [key: string]: unknown;
}

/**
 * Structured logger that outputs JSON in production and human-readable in development.
 *
 * Usage:
 *   import { createLogger } from '@/lib/logger';
 *   const log = createLogger('Router');
 *   log.info('Provider selected', { provider: 'openai', model: 'gpt-4o' });
 *   log.error('Provider failed', { provider: 'openai', error: err.message });
 */

let globalContext: LogContext = {};

export function setGlobalLogContext(context: LogContext): void {
  globalContext = { ...globalContext, ...context };
}

export function clearGlobalLogContext(): void {
  globalContext = {};
}

function formatMessage(level: LogLevel, module: string, message: string, context: LogContext): string {
  const timestamp = new Date().toISOString();
  const ctx = { ...globalContext, ...context };

  if (process.env.NODE_ENV === 'production') {
    // JSON structured log for production (ship to Axiom, Datadog, etc.)
    return JSON.stringify({
      level,
      module,
      message,
      ...ctx,
      timestamp,
    });
  }

  // Human-readable for development
  const emoji = { debug: '🔍', info: '✅', warn: '⚠️', error: '❌' }[level];
  const contextStr = Object.keys(ctx).length > 0 ? ` | ${JSON.stringify(ctx)}` : '';
  return `${emoji} [${module}] ${message}${contextStr}`;
}

function log(level: LogLevel, module: string, message: string, context: LogContext = {}): void {
  const formatted = formatMessage(level, module, message, context);

  switch (level) {
    case 'debug':
      console.debug(formatted);
      break;
    case 'info':
      console.info(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    case 'error':
      console.error(formatted);
      break;
  }
}

/**
 * Create a logger instance bound to a module name.
 */
export function createLogger(module: string) {
  return {
    debug: (message: string, context?: LogContext) => log('debug', module, message, context),
    info: (message: string, context?: LogContext) => log('info', module, message, context),
    warn: (message: string, context?: LogContext) => log('warn', module, message, context),
    error: (message: string, context?: LogContext) => log('error', module, message, context),
  };
}
