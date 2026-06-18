'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { motionVariants, transitions, buttonTapProps } from '@/styles/design-tokens';
import toast from 'react-hot-toast';
import { TOAST_DEFAULTS } from '@/lib/toast-config';
import {
  openRazorpayCheckout,
  createRazorpayOrder,
  verifyRazorpayPayment,
  generateUPIQR,
  generatePaymentLink,
  getPaymentRecords,
  getUPIQRCodes,
  getPaymentLinks,
  markUPIQRPaid,
  markPaymentLinkPaid,
  deletePayment,
  deleteUPIQR,
  deletePaymentLink,
  getRazorpayConfig,
  setRazorpayConfig,
  type PaymentRecord,
  type UPIQRData,
  type PaymentLink,
  type RazorpayConfig,
} from '@/lib/razorpay';

// ─── Types ─────────────────────────────

type ActiveView = 'checkout' | 'upi' | 'links' | 'records' | 'settings';

// ─── Main Component ────────────────────

export function RazorpayPaymentsTab() {
  const [activeView, setActiveView] = useState<ActiveView>('checkout');
  const [config, setConfigState] = useState<RazorpayConfig | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [upiCodes, setUpiCodes] = useState<UPIQRData[]>([]);
  const [paymentLinks, setPaymentLinks] = useState<PaymentLink[]>([]);

  useEffect(() => {
    setConfigState(getRazorpayConfig());
    setPayments(getPaymentRecords());
    setUpiCodes(getUPIQRCodes());
    setPaymentLinks(getPaymentLinks());
  }, []);

  const refreshData = useCallback(() => {
    setPayments(getPaymentRecords());
    setUpiCodes(getUPIQRCodes());
    setPaymentLinks(getPaymentLinks());
  }, []);

  const totalRevenue = payments.filter((p) => p.status === 'captured').reduce((s, p) => s + p.amount, 0);
  const pendingAmount = upiCodes.filter((u) => u.status === 'active').reduce((s, u) => s + u.amount, 0);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-5xl">
          {/* Header */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} className="mb-6">
            <h1 className="text-[22px] font-bold text-[var(--oracle-text-1)]">💳 Razorpay Payments</h1>
            <p className="mt-1 text-[13px] text-[var(--oracle-text-3)]">Accept payments via Checkout, UPI QR codes, and payment links</p>
          </motion.div>

          {/* Stats Bar */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} className="mb-4 grid grid-cols-4 gap-3">
            {[
              { label: 'Total Collected', value: `₹${totalRevenue.toLocaleString('en-IN')}`, icon: '💰', color: 'var(--oracle-success)' },
              { label: 'Transactions', value: payments.length.toString(), icon: '📊', color: 'var(--oracle-info)' },
              { label: 'UPI Pending', value: `₹${pendingAmount.toLocaleString('en-IN')}`, icon: '📱', color: 'var(--oracle-warning)' },
              { label: 'Active Links', value: paymentLinks.filter((l) => l.status !== 'paid').length.toString(), icon: '🔗', color: 'var(--oracle-primary-l)' },
            ].map((s) => (
              <div key={s.label} className="oracle-glass rounded-xl p-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-base">{s.icon}</span>
                  <span className="text-[10px] text-[var(--oracle-text-muted)]">{s.label}</span>
                </div>
                <p className="mt-1 text-[14px] font-bold" style={{ color: s.color }}>{s.value}</p>
              </div>
            ))}
          </motion.div>

          {/* View Tabs */}
          <div className="mb-4 flex gap-2 flex-wrap">
            {([
              { id: 'checkout' as const, label: '⚡ Checkout', desc: 'Accept online payments' },
              { id: 'upi' as const, label: '📱 UPI QR', desc: 'Generate UPI QR codes' },
              { id: 'links' as const, label: '🔗 Payment Links', desc: 'Shareable payment links' },
              { id: 'records' as const, label: '📋 All Payments', desc: 'Payment history' },
              { id: 'settings' as const, label: '⚙️ Settings', desc: 'Razorpay keys' },
            ]).map((v) => (
              <button key={v.id} onClick={() => setActiveView(v.id)} className={`rounded-xl border px-3 py-2 text-[11px] font-medium transition-all ${activeView === v.id ? 'border-[var(--oracle-primary)] bg-[var(--oracle-primary)]/10 text-[var(--oracle-primary-l)]' : 'border-[var(--oracle-border)] text-[var(--oracle-text-3)] hover:bg-[var(--oracle-card-hover)]'}`}>
                {v.label}
              </button>
            ))}
          </div>

          {/* Checkout View */}
          {activeView === 'checkout' && <CheckoutView config={config} onPayment={refreshData} />}
          {/* UPI QR View */}
          {activeView === 'upi' && <UPIQRView codes={upiCodes} config={config} onRefresh={refreshData} />}
          {/* Payment Links View */}
          {activeView === 'links' && <PaymentLinksView links={paymentLinks} config={config} onRefresh={refreshData} />}
          {/* Records View */}
          {activeView === 'records' && <RecordsView payments={payments} onRefresh={refreshData} />}
          {/* Settings View */}
          {activeView === 'settings' && <SettingsView config={config} onConfigSaved={(c) => { setConfigState(c); }} />}
        </div>
      </div>
    </div>
  );
}

