// ═══════════════════════════════════════
// ORACLE — Encryption Utilities Tests
// AES-256-CBC encrypt/decrypt round-trip, maskKey, edge cases
// ═══════════════════════════════════════

import { describe, it, expect, vi, afterEach } from 'vitest';

// vi.hoisted runs BEFORE imports (Vitest hoists imports to top)
const { TEST_KEY } = vi.hoisted(() => {
  const key = 'a'.repeat(64); // 64 hex chars = 32 bytes
  process.env.API_KEY_ENCRYPTION_KEY = key;
  return { TEST_KEY: key };
});

import { encrypt, decrypt, maskKey } from './encryption';

afterEach(() => {
  delete process.env.API_KEY_ENCRYPTION_KEY;
});

// ─── encrypt/decrypt Round-Trip Tests ───

describe('encrypt/decrypt round-trip', () => {
  it('encrypts and decrypts a simple string', () => {
    const plainText = 'hello world';
    const cipherText = encrypt(plainText);
    expect(decrypt(cipherText)).toBe(plainText);
  });

  it('produces iv:ciphertext format', () => {
    const cipherText = encrypt('test');
    const parts = cipherText.split(':');
    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatch(/^[0-9a-f]{32}$/); // 16 bytes = 32 hex chars
    expect(parts[1]).toMatch(/^[0-9a-f]+$/); // ciphertext is hex
  });

  it('produces different ciphertext each time (random IV)', () => {
    const ct1 = encrypt('same input');
    const ct2 = encrypt('same input');
    expect(ct1).not.toBe(ct2); // different IVs → different ciphertext
  });

  it('handles empty string', () => {
    const cipherText = encrypt('');
    expect(decrypt(cipherText)).toBe('');
  });

  it('handles unicode characters', () => {
    const plainText = 'नमस्ते दुनिया 🌍 café résumé';
    const cipherText = encrypt(plainText);
    expect(decrypt(cipherText)).toBe(plainText);
  });

  it('handles long strings', () => {
    const plainText = 'x'.repeat(10000);
    const cipherText = encrypt(plainText);
    expect(decrypt(cipherText)).toBe(plainText);
  });

  it('handles strings with special characters', () => {
    const plainText = '!@#$%^&*()_+-={}[]|\\:";\'<>,.?/`~';
    const cipherText = encrypt(plainText);
    expect(decrypt(cipherText)).toBe(plainText);
  });

  it('handles newlines and tabs', () => {
    const plainText = 'line1\nline2\ttab\r\nwindows';
    const cipherText = encrypt(plainText);
    expect(decrypt(cipherText)).toBe(plainText);
  });

  it('handles JSON-like strings', () => {
    const plainText = JSON.stringify({ key: 'value', nested: { a: 1 } });
    const cipherText = encrypt(plainText);
    expect(decrypt(cipherText)).toBe(plainText);
  });

  it('handles API key format strings', () => {
    const apiKey = 'sk-proj-abc123def456ghi789jkl012mno345pqr678stu901';
    const cipherText = encrypt(apiKey);
    expect(decrypt(cipherText)).toBe(apiKey);
  });
});

// ─── decrypt Edge Cases ─────────────────

describe('decrypt edge cases', () => {
  it('returns empty string for malformed input (no colon)', () => {
    expect(decrypt('nocolon')).toBe('');
  });

  it('returns empty string for empty input', () => {
    expect(decrypt('')).toBe('');
  });

  it('returns empty string for invalid hex IV', () => {
    expect(decrypt('zzzz:abc')).toBe('');
  });

  it('returns empty string for corrupted ciphertext', () => {
    const ct = encrypt('hello');
    const [iv] = ct.split(':');
    expect(decrypt(`${iv}:0000000000000000`)).toBe('');
  });

  it('returns empty string for completely invalid format', () => {
    expect(decrypt('not-valid-at-all')).toBe('');
  });

  it('returns empty string when only IV provided', () => {
    const iv = 'a'.repeat(32);
    expect(decrypt(`${iv}:`)).toBe('');
  });
});

// ─── Key Buffer Tests (vi.resetModules) ─

describe('key buffer handling', () => {
  it('works with a short key (padded to 32 bytes)', async () => {
    vi.resetModules();
    process.env.API_KEY_ENCRYPTION_KEY = 'short';
    const { encrypt: enc, decrypt: dec } = await import('./encryption');
    const ct = enc('test');
    expect(dec(ct)).toBe('test');
  });

  it('works with a key longer than 32 bytes (truncated)', async () => {
    vi.resetModules();
    process.env.API_KEY_ENCRYPTION_KEY = 'x'.repeat(64);
    const { encrypt: enc, decrypt: dec } = await import('./encryption');
    const ct = enc('test');
    expect(dec(ct)).toBe('test');
  });

  it('works with a key that is exactly 32 bytes', async () => {
    vi.resetModules();
    process.env.API_KEY_ENCRYPTION_KEY = 'b'.repeat(32);
    const { encrypt: enc, decrypt: dec } = await import('./encryption');
    const ct = enc('test');
    expect(dec(ct)).toBe('test');
  });

  it('different keys produce different ciphertext', async () => {
    vi.resetModules();
    process.env.API_KEY_ENCRYPTION_KEY = TEST_KEY;
    const { encrypt: enc1 } = await import('./encryption');
    const ct1 = enc1('test');

    vi.resetModules();
    process.env.API_KEY_ENCRYPTION_KEY = 'c'.repeat(64);
    const { encrypt: enc2 } = await import('./encryption');
    const ct2 = enc2('test');

    expect(ct1).not.toBe(ct2);
  });
});

// ─── maskKey Tests ──────────────────────

describe('maskKey', () => {
  it('masks a typical API key', () => {
    expect(maskKey('sk-1234567890abcdef')).toBe('sk-1****cdef');
  });

  it('masks short keys (<= 8 chars) to ****', () => {
    expect(maskKey('short')).toBe('****');
    expect(maskKey('12345678')).toBe('****');
  });

  it('masks exactly 9-char keys (first 4 + **** + last 4)', () => {
    expect(maskKey('123456789')).toBe('1234****6789');
  });

  it('masks long keys', () => {
    expect(maskKey('abcdefghijklmnopqrstuvwxyz')).toBe('abcd****wxyz');
  });

  it('preserves first 4 and last 4 characters', () => {
    const key = 'abcdefghijklmnop';
    const masked = maskKey(key);
    expect(masked.startsWith('abcd')).toBe(true);
    expect(masked.endsWith('mnop')).toBe(true);
    expect(masked).toContain('****');
  });
});
