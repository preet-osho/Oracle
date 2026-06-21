// ═══════════════════════════════════════
// ORACLE — Structured Logger Tests
// createLogger, global context, formatting, production/development modes
// ═══════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createLogger,
  setGlobalLogContext,
  clearGlobalLogContext,
} from './logger';

// ─── Helpers ────────────────────────────

function captureConsole(level: 'debug' | 'info' | 'warn' | 'error') {
  const spy = vi.spyOn(console, level).mockImplementation(() => {});
  return {
    getLastCall: () => spy.mock.calls[spy.mock.calls.length - 1]?.[0] as string,
    spy,
    restore: () => spy.mockRestore(),
  };
}

// ─── createLogger Tests ─────────────────

describe('createLogger', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
    clearGlobalLogContext();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    clearGlobalLogContext();
  });

  describe('development mode (human-readable)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('info includes module name and message', () => {
      const c = captureConsole('info');
      const log = createLogger('Router');
      log.info('Provider selected');
      expect(c.getLastCall()).toContain('[Router]');
      expect(c.getLastCall()).toContain('Provider selected');
      c.restore();
    });

    it('info includes ✅ emoji', () => {
      const c = captureConsole('info');
      const log = createLogger('Test');
      log.info('hello');
      expect(c.getLastCall()).toMatch(/^✅/);
      c.restore();
    });

    it('debug includes 🔍 emoji', () => {
      const c = captureConsole('debug');
      const log = createLogger('Test');
      log.debug('detail');
      expect(c.getLastCall()).toMatch(/^🔍/);
      c.restore();
    });

    it('warn includes ⚠️ emoji', () => {
      const c = captureConsole('warn');
      const log = createLogger('Test');
      log.warn('careful');
      expect(c.getLastCall()).toMatch(/^⚠️/);
      c.restore();
    });

    it('error includes ❌ emoji', () => {
      const c = captureConsole('error');
      const log = createLogger('Test');
      log.error('failed');
      expect(c.getLastCall()).toMatch(/^❌/);
      c.restore();
    });

    it('includes context as JSON when provided', () => {
      const c = captureConsole('info');
      const log = createLogger('Test');
      log.info('action', { provider: 'openai', model: 'gpt-4o' });
      const output = c.getLastCall();
      expect(output).toContain('"provider":"openai"');
      expect(output).toContain('"model":"gpt-4o"');
      c.restore();
    });

    it('omits context separator when context is empty', () => {
      const c = captureConsole('info');
      const log = createLogger('Test');
      log.info('no context');
      expect(c.getLastCall()).not.toContain(' | ');
      c.restore();
    });

    it('calls console.info for info level', () => {
      const c = captureConsole('info');
      const log = createLogger('Test');
      log.info('msg');
      expect(c.spy).toHaveBeenCalled();
      c.restore();
    });

    it('calls console.debug for debug level', () => {
      const c = captureConsole('debug');
      const log = createLogger('Test');
      log.debug('msg');
      expect(c.spy).toHaveBeenCalled();
      c.restore();
    });

    it('calls console.warn for warn level', () => {
      const c = captureConsole('warn');
      const log = createLogger('Test');
      log.warn('msg');
      expect(c.spy).toHaveBeenCalled();
      c.restore();
    });

    it('calls console.error for error level', () => {
      const c = captureConsole('error');
      const log = createLogger('Test');
      log.error('msg');
      expect(c.spy).toHaveBeenCalled();
      c.restore();
    });
  });

  describe('production mode (JSON structured)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('outputs valid JSON', () => {
      const c = captureConsole('info');
      const log = createLogger('Router');
      log.info('Provider selected');
      const output = c.getLastCall();
      expect(() => JSON.parse(output)).not.toThrow();
      c.restore();
    });

    it('JSON includes level, module, message, timestamp', () => {
      const c = captureConsole('info');
      const log = createLogger('Router');
      log.info('Provider selected');
      const parsed = JSON.parse(c.getLastCall());
      expect(parsed.level).toBe('info');
      expect(parsed.module).toBe('Router');
      expect(parsed.message).toBe('Provider selected');
      expect(parsed.timestamp).toBeTruthy();
      c.restore();
    });

    it('JSON includes context fields at top level', () => {
      const c = captureConsole('info');
      const log = createLogger('Router');
      log.info('action', { provider: 'openai' });
      const parsed = JSON.parse(c.getLastCall());
      expect(parsed.provider).toBe('openai');
      c.restore();
    });

    it('error level logs as JSON with level=error', () => {
      const c = captureConsole('error');
      const log = createLogger('Test');
      log.error('failed', { code: 500 });
      const parsed = JSON.parse(c.getLastCall());
      expect(parsed.level).toBe('error');
      expect(parsed.code).toBe(500);
      c.restore();
    });

    it('debug level logs as JSON with level=debug', () => {
      const c = captureConsole('debug');
      const log = createLogger('Test');
      log.debug('trace');
      const parsed = JSON.parse(c.getLastCall());
      expect(parsed.level).toBe('debug');
      c.restore();
    });

    it('warn level logs as JSON with level=warn', () => {
      const c = captureConsole('warn');
      const log = createLogger('Test');
      log.warn('watch out');
      const parsed = JSON.parse(c.getLastCall());
      expect(parsed.level).toBe('warn');
      c.restore();
    });
  });

  describe('global context', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('merges global context into log output', () => {
      setGlobalLogContext({ userId: 'user-1', requestId: 'req-123' });
      const c = captureConsole('info');
      const log = createLogger('Test');
      log.info('action');
      const output = c.getLastCall();
      expect(output).toContain('user-1');
      expect(output).toContain('req-123');
      c.restore();
    });

    it('local context overrides global context', () => {
      setGlobalLogContext({ userId: 'global-user' });
      const c = captureConsole('info');
      const log = createLogger('Test');
      log.info('action', { userId: 'local-user' });
      const output = c.getLastCall();
      expect(output).toContain('local-user');
      c.restore();
    });

    it('clearGlobalLogContext removes global context', () => {
      setGlobalLogContext({ userId: 'user-1' });
      clearGlobalLogContext();
      const c = captureConsole('info');
      const log = createLogger('Test');
      log.info('action');
      const output = c.getLastCall();
      expect(output).not.toContain('user-1');
      c.restore();
    });

    it('setGlobalLogContext merges incrementally', () => {
      setGlobalLogContext({ userId: 'user-1' });
      setGlobalLogContext({ requestId: 'req-1' });
      const c = captureConsole('info');
      const log = createLogger('Test');
      log.info('action');
      const output = c.getLastCall();
      expect(output).toContain('user-1');
      expect(output).toContain('req-1');
      c.restore();
    });

    it('global context works in production mode too', () => {
      process.env.NODE_ENV = 'production';
      setGlobalLogContext({ orgId: 'org-1' });
      const c = captureConsole('info');
      const log = createLogger('Test');
      log.info('action');
      const parsed = JSON.parse(c.getLastCall());
      expect(parsed.orgId).toBe('org-1');
      c.restore();
    });
  });

  describe('multiple loggers', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('different modules log independently', () => {
      const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const log1 = createLogger('ModuleA');
      const log2 = createLogger('ModuleB');
      log1.info('from A');
      log2.info('from B');
      expect(spy.mock.calls[0][0]).toContain('ModuleA');
      expect(spy.mock.calls[1][0]).toContain('ModuleB');
      spy.mockRestore();
    });
  });

  describe('context with various types', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('handles nested objects in context', () => {
      const c = captureConsole('info');
      const log = createLogger('Test');
      log.info('action', { meta: { nested: true } });
      const parsed = JSON.parse(c.getLastCall());
      expect(parsed.meta).toEqual({ nested: true });
      c.restore();
    });

    it('handles array values in context', () => {
      const c = captureConsole('info');
      const log = createLogger('Test');
      log.info('action', { tags: ['a', 'b'] });
      const parsed = JSON.parse(c.getLastCall());
      expect(parsed.tags).toEqual(['a', 'b']);
      c.restore();
    });

    it('handles number values in context', () => {
      const c = captureConsole('info');
      const log = createLogger('Test');
      log.info('action', { count: 42, cost: 1.5 });
      const parsed = JSON.parse(c.getLastCall());
      expect(parsed.count).toBe(42);
      expect(parsed.cost).toBe(1.5);
      c.restore();
    });

    it('handles boolean values in context', () => {
      const c = captureConsole('info');
      const log = createLogger('Test');
      log.info('action', { success: true });
      const parsed = JSON.parse(c.getLastCall());
      expect(parsed.success).toBe(true);
      c.restore();
    });
  });
});