// ─── Checkout View ─────────────────────

function CheckoutView({ config, onPayment }: { config: RazorpayConfig | null; onPayment: () => void }) {
  const [amount, setAmount] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [verifiedStatus, setVerifiedStatus] = useState<'pending' | 'verified' | 'failed' | null>(null);

  const handleCheckout = useCallback(async () => {
    if (!amount || parseFloat(amount) <= 0) { toast.error('❌ Enter a valid amount', TOAST_DEFAULTS); return; }
    if (!name.trim()) { toast.error('❌ Business name required', TOAST_DEFAULTS); return; }
    setIsProcessing(true);
    setVerifiedStatus(null);
    try {
      // Step 1: Create order server-side for secure payment verification
      const order = await createRazorpayOrder(
        parseFloat(amount),
        'INR',
        `orc_${Date.now()}`,
        { description: description.trim() || 'Payment', business: name.trim() }
      );

      // Step 2: Open Razorpay checkout with the server-created order ID
      const result = await openRazorpayCheckout({
        amount: parseFloat(amount),
        name: name.trim(),
        description: description.trim() || 'Payment',
        orderId: order?.orderId,
        customerName: customerName.trim() || undefined,
        customerEmail: customerEmail.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
      });

      if (result) {
        // Step 3: Verify payment signature server-side
        if (result.razorpay_order_id && result.razorpay_signature) {
          setVerifiedStatus('pending');
          const verification = await verifyRazorpayPayment(
            result.razorpay_order_id,
            result.razorpay_payment_id,
            result.razorpay_signature
          );
          if (verification?.verified) {
            setVerifiedStatus('verified');
            toast.success(`✅ Payment verified! ₹${verification.amount?.toLocaleString('en-IN') || amount}`, TOAST_DEFAULTS);
          } else {
            setVerifiedStatus('failed');
            toast.error('⚠️ Payment received but verification failed. Check manually.', TOAST_DEFAULTS);
          }
        } else {
          toast.success(`✅ Payment successful! ID: ${result.razorpay_payment_id.slice(0, 16)}...`, TOAST_DEFAULTS);
        }
        onPayment();
        setAmount('');
        setDescription('');
        setCustomerName('');
        setCustomerEmail('');
        setCustomerPhone('');
      }
    } catch (err) {
      toast.error(`❌ ${err instanceof Error ? err.message : 'Payment failed'}`, TOAST_DEFAULTS);
    } finally {
      setIsProcessing(false);
    }
  }, [amount, name, description, customerName, customerEmail, customerPhone, onPayment]);

  return (
    <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
      <div className="oracle-glass rounded-2xl p-6">
        <h3 className="mb-4 text-[15px] font-bold text-[var(--oracle-text-1)]">⚡ Razorpay Checkout</h3>

        {!config?.keyId && (
          <div className="mb-4 rounded-xl border border-[var(--oracle-warning)]/30 bg-[var(--oracle-warning)]/5 p-3">
            <p className="text-[12px] text-[var(--oracle-warning)]">⚠️ Razorpay Key ID not configured. Go to Settings to add your key.</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[var(--oracle-text-muted)]">Amount (₹) *</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="5000" className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-2.5 text-[14px] font-bold text-[var(--oracle-text-1)] outline-none focus:border-[var(--oracle-primary)]" />
              {amount && parseFloat(amount) > 0 && (
                <p className="mt-1 text-[10px] text-[var(--oracle-text-muted)]">
                  = {Math.round(parseFloat(amount) * 100)} paise
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[var(--oracle-text-muted)]">Business Name *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Oracle Digital" className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-2.5 text-[13px] text-[var(--oracle-text-1)] outline-none focus:border-[var(--oracle-primary)]" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[var(--oracle-text-muted)]">Description</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="SEO Service - January" className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-2.5 text-[13px] text-[var(--oracle-text-1)] outline-none focus:border-[var(--oracle-primary)]" />
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[var(--oracle-text-muted)]">Customer Name</label>
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Rahul Sharma" className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-2.5 text-[13px] text-[var(--oracle-text-1)] outline-none focus:border-[var(--oracle-primary)]" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[var(--oracle-text-muted)]">Customer Email</label>
              <input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="rahul@company.com" className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-2.5 text-[13px] text-[var(--oracle-text-1)] outline-none focus:border-[var(--oracle-primary)]" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[var(--oracle-text-muted)]">Customer Phone</label>
              <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="9876543210" className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-2.5 text-[13px] text-[var(--oracle-text-1)] outline-none focus:border-[var(--oracle-primary)]" />
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-[11px] text-[var(--oracle-text-muted)]">
            {amount && parseFloat(amount) > 0 && (
              <span>💰 Razorpay fee (2%): ₹{(parseFloat(amount) * 0.02).toFixed(2)} · You receive: ₹{(parseFloat(amount) * 0.98).toFixed(2)}</span>
            )}
          </div>
          <motion.button
            {...buttonTapProps}
            onClick={handleCheckout}
            disabled={!amount || parseFloat(amount) <= 0 || !name.trim() || isProcessing}
            className="flex items-center gap-2 rounded-xl oracle-gradient-bg px-6 py-3 text-[13px] font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Processing...</>
            ) : (
              <>💳 Accept Payment</>
            )}
          </motion.button>
        </div>

        {/* Verification Status */}
        <AnimatePresence>
          {verifiedStatus && (
            <motion.div
              variants={motionVariants.fadeUp}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={transitions.smooth}
              className={`mt-4 rounded-xl border p-3 ${
                verifiedStatus === 'verified'
                  ? 'border-[var(--oracle-success)]/30 bg-[var(--oracle-success)]/5'
                  : verifiedStatus === 'failed'
                  ? 'border-[var(--oracle-error)]/30 bg-[var(--oracle-error)]/5'
                  : 'border-[var(--oracle-info)]/30 bg-[var(--oracle-info)]/5'
              }`}
            >
              <div className="flex items-center gap-2">
                {verifiedStatus === 'verified' && <span className="text-[14px]">✅</span>}
                {verifiedStatus === 'failed' && <span className="text-[14px]">⚠️</span>}
                {verifiedStatus === 'pending' && <div className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--oracle-info)]/30 border-t-[var(--oracle-info)]" />}
                <p className={`text-[12px] font-medium ${
                  verifiedStatus === 'verified' ? 'text-[var(--oracle-success)]' :
                  verifiedStatus === 'failed' ? 'text-[var(--oracle-error)]' :
                  'text-[var(--oracle-info)]'
                }`}>
                  {verifiedStatus === 'verified' && 'Payment verified server-side — signature is valid'}
                  {verifiedStatus === 'failed' && 'Payment received but verification failed — check manually'}
                  {verifiedStatus === 'pending' && 'Verifying payment signature...'}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── UPI QR View ───────────────────────

function UPIQRView({ codes, config, onRefresh }: { codes: UPIQRData[]; config: RazorpayConfig | null; onRefresh: () => void }) {
  const [upiId, setUpiId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedQR, setSelectedQR] = useState<UPIQRData | null>(null);

  const handleGenerate = useCallback(() => {
    if (!upiId.trim()) { toast.error('❌ UPI ID required', TOAST_DEFAULTS); return; }
    if (!amount || parseFloat(amount) <= 0) { toast.error('❌ Enter valid amount', TOAST_DEFAULTS); return; }
    const qr = generateUPIQR(upiId.trim(), parseFloat(amount), description.trim() || 'Payment');
    setSelectedQR(qr);
    onRefresh();
    toast.success('✅ UPI QR code generated', TOAST_DEFAULTS);
  }, [upiId, amount, description, onRefresh]);

  const copyUPILink = useCallback((link: string) => {
    navigator.clipboard.writeText(link);
    toast.success('📋 UPI link copied', TOAST_DEFAULTS);
  }, []);

  const sendViaWhatsApp = useCallback((qr: UPIQRData) => {
    const msg = `Hi! Please pay ₹${qr.amount.toLocaleString('en-IN')} for "${qr.description}"\n\nUPI ID: ${qr.upiId}\nScan the QR code or use this link: ${qr.upiLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  }, []);

  return (
    <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
      <div className="grid grid-cols-12 gap-4">
        {/* Generator */}
        <div className="col-span-5">
          <div className="oracle-glass rounded-2xl p-5">
            <h3 className="mb-4 text-[15px] font-bold text-[var(--oracle-text-1)]">📱 Generate UPI QR Code</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-[var(--oracle-text-muted)]">UPI ID *</label>
                <input value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="oracle@paytm" className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-2.5 text-[13px] text-[var(--oracle-text-1)] outline-none focus:border-[var(--oracle-primary)]" />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-[var(--oracle-text-muted)]">Amount (₹) *</label>
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="5000" className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-2.5 text-[13px] text-[var(--oracle-text-1)] outline-none focus:border-[var(--oracle-primary)]" />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-[var(--oracle-text-muted)]">Description</label>
                <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="SEO Service Payment" className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-2.5 text-[13px] text-[var(--oracle-text-1)] outline-none focus:border-[var(--oracle-primary)]" />
              </div>
              <motion.button {...buttonTapProps} onClick={handleGenerate} className="w-full rounded-xl oracle-gradient-bg px-4 py-2.5 text-[13px] font-semibold text-white">Generate QR Code</motion.button>
            </div>

            {/* Preview QR */}
            {selectedQR && (
              <div className="mt-4 rounded-xl border border-[var(--oracle-border)] bg-white p-4 text-center">
                <img src={selectedQR.qrUrl} alt="UPI QR Code" className="mx-auto mb-3 h-48 w-48" />
                <p className="text-[12px] font-bold text-gray-900">₹{selectedQR.amount.toLocaleString('en-IN')}</p>
                <p className="text-[10px] text-gray-500">{selectedQR.upiId}</p>
                <div className="mt-3 flex gap-2 justify-center">
                  <button onClick={() => copyUPILink(selectedQR.upiLink)} className="rounded-lg bg-gray-100 px-3 py-1.5 text-[11px] font-medium text-gray-700 hover:bg-gray-200">📋 Copy Link</button>
                  <button onClick={() => sendViaWhatsApp(selectedQR)} className="rounded-lg bg-green-500 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-green-600">💬 WhatsApp</button>
                  <button onClick={() => { markUPIQRPaid(selectedQR.id); setSelectedQR({ ...selectedQR, status: 'paid' }); onRefresh(); toast.success('Marked as paid', TOAST_DEFAULTS); }} className="rounded-lg bg-blue-500 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-blue-600">✅ Mark Paid</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* QR History */}
        <div className="col-span-7">
          <div className="oracle-glass rounded-2xl p-5">
            <h3 className="mb-3 text-[15px] font-bold text-[var(--oracle-text-1)]">Generated QR Codes ({codes.length})</h3>
            {codes.length === 0 ? (
              <p className="py-8 text-center text-[12px] text-[var(--oracle-text-muted)]">No QR codes generated yet</p>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {codes.map((qr) => (
                  <div key={qr.id} onClick={() => setSelectedQR(qr)} className={`cursor-pointer rounded-xl border p-3 transition-all ${selectedQR?.id === qr.id ? 'border-[var(--oracle-primary)] bg-[var(--oracle-primary)]/5' : 'border-[var(--oracle-border)] hover:border-[var(--oracle-border-strong)]'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img src={qr.qrUrl} alt="" className="h-10 w-10 rounded-lg" />
                        <div>
                          <p className="text-[12px] font-semibold text-[var(--oracle-text-1)]">₹{qr.amount.toLocaleString('en-IN')}</p>
                          <p className="text-[10px] text-[var(--oracle-text-muted)]">{qr.upiId} · {new Date(qr.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${qr.status === 'paid' ? 'bg-[var(--oracle-success)]/10 text-[var(--oracle-success)]' : qr.status === 'expired' ? 'bg-[var(--oracle-error)]/10 text-[var(--oracle-error)]' : 'bg-[var(--oracle-warning)]/10 text-[var(--oracle-warning)]'}`}>{qr.status}</span>
                        <button onClick={(e) => { e.stopPropagation(); deleteUPIQR(qr.id); onRefresh(); }} className="text-[10px] text-[var(--oracle-text-muted)] hover:text-[var(--oracle-error)]">🗑</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Payment Links View ────────────────

function PaymentLinksView({ links, config, onRefresh }: { links: PaymentLink[]; config: RazorpayConfig | null; onRefresh: () => void }) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [agencyName, setAgencyName] = useState('Oracle Digital');

  const handleGenerate = useCallback(() => {
    if (!amount || parseFloat(amount) <= 0) { toast.error('❌ Enter valid amount', TOAST_DEFAULTS); return; }
    generatePaymentLink(parseFloat(amount), description.trim() || 'Payment', agencyName.trim(), 30);
    onRefresh();
    setAmount('');
    setDescription('');
    toast.success('✅ Payment link created', TOAST_DEFAULTS);
  }, [amount, description, agencyName, onRefresh]);

  const copyLink = useCallback((link: string) => {
    navigator.clipboard.writeText(link);
    toast.success('📋 Link copied', TOAST_DEFAULTS);
  }, []);

  const shareViaWhatsApp = useCallback((link: PaymentLink) => {
    const msg = `Hi! Please complete your payment:\n\n💰 Amount: ₹${link.amount.toLocaleString('en-IN')}\n📝 For: ${link.description}\n🔗 Pay here: ${link.shortUrl}\n\n_Powered by ORACLE — Oracle Digital_`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  }, []);

  return (
    <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
      <div className="oracle-glass rounded-2xl p-5 mb-4">
        <h3 className="mb-4 text-[15px] font-bold text-[var(--oracle-text-1)]">🔗 Generate Payment Link</h3>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="mb-1 block text-[11px] font-medium text-[var(--oracle-text-muted)]">Amount (₹)</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="5000" className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-2.5 text-[13px] text-[var(--oracle-text-1)] outline-none focus:border-[var(--oracle-primary)]" />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-[11px] font-medium text-[var(--oracle-text-muted)]">Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="SEO Service - January" className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-2.5 text-[13px] text-[var(--oracle-text-1)] outline-none focus:border-[var(--oracle-primary)]" />
          </div>
          <motion.button {...buttonTapProps} onClick={handleGenerate} className="shrink-0 rounded-xl oracle-gradient-bg px-5 py-2.5 text-[13px] font-semibold text-white">Generate</motion.button>
        </div>
      </div>

      <div className="oracle-glass rounded-2xl p-5">
        <h3 className="mb-3 text-[15px] font-bold text-[var(--oracle-text-1)]">Payment Links ({links.length})</h3>
        {links.length === 0 ? (
          <p className="py-8 text-center text-[12px] text-[var(--oracle-text-muted)]">No payment links yet</p>
        ) : (
          <div className="space-y-2">
            {links.map((link) => (
              <div key={link.id} className="flex items-center justify-between rounded-xl border border-[var(--oracle-border)] p-3 hover:border-[var(--oracle-border-strong)] transition-colors">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[12px] font-semibold text-[var(--oracle-text-1)]">₹{link.amount.toLocaleString('en-IN')}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${link.status === 'paid' ? 'bg-[var(--oracle-success)]/10 text-[var(--oracle-success)]' : 'bg-[var(--oracle-warning)]/10 text-[var(--oracle-warning)]'}`}>{link.status}</span>
                  </div>
                  <p className="text-[10px] text-[var(--oracle-text-muted)]">{link.description} · {link.shortUrl}</p>
                  <p className="text-[9px] text-[var(--oracle-text-muted)]">Created {new Date(link.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {link.status !== 'paid' && (
                    <>
                      <button onClick={() => copyLink(link.shortUrl)} className="rounded-lg bg-[var(--oracle-surface-2)] px-2.5 py-1.5 text-[10px] font-medium text-[var(--oracle-text-3)] hover:bg-[var(--oracle-card-hover)]">📋 Copy</button>
                      <button onClick={() => shareViaWhatsApp(link)} className="rounded-lg bg-[var(--oracle-success)]/10 px-2.5 py-1.5 text-[10px] font-medium text-[var(--oracle-success)] hover:bg-[var(--oracle-success)]/20">💬 WA</button>
                      <button onClick={() => { markPaymentLinkPaid(link.id); onRefresh(); toast.success('Marked as paid', TOAST_DEFAULTS); }} className="rounded-lg bg-[var(--oracle-info)]/10 px-2.5 py-1.5 text-[10px] font-medium text-[var(--oracle-info)] hover:bg-[var(--oracle-info)]/20">✅ Paid</button>
                    </>
                  )}
                  <button onClick={() => { deletePaymentLink(link.id); onRefresh(); }} className="text-[10px] text-[var(--oracle-text-muted)] hover:text-[var(--oracle-error)]">🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Records View ──────────────────────

function RecordsView({ payments, onRefresh }: { payments: PaymentRecord[]; onRefresh: () => void }) {
  return (
    <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
      <div className="oracle-glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[15px] font-bold text-[var(--oracle-text-1)]">📋 Payment History ({payments.length})</h3>
          <button onClick={() => { navigator.clipboard.writeText(payments.map((p) => `${p.customerName}\t₹${p.amount}\t${p.status}\t${new Date(p.createdAt).toLocaleDateString()}`).join('\n')); toast.success('Copied', TOAST_DEFAULTS); }} className="text-[11px] text-[var(--oracle-primary-l)] hover:underline">📋 Export CSV</button>
        </div>

        {payments.length === 0 ? (
          <p className="py-8 text-center text-[12px] text-[var(--oracle-text-muted)]">No payments recorded yet</p>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border border-[var(--oracle-border)] p-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[12px] font-semibold text-[var(--oracle-text-1)]">{p.customerName}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${p.status === 'captured' ? 'bg-[var(--oracle-success)]/10 text-[var(--oracle-success)]' : p.status === 'failed' ? 'bg-[var(--oracle-error)]/10 text-[var(--oracle-error)]' : 'bg-[var(--oracle-warning)]/10 text-[var(--oracle-warning)]'}`}>{p.status}</span>
                  </div>
                  <p className="text-[10px] text-[var(--oracle-text-muted)]">{p.description} · {p.method} · {new Date(p.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold text-[var(--oracle-text-1)]">₹{p.amount.toLocaleString('en-IN')}</span>
                  {p.paymentId && <button onClick={() => { navigator.clipboard.writeText(p.paymentId); toast.success('Payment ID copied', TOAST_DEFAULTS); }} className="text-[10px] text-[var(--oracle-text-muted)] hover:text-[var(--oracle-primary-l)]" title={p.paymentId}>📋</button>}
                  <button onClick={() => { deletePayment(p.id); onRefresh(); }} className="text-[10px] text-[var(--oracle-text-muted)] hover:text-[var(--oracle-error)]">🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Settings View ─────────────────────

function SettingsView({ config, onConfigSaved }: { config: RazorpayConfig | null; onConfigSaved: (c: RazorpayConfig | null) => void }) {
  const [keyId, setKeyId] = useState(config?.keyId || '');
  const [keySecret, setKeySecret] = useState(config?.keySecret || '');
  const [showSecret, setShowSecret] = useState(false);

  const handleSave = useCallback(() => {
    if (!keyId.trim()) { toast.error('❌ Key ID required', TOAST_DEFAULTS); return; }
    const newConfig = { keyId: keyId.trim(), keySecret: keySecret.trim() };
    setRazorpayConfig(newConfig);
    onConfigSaved(newConfig);
    toast.success('✅ Razorpay config saved', TOAST_DEFAULTS);
  }, [keyId, keySecret, onConfigSaved]);

  return (
    <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
      <div className="oracle-glass rounded-2xl p-6 max-w-xl">
        <h3 className="mb-4 text-[15px] font-bold text-[var(--oracle-text-1)]">⚙️ Razorpay Configuration</h3>
        <p className="mb-4 text-[12px] text-[var(--oracle-text-3)]">
          Get your API keys from{' '}
          <a href="https://dashboard.razorpay.com/app/keys" target="_blank" rel="noopener noreferrer" className="text-[var(--oracle-primary-l)] underline">
            Razorpay Dashboard → Settings → API Keys
          </a>
        </p>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--oracle-text-muted)]">Key ID (rzp_test_xxx or rzp_live_xxx) *</label>
            <input value={keyId} onChange={(e) => setKeyId(e.target.value)} placeholder="rzp_test_..." className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-2.5 text-[13px] font-mono text-[var(--oracle-text-1)] outline-none focus:border-[var(--oracle-primary)]" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--oracle-text-muted)]">Key Secret</label>
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                value={keySecret}
                onChange={(e) => setKeySecret(e.target.value)}
                placeholder="Enter key secret (for QR/link generation)"
                className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-2.5 pr-16 text-[13px] font-mono text-[var(--oracle-text-1)] outline-none focus:border-[var(--oracle-primary)]"
              />
              <button onClick={() => setShowSecret(!showSecret)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[var(--oracle-text-muted)] hover:text-[var(--oracle-text-3)]">
                {showSecret ? '🙈 Hide' : '👁️ Show'}
              </button>
            </div>
            <p className="mt-1 text-[10px] text-[var(--oracle-text-muted)]">Optional — only needed for server-side QR/link generation</p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-[10px] text-[var(--oracle-text-muted)]">
            {config?.keyId ? '✅ Configured' : '⚠️ Not configured'}
          </p>
          <motion.button {...buttonTapProps} onClick={handleSave} className="rounded-xl oracle-gradient-bg px-5 py-2.5 text-[13px] font-semibold text-white">Save Configuration</motion.button>
        </div>

        <div className="mt-6 rounded-xl bg-[var(--oracle-surface-2)] p-4">
          <h4 className="mb-2 text-[12px] font-semibold text-[var(--oracle-text-1)]">📖 Quick Setup Guide</h4>
          <ol className="space-y-1.5 text-[11px] text-[var(--oracle-text-3)]">
            <li>1. Create a Razorpay account at <a href="https://razorpay.com" target="_blank" rel="noopener noreferrer" className="text-[var(--oracle-primary-l)] underline">razorpay.com</a></li>
            <li>2. Go to Dashboard → Settings → API Keys → Generate Key</li>
            <li>3. Copy the Key ID and paste above</li>
            <li>4. For UPI QR and Payment Links, also copy the Key Secret</li>
            <li>5. Switch to Live mode when ready to accept real payments</li>
          </ol>
          <p className="mt-3 text-[10px] text-[var(--oracle-text-muted)]">💡 Test mode: Use UPI ID <code className="rounded bg-[var(--oracle-surface-3)] px-1 py-0.5 font-mono text-[var(--oracle-primary-l)]">success@razorpay</code> for successful test payments</p>
        </div>
      </div>
    </motion.div>
  );
}
