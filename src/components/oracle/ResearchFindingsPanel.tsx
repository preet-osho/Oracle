'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { fetchWithTimeout, TIMEOUT_QUICK_MS } from '@/lib/fetch-utils';
import { exportToJson, exportToCsv, type ResearchFinding } from './research-export';

// Re-export for any external consumers
export type { ResearchFinding };

// ─── Research Type Config ─────────────

const RESEARCH_TYPE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  competitor: { label: 'Competitor', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30', icon: '🔍' },
  market: { label: 'Market', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30', icon: '📊' },
  'website-audit': { label: 'Audit', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30', icon: '🔧' },
  'lead-intel': { label: 'Lead Intel', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', icon: '🎯' },
  'content-extract': { label: 'Extract', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30', icon: '📄' },
};

const PAGE_SIZES = [10, 25, 50, 100] as const;

const MS_PER_DAY = 86_400_000;

interface DatePreset {
  label: string;
  getRange: () => { from: string; to: string };
}

function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const DATE_PRESETS: DatePreset[] = [
  {
    label: 'Last 7 days',
    getRange: () => ({
      from: toLocalDateStr(new Date(Date.now() - 7 * MS_PER_DAY)),
      to: toLocalDateStr(new Date()),
    }),
  },
  {
    label: 'Last 30 days',
    getRange: () => ({
      from: toLocalDateStr(new Date(Date.now() - 30 * MS_PER_DAY)),
      to: toLocalDateStr(new Date()),
    }),
  },
  {
    label: 'Last month',
    getRange: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: toLocalDateStr(start), to: toLocalDateStr(end) };
    },
  },
  {
    label: 'This month',
    getRange: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: toLocalDateStr(start), to: toLocalDateStr(now) };
    },
  },
  {
    label: 'All time',
    getRange: () => ({ from: '', to: '' }),
  },
];

// ─── Component ────────────────────────

