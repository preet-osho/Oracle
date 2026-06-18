import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// ─── Mocks ───

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/toast-config', () => ({
  TOAST_DEFAULTS: { duration: 3000 },
}));

vi.mock('@/lib/razorpay', () => ({
  openRazorpayCheckout: vi.fn().mockResolvedValue(null),
  createRazorpayOrder: vi.fn().mockResolvedValue({ orderId: 'order_test', amount: 50000, currency: 'INR', status: 'created' }),
  verifyRazorpayPayment: vi.fn().mockResolvedValue({ verified: true, amount: 500 }),
  generateUPIQR: vi.fn().mockReturnValue({
    id: 'upi_test123',
    upiId: 'test@upi',
    amount: 500,
    description: 'Test Payment',
    qrUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=test',
    upiLink: 'upi://pay?pa=test%40upi&am=500&cu=INR',
    status: 'active' as const,
    createdAt: Date.now(),
  }),
  generatePaymentLink: vi.fn().mockReturnValue({
    id: 'link_test123',
    amount: 5000,
    description: 'SEO Package',
    shortUrl: 'https://oracle.digital/pay/ORC-TEST',
    status: 'partially_paid' as const,
    createdAt: Date.now(),
  }),
  getPaymentRecords: vi.fn().mockReturnValue([]),
  getUPIQRCodes: vi.fn().mockReturnValue([]),
  getPaymentLinks: vi.fn().mockReturnValue([]),
  markUPIQRPaid: vi.fn(),
  markPaymentLinkPaid: vi.fn(),
  deletePayment: vi.fn(),
  deleteUPIQR: vi.fn(),
  deletePaymentLink: vi.fn(),
  getRazorpayConfig: vi.fn().mockReturnValue(null),
  setRazorpayConfig: vi.fn(),
}));

// ─── Import after mocks ───

import { RazorpayPaymentsTab } from './RazorpayPaymentsTab';
import {
  getRazorpayConfig,
  getPaymentRecords,
  getUPIQRCodes,
  getPaymentLinks,
  generateUPIQR,
  generatePaymentLink,
  createRazorpayOrder,
  openRazorpayCheckout,
  verifyRazorpayPayment,
  markUPIQRPaid,
  markPaymentLinkPaid,
  deletePayment,
  deleteUPIQR,
  deletePaymentLink,
  setRazorpayConfig,
} from '@/lib/razorpay';
import toast from 'react-hot-toast';

// ─── Tests ─────────────────────────────

