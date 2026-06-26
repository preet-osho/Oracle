// ═══════════════════════════════════════
// ORACLE — Client Communication Log
// Record every client touchpoint · Timeline view · Follow-up tracking
// ═══════════════════════════════════════

// ─── Types ─────────────────────────────

export type CommunicationChannel = 'email' | 'phone' | 'whatsapp' | 'linkedin' | 'meeting' | 'in-person' | 'other';

export interface CommunicationEntry {
  id: string;
  projectId: string;
  clientName: string;
  channel: CommunicationChannel;
  direction: 'outbound' | 'inbound';
  subject: string;
  summary: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  followUpRequired: boolean;
  followUpDate?: number;
  timestamp: number;
}

// ─── Storage ───────────────────────────

const COMM_LOG_KEY = 'oracle_comm_log';

export function addCommunication(entry: Omit<CommunicationEntry, 'id' | 'timestamp'>): CommunicationEntry {
  const full: CommunicationEntry = {
    ...entry,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  };
  if (typeof window === 'undefined') return full;
  try {
    const raw = localStorage.getItem(COMM_LOG_KEY);
    const entries: CommunicationEntry[] = raw ? JSON.parse(raw) : [];
    entries.unshift(full);
    localStorage.setItem(COMM_LOG_KEY, JSON.stringify(entries.slice(0, 1000)));
  } catch {
    // Silently fail
  }
  return full;
}

export function getCommunications(projectId?: string): CommunicationEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(COMM_LOG_KEY);
    const entries: CommunicationEntry[] = raw ? JSON.parse(raw) : [];
    if (projectId) return entries.filter((e) => e.projectId === projectId);
    return entries;
  } catch {
    return [];
  }
}

export function deleteCommunication(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(COMM_LOG_KEY);
    const entries: CommunicationEntry[] = raw ? JSON.parse(raw) : [];
    localStorage.setItem(COMM_LOG_KEY, JSON.stringify(entries.filter((e) => e.id !== id)));
  } catch {
    // Silently fail
  }
}

// ─── Analysis ──────────────────────────

export function getPendingFollowUps(): CommunicationEntry[] {
  const entries = getCommunications();
  const now = Date.now();
  return entries
    .filter((e) => e.followUpRequired && e.followUpDate && e.followUpDate <= now + 7 * 24 * 60 * 60 * 1000)
    .sort((a, b) => (a.followUpDate || 0) - (b.followUpDate || 0));
}

export function getCommunicationStats(entries: CommunicationEntry[]): {
  total: number;
  outbound: number;
  inbound: number;
  channels: Record<CommunicationChannel, number>;
  sentimentBreakdown: Record<string, number>;
  pendingFollowUps: number;
} {
  const channels = {} as Record<CommunicationChannel, number>;
  const sentimentBreakdown: Record<string, number> = {};

  for (const entry of entries) {
    channels[entry.channel] = (channels[entry.channel] || 0) + 1;
    sentimentBreakdown[entry.sentiment] = (sentimentBreakdown[entry.sentiment] || 0) + 1;
  }

  return {
    total: entries.length,
    outbound: entries.filter((e) => e.direction === 'outbound').length,
    inbound: entries.filter((e) => e.direction === 'inbound').length,
    channels,
    sentimentBreakdown,
    pendingFollowUps: getPendingFollowUps().length,
  };
}

export function getChannelIcon(channel: CommunicationChannel): string {
  switch (channel) {
    case 'email': return '📧';
    case 'phone': return '📞';
    case 'whatsapp': return '💬';
    case 'linkedin': return '💼';
    case 'meeting': return '🤝';
    case 'in-person': return '👥';
    default: return '📋';
  }
}

export function getSentimentIcon(sentiment: string): string {
  switch (sentiment) {
    case 'positive': return '😊';
    case 'negative': return '😟';
    default: return '😐';
  }
}
