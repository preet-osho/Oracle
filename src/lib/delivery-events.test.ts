import { describe, it, expect, beforeEach } from 'vitest';
import { storeDeliveryEvent, getDeliveryEvents, getDeliveryStats, clearDeliveryEvents, clearTestEvents, countTestEvents, getTestEventTTL, setTestEventTTL, cleanExpiredTestEvents } from './delivery-events';

// ─── Tests ─────────────────────────────

describe('Delivery Events Storage', () => {
  beforeEach(() => {
    clearDeliveryEvents();
  });

  it('stores and retrieves delivery events', () => {
    storeDeliveryEvent({
      provider: 'resend',
      channel: 'email',
      eventType: 'email.delivered',
      messageId: 'msg-001',
      recipient: 'test@example.com',
      sender: 'oracle@example.com',
      metadata: {},
    });

    const events = getDeliveryEvents();
    expect(events).toHaveLength(1);
    expect(events[0].messageId).toBe('msg-001');
    expect(events[0].eventType).toBe('email.delivered');
    expect(events[0].provider).toBe('resend');
    expect(events[0].channel).toBe('email');
  });

  it('stores WhatsApp delivery events', () => {
    storeDeliveryEvent({
      provider: 'twilio',
      channel: 'whatsapp',
      eventType: 'whatsapp.delivered',
      messageId: 'SM123456',
      recipient: '+919876543210',
      sender: '+911234567890',
      metadata: {},
    });

    const events = getDeliveryEvents();
    expect(events).toHaveLength(1);
    expect(events[0].provider).toBe('twilio');
    expect(events[0].channel).toBe('whatsapp');
  });

  it('filters by channel', () => {
    storeDeliveryEvent({
      provider: 'resend',
      channel: 'email',
      eventType: 'email.delivered',
      messageId: 'msg-001',
      metadata: {},
    });
    storeDeliveryEvent({
      provider: 'twilio',
      channel: 'whatsapp',
      eventType: 'whatsapp.delivered',
      messageId: 'SM001',
      metadata: {},
    });

    const emailEvents = getDeliveryEvents({ channel: 'email' });
    expect(emailEvents).toHaveLength(1);
    expect(emailEvents[0].channel).toBe('email');

    const whatsappEvents = getDeliveryEvents({ channel: 'whatsapp' });
    expect(whatsappEvents).toHaveLength(1);
    expect(whatsappEvents[0].channel).toBe('whatsapp');
  });

  it('filters by provider', () => {
    storeDeliveryEvent({
      provider: 'resend',
      channel: 'email',
      eventType: 'email.sent',
      messageId: 'msg-001',
      metadata: {},
    });
    storeDeliveryEvent({
      provider: 'resend',
      channel: 'email',
      eventType: 'email.delivered',
      messageId: 'msg-002',
      metadata: {},
    });

    const resendEvents = getDeliveryEvents({ provider: 'resend' });
    expect(resendEvents).toHaveLength(2);
  });

  it('filters by event type', () => {
    storeDeliveryEvent({
      provider: 'resend',
      channel: 'email',
      eventType: 'email.delivered',
      messageId: 'msg-001',
      metadata: {},
    });
    storeDeliveryEvent({
      provider: 'resend',
      channel: 'email',
      eventType: 'email.opened',
      messageId: 'msg-001',
      metadata: {},
    });

    const deliveredEvents = getDeliveryEvents({ eventType: 'email.delivered' });
    expect(deliveredEvents).toHaveLength(1);
    expect(deliveredEvents[0].eventType).toBe('email.delivered');
  });

  it('limits results', () => {
    for (let i = 0; i < 10; i++) {
      storeDeliveryEvent({
        provider: 'resend',
        channel: 'email',
        eventType: 'email.delivered',
        messageId: `msg-${i}`,
        metadata: {},
      });
    }

    const limited = getDeliveryEvents({ limit: 5 });
    expect(limited).toHaveLength(5);
  });

  it('returns stats with correct counts', () => {
    storeDeliveryEvent({
      provider: 'resend',
      channel: 'email',
      eventType: 'email.delivered',
      messageId: 'msg-001',
      metadata: {},
    });
    storeDeliveryEvent({
      provider: 'resend',
      channel: 'email',
      eventType: 'email.opened',
      messageId: 'msg-001',
      metadata: {},
    });
    storeDeliveryEvent({
      provider: 'resend',
      channel: 'email',
      eventType: 'email.clicked',
      messageId: 'msg-001',
      metadata: {},
    });
    storeDeliveryEvent({
      provider: 'twilio',
      channel: 'whatsapp',
      eventType: 'whatsapp.failed',
      messageId: 'SM001',
      metadata: {},
    });

    const stats = getDeliveryStats();
    expect(stats.totalEvents).toBe(4);
    expect(stats.emailEvents).toBe(3);
    expect(stats.whatsappEvents).toBe(1);
    expect(stats.byStatus.delivered).toBe(1);
    expect(stats.byStatus.opened).toBe(1);
    expect(stats.byStatus.clicked).toBe(1);
    expect(stats.byStatus.failed).toBe(1);
    expect(stats.byType['email.delivered']).toBe(1);
    expect(stats.byType['email.opened']).toBe(1);
  });

  it('clears all events', () => {
    storeDeliveryEvent({
      provider: 'resend',
      channel: 'email',
      eventType: 'email.delivered',
      messageId: 'msg-001',
      metadata: {},
    });

    clearDeliveryEvents();
    const events = getDeliveryEvents();
    expect(events).toHaveLength(0);
  });

  it('returns empty array on server side', () => {
    // This test verifies the SSR safety
    const events = getDeliveryEvents();
    expect(Array.isArray(events)).toBe(true);
  });

  it('generates unique IDs for each event', () => {
    const event1 = storeDeliveryEvent({
      provider: 'resend',
      channel: 'email',
      eventType: 'email.delivered',
      messageId: 'msg-001',
      metadata: {},
    });
    const event2 = storeDeliveryEvent({
      provider: 'resend',
      channel: 'email',
      eventType: 'email.delivered',
      messageId: 'msg-002',
      metadata: {},
    });

    expect(event1.id).not.toBe(event2.id);
    expect(event1.id).toBeTruthy();
    expect(event2.id).toBeTruthy();
  });

  it('includes receivedAt timestamp', () => {
    const before = Date.now();
    const event = storeDeliveryEvent({
      provider: 'resend',
      channel: 'email',
      eventType: 'email.delivered',
      messageId: 'msg-001',
      metadata: {},
    });
    const after = Date.now();

    expect(event.receivedAt).toBeGreaterThanOrEqual(before);
    expect(event.receivedAt).toBeLessThanOrEqual(after);
  });

  it('stores metadata correctly', () => {
    const event = storeDeliveryEvent({
      provider: 'resend',
      channel: 'email',
      eventType: 'email.clicked',
      messageId: 'msg-001',
      metadata: {
        url: 'https://example.com',
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
      },
    });

    expect(event.metadata.url).toBe('https://example.com');
    expect(event.metadata.ip).toBe('127.0.0.1');
  });

  it('returns recentEvents in stats', () => {
    for (let i = 0; i < 25; i++) {
      storeDeliveryEvent({
        provider: 'resend',
        channel: 'email',
        eventType: 'email.delivered',
        messageId: `msg-${i}`,
        metadata: {},
      });
    }

    const stats = getDeliveryStats();
    expect(stats.recentEvents).toHaveLength(20); // Limited to 20
  });

  // ─── Test Event TTL Tests ──────────────

  describe('Test Event TTL', () => {
    beforeEach(() => {
      clearDeliveryEvents();
      localStorage.removeItem('oracle_test_event_ttl_ms');
    });

    describe('getTestEventTTL', () => {
      it('returns default TTL (1 hour) when no value is set', () => {
        const ttl = getTestEventTTL();
        expect(ttl).toBe(60 * 60 * 1000);
      });

      it('returns stored TTL when set', () => {
        setTestEventTTL(30 * 60 * 1000); // 30 minutes
        const ttl = getTestEventTTL();
        expect(ttl).toBe(30 * 60 * 1000);
      });
    });

    describe('setTestEventTTL', () => {
      it('stores TTL value in localStorage', () => {
        setTestEventTTL(5 * 60 * 1000); // 5 minutes
        const stored = localStorage.getItem('oracle_test_event_ttl_ms');
        expect(stored).toBe(String(5 * 60 * 1000));
      });

      it('overwrites previous TTL value', () => {
        setTestEventTTL(10 * 60 * 1000);
        setTestEventTTL(20 * 60 * 1000);
        const ttl = getTestEventTTL();
        expect(ttl).toBe(20 * 60 * 1000);
      });
    });

    describe('cleanExpiredTestEvents', () => {
      it('removes expired test events', () => {
        // Set very short TTL
        setTestEventTTL(1000); // 1 second

        // Store a test event in the past (well beyond TTL)
        const oldEvent = storeDeliveryEvent({
          provider: 'resend',
          channel: 'email',
          eventType: 'email.delivered',
          messageId: 'old-test-msg',
          metadata: { testEvent: true },
        });
        // Manually set receivedAt to 10 seconds ago
        const events = getDeliveryEvents();
        const eventIndex = events.findIndex(e => e.id === oldEvent.id);
        events[eventIndex].receivedAt = Date.now() - 10000;
        localStorage.setItem('oracle_delivery_events', JSON.stringify(events));

        // Store a recent test event (within TTL)
        storeDeliveryEvent({
          provider: 'resend',
          channel: 'email',
          eventType: 'email.delivered',
          messageId: 'recent-test-msg',
          metadata: { testEvent: true },
        });

        // Store a non-test event (should never be removed)
        storeDeliveryEvent({
          provider: 'resend',
          channel: 'email',
          eventType: 'email.delivered',
          messageId: 'real-msg',
          metadata: {},
        });

        const removed = cleanExpiredTestEvents();
        expect(removed).toBe(1); // Only old test event removed

        const remaining = getDeliveryEvents();
        expect(remaining).toHaveLength(2); // Recent test + non-test
        expect(remaining.find(e => e.messageId === 'old-test-msg')).toBeUndefined();
        expect(remaining.find(e => e.messageId === 'recent-test-msg')).toBeDefined();
        expect(remaining.find(e => e.messageId === 'real-msg')).toBeDefined();
      });

      it('keeps all events when none are expired', () => {
        setTestEventTTL(60 * 60 * 1000); // 1 hour

        // Store recent test event (within TTL)
        storeDeliveryEvent({
          provider: 'resend',
          channel: 'email',
          eventType: 'email.delivered',
          messageId: 'recent-msg',
          metadata: { testEvent: true },
        });

        const removed = cleanExpiredTestEvents();
        expect(removed).toBe(0);

        const events = getDeliveryEvents();
        expect(events).toHaveLength(1);
      });

      it('preserves non-test events regardless of age', () => {
        setTestEventTTL(1000); // 1 second

        // Store an old non-test event
        const oldEvent = storeDeliveryEvent({
          provider: 'resend',
          channel: 'email',
          eventType: 'email.delivered',
          messageId: 'old-real-msg',
          metadata: {},
        });
        const events = getDeliveryEvents();
        const eventIndex = events.findIndex(e => e.id === oldEvent.id);
        events[eventIndex].receivedAt = Date.now() - 10000;
        localStorage.setItem('oracle_delivery_events', JSON.stringify(events));

        const removed = cleanExpiredTestEvents();
        expect(removed).toBe(0); // No test events to remove

        const remaining = getDeliveryEvents();
        expect(remaining).toHaveLength(1); // Old non-test event preserved
        expect(remaining[0].messageId).toBe('old-real-msg');
      });

      it('returns 0 when no events exist', () => {
        const removed = cleanExpiredTestEvents();
        expect(removed).toBe(0);
      });

      it('handles corrupted localStorage gracefully', () => {
        localStorage.setItem('oracle_delivery_events', 'invalid-json');
        const removed = cleanExpiredTestEvents();
        expect(removed).toBe(0);
      });
    });

    describe('clearTestEvents', () => {
      it('removes all test events and returns count', () => {
        storeDeliveryEvent({
          provider: 'resend',
          channel: 'email',
          eventType: 'email.delivered',
          messageId: 'test-1',
          metadata: { testEvent: true },
        });
        storeDeliveryEvent({
          provider: 'resend',
          channel: 'email',
          eventType: 'email.delivered',
          messageId: 'test-2',
          metadata: { testEvent: true },
        });
        storeDeliveryEvent({
          provider: 'resend',
          channel: 'email',
          eventType: 'email.delivered',
          messageId: 'real-1',
          metadata: {},
        });

        const removed = clearTestEvents();
        expect(removed).toBe(2);

        const events = getDeliveryEvents();
        expect(events).toHaveLength(1);
        expect(events[0].messageId).toBe('real-1');
      });

      it('returns 0 when no test events exist', () => {
        storeDeliveryEvent({
          provider: 'resend',
          channel: 'email',
          eventType: 'email.delivered',
          messageId: 'real-1',
          metadata: {},
        });

        const removed = clearTestEvents();
        expect(removed).toBe(0);

        const events = getDeliveryEvents();
        expect(events).toHaveLength(1);
      });
    });

    describe('countTestEvents', () => {
      it('counts only test events', () => {
        storeDeliveryEvent({
          provider: 'resend',
          channel: 'email',
          eventType: 'email.delivered',
          messageId: 'test-1',
          metadata: { testEvent: true },
        });
        storeDeliveryEvent({
          provider: 'resend',
          channel: 'email',
          eventType: 'email.delivered',
          messageId: 'test-2',
          metadata: { testEvent: true },
        });
        storeDeliveryEvent({
          provider: 'resend',
          channel: 'email',
          eventType: 'email.delivered',
          messageId: 'real-1',
          metadata: {},
        });

        const count = countTestEvents();
        expect(count).toBe(2);
      });

      it('returns 0 when no test events exist', () => {
        storeDeliveryEvent({
          provider: 'resend',
          channel: 'email',
          eventType: 'email.delivered',
          messageId: 'real-1',
          metadata: {},
        });

        const count = countTestEvents();
        expect(count).toBe(0);
      });
    });
  });

  // ─── Edge Case & Coverage Tests ───────

  describe('Edge Cases', () => {
    it('respects MAX_EVENTS cap of 500', () => {
      // Store 510 events — only the last 500 should remain
      for (let i = 0; i < 510; i++) {
        storeDeliveryEvent({
          provider: 'resend',
          channel: 'email',
          eventType: 'email.sent',
          messageId: `msg-${String(i).padStart(3, '0')}`,
          metadata: {},
        });
      }

      const events = getDeliveryEvents();
      expect(events).toHaveLength(500);
      // Most recent event should be first
      expect(events[0].messageId).toBe('msg-509');
      // Oldest retained should be msg-010
      expect(events[events.length - 1].messageId).toBe('msg-010');
    });

    it('classifies queued events as pending', () => {
      storeDeliveryEvent({
        provider: 'twilio',
        channel: 'whatsapp',
        eventType: 'whatsapp.queued',
        messageId: 'SM-Q1',
        metadata: {},
      });

      const stats = getDeliveryStats();
      expect(stats.byStatus.pending).toBe(1);
      expect(stats.byStatus.delivered).toBe(0);
      expect(stats.byStatus.failed).toBe(0);
    });

    it('classifies sent events as pending', () => {
      storeDeliveryEvent({
        provider: 'resend',
        channel: 'email',
        eventType: 'email.sent',
        messageId: 'msg-S1',
        metadata: {},
      });

      const stats = getDeliveryStats();
      expect(stats.byStatus.pending).toBe(1);
    });

    it('classifies scheduled events as pending', () => {
      storeDeliveryEvent({
        provider: 'resend',
        channel: 'email',
        eventType: 'email.scheduled',
        messageId: 'msg-SC1',
        metadata: {},
      });

      const stats = getDeliveryStats();
      expect(stats.byStatus.pending).toBe(1);
    });

    it('classifies delivery_delayed as pending (not delivered)', () => {
      storeDeliveryEvent({
        provider: 'resend',
        channel: 'email',
        eventType: 'email.delivery_delayed',
        messageId: 'msg-DL1',
        metadata: {},
      });

      const stats = getDeliveryStats();
      expect(stats.byStatus.pending).toBe(1);
      expect(stats.byStatus.delivered).toBe(0);
    });

    it('classifies bounced and undelivered as failed', () => {
      storeDeliveryEvent({
        provider: 'resend',
        channel: 'email',
        eventType: 'email.bounced',
        messageId: 'msg-B1',
        metadata: {},
      });
      storeDeliveryEvent({
        provider: 'twilio',
        channel: 'whatsapp',
        eventType: 'whatsapp.undelivered',
        messageId: 'SM-UD1',
        metadata: {},
      });

      const stats = getDeliveryStats();
      expect(stats.byStatus.failed).toBe(2);
    });

    it('classifies complained as neither delivered nor failed (no match)', () => {
      storeDeliveryEvent({
        provider: 'resend',
        channel: 'email',
        eventType: 'email.complained',
        messageId: 'msg-C1',
        metadata: {},
      });

      const stats = getDeliveryStats();
      expect(stats.byStatus.delivered).toBe(0);
      expect(stats.byStatus.failed).toBe(0);
      expect(stats.byStatus.pending).toBe(0);
      expect(stats.totalEvents).toBe(1);
    });

    it('classifies suppressed as neither delivered nor failed', () => {
      storeDeliveryEvent({
        provider: 'resend',
        channel: 'email',
        eventType: 'email.suppressed',
        messageId: 'msg-SP1',
        metadata: {},
      });

      const stats = getDeliveryStats();
      expect(stats.byStatus.delivered).toBe(0);
      expect(stats.byStatus.failed).toBe(0);
    });

    it('classifies received as neither delivered nor failed', () => {
      storeDeliveryEvent({
        provider: 'resend',
        channel: 'email',
        eventType: 'email.received',
        messageId: 'msg-RC1',
        metadata: {},
      });

      const stats = getDeliveryStats();
      expect(stats.byStatus.delivered).toBe(0);
      expect(stats.byStatus.failed).toBe(0);
    });

    it('stores subject and errorCode/errorMessage fields', () => {
      const event = storeDeliveryEvent({
        provider: 'resend',
        channel: 'email',
        eventType: 'email.bounced',
        messageId: 'msg-ERR1',
        recipient: 'bad@example.com',
        subject: 'Weekly Report',
        errorCode: '550',
        errorMessage: 'Mailbox not found',
        metadata: {},
      });

      expect(event.subject).toBe('Weekly Report');
      expect(event.errorCode).toBe('550');
      expect(event.errorMessage).toBe('Mailbox not found');
    });

    it('combines channel and eventType filters', () => {
      storeDeliveryEvent({
        provider: 'resend',
        channel: 'email',
        eventType: 'email.delivered',
        messageId: 'msg-001',
        metadata: {},
      });
      storeDeliveryEvent({
        provider: 'resend',
        channel: 'email',
        eventType: 'email.opened',
        messageId: 'msg-002',
        metadata: {},
      });
      storeDeliveryEvent({
        provider: 'twilio',
        channel: 'whatsapp',
        eventType: 'whatsapp.delivered',
        messageId: 'SM-001',
        metadata: {},
      });

      const result = getDeliveryEvents({ channel: 'email', eventType: 'email.opened' });
      expect(result).toHaveLength(1);
      expect(result[0].messageId).toBe('msg-002');
    });

    it('returns empty array when no events match filter', () => {
      storeDeliveryEvent({
        provider: 'resend',
        channel: 'email',
        eventType: 'email.delivered',
        messageId: 'msg-001',
        metadata: {},
      });

      const result = getDeliveryEvents({ channel: 'whatsapp' });
      expect(result).toHaveLength(0);
    });

    it('handles corrupted localStorage in getDeliveryEvents', () => {
      localStorage.setItem('oracle_delivery_events', 'invalid-json!');
      const events = getDeliveryEvents();
      expect(events).toEqual([]);
    });

    it('handles corrupted localStorage in getDeliveryStats', () => {
      localStorage.setItem('oracle_delivery_events', 'not-json');
      const stats = getDeliveryStats();
      expect(stats.totalEvents).toBe(0);
      expect(stats.emailEvents).toBe(0);
      expect(stats.whatsappEvents).toBe(0);
      expect(stats.byStatus.delivered).toBe(0);
      expect(stats.recentEvents).toHaveLength(0);
    });

    it('returns all events when no filters are provided', () => {
      storeDeliveryEvent({
        provider: 'resend',
        channel: 'email',
        eventType: 'email.delivered',
        messageId: 'msg-001',
        metadata: {},
      });
      storeDeliveryEvent({
        provider: 'twilio',
        channel: 'whatsapp',
        eventType: 'whatsapp.sent',
        messageId: 'SM-001',
        metadata: {},
      });

      const all = getDeliveryEvents();
      expect(all).toHaveLength(2);
    });

    it('returns correct stats for empty storage', () => {
      const stats = getDeliveryStats();
      expect(stats.totalEvents).toBe(0);
      expect(stats.emailEvents).toBe(0);
      expect(stats.whatsappEvents).toBe(0);
      expect(stats.byType).toEqual({});
      expect(stats.byStatus.delivered).toBe(0);
      expect(stats.byStatus.failed).toBe(0);
      expect(stats.byStatus.pending).toBe(0);
      expect(stats.byStatus.opened).toBe(0);
      expect(stats.byStatus.clicked).toBe(0);
      expect(stats.recentEvents).toHaveLength(0);
    });

    it('tracks byType counts for all event types', () => {
      storeDeliveryEvent({
        provider: 'resend',
        channel: 'email',
        eventType: 'email.delivered',
        messageId: 'msg-001',
        metadata: {},
      });
      storeDeliveryEvent({
        provider: 'resend',
        channel: 'email',
        eventType: 'email.delivered',
        messageId: 'msg-002',
        metadata: {},
      });
      storeDeliveryEvent({
        provider: 'resend',
        channel: 'email',
        eventType: 'email.opened',
        messageId: 'msg-001',
        metadata: {},
      });
      storeDeliveryEvent({
        provider: 'twilio',
        channel: 'whatsapp',
        eventType: 'whatsapp.read',
        messageId: 'SM-001',
        metadata: {},
      });

      const stats = getDeliveryStats();
      expect(stats.byType['email.delivered']).toBe(2);
      expect(stats.byType['email.opened']).toBe(1);
      expect(stats.byType['whatsapp.read']).toBe(1);
    });

    it('returns most recent events first', () => {
      storeDeliveryEvent({
        provider: 'resend',
        channel: 'email',
        eventType: 'email.sent',
        messageId: 'msg-first',
        metadata: {},
      });
      storeDeliveryEvent({
        provider: 'resend',
        channel: 'email',
        eventType: 'email.sent',
        messageId: 'msg-second',
        metadata: {},
      });

      const events = getDeliveryEvents();
      expect(events[0].messageId).toBe('msg-second');
      expect(events[1].messageId).toBe('msg-first');
    });

    it('clearTestEvents and countTestEvents work with empty storage', () => {
      expect(clearTestEvents()).toBe(0);
      expect(countTestEvents()).toBe(0);
    });

    it('handles localStorage.removeItem throwing', () => {
      const orig = localStorage.removeItem;
      try {
        localStorage.removeItem = () => { throw new Error('blocked'); };
        // Should not throw
        expect(() => clearDeliveryEvents()).not.toThrow();
      } finally {
        localStorage.removeItem = orig;
      }
    });

    it('handles localStorage.getItem throwing in getDeliveryEvents', () => {
      const orig = localStorage.getItem;
      try {
        localStorage.getItem = () => { throw new Error('blocked'); };
        const events = getDeliveryEvents();
        expect(events).toEqual([]);
      } finally {
        localStorage.getItem = orig;
      }
    });

    it('handles localStorage.setItem throwing in storeDeliveryEvent', () => {
      const orig = localStorage.setItem;
      try {
        localStorage.setItem = () => { throw new Error('blocked'); };
        // Should not throw — silently fails
        const event = storeDeliveryEvent({
          provider: 'resend',
          channel: 'email',
          eventType: 'email.delivered',
          messageId: 'msg-ERR',
          metadata: {},
        });
        expect(event.id).toBeTruthy();
        expect(event.receivedAt).toBeGreaterThan(0);
      } finally {
        localStorage.setItem = orig;
      }
    });

    it('handles setTestEventTTL with corrupted localStorage', () => {
      const orig = localStorage.setItem;
      try {
        localStorage.setItem = () => { throw new Error('blocked'); };
        // Should not throw
        expect(() => setTestEventTTL(5000)).not.toThrow();
      } finally {
        localStorage.setItem = orig;
      }
    });

    it('handles getTestEventTTL with corrupted localStorage', () => {
      const orig = localStorage.getItem;
      try {
        localStorage.getItem = () => { throw new Error('blocked'); };
        // Should fall back to default TTL
        const ttl = getTestEventTTL();
        expect(ttl).toBe(60 * 60 * 1000);
      } finally {
        localStorage.getItem = orig;
      }
    });
  });
});
