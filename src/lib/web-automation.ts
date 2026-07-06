// ═══════════════════════════════════════
// ORACLE — Web Automation Layer (Playwright)
// Browser sessions · Login · Form filling · Data extraction · Screenshots
// ═══════════════════════════════════════

import type { Browser, BrowserContext, Page } from 'playwright';

// ─── Types ────────────────────────────

export interface BrowserSession {
  id: string;
  browser: Browser;
  context: BrowserContext;
  page: Page;
  createdAt: number;
  lastActivity: number;
}

export interface NavigationResult {
  url: string;
  title: string;
  content: string;
  links: string[];
  forms: FormInfo[];
  screenshot?: string;
}

export interface FormInfo {
  action: string;
  method: string;
  fields: Array<{
    name: string;
    type: string;
    placeholder?: string;
    required: boolean;
  }>;
}

export interface ExtractedData {
  selector: string;
  text: string;
  html: string;
  attributes: Record<string, string>;
}

export interface AutomationOptions {
  headless?: boolean;
  timeout?: number;
  userAgent?: string;
  viewport?: { width: number; height: number };
  proxy?: { server: string; username?: string; password?: string };
}

// ─── Session Management ───────────────

const sessions = new Map<string, BrowserSession>();
const MAX_SESSIONS = 5;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

let playwrightModule: typeof import('playwright') | null = null;

async function getPlaywright() {
  if (!playwrightModule) {
    playwrightModule = await import('playwright');
  }
  return playwrightModule;
}

export async function createSession(options: AutomationOptions = {}): Promise<BrowserSession> {
  // Clean up expired sessions
  cleanupExpiredSessions();

  if (sessions.size >= MAX_SESSIONS) {
    // Close the oldest session
    const oldest = Array.from(sessions.values()).sort((a, b) => a.lastActivity - b.lastActivity)[0];
    if (oldest) await closeSession(oldest.id);
  }

  const pw = await getPlaywright();
  const browser = await pw.chromium.launch({
    headless: options.headless ?? true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
    ],
  });

  const context = await browser.newContext({
    userAgent: options.userAgent,
    viewport: options.viewport || { width: 1280, height: 720 },
    proxy: options.proxy,
  });

  // Set default timeout
  context.setDefaultTimeout(options.timeout || 30000);

  const page = await context.newPage();
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const session: BrowserSession = {
    id: sessionId,
    browser,
    context,
    page,
    createdAt: Date.now(),
    lastActivity: Date.now(),
  };

  sessions.set(sessionId, session);
  return session;
}

export async function closeSession(sessionId: string): Promise<void> {
  const session = sessions.get(sessionId);
  if (!session) return;

  try {
    await session.page.close();
    await session.context.close();
    await session.browser.close();
  } catch {
    // Silently fail cleanup
  }

  sessions.delete(sessionId);
}

export async function closeAllSessions(): Promise<void> {
  for (const [id] of sessions) {
    await closeSession(id);
  }
}

function cleanupExpiredSessions(): void {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastActivity > SESSION_TIMEOUT_MS) {
      closeSession(id);
    }
  }
}

function getSession(sessionId: string): BrowserSession | null {
  const session = sessions.get(sessionId);
  if (!session) return null;
  session.lastActivity = Date.now();
  return session;
}

// ─── Navigation ───────────────────────

export async function navigateTo(
  sessionId: string,
  url: string,
  options: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle'; screenshot?: boolean } = {}
): Promise<NavigationResult> {
  const session = getSession(sessionId);
  if (!session) throw new Error('Session not found or expired');

  const { waitUntil = 'domcontentloaded', screenshot = false } = options;

  await session.page.goto(url, { waitUntil });

  const title = await session.page.title();
  const content = await session.page.textContent('body') || '';

  // Extract all links
  const links = await session.page.$$eval('a[href]', (els) =>
    els.map((el) => (el as HTMLAnchorElement).href).filter(Boolean)
  );

  // Extract form information
  const forms = await session.page.$$eval('form', (els) =>
    els.map((form) => ({
      action: form.action || '',
      method: form.method || 'GET',
      fields: Array.from(form.querySelectorAll('input, textarea, select')).map((field) => ({
        name: (field as HTMLInputElement).name || '',
        type: (field as HTMLInputElement).type || 'text',
        placeholder: (field as HTMLInputElement).placeholder || '',
        required: (field as HTMLInputElement).required,
      })),
    }))
  );

  let screenshotData: string | undefined;
  if (screenshot) {
    const buffer = await session.page.screenshot({ fullPage: false });
    screenshotData = buffer.toString('base64');
  }

  return {
    url: session.page.url(),
    title,
    content: content.slice(0, 10000), // Limit content size
    links: [...new Set(links)].slice(0, 100), // Dedupe and limit
    forms,
    screenshot: screenshotData,
  };
}