describe('RazorpayPaymentsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset default return values
    vi.mocked(getPaymentRecords).mockReturnValue([]);
    vi.mocked(getUPIQRCodes).mockReturnValue([]);
    vi.mocked(getPaymentLinks).mockReturnValue([]);
    vi.mocked(getRazorpayConfig).mockReturnValue(null);
  });

  describe('rendering', () => {
    it('renders the main header', () => {
      render(<RazorpayPaymentsTab />);
      expect(screen.getByText('💳 Razorpay Payments')).toBeDefined();
      expect(screen.getByText(/Accept payments via Checkout/)).toBeDefined();
    });

    it('renders all 5 view tabs', () => {
      render(<RazorpayPaymentsTab />);
      expect(screen.getByText('⚡ Checkout')).toBeDefined();
      expect(screen.getByText('📱 UPI QR')).toBeDefined();
      expect(screen.getByText('🔗 Payment Links')).toBeDefined();
      expect(screen.getByText('📋 All Payments')).toBeDefined();
      expect(screen.getByText('⚙️ Settings')).toBeDefined();
    });

    it('shows stats bar with zero values when empty', () => {
      render(<RazorpayPaymentsTab />);
      expect(screen.getByText('Total Collected')).toBeDefined();
      expect(screen.getByText('Transactions')).toBeDefined();
      expect(screen.getByText('UPI Pending')).toBeDefined();
      expect(screen.getByText('Active Links')).toBeDefined();
    });

    it('defaults to checkout view', () => {
      render(<RazorpayPaymentsTab />);
      expect(screen.getByText('⚡ Razorpay Checkout')).toBeDefined();
    });
  });

  describe('tab switching', () => {
    it('switches to UPI QR view when clicked', () => {
      render(<RazorpayPaymentsTab />);
      fireEvent.click(screen.getByText('📱 UPI QR'));
      expect(screen.getByText('📱 Generate UPI QR Code')).toBeDefined();
    });

    it('switches to Payment Links view when clicked', () => {
      render(<RazorpayPaymentsTab />);
      fireEvent.click(screen.getByText('🔗 Payment Links'));
      expect(screen.getByText('🔗 Generate Payment Link')).toBeDefined();
    });

    it('switches to All Payments view when clicked', () => {
      render(<RazorpayPaymentsTab />);
      fireEvent.click(screen.getByText('📋 All Payments'));
      expect(screen.getByText(/Payment History/)).toBeDefined();
    });

    it('switches to Settings view when clicked', () => {
      render(<RazorpayPaymentsTab />);
      fireEvent.click(screen.getByText('⚙️ Settings'));
      expect(screen.getByText('⚙️ Razorpay Configuration')).toBeDefined();
    });

    it('switches back to checkout from another view', () => {
      render(<RazorpayPaymentsTab />);
      fireEvent.click(screen.getByText('⚙️ Settings'));
      expect(screen.getByText('⚙️ Razorpay Configuration')).toBeDefined();
      fireEvent.click(screen.getByText('⚡ Checkout'));
      expect(screen.getByText('⚡ Razorpay Checkout')).toBeDefined();
    });
  });

  describe('stats bar', () => {
    it('shows correct stats with payment records', () => {
      vi.mocked(getPaymentRecords).mockReturnValue([
        {
          id: 'pay1', paymentId: 'rp_pay1', amount: 10000, currency: 'INR',
          status: 'captured', method: 'upi', customerName: 'Client A',
          description: 'Service', createdAt: Date.now(),
        },
        {
          id: 'pay2', paymentId: 'rp_pay2', amount: 5000, currency: 'INR',
          status: 'created', method: 'card', customerName: 'Client B',
          description: 'Service', createdAt: Date.now(),
        },
      ]);
      vi.mocked(getUPIQRCodes).mockReturnValue([
        {
          id: 'u1', upiId: 'test@upi', amount: 2000, description: 'Test',
          qrUrl: '', upiLink: '', status: 'active', createdAt: Date.now(),
        },
      ]);
      vi.mocked(getPaymentLinks).mockReturnValue([
        {
          id: 'l1', amount: 3000, description: 'Test', shortUrl: '',
          status: 'partially_paid', createdAt: Date.now(),
        },
      ]);

      render(<RazorpayPaymentsTab />);

      // Total collected: only captured payments = 10000
      expect(screen.getByText('₹10,000')).toBeDefined();
      // Transaction count: 2
      expect(screen.getByText('2')).toBeDefined();
      // UPI pending: 2000
      expect(screen.getByText('₹2,000')).toBeDefined();
    });
  });
});

