// ═══════════════════════════════════════
// ORACLE — Razorpay Payment Gateway
// Checkout · UPI QR · Payment Links · Order Management
// ═══════════════════════════════════════

// ─── Types ─────────────────────────────

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
}

export interface RazorpayPaymentOptions {
  amount: number; // in INR (will be converted to paise)
  currency?: string;
  name: string;
  description: string;
  orderId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  notes?: Record<string, string>;
  theme?: { color?: string };
}

export interface RazorpayPaymentResult {
  razorpay_payment_id: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
}

export interface PaymentRecord {
  id: string;
  paymentId: string;
  orderId?: string;
  amount: number;
  currency: string;
  status: 'created' | 'captured' | 'authorized' | 'failed' | 'refunded';
  method: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  description: string;
  notes?: Record<string, string>;
  createdAt: number;
}

export interface UPIQRData {
  id: string;
  upiId: string;
  amount: number;
  description: string;
  qrUrl: string;
  upiLink: string;
  status: 'active' | 'paid' | 'expired';
  createdAt: number;
  expiresAt?: number;
}

export interface PaymentLink {
  id: string;
  amount: number;
  description: string;
  shortUrl: string;
  status: 'partially_paid' | 'expired' | 'paid';
  createdAt: number;
  expiresAt?: number;
}

// ─── Storage Helpers ───────────────────

const STORAGE_KEY = 'oracle_razorpay_payments';
const UPI_KEY = 'oracle_razorpay_upi';
const LINKS_KEY = 'oracle_razorpay_links';
const CONFIG_KEY = 'oracle_razorpay_config';

export function getRazorpayConfig(): RazorpayConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function setRazorpayConfig(config: RazorpayConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

function loadPayments(): PaymentRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function savePayments(records: PaymentRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, 500)));
}

