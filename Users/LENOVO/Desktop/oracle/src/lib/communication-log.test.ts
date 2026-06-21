import { describe, it, expect, beforeEach } from 'vitest';
import {
  addCommunication,
  getCommunications,
  deleteCommunication,
  getPendingFollowUps,
  getCommunicationStats,
  getChannelIcon,
  getSentimentIcon,
  type CommunicationEntry,
} from './communication-log';

const COMM_KEY = 'oracle_comm_log';

function makeEntry(overrides: Partial<CommunicationEntry> = {}): CommunicationEntry {
  return {
    id: `test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    projectId: 'proj-1',
    clientName: 'Test Client',
    channel: 'email',
    direction: 'outbound',
    subject: 'Test Subject',
    summary: 'Test summary',
    sentiment: 'neutral',
    followUpRequired: false,
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('addCommunication', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('adds entry with id and timestamp', () => {
    const entry = addCommunication({
      projectId: 'proj-1',
      clientName: 'Client',
      channel: 'email',
      direction: 'outbound',
      subject: 'Hi',
      summary: 'Hello',
      sentiment: 'neutral',
      followUpRequired: false,
    });
    expect(entry.id).toBeTruthy();
    expect(entry.timestamp).toBeGreaterThan(0);
    expect(entry.subject).toBe('Hi');
  });

  it('stores entry in localStorage', () => {
    addCommunication({
      projectId: 'proj-1',
      clientName: 'Client',
      channel: 'phone',
      direction: 'inbound',
      subject: 'Call',
      summary: 'Called about project',
      sentiment: 'positive',
      followUpRequired: false,
    });
    const stored = JSON.parse(localStorage.getItem(COMM_KEY) || '[]');
    expect(stored.length).toBe(1);
    expect(stored[0].channel).toBe('phone');
  });

  it('prepends new entries (newest first)', () => {
    addCommunication({
      projectId: 'proj-1', clientName: 'C', channel: 'email',
      direction: 'outbound', subject: 'First', summary: '', sentiment: 'neutral', followUpRequired: false,
    });
    addCommunication({
      projectId: 'proj-1', clientName: 'C', channel: 'email',
      direction: 'outbound', subject: 'Second', summary: '', sentiment: 'neutral', followUpRequired: false,
    });
    const stored = JSON.parse(localStorage.getItem(COMM_KEY) || '[]');
    expect(stored[0].subject).toBe('Second');
    expect(stored[1].subject).toBe('First');
  });

  it('caps storage at 1000 entries', () => {
    const entries = Array.from({ length: 1000 }, () => makeEntry());
    localStorage.setItem(COMM_KEY, JSON.stringify(entries));

    addCommunication({
      projectId: 'proj-1', clientName: 'C', channel: 'email',
      direction: 'outbound', subject: 'New', summary: '', sentiment: 'neutral', followUpRequired: false,
    });

    const stored = JSON.parse(localStorage.getItem(COMM_KEY) || '[]');
    expect(stored.length).toBe(1000);
    expect(stored[0].subject).toBe('New');
  });
});

describe('getCommunications', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns empty array when no data', () => {
    expect(getCommunications()).toEqual([]);
  });

  it('returns all entries', () => {
    const entries = [makeEntry({ projectId: 'p1' }), makeEntry({ projectId: 'p2' })];
    localStorage.setItem(COMM_KEY, JSON.stringify(entries));
    expect(getCommunications().length).toBe(2);
  });

  it('filters by projectId', () => {
    const entries = [
      makeEntry({ projectId: 'p1', id: '1' }),
      makeEntry({ projectId: 'p2', id: '2' }),
      makeEntry({ projectId: 'p1', id: '3' }),
    ];
    localStorage.setItem(COMM_KEY, JSON.stringify(entries));
    const result = getCommunications('p1');
    expect(result.length).toBe(2);
    expect(result.every(e => e.projectId === 'p1')).toBe(true);
  });
});

describe('deleteCommunication', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('removes entry by id', () => {
    const entries = [
      makeEntry({ id: 'to-keep' }),
      makeEntry({ id: 'to-delete' }),
    ];
    localStorage.setItem(COMM_KEY, JSON.stringify(entries));

    deleteCommunication('to-delete');
    const stored = JSON.parse(localStorage.getItem(COMM_KEY) || '[]');
    expect(stored.length).toBe(1);
    expect(stored[0].id).toBe('to-keep');
  });

  it('handles unknown id gracefully', () => {
    localStorage.setItem(COMM_KEY, JSON.stringify([makeEntry({ id: 'exists' })]));
    deleteCommunication('nonexistent');
    const stored = JSON.parse(localStorage.getItem(COMM_KEY) || '[]');
    expect(stored.length).toBe(1);
  });
});

describe('getPendingFollowUps', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns follow-ups due within 7 days', () => {
    const now = Date.now();
    const entries = [
      makeEntry({ id: '1', followUpRequired: true, followUpDate: now + 1000, timestamp: now }),
      makeEntry({ id: '2', followUpRequired: true, followUpDate: now + 1000 * 60 * 60 * 24 * 3, timestamp: now }),
      makeEntry({ id: '3', followUpRequired: false, followUpDate: now + 1000, timestamp: now }),
      makeEntry({ id: '4', followUpRequired: true, followUpDate: now + 1000 * 60 * 60 * 24 * 10, timestamp: now }), // Too far out
    ];
    localStorage.setItem(COMM_KEY, JSON.stringify(entries));
    const result = getPendingFollowUps();
    expect(result.length).toBe(2);
  });

  it('sorts by followUpDate ascending', () => {
    const now = Date.now();
    const entries = [
      makeEntry({ id: '1', followUpRequired: true, followUpDate: now + 5000, timestamp: now }),
      makeEntry({ id: '2', followUpRequired: true, followUpDate: now + 1000, timestamp: now }),
    ];
    localStorage.setItem(COMM_KEY, JSON.stringify(entries));
    const result = getPendingFollowUps();
    expect(result[0].id).toBe('2');
    expect(result[1].id).toBe('1');
  });
});

describe('getCommunicationStats', () => {
  it('counts total and direction', () => {
    const entries = [
      makeEntry({ direction: 'outbound' }),
      makeEntry({ direction: 'outbound' }),
      makeEntry({ direction: 'inbound' }),
    ];
    const stats = getCommunicationStats(entries);
    expect(stats.total).toBe(3);
    expect(stats.outbound).toBe(2);
    expect(stats.inbound).toBe(1);
  });

  it('counts channels', () => {
    const entries = [
      makeEntry({ channel: 'email' }),
      makeEntry({ channel: 'email' }),
      makeEntry({ channel: 'phone' }),
    ];
    const stats = getCommunicationStats(entries);
    expect(stats.channels.email).toBe(2);
    expect(stats.channels.phone).toBe(1);
  });

  it('counts sentiment', () => {
    const entries = [
      makeEntry({ sentiment: 'positive' }),
      makeEntry({ sentiment: 'neutral' }),
      makeEntry({ sentiment: 'negative' }),
      makeEntry({ sentiment: 'positive' }),
    ];
    const stats = getCommunicationStats(entries);
    expect(stats.sentimentBreakdown.positive).toBe(2);
    expect(stats.sentimentBreakdown.neutral).toBe(1);
    expect(stats.sentimentBreakdown.negative).toBe(1);
  });

  it('returns 0 for empty entries', () => {
    const stats = getCommunicationStats([]);
    expect(stats.total).toBe(0);
    expect(stats.outbound).toBe(0);
    expect(stats.inbound).toBe(0);
  });
});

describe('getChannelIcon', () => {
  it('returns correct icons for each channel', () => {
    expect(getChannelIcon('email')).toBe('📧');
    expect(getChannelIcon('phone')).toBe('📞');
    expect(getChannelIcon('whatsapp')).toBe('💬');
    expect(getChannelIcon('linkedin')).toBe('💼');
    expect(getChannelIcon('meeting')).toBe('🤝');
    expect(getChannelIcon('in-person')).toBe('👥');
    expect(getChannelIcon('other')).toBe('📋');
  });
});

describe('getSentimentIcon', () => {
  it('returns correct icons', () => {
    expect(getSentimentIcon('positive')).toBe('😊');
    expect(getSentimentIcon('negative')).toBe('😟');
    expect(getSentimentIcon('neutral')).toBe('😐');
    expect(getSentimentIcon('unknown')).toBe('😐');
  });
});
