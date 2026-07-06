// ═══════════════════════════════════════
// ORACLE — Research Engine Shared Utilities
// URL normalization, domain extraction, SSRF protection
// ═══════════════════════════════════════

// ─── URL Normalization ────────────────

/**
 * Normalize a URL for fetching.
 * - Blocks non-HTTP protocols (file://, ftp://, javascript:, etc.)
 * - Adds https:// if no protocol specified
 * - Trims whitespace
 */
export function normalizeUrl(url: string): string {
  let normalized = url.trim();
  if (/^(file|ftp|javascript|data):/i.test(normalized)) {
    throw new Error(`Unsupported protocol: ${normalized.split(':')[0]}://`);
  }
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = 'https://' + normalized;
  }
  return normalized;
}

// ─── Domain Extraction ────────────────

/**
 * Extract the bare domain from a URL, stripping www. prefix.
 * Falls back to first 50 chars on invalid URLs.
 */
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.slice(0, 50);
  }
}

// ─── SSRF Protection ──────────────────

/**
 * Check if a hostname is a private/internal address that should be blocked
 * to prevent Server-Side Request Forgery (SSRF) attacks.
 *
 * Blocks: localhost, 127.0.0.1, ::1, 10.0.0.0/8, 172.16.0.0/12,
 *         192.168.0.0/16, 169.254.0.0/16, .local, .internal
 */
export function isPrivateHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.') ||
    /^169\.254\./.test(hostname) ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    isPrivateCidr(hostname)
  );
}

/**
 * Check if a hostname is within common private CIDR ranges.
 * Currently handles 172.16.0.0/12 (172.16.x.x – 172.31.x.x).
 */
function isPrivateCidr(hostname: string): boolean {
  const parts = hostname.split('.');
  if (parts.length !== 4) return false;
  const first = parseInt(parts[0], 10);
  const second = parseInt(parts[1], 10);
  return first === 172 && second >= 16 && second <= 31;
}

// ─── Title Extraction ─────────────────

/**
 * Extract a human-readable title from a URL.
 * Uses the hostname as a fallback.
 */
export function extractTitleFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, '');
  } catch {
    return url.slice(0, 50);
  }
}