describe('CheckoutView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRazorpayConfig).mockReturnValue(null);
  });

  it('shows warning when Razorpay key is not configured', () => {
    render(<RazorpayPaymentsTab />);
    expect(screen.getByText(/Razorpay Key ID not configured/)).toBeDefined();
  });

  it('hides warning when Razorpay key is configured', () => {
    vi.mocked(getRazorpayConfig).mockReturnValue({ keyId: 'rzp_test_123', keySecret: 'secret' });
    render(<RazorpayPaymentsTab />);
    expect(screen.queryByText(/Razorpay Key ID not configured/)).toBeNull();
  });

  it('renders checkout form inputs', () => {
    render(<RazorpayPaymentsTab />);
    expect(screen.getByPlaceholderText('5000')).toBeDefined();
    expect(screen.getByPlaceholderText('Oracle Digital')).toBeDefined();
    expect(screen.getByPlaceholderText('SEO Service - January')).toBeDefined();
    expect(screen.getByPlaceholderText('Rahul Sharma')).toBeDefined();
    expect(screen.getByPlaceholderText('rahul@company.com')).toBeDefined();
    expect(screen.getByPlaceholderText('9876543210')).toBeDefined();
  });

  it('disables checkout button when amount is empty', () => {
    render(<RazorpayPaymentsTab />);
    const btn = screen.getByText('💳 Accept Payment').closest('button');
    expect(btn?.getAttribute('disabled')).not.toBeNull();
  });

  it('enables checkout button when amount and name are filled', () => {
    render(<RazorpayPaymentsTab />);
    const amountInput = screen.getByPlaceholderText('5000');
    const nameInput = screen.getByPlaceholderText('Oracle Digital');

    fireEvent.change(amountInput, { target: { value: '5000' } });
    fireEvent.change(nameInput, { target: { value: 'Oracle Digital' } });

    const btn = screen.getByText('💳 Accept Payment').closest('button');
    expect(btn?.getAttribute('disabled')).toBeNull();
  });

  it('shows paise conversion when amount is entered', () => {
    render(<RazorpayPaymentsTab />);
    fireEvent.change(screen.getByPlaceholderText('5000'), { target: { value: '100' } });
    expect(screen.getByText('= 10000 paise')).toBeDefined();
  });

  it('shows Razorpay fee calculation', () => {
    render(<RazorpayPaymentsTab />);
    fireEvent.change(screen.getByPlaceholderText('5000'), { target: { value: '10000' } });
    // Fee text should appear when amount is entered
    const feeEl = screen.getByText(/Razorpay fee/);
    expect(feeEl).toBeDefined();
    expect(feeEl.textContent).toContain('2%');
  });

  it('calls createRazorpayOrder and openRazorpayCheckout on successful checkout', async () => {
    vi.mocked(createRazorpayOrder).mockResolvedValue({ orderId: 'order_abc', amount: 50000, currency: 'INR', status: 'created' });
    vi.mocked(openRazorpayCheckout).mockResolvedValue({
      razorpay_payment_id: 'pay_test123',
      razorpay_order_id: 'order_abc',
      razorpay_signature: 'sig_test',
    });
    vi.mocked(verifyRazorpayPayment).mockResolvedValue({ verified: true, amount: 500 });

    render(<RazorpayPaymentsTab />);

    fireEvent.change(screen.getByPlaceholderText('5000'), { target: { value: '500' } });
    fireEvent.change(screen.getByPlaceholderText('Oracle Digital'), { target: { value: 'Test Business' } });
    fireEvent.change(screen.getByPlaceholderText('SEO Service - January'), { target: { value: 'Web Dev' } });

    fireEvent.click(screen.getByText('💳 Accept Payment'));

    await waitFor(() => {
      expect(createRazorpayOrder).toHaveBeenCalledWith(
        500,
        'INR',
        expect.stringContaining('orc_'),
        { description: 'Web Dev', business: 'Test Business' }
      );
    });

    await waitFor(() => {
      expect(openRazorpayCheckout).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 500,
          name: 'Test Business',
          description: 'Web Dev',
          orderId: 'order_abc',
        })
      );
    });
  });

  it('shows verified status after successful verification', async () => {
    vi.mocked(openRazorpayCheckout).mockResolvedValue({
      razorpay_payment_id: 'pay_test123',
      razorpay_order_id: 'order_test123',
      razorpay_signature: 'sig_test',
    });
    vi.mocked(verifyRazorpayPayment).mockResolvedValue({ verified: true, amount: 500 });

    render(<RazorpayPaymentsTab />);

    fireEvent.change(screen.getByPlaceholderText('5000'), { target: { value: '500' } });
    fireEvent.change(screen.getByPlaceholderText('Oracle Digital'), { target: { value: 'Test' } });
    fireEvent.click(screen.getByText('💳 Accept Payment'));

    await waitFor(() => {
      expect(screen.getByText(/Payment verified server-side/)).toBeDefined();
    });
  });

  it('shows failed status when verification fails', async () => {
    vi.mocked(openRazorpayCheckout).mockResolvedValue({
      razorpay_payment_id: 'pay_test123',
      razorpay_order_id: 'order_test123',
      razorpay_signature: 'sig_test',
    });
    vi.mocked(verifyRazorpayPayment).mockResolvedValue({ verified: false });

    render(<RazorpayPaymentsTab />);

    fireEvent.change(screen.getByPlaceholderText('5000'), { target: { value: '500' } });
    fireEvent.change(screen.getByPlaceholderText('Oracle Digital'), { target: { value: 'Test' } });
    fireEvent.click(screen.getByText('💳 Accept Payment'));

    await waitFor(() => {
      expect(screen.getByText(/verification failed/)).toBeDefined();
    });
  });

  it('shows toast error when checkout throws', async () => {
    vi.mocked(openRazorpayCheckout).mockRejectedValue(new Error('Payment cancelled'));

    render(<RazorpayPaymentsTab />);

    fireEvent.change(screen.getByPlaceholderText('5000'), { target: { value: '500' } });
    fireEvent.change(screen.getByPlaceholderText('Oracle Digital'), { target: { value: 'Test' } });
    fireEvent.click(screen.getByText('💳 Accept Payment'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Payment cancelled'),
        expect.anything()
      );
    });
  });

  it('disables checkout button when business name is missing', () => {
    render(<RazorpayPaymentsTab />);
    fireEvent.change(screen.getByPlaceholderText('5000'), { target: { value: '500' } });
    const btn = screen.getByText('💳 Accept Payment').closest('button');
    expect(btn?.getAttribute('disabled')).not.toBeNull();
  });

  it('disables checkout button when amount is zero', () => {
    render(<RazorpayPaymentsTab />);
    fireEvent.change(screen.getByPlaceholderText('5000'), { target: { value: '0' } });
    fireEvent.change(screen.getByPlaceholderText('Oracle Digital'), { target: { value: 'Test' } });
    const btn = screen.getByText('💳 Accept Payment').closest('button');
    expect(btn?.getAttribute('disabled')).not.toBeNull();
  });
});

