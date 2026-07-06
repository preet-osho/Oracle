// ═══════════════════════════════════════
// ORACLE — Download Blob Utility
// Reusable file download via browser Blob API
// ═══════════════════════════════════════

/**
 * Trigger a browser file download from a string or Blob.
 * Safe no-op if `document` is unavailable (SSR / test environments).
 *
 * @param content   File content as string or Blob
 * @param filename  Download filename (e.g. "report.pdf")
 * @param mimeType  MIME type (e.g. "application/pdf", "text/csv")
 */
export function downloadBlob(
  content: string | Blob,
  filename: string,
  mimeType: string,
): void {
  if (typeof document === 'undefined') return;

  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
