// ═══════════════════════════════════════
// ORACLE — Shared Encryption Utilities
// AES-256-CBC encryption for API key storage
// SERVER-ONLY — never import in client components
// Used by all API routes that handle encrypted keys
// ═══════════════════════════════════════

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// ─── Encryption Key ─────────────────────
// In production, this MUST be set via API_KEY_ENCRYPTION_KEY env var.
// The fallback is ONLY for development and will log a warning.

const ENCRYPTION_KEY = process.env.API_KEY_ENCRYPTION_KEY;

if (!ENCRYPTION_KEY && process.env.NODE_ENV === 'production') {
  console.error('[FATAL] API_KEY_ENCRYPTION_KEY environment variable is required in production');
}

function getRawKey(): string {
  return ENCRYPTION_KEY || 'oracle-dev-key-change-in-production-32b!';
}

function getKeyBuffer(): Buffer {
  return Buffer.from(getRawKey().padEnd(32, '0').slice(0, 32));
}

// ─── Encrypt ────────────────────────────

/**
 * Encrypt a plaintext string using AES-256-CBC.
 * Returns format: `<iv_hex>:<ciphertext_hex>`
 */
export function encrypt(plainText: string): string {
  const key = getKeyBuffer();
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

// ─── Decrypt ────────────────────────────

/**
 * Decrypt a ciphertext string encrypted with `encrypt()`.
 * Input format: `<iv_hex>:<ciphertext_hex>`
 * Returns empty string on failure (never throws).
 */
export function decrypt(cipherText: string): string {
  try {
    const key = getKeyBuffer();
    const [ivHex, encrypted] = cipherText.split(':');
    if (!ivHex || !encrypted) return '';
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return '';
  }
}

// ─── Mask Key ───────────────────────────

/**
 * Mask an API key for display: "sk-1****abcd"
 */
export function maskKey(key: string): string {
  if (key.length <= 8) return '****';
  return key.slice(0, 4) + '****' + key.slice(-4);
}