describe('UPI QR View', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUPIQRCodes).mockReturnValue([]);
  });

  it('renders QR generator form', () => {
    render(<RazorpayPaymentsTab />);
    fireEvent.click(screen.getByText('📱 UPI QR'));

    expect(screen.getByPlaceholderText('oracle@paytm')).toBeDefined();
    expect(screen.getByPlaceholderText('SEO Service Payment')).toBeDefined();
    expect(screen.getByText('Generate QR Code')).toBeDefined();
  });

  it('shows empty state when no QR codes exist', () => {
    render(<RazorpayPaymentsTab />);
    fireEvent.click(screen.getByText('📱 UPI QR'));
    expect(screen.getByText('No QR codes generated yet')).toBeDefined();
  });

  it('generates QR code and shows preview', () => {
    render(<RazorpayPaymentsTab />);
    fireEvent.click(screen.getByText('📱 UPI QR'));

    fireEvent.change(screen.getByPlaceholderText('oracle@paytm'), { target: { value: 'test@upi' } });
    fireEvent.change(screen.getByPlaceholderText('5000'), { target: { value: '500' } });
    fireEvent.change(screen.getByPlaceholderText('SEO Service Payment'), { target: { value: 'Test Payment' } });

    fireEvent.click(screen.getByText('Generate QR Code'));

    expect(generateUPIQR).toHaveBeenCalledWith('test@upi', 500, 'Test Payment');
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('UPI QR code generated'), expect.anything());
  });

  it('shows QR code preview with copy and WhatsApp buttons', () => {
    render(<RazorpayPaymentsTab />);
    fireEvent.click(screen.getByText('📱 UPI QR'));

    fireEvent.change(screen.getByPlaceholderText('oracle@paytm'), { target: { value: 'test@upi' } });
    fireEvent.change(screen.getByPlaceholderText('5000'), { target: { value: '500' } });
    fireEvent.click(screen.getByText('Generate QR Code'));

    expect(screen.getByText('📋 Copy Link')).toBeDefined();
    expect(screen.getByText('💬 WhatsApp')).toBeDefined();
    expect(screen.getByText('✅ Mark Paid')).toBeDefined();
  });

  it('shows existing QR codes in history', () => {
    vi.mocked(getUPIQRCodes).mockReturnValue([
      {
        id: 'u1', upiId: 'oracle@paytm', amount: 2500, description: 'SEO',
        qrUrl: 'https://test.com/qr.png', upiLink: 'upi://pay?pa=oracle@paytm',
        status: 'active', createdAt: Date.now(),
      },
    ]);

    render(<RazorpayPaymentsTab />);
    fireEvent.click(screen.getByText('📱 UPI QR'));

    expect(screen.getAllByText('₹2,500').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/oracle@paytm/).length).toBeGreaterThanOrEqual(1);
  });

  it('calls markUPIQRPaid when Mark Paid is clicked', () => {
    render(<RazorpayPaymentsTab />);
    fireEvent.click(screen.getByText('📱 UPI QR'));

    fireEvent.change(screen.getByPlaceholderText('oracle@paytm'), { target: { value: 'test@upi' } });
    fireEvent.change(screen.getByPlaceholderText('5000'), { target: { value: '100' } });
    fireEvent.click(screen.getByText('Generate QR Code'));
    fireEvent.click(screen.getByText('✅ Mark Paid'));

    expect(markUPIQRPaid).toHaveBeenCalledWith('upi_test123');
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Marked as paid'), expect.anything());
  });
});

