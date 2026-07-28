// ═══════════════════════════════════════
// ORACLE — Root Barrel Export
// Re-exports all public modules for convenient imports
// ═══════════════════════════════════════

// Styles (design tokens, keyboard shortcuts, etc.)
export * from './styles';

// Types
export * from './types';

// Lib utilities (re-export commonly used ones)
export { formatINR, formatUSD, buildPDFSections } from './lib/export-utils';
export type { PDFSection, PDFExportOptions } from './lib/export-utils';