function loadUPIQRCodes(): UPIQRData[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(UPI_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveUPIQRCodes(records: UPIQRData[]): void {
  localStorage.setItem(UPI_KEY, JSON.stringify(records.slice(0, 200)));
}

function loadPaymentLinks(): PaymentLink[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LINKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function savePaymentLinks(records: PaymentLink[]): void {
  localStorage.setItem(LINKS_KEY, JSON.stringify(records.slice(0, 200)));
}

// ─── Server-Side Order Creation ────────

export async function createRazorpayOrder(
  amount: number,
  currency?: string,
  receipt?: string,
  notes?: Record<string, string>
): Promise<{ orderId: string; amount: number; currency: string; status: string }> {
  const response = await fetch('/api/razorpay/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, currency, receipt, notes }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to create order');
  return data;
}

export async function verifyRazorpayPayment(
  orderId: string,
  paymentId: string,
  signature: string
): Promise<{ verified: boolean; amount?: number; status?: string }> {
  const response = await fetch('/api/razorpay/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Verification failed');
  return data;
}

// ─── Razorpay Checkout ─────────────────

interface RazorpayInstance {
  open: () => void;
  close?: () => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') { resolve(false); return; }
    if (window.Razorpay !== undefined) { resolve(true); return; }

    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) { resolve(true); return; }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

export async function openRazorpayCheckout(
  options: RazorpayPaymentOptions
): Promise<RazorpayPaymentResult | null> {
  const config = getRazorpayConfig();
  if (!config?.keyId) {
    throw new Error('Razorpay Key ID not configured. Add it in Settings → Razorpay.');
  }

  const scriptLoaded = await loadRazorpayScript();
  const RazorpayConstructor = window.Razorpay;
  if (!scriptLoaded || !RazorpayConstructor) {
    throw new Error('Failed to load Razorpay SDK. Check your internet connection.');
  }

  return new Promise((resolve, reject) => {
    const rzpOptions: Record<string, unknown> = {
      key: config.keyId,
      amount: Math.round(options.amount * 100), // Convert INR to paise
      currency: options.currency || 'INR',
      name: options.name,
      description: options.description,
      prefill: {
        name: options.customerName || '',
        email: options.customerEmail || '',
        contact: options.customerPhone || '',
      },
      notes: options.notes || {},
      theme: { color: options.theme?.color || '#6366f1' },
      handler: (response: RazorpayPaymentResult) => {
        // Record payment
        const record: PaymentRecord = {
          id: `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          paymentId: response.razorpay_payment_id,
          orderId: response.razorpay_order_id,
          amount: options.amount,
          currency: options.currency || 'INR',
          status: 'captured',
          method: 'online',
          customerName: options.customerName || 'Customer',
          customerEmail: options.customerEmail,
          customerPhone: options.customerPhone,
          description: options.description,
          notes: options.notes,
          createdAt: Date.now(),
        };
        const payments = loadPayments();
        payments.unshift(record);
        savePayments(payments);
        resolve(response);
      },
      modal: {
        ondismiss: () => resolve(null),
        confirm_close: true,
      },
    };

    if (options.orderId) {
      rzpOptions.order_id = options.orderId;
    }

    try {
      const rzp = new RazorpayConstructor(rzpOptions);
      rzp.open();
    } catch (err) {
      reject(err);
    }
  });
}

// ─── UPI QR Code Generation ────────────

export function generateUPIQR(
  upiId: string,
  amount: number,
  description: string,
  expiryMinutes?: number
): UPIQRData {
  const upiLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(description)}&am=${amount}&cu=INR&tn=${encodeURIComponent(description)}`;

  // Use qrserver.com API for QR generation (free, no API key needed)
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiLink)}`;

  const record: UPIQRData = {
    id: `upi_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    upiId,
    amount,
    description,
    qrUrl,
    upiLink,
    status: 'active',
    createdAt: Date.now(),
    expiresAt: expiryMinutes ? Date.now() + expiryMinutes * 60 * 1000 : undefined,
  };

  const records = loadUPIQRCodes();
  records.unshift(record);
  saveUPIQRCodes(records);

  return record;
}

export function getUPIQRCodes(): UPIQRData[] {
  return loadUPIQRCodes();
}

export function markUPIQRPaid(id: string): void {
  const records = loadUPIQRCodes().map((r) =>
    r.id === id ? { ...r, status: 'paid' as const } : r
  );
  saveUPIQRCodes(records);
}

export function deleteUPIQR(id: string): void {
  saveUPIQRCodes(loadUPIQRCodes().filter((r) => r.id !== id));
}

// ─── Payment Links (Simulated) ─────────
// Note: Real payment links require Razorpay API (server-side).
// This generates shareable payment request links for WhatsApp/email.

export function generatePaymentLink(
  amount: number,
  description: string,
  agencyName: string,
  expiryDays?: number
): PaymentLink {
  // Generate a shareable payment request (client sends to customer via WhatsApp)
  const referenceId = `ORC-${Date.now().toString(36).toUpperCase()}`;
  const shortUrl = `https://oracle.digital/pay/${referenceId}`;

  const record: PaymentLink = {
    id: `link_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    amount,
    description,
    shortUrl,
    status: 'partially_paid',
    createdAt: Date.now(),
    expiresAt: expiryDays ? Date.now() + expiryDays * 24 * 60 * 60 * 1000 : undefined,
  };

  const records = loadPaymentLinks();
  records.unshift(record);
  savePaymentLinks(records);

  return record;
}

export function getPaymentLinks(): PaymentLink[] {
  return loadPaymentLinks();
}

export function markPaymentLinkPaid(id: string): void {
  const records = loadPaymentLinks().map((r) =>
    r.id === id ? { ...r, status: 'paid' as const } : r
  );
  savePaymentLinks(records);
}

export function deletePaymentLink(id: string): void {
  savePaymentLinks(loadPaymentLinks().filter((r) => r.id !== id));
}

// ─── Payment Records ───────────────────

export function getPaymentRecords(): PaymentRecord[] {
  return loadPayments();
}

export function addManualPayment(record: Omit<PaymentRecord, 'id' | 'createdAt'>): PaymentRecord {
  const full: PaymentRecord = {
    ...record,
    id: `manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  };
  const payments = loadPayments();
  payments.unshift(full);
  savePayments(payments);
  return full;
}

export function deletePayment(id: string): void {
  savePayments(loadPayments().filter((r) => r.id !== id));
}

// ─── WhatsApp Payment Message ──────────

export function generatePaymentMessage(
  clientName: string,
  amount: number,
  description: string,
  invoiceNumber?: string
): string {
  const ref = invoiceNumber || `INV-${Date.now().toString(36).slice(-6).toUpperCase()}`;
  return `Hi ${clientName} 👋

📋 *Invoice: ${ref}*
💰 *Amount: ₹${amount.toLocaleString('en-IN')}*
📝 *For: ${description}*

💳 *Payment Options:*
1. UPI: Scan the QR code
2. Bank Transfer: Share your payment confirmation
3. Online: Click the payment link

Please share payment confirmation after completing the payment. Thank you! 🙏

_Powered by ORACLE — Oracle Digital_`;
}

export function formatINRRazorpay(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}