describe('Payment Links View', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPaymentLinks).mockReturnValue([]);
  });

  it('renders link generator form', () => {
    render(<RazorpayPaymentsTab />);
    fireEvent.click(screen.getByText('🔗 Payment Links'));

    expect(screen.getByText('🔗 Generate Payment Link')).toBeDefined();
    expect(screen.getByText('Generate')).toBeDefined();
  });

  it('shows empty state when no links exist', () => {
    render(<RazorpayPaymentsTab />);
    fireEvent.click(screen.getByText('🔗 Payment Links'));
    expect(screen.getByText('No payment links yet')).toBeDefined();
  });

  it('generates payment link', () => {
    render(<RazorpayPaymentsTab />);
    fireEvent.click(screen.getByText('🔗 Payment Links'));

    fireEvent.change(screen.getByPlaceholderText('5000'), { target: { value: '5000' } });
    fireEvent.change(screen.getByPlaceholderText('SEO Service - January'), { target: { value: 'SEO Package' } });
    fireEvent.click(screen.getByText('Generate'));

    expect(generatePaymentLink).toHaveBeenCalledWith(5000, 'SEO Package', 'Oracle Digital', 30);
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Payment link created'), expect.anything());
  });

  it('shows existing payment links', () => {
    vi.mocked(getPaymentLinks).mockReturnValue([
      {
        id: 'l1', amount: 10000, description: 'Web Design', shortUrl: 'https://oracle.digital/pay/ORC-123',
        status: 'partially_paid', createdAt: Date.now(),
      },
    ]);

    render(<RazorpayPaymentsTab />);
    fireEvent.click(screen.getByText('🔗 Payment Links'));

    expect(screen.getAllByText('₹10,000').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Web Design/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('partially_paid').length).toBeGreaterThanOrEqual(1);
  });

  it('shows Copy, WA, and Paid buttons for unpaid links', () => {
    vi.mocked(getPaymentLinks).mockReturnValue([
      {
        id: 'l1', amount: 5000, description: 'Test', shortUrl: 'https://oracle.digital/pay/ORC-1',
        status: 'partially_paid', createdAt: Date.now(),
      },
    ]);

    render(<RazorpayPaymentsTab />);
    fireEvent.click(screen.getByText('🔗 Payment Links'));

    expect(screen.getByText('📋 Copy')).toBeDefined();
    expect(screen.getByText('💬 WA')).toBeDefined();
    expect(screen.getByText('✅ Paid')).toBeDefined();
  });

  it('calls markPaymentLinkPaid when Paid button is clicked', () => {
    vi.mocked(getPaymentLinks).mockReturnValue([
      {
        id: 'l1', amount: 5000, description: 'Test', shortUrl: 'https://oracle.digital/pay/ORC-1',
        status: 'partially_paid', createdAt: Date.now(),
      },
    ]);

    render(<RazorpayPaymentsTab />);
    fireEvent.click(screen.getByText('🔗 Payment Links'));
    fireEvent.click(screen.getByText('✅ Paid'));

    expect(markPaymentLinkPaid).toHaveBeenCalledWith('l1');
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Marked as paid'), expect.anything());
  });

  it('calls deletePaymentLink when delete button is clicked', () => {
    vi.mocked(getPaymentLinks).mockReturnValue([
      {
        id: 'l1', amount: 5000, description: 'Test', shortUrl: 'https://oracle.digital/pay/ORC-1',
        status: 'partially_paid', createdAt: Date.now(),
      },
    ]);

    render(<RazorpayPaymentsTab />);
    fireEvent.click(screen.getByText('🔗 Payment Links'));

    // Find the delete button (🗑) for this link
    const deleteButtons = screen.getAllByText('🗑');
    fireEvent.click(deleteButtons[0]);

    expect(deletePaymentLink).toHaveBeenCalledWith('l1');
  });
});

