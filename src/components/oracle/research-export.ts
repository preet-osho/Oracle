// ═══════════════════════════════════════
// Research Findings Export Utilities
// JSON and CSV export for research findings
// ═══════════════════════════════════════

import { downloadBlob } from '@/lib/download-blob';

// Re-export downloadBlob as downloadFile for backward compatibility
export { downloadBlob as downloadFile };

// ─── Types ────────────────────────────

export interface ResearchFinding {
  id: string;
  userId: string;
  clientId?: string;
  researchType: 'competitor' | 'market' | 'website-audit' | 'lead-intel' | 'content-extract';
  targetUrl?: string;
  targetQuery?: string;
  findings: Record<string, unknown>;
  reportMarkdown?: string;
  createdAt: number;
  expiresAt?: number;
}

// ─── JSON Export ──────────────────────

export function findingsToJson(findings: ResearchFinding[]): string {
  return JSON.stringify(
    findings.map((f) => ({
      id: f.id,
      researchType: f.researchType,
      targetUrl: f.targetUrl ?? null,
      targetQuery: f.targetQuery ?? null,
      clientId: f.clientId ?? null,
      findings: f.findings,
      reportMarkdown: f.reportMarkdown ?? null,
      createdAt: new Date(f.createdAt).toISOString(),
      expiresAt: f.expiresAt ? new Date(f.expiresAt).toISOString() : null,
    })),
    null,
    2,
  );
}

export function exportToJson(findings: ResearchFinding[]) {
  const json = findingsToJson(findings);
  const timestamp = new Date().toISOString().slice(0, 10);
  downloadBlob(json, `research-findings-${timestamp}.json`, 'application/json');
}

// ─── CSV Helpers ──────────────────────

export function escapeCsvValue(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export function findingsToCsv(findings: ResearchFinding[]): string {
  const headers = [
    'id', 'researchType', 'targetUrl', 'targetQuery', 'clientId',
    'createdAt', 'expiresAt', 'findingsJson',
  ];

  const rows = findings.map((f) => [
    f.id,
    f.researchType,
    f.targetUrl ?? '',
    f.targetQuery ?? '',
    f.clientId ?? '',
    new Date(f.createdAt).toISOString(),
    f.expiresAt ? new Date(f.expiresAt).toISOString() : '',
    JSON.stringify(f.findings),
  ]);

  return [
    headers.join(','),
    ...rows.map((row) => row.map(escapeCsvValue).join(',')),
  ].join('\n');
}

// ─── CSV Export ───────────────────────

export function exportToCsv(findings: ResearchFinding[]) {
  const csv = findingsToCsv(findings);
  const timestamp = new Date().toISOString().slice(0, 10);
  downloadBlob(csv, `research-findings-${timestamp}.csv`, 'text/csv');
}