export default function ResearchFindingsPanel() {
  const [findings, setFindings] = useState<ResearchFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedFinding, setSelectedFinding] = useState<ResearchFinding | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);

  // ── Pagination state ──
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(25);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // ── Client-side search + date filter ──
  const filteredFindings = useMemo(() => {
    let result = findings;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((f) => {
        const url = f.targetUrl?.toLowerCase() || '';
        const query = f.targetQuery?.toLowerCase() || '';
        return url.includes(q) || query.includes(q);
      });
    }

    // Date range filter
    if (dateFrom) {
      const fromMs = new Date(dateFrom).getTime();
      result = result.filter((f) => f.createdAt >= fromMs);
    }
    if (dateTo) {
      const toMs = new Date(dateTo).getTime() + MS_PER_DAY; // Include the full end date
      result = result.filter((f) => f.createdAt < toMs);
    }

    return result;
  }, [findings, searchQuery, dateFrom, dateTo]);

  // Debounced search — refetch with wider window only after typing stops
  const [debouncedQuery, setDebouncedQuery] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const fetchFindings = useCallback(async (signal?: AbortSignal) => {
    try {
      const params = new URLSearchParams();
      if (selectedType !== 'all') params.set('researchType', selectedType);
      // When searching client-side, fetch more results so search covers a wider set
      const effectiveLimit = debouncedQuery.trim() ? Math.max(pageSize, 100) : pageSize;
      const effectiveOffset = debouncedQuery.trim() ? 0 : page * pageSize;
      params.set('limit', String(effectiveLimit));
      params.set('offset', String(effectiveOffset));

      const res = await fetchWithTimeout(`/api/research/memory?${params.toString()}`, {
        timeoutMs: TIMEOUT_QUICK_MS,
        signal,
      });

      if (res.ok) {
        const data = await res.json();
        setFindings(data.findings || []);
        setTotalCount(data.totalCount ?? data.findings?.length ?? 0);
        setHasMore(data.hasMore ?? false);
        setError(null);
      } else {
        setError(`Failed to load findings (${res.status})`);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError('Failed to load findings. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, [selectedType, page, pageSize, debouncedQuery]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetchFindings(controller.signal);
    return () => controller.abort();
  }, [fetchFindings]);

  const handleTypeChange = useCallback((type: string) => {
    setSelectedType(type);
    setPage(0);
  }, []);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setPage(0);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    setDeleting(id);
    try {
      const res = await fetchWithTimeout('/api/research/memory', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
        timeoutMs: TIMEOUT_QUICK_MS,
      });

      if (res.ok) {
        setFindings((prev) => prev.filter((f) => f.id !== id));
        setTotalCount((prev) => Math.max(0, prev - 1));
        if (selectedFinding?.id === id) setSelectedFinding(null);
      }
    } catch {
      // Silently fail
    } finally {
      setDeleting(null);
    }
  }, [selectedFinding]);

  // Keyboard shortcuts for pagination
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't capture when user is typing in an input, textarea, or select
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      // Don't capture when in detail view or when pagination is hidden
      if (selectedFinding || searchQuery.trim()) return;
      if (totalCount === 0) return;

      if (e.key === 'ArrowLeft' && page > 0) {
        e.preventDefault();
        setPage((p) => Math.max(0, p - 1));
      } else if (e.key === 'ArrowRight' && hasMore) {
        e.preventDefault();
        setPage((p) => p + 1);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [page, hasMore, totalCount, selectedFinding, searchQuery]);

  // Close export menu on outside click
  useEffect(() => {
    if (!showExportMenu) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-export-menu]')) setShowExportMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showExportMenu]);

  if (selectedFinding) {
    return (
      <FindingDetail
        finding={selectedFinding}
        onBack={() => setSelectedFinding(null)}
        onDelete={handleDelete}
        deleting={deleting === selectedFinding.id}
      />
    );
  }

  const hasData = filteredFindings.length > 0;

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Research Findings</h2>
          <p className="text-sm text-zinc-500">
            {searchQuery.trim()
              ? `${filteredFindings.length} of ${totalCount} finding${totalCount !== 1 ? 's' : ''}`
              : `${totalCount} finding${totalCount !== 1 ? 's' : ''} stored`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* ── Export Button ── */}
          {hasData && (
            <div className="relative group" data-export-menu>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowExportMenu(!showExportMenu)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" />
                </svg>
                Export
              </Button>
              {/* Tooltip (hidden when menu is open) */}
              {!showExportMenu && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-zinc-300 whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 shadow-lg z-50">
                  Export {filteredFindings.length} finding{filteredFindings.length !== 1 ? 's' : ''} as JSON or CSV
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-zinc-900 border-r border-b border-zinc-700 rotate-45 -mt-1" />
                </div>
              )}
              {showExportMenu && (
                <div className="absolute right-0 top-full mt-1 z-50 w-40 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1">
                  <button
                    onClick={() => { exportToJson(filteredFindings); setShowExportMenu(false); }}
                    className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors flex items-center gap-2"
                  >
                    <span className="text-xs">{'{ }'}</span> Export as JSON
                  </button>
                  <button
                    onClick={() => { exportToCsv(filteredFindings); setShowExportMenu(false); }}
                    className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors flex items-center gap-2"
                  >
                    <span className="text-xs">📊</span> Export as CSV
                  </button>
                </div>
              )}
            </div>
          )}
          <Button variant="outline" size="sm" onClick={() => fetchFindings()}>
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Search Input ── */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="text"
          placeholder="Search by URL or query..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-500 focus:border-zinc-500 transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* ── Date Range Filter ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-zinc-500">From:</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="text-xs bg-zinc-800/50 border border-zinc-700/50 rounded px-2 py-1 text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-zinc-500">To:</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="text-xs bg-zinc-800/50 border border-zinc-700/50 rounded px-2 py-1 text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </div>
        {(dateFrom || dateTo) && (
          <button
            onClick={() => { setDateFrom(''); setDateTo(''); }}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Clear
          </button>
        )}
      </div>
      <div className="flex gap-2 flex-wrap">
        {DATE_PRESETS.map((preset) => {
          const range = preset.getRange();
          const isActive = dateFrom === range.from && dateTo === range.to;
          return (
            <FilterChip
              key={preset.label}
              label={preset.label}
              active={isActive}
              onClick={() => { setDateFrom(range.from); setDateTo(range.to); }}
            />
          );
        })}
      </div>

      {/* ── Type Filter ── */}
      <div className="flex gap-2 flex-wrap">
        <FilterChip
          label="All"
          active={selectedType === 'all'}
          onClick={() => handleTypeChange('all')}
        />
        {Object.entries(RESEARCH_TYPE_CONFIG).map(([type, config]) => (
          <FilterChip
            key={type}
            label={`${config.icon} ${config.label}`}
            active={selectedType === type}
            onClick={() => handleTypeChange(type)}
          />
        ))}
      </div>

      {/* ── Findings List ── */}
      {loading ? (
        <Card className="border-white/10 bg-white/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-zinc-400">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-300" />
              Loading findings...
            </div>
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="p-6">
            <p className="text-sm text-red-400">{error}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => fetchFindings()}>Retry</Button>
          </CardContent>
        </Card>
      ) : findings.length === 0 ? (
        <Card className="border-white/10 bg-white/5">
          <CardContent className="p-6 text-zinc-500">
            {totalCount === 0
              ? 'No research findings stored yet. Run a competitor analysis or market research to start collecting findings.'
              : searchQuery
                ? `No findings matching "${searchQuery}". Try a different search term.`
                : 'No findings on this page. Try a different page or filter.'}
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[500px]">
          <div className="space-y-2">
            {filteredFindings.map((finding) => (
              <FindingCard
                key={finding.id}
                finding={finding}
                onSelect={() => setSelectedFinding(finding)}
                onDelete={handleDelete}
                deleting={deleting === finding.id}
              />
            ))}
          </div>
        </ScrollArea>
      )}

      {/* ── Pagination Controls ── */}
      {totalCount > 0 && !searchQuery.trim() && (
        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-500">
              {totalCount === 0
                ? '0 results'
                : `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, totalCount)} of ${totalCount}`}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                ← Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasMore}
                onClick={() => setPage((p) => p + 1)}
              >
                Next →
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-Components ───────────────────

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
        active
          ? 'bg-zinc-700 text-zinc-100 ring-1 ring-zinc-500'
          : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300'
      }`}
    >
      {label}
    </button>
  );
}

function FindingCard({
  finding,
  onSelect,
  onDelete,
  deleting,
}: {
  finding: ResearchFinding;
  onSelect: () => void;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const config = RESEARCH_TYPE_CONFIG[finding.researchType] || {
    label: finding.researchType,
    color: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30',
    icon: '📋',
  };

  const timeAgo = getTimeAgo(finding.createdAt);
  // eslint-disable-next-line react-hooks/purity -- Date.now() is stable within a render cycle
  const isExpired = finding.expiresAt && finding.expiresAt < Date.now();
   
  const daysUntilExpiry = finding.expiresAt
    // eslint-disable-next-line react-hooks/purity -- Date.now() is stable within a render cycle
    ? Math.max(0, Math.ceil((finding.expiresAt - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const summary = extractSummary(finding);

  return (
    <Card className="border-white/10 bg-white/5 hover:bg-white/8 transition-colors cursor-pointer" onClick={onSelect}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <Badge className={config.color}>
                {config.icon} {config.label}
              </Badge>
              {isExpired && (
                <Badge className="bg-red-500/20 text-red-300 border-red-500/30">Expired</Badge>
              )}
            </div>

            <h3 className="text-sm font-medium text-zinc-200 truncate">
              {finding.targetUrl || finding.targetQuery || 'Research Finding'}
            </h3>

            {summary && (
              <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{summary}</p>
            )}

            <div className="flex items-center gap-3 mt-2 text-xs text-zinc-600">
              <span>{timeAgo}</span>
              {finding.targetUrl && (
                <span className="truncate max-w-[200px]">{safeHostname(finding.targetUrl)}</span>
              )}
              {daysUntilExpiry !== null && (
                <span className={daysUntilExpiry < 7 ? 'text-amber-400' : ''}>
                  Expires in {daysUntilExpiry}d
                </span>
              )}
            </div>
          </div>

          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
            {confirmDelete ? (
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => onDelete(finding.id)}
                  className="text-red-400 hover:text-red-300"
                >
                  ✓
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setConfirmDelete(false)}
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  ✗
                </Button>
              </div>
            ) : deleting ? (
              <div className="h-3 w-3 animate-spin rounded-full border border-zinc-600 border-t-zinc-300" />
            ) : (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setConfirmDelete(true)}
                className="text-zinc-600 hover:text-red-400"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FindingDetail({
  finding,
  onBack,
  onDelete,
  deleting,
}: {
  finding: ResearchFinding;
  onBack: () => void;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const config = RESEARCH_TYPE_CONFIG[finding.researchType] || {
    label: finding.researchType,
    color: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30',
    icon: '📋',
  };

  const swot = finding.findings.swot as { strengths?: string[]; weaknesses?: string[]; opportunities?: string[]; threats?: string[] } | undefined;

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-xs" onClick={onBack}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Badge className={config.color}>
              {config.icon} {config.label}
            </Badge>
            <h2 className="text-lg font-semibold text-zinc-100 truncate">
              {finding.targetUrl || finding.targetQuery || 'Research Finding'}
            </h2>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            {new Date(finding.createdAt).toLocaleString()}
            {finding.expiresAt && ` · Expires ${new Date(finding.expiresAt).toLocaleDateString()}`}
          </p>
        </div>
        {confirmDelete ? (
          <div className="flex gap-2">
            <Button variant="destructive" size="sm" onClick={() => onDelete(finding.id)}>
              Confirm Delete
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setConfirmDelete(true)}
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        )}
      </div>

      {/* ── Report Markdown ── */}
      {finding.reportMarkdown && (
        <Card className="border-white/10 bg-white/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-300">Report</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <pre className="text-xs text-zinc-400 whitespace-pre-wrap font-mono">
                {finding.reportMarkdown}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* ── SWOT Analysis ── */}
      {swot && (
        <div className="grid grid-cols-2 gap-4">
          {swot.strengths && swot.strengths.length > 0 && (
            <SwotCard title="Strengths" items={swot.strengths} color="emerald" icon="✅" />
          )}
          {swot.weaknesses && swot.weaknesses.length > 0 && (
            <SwotCard title="Weaknesses" items={swot.weaknesses} color="red" icon="❌" />
          )}
          {swot.opportunities && swot.opportunities.length > 0 && (
            <SwotCard title="Opportunities" items={swot.opportunities} color="blue" icon="🎯" />
          )}
          {swot.threats && swot.threats.length > 0 && (
            <SwotCard title="Threats" items={swot.threats} color="amber" icon="⚠️" />
          )}
        </div>
      )}

      {/* ── Raw Findings ── */}
      <Card className="border-white/10 bg-white/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-zinc-300">Raw Findings Data</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            <pre className="text-xs text-zinc-400 whitespace-pre-wrap font-mono">
              {JSON.stringify(finding.findings, null, 2)}
            </pre>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function SwotCard({
  title,
  items,
  color,
  icon,
}: {
  title: string;
  items: string[];
  color: string;
  icon: string;
}) {
  const colorClasses: Record<string, string> = {
    emerald: 'border-emerald-500/30 bg-emerald-500/5',
    red: 'border-red-500/30 bg-red-500/5',
    blue: 'border-blue-500/30 bg-blue-500/5',
    amber: 'border-amber-500/30 bg-amber-500/5',
  };

  return (
    <Card className={`border ${colorClasses[color] || 'border-white/10 bg-white/5'}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-zinc-300">
          {icon} {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1">
          {items.map((item, i) => (
            <li key={i} className="text-xs text-zinc-400 flex items-start gap-2">
              <span className="text-zinc-600 shrink-0">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ─── Helpers ──────────────────────────

function getTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function safeHostname(url?: string): string {
  if (!url) return '';
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function extractSummary(finding: ResearchFinding): string {
  const analysis = finding.findings.analysis as Record<string, unknown> | undefined;
  if (analysis) {
    const domain = analysis.domain as string | undefined;
    if (domain) return `Analyzed ${domain}`;
  }

  const swot = finding.findings.swot as { summary?: string } | undefined;
  if (swot?.summary) return swot.summary;

  const competitors = finding.findings.competitors as Array<{ domain?: string }> | undefined;
  if (competitors && competitors.length > 0) {
    return `Compared ${competitors.length} competitor${competitors.length > 1 ? 's' : ''}`;
  }

  return '';
}
