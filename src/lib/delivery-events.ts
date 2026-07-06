// ═══════════════════════════════════════
// ORACLE — Delivery Event Storage
// Track email/WhatsApp delivery events from webhooks
// ═══════════════════════════════════════

// ─── Types ─────────────────────────────

export type DeliveryProvider = 'resend' | 'twilio';
export type DeliveryChannel = 'email' | 'whatsapp';

export type EmailEventType =
  | 'email.sent'
  | 'email.delivered'
  | 'email.opened'
  | 'email.clicked'
  | 'email.bounced'
  | 'email.complained'
  | 'email.failed'
  | 'email.delivery_delayed'
  | 'email.received'
  | 'email.scheduled'
  | 'email.suppressed';

export type WhatsAppEventType =
  | 'whatsapp.queued'
  | 'whatsapp.sent'
  | 'whatsapp.delivered'
  | 'whatsapp.read'
  | 'whatsapp.failed'
  | 'whatsapp.undelivered';

export type DeliveryEventType = EmailEventType | WhatsAppEventType;

export interface DeliveryEvent {
  id: string;
  provider: DeliveryProvider;
  channel: DeliveryChannel;
  eventType: DeliveryEventType;
  messageId: string;
  recipient?: string;
  sender?: string;
  subject?: string;
  errorCode?: string;
  errorMessage?: string;
  metadata: Record<string, unknown>;
  receivedAt: number;
}

export interface DeliveryStats {
  totalEvents: number;
  emailEvents: number;
  whatsappEvents: number;
  byType: Record<string, number>;
  byStatus: { delivered: number; failed: number; pending: number; opened: number; clicked: number };
  recentEvents: DeliveryEvent[];
}

// ─── Storage ───────────────────────────

const DELIVERY_EVENTS_KEY = 'oracle_delivery_events';
const MAX_EVENTS = 500;

export function storeDeliveryEvent(event: Omit<DeliveryEvent, 'id' | 'receivedAt'>): DeliveryEvent {
  const full: DeliveryEvent = {
    ...event,
    id: crypto.randomUUID(),
    receivedAt: Date.now(),
  };

  if (typeof window === 'undefined') return full;

  try {
    const raw = localStorage.getItem(DELIVERY_EVENTS_KEY);
    const events: DeliveryEvent[] = raw ? JSON.parse(raw) : [];
    events.unshift(full);
    localStorage.setItem(DELIVERY_EVENTS_KEY, JSON.stringify(events.slice(0, MAX_EVENTS)));
  } catch {
    // Silently fail
  }

  return full;
}

export function getDeliveryEvents(options?: {
  channel?: DeliveryChannel;
  provider?: DeliveryProvider;
  eventType?: DeliveryEventType;
  limit?: number;
}): DeliveryEvent[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = localStorage.getItem(DELIVERY_EVENTS_KEY);
    let events: DeliveryEvent[] = raw ? JSON.parse(raw) : [];

    if (options?.channel) {
      events = events.filter((e) => e.channel === options.channel);
    }
    if (options?.provider) {
      events = events.filter((e) => e.provider === options.provider);
    }
    if (options?.eventType) {
      events = events.filter((e) => e.eventType === options.eventType);
    }

    return options?.limit ? events.slice(0, options.limit) : events;
  } catch {
    return [];
  }
}

export function getDeliveryStats(): DeliveryStats {
  const events = getDeliveryEvents();

  const byType: Record<string, number> = {};
  let delivered = 0;
  let failed = 0;
  let pending = 0;
  let opened = 0;
  let clicked = 0;

  for (const event of events) {
    byType[event.eventType] = (byType[event.eventType] || 0) + 1;

    // Delivery status (use endsWith to avoid 'delivery_delayed' matching 'delivered')
    if (event.eventType.endsWith('.delivered')) delivered++;
    else if (event.eventType.endsWith('.failed') || event.eventType.endsWith('.bounced') || event.eventType.endsWith('.undelivered')) failed++;
    else if (event.eventType.endsWith('.sent') || event.eventType.endsWith('.queued') || event.eventType.endsWith('.scheduled') || event.eventType.endsWith('.delivery_delayed')) pending++;
    // Engagement metrics (tracked separately)
    if (event.eventType.includes('opened')) opened++;
    if (event.eventType.includes('clicked')) clicked++;
  }

  return {
    totalEvents: events.length,
    emailEvents: events.filter((e) => e.channel === 'email').length,
    whatsappEvents: events.filter((e) => e.channel === 'whatsapp').length,
    byType,
    byStatus: { delivered, failed, pending, opened, clicked },
    recentEvents: events.slice(0, 20),
  };
}

export function clearDeliveryEvents(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(DELIVERY_EVENTS_KEY);
  } catch {
    // Silently fail
  }
}

export function clearTestEvents(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(DELIVERY_EVENTS_KEY);
    const events: DeliveryEvent[] = raw ? JSON.parse(raw) : [];
    const filtered = events.filter((e) => e.metadata?.testEvent !== true);
    const removed = events.length - filtered.length;
    localStorage.setItem(DELIVERY_EVENTS_KEY, JSON.stringify(filtered));
    return removed;
  } catch {
    return 0;
  }
}

export function countTestEvents(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(DELIVERY_EVENTS_KEY);
    const events: DeliveryEvent[] = raw ? JSON.parse(raw) : [];
    return events.filter((e) => e.metadata?.testEvent === true).length;
  } catch {
    return 0;
  }
}

// ─── Test Event TTL ────────────────────

const TEST_EVENT_TTL_KEY = 'oracle_test_event_ttl_ms';
const DEFAULT_TEST_EVENT_TTL_MS = 60 * 60 * 1000; // 1 hour

export function getTestEventTTL(): number {
  if (typeof window === 'undefined') return DEFAULT_TEST_EVENT_TTL_MS;
  try {
    const raw = localStorage.getItem(TEST_EVENT_TTL_KEY);
    return raw ? Number(raw) : DEFAULT_TEST_EVENT_TTL_MS;
  } catch {
    return DEFAULT_TEST_EVENT_TTL_MS;
  }
}

export function setTestEventTTL(ms: number): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TEST_EVENT_TTL_KEY, String(ms));
  } catch {
    // Silently fail
  }
}

export function cleanExpiredTestEvents(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(DELIVERY_EVENTS_KEY);
    const events: DeliveryEvent[] = raw ? JSON.parse(raw) : [];
    const ttlMs = getTestEventTTL();
    const cutoff = Date.now() - ttlMs;
    const filtered = events.filter((e) => {
      if (e.metadata?.testEvent !== true) return true; // Keep non-test events
      return e.receivedAt >= cutoff; // Keep test events within TTL
    });
    const removed = events.length - filtered.length;
    if (removed > 0) {
      localStorage.setItem(DELIVERY_EVENTS_KEY, JSON.stringify(filtered));
    }
    return removed;
  } catch {
    return 0;
  }
}