// ─── Form Interaction ─────────────────

export async function fillForm(
  sessionId: string,
  fields: Array<{ selector: string; value: string }>,
  submitSelector?: string
): Promise<{ success: boolean; url: string; content: string }> {
  const session = getSession(sessionId);
  if (!session) throw new Error('Session not found or expired');

  for (const field of fields) {
    await session.page.fill(field.selector, field.value);
  }

  if (submitSelector) {
    await session.page.click(submitSelector);
    await session.page.waitForLoadState('domcontentloaded');
  }

  return {
    success: true,
    url: session.page.url(),
    content: (await session.page.textContent('body') || '').slice(0, 5000),
  };
}

export async function clickElement(
  sessionId: string,
  selector: string,
  options: { waitForNavigation?: boolean } = {}
): Promise<{ url: string; content: string }> {
  const session = getSession(sessionId);
  if (!session) throw new Error('Session not found or expired');

  if (options.waitForNavigation) {
    await Promise.all([
      session.page.waitForNavigation(),
      session.page.click(selector),
    ]);
  } else {
    await session.page.click(selector);
  }

  return {
    url: session.page.url(),
    content: (await session.page.textContent('body') || '').slice(0, 5000),
  };
}

// ─── Data Extraction ──────────────────

export async function extractData(
  sessionId: string,
  selectors: string[]
): Promise<ExtractedData[]> {
  const session = getSession(sessionId);
  if (!session) throw new Error('Session not found or expired');

  const results: ExtractedData[] = [];

  for (const selector of selectors) {
    const elements = await session.page.$$(selector);
    for (const el of elements) {
      const text = await el.textContent() || '';
      const html = await el.innerHTML();
      const attributes: Record<string, string> = {};

      // Get all attributes
      const attrNames = await el.evaluate((node) => {
        const attrs: string[] = [];
        for (let i = 0; i < node.attributes.length; i++) {
          attrs.push(node.attributes[i].name);
        }
        return attrs;
      });

      for (const name of attrNames) {
        const value = await el.getAttribute(name);
        if (value) attributes[name] = value;
      }

      results.push({
        selector,
        text: text.trim(),
        html,
        attributes,
      });
    }
  }

  return results;
}

export async function extractTable(
  sessionId: string,
  tableSelector: string
): Promise<Array<Record<string, string>>> {
  const session = getSession(sessionId);
  if (!session) throw new Error('Session not found or expired');

  return session.page.$$eval(`${tableSelector} tr`, (rows) => {
    if (rows.length === 0) return [];

    // Get headers from first row
    const headers = Array.from(rows[0].querySelectorAll('th, td')).map(
      (cell) => cell.textContent?.trim() || ''
    );

    // Get data from remaining rows
    return Array.from(rows.slice(1)).map((row) => {
      const cells = Array.from(row.querySelectorAll('td')).map(
        (cell) => cell.textContent?.trim() || ''
      );
      const record: Record<string, string> = {};
      headers.forEach((header, i) => {
        if (header) record[header] = cells[i] || '';
      });
      return record;
    });
  });
}

// ─── Screenshot ───────────────────────

export async function takeScreenshot(
  sessionId: string,
  options: { fullPage?: boolean; selector?: string } = {}
): Promise<string> {
  const session = getSession(sessionId);
  if (!session) throw new Error('Session not found or expired');

  if (options.selector) {
    const element = await session.page.$(options.selector);
    if (element) {
      const buffer = await element.screenshot();
      return buffer.toString('base64');
    }
  }

  const buffer = await session.page.screenshot({ fullPage: options.fullPage ?? false });
  return buffer.toString('base64');
}

// ─── Utility ──────────────────────────

export function getActiveSessions(): Array<{ id: string; createdAt: number; lastActivity: number }> {
  return Array.from(sessions.values()).map((s) => ({
    id: s.id,
    createdAt: s.createdAt,
    lastActivity: s.lastActivity,
  }));
}