describe('Records View', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPaymentRecords).mockReturnValue([]);
  });

  it('shows empty state when no records exist', () => {
    render(<RazorpayPaymentsTab />);
    fireEvent.click(screen.getByText('📋 All Payments'));
    expect(screen.getByText('No payments recorded yet')).toBeDefined();
  });

  it('renders payment records', () => {
    vi.mocked(getPaymentRecords).mockReturnValue([
      {
        id: 'pay1', paymentId: 'rp_pay1', amount: 7500, currency: 'INR',
        status: 'captured', method: 'upi', customerName: 'Acme Corp',
        description: 'Website Project', createdAt: Date.now(),
      },
    ]);

    render(<RazorpayPaymentsTab />);
    fireEvent.click(screen.getByText('📋 All Payments'));

    expect(screen.getByText('Acme Corp')).toBeDefined();
    expect(screen.getAllByText('₹7,500').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('captured').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Website Project/).length).toBeGreaterThanOrEqual(1);
  });

  it('calls deletePayment when delete button is clicked', () => {
    vi.mocked(getPaymentRecords).mockReturnValue([
      {
        id: 'pay1', paymentId: 'rp_pay1', amount: 5000, currency: 'INR',
        status: 'captured', method: 'card', customerName: 'Client',
        description: 'Service', createdAt: Date.now(),
      },
    ]);

    render(<RazorpayPaymentsTab />);
    fireEvent.click(screen.getByText('📋 All Payments'));

    const deleteButtons = screen.getAllByText('🗑');
    fireEvent.click(deleteButtons[0]);

    expect(deletePayment).toHaveBeenCalledWith('pay1');
  });
});

describe('Settings View', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRazorpayConfig).mockReturnValue(null);
  });

  it('renders configuration form', () => {
    render(<RazorpayPaymentsTab />);
    fireEvent.click(screen.getByText('⚙️ Settings'));

    expect(screen.getByText('⚙️ Razorpay Configuration')).toBeDefined();
    expect(screen.getByText('Save Configuration')).toBeDefined();
  });

  it('shows not-configured status when no keys set', () => {
    render(<RazorpayPaymentsTab />);
    fireEvent.click(screen.getByText('⚙️ Settings'));
    expect(screen.getByText('⚠️ Not configured')).toBeDefined();
  });

  it('shows configured status when keys are set', () => {
    vi.mocked(getRazorpayConfig).mockReturnValue({ keyId: 'rzp_test_123', keySecret: 'secret' });
    render(<RazorpayPaymentsTab />);
    fireEvent.click(screen.getByText('⚙️ Settings'));
    expect(screen.getByText('✅ Configured')).toBeDefined();
  });

  it('calls setRazorpayConfig when save is clicked', () => {
    render(<RazorpayPaymentsTab />);
    fireEvent.click(screen.getByText('⚙️ Settings'));

    fireEvent.change(screen.getByPlaceholderText('rzp_test_...'), { target: { value: 'rzp_test_abc' } });
    fireEvent.click(screen.getByText('Save Configuration'));

    expect(setRazorpayConfig).toHaveBeenCalledWith({ keyId: 'rzp_test_abc', keySecret: '' });
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('saved'), expect.anything());
  });

  it('shows setup guide with steps', () => {
    render(<RazorpayPaymentsTab />);
    fireEvent.click(screen.getByText('⚙️ Settings'));

    expect(screen.getByText('📖 Quick Setup Guide')).toBeDefined();
    expect(screen.getByText(/Create a Razorpay account/)).toBeDefined();
    expect(screen.getByText(/Generate Key/)).toBeDefined();
  });

  it('toggles secret visibility', () => {
    render(<RazorpayPaymentsTab />);
    fireEvent.click(screen.getByText('⚙️ Settings'));

    const secretInput = screen.getByPlaceholderText('Enter key secret (for QR/link generation)');
    expect(secretInput.getAttribute('type')).toBe('password');

    fireEvent.click(screen.getByText('👁️ Show'));
    expect(screen.getByText('🙈 Hide')).toBeDefined();

    fireEvent.click(screen.getByText('🙈 Hide'));
    expect(screen.getByText('👁️ Show')).toBeDefined();
  });
});
