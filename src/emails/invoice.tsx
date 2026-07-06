import React from 'react';
import { Text, Button, Section, Hr } from '@react-email/components';
import { BaseLayout } from './base-layout';
import { formatCurrency } from './utils';

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

interface InvoiceEmailProps {
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  items: InvoiceLineItem[];
  subtotal: number;
  tax?: number;
  taxRate?: number;
  discount?: number;
  total: number;
  currency?: string;
  dueDate?: string;
  paymentUrl?: string;
  notes?: string;
  issuedBy?: string;
}

/**
 * Invoice email template.
 * Sent when an invoice is generated or updated for a client.
 */
export const InvoiceEmail: React.FC<InvoiceEmailProps> = ({
  invoiceNumber,
  clientName,
  items,
  subtotal,
  tax,
  taxRate,
  discount,
  total,
  currency = 'INR',
  dueDate,
  paymentUrl,
  notes,
  issuedBy = 'Oracle Digital',
}) => (
  <BaseLayout previewText={`Invoice ${invoiceNumber} — ${formatCurrency(total, currency)}`}>
    <Section>
      {/* Header */}
      <Text
        style={{
          fontSize: '22px',
          fontWeight: 600,
          color: '#fafafa',
          margin: '0 0 4px 0',
        }}
      >
        🧾 Invoice {invoiceNumber}
      </Text>
      <Text
        style={{
          fontSize: '14px',
          color: '#71717a',
          margin: '0 0 24px 0',
        }}
      >
        Issued by {issuedBy}
        {dueDate ? ` · Due ${dueDate}` : ''}
      </Text>

      {/* Client */}
      <Text
        style={{
          fontSize: '13px',
          color: '#52525b',
          margin: '0 0 4px 0',
          textTransform: 'uppercase' as const,
          letterSpacing: '0.05em',
        }}
      >
        Bill To
      </Text>
      <Text
        style={{
          fontSize: '15px',
          color: '#e4e4e7',
          fontWeight: 500,
          margin: '0 0 24px 0',
        }}
      >
        {clientName}
      </Text>

      {/* Line Items Table */}
      <Section
        style={{
          backgroundColor: '#18181b',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '16px',
        }}
      >
        {/* Table Header */}
        <Section>
          <Text
            style={{
              fontSize: '12px',
              color: '#52525b',
              textTransform: 'uppercase' as const,
              letterSpacing: '0.05em',
              margin: '0 0 8px 0',
            }}
          >
            <span style={{ display: 'inline-block', width: '55%' }}>Description</span>
            <span style={{ display: 'inline-block', width: '15%', textAlign: 'right' as const }}>Qty</span>
            <span style={{ display: 'inline-block', width: '30%', textAlign: 'right' as const }}>Amount</span>
          </Text>
        </Section>

        <Hr
          style={{
            border: 'none',
            borderTop: '1px solid #27272a',
            margin: '0 0 8px 0',
          }}
        />

        {/* Line Items */}
        {items.map((item, index) => (
          <Section key={index}>
            <Text
              style={{
                fontSize: '14px',
                color: '#a1a1aa',
                margin: '0 0 4px 0',
              }}
            >
              <span style={{ display: 'inline-block', width: '55%' }}>
                {item.description}
              </span>
              <span style={{ display: 'inline-block', width: '15%', textAlign: 'right' as const }}>
                {item.quantity}
              </span>
              <span
                style={{
                  display: 'inline-block',
                  width: '30%',
                  textAlign: 'right' as const,
                  color: '#e4e4e7',
                  fontWeight: 500,
                }}
              >
                {formatCurrency(item.amount, currency)}
              </span>
            </Text>
          </Section>
        ))}
      </Section>

      {/* Totals */}
      <Section style={{ marginBottom: '24px' }}>
        <Text
          style={{
            fontSize: '14px',
            color: '#71717a',
            margin: '0 0 4px 0',
          }}
        >
          <span style={{ display: 'inline-block', width: '70%' }}>Subtotal</span>
          <span style={{ display: 'inline-block', width: '30%', textAlign: 'right' as const }}>
            {formatCurrency(subtotal, currency)}
          </span>
        </Text>

        {discount && discount > 0 && (
          <Text
            style={{
              fontSize: '14px',
              color: '#22c55e',
              margin: '0 0 4px 0',
            }}
          >
            <span style={{ display: 'inline-block', width: '70%' }}>Discount</span>
            <span style={{ display: 'inline-block', width: '30%', textAlign: 'right' as const }}>
              -{formatCurrency(discount, currency)}
            </span>
          </Text>
        )}

        {tax && tax > 0 && (
          <Text
            style={{
              fontSize: '14px',
              color: '#71717a',
              margin: '0 0 4px 0',
            }}
          >
            <span style={{ display: 'inline-block', width: '70%' }}>
              Tax{taxRate ? ` (${taxRate}%)` : ''}
            </span>
            <span style={{ display: 'inline-block', width: '30%', textAlign: 'right' as const }}>
              {formatCurrency(tax, currency)}
            </span>
          </Text>
        )}

        <Hr
          style={{
            border: 'none',
            borderTop: '1px solid #27272a',
            margin: '8px 0',
          }}
        />

        <Text
          style={{
            fontSize: '18px',
            fontWeight: 700,
            color: '#fafafa',
            margin: 0,
          }}
        >
          <span style={{ display: 'inline-block', width: '70%' }}>Total</span>
          <span
            style={{
              display: 'inline-block',
              width: '30%',
              textAlign: 'right' as const,
              background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {formatCurrency(total, currency)}
          </span>
        </Text>
      </Section>

      {/* Payment Button */}
      {paymentUrl && (
        <Section style={{ textAlign: 'center' as const, marginBottom: '24px' }}>
          <Button
            href={paymentUrl}
            style={{
              display: 'inline-block',
              background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
              color: '#ffffff',
              padding: '14px 36px',
              borderRadius: '12px',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '15px',
              letterSpacing: '0.01em',
            }}
          >
            Pay Now — {formatCurrency(total, currency)}
          </Button>
        </Section>
      )}

      {/* Notes */}
      {notes && (
        <Section
          style={{
            backgroundColor: '#18181b',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '16px',
          }}
        >
          <Text
            style={{
              fontSize: '12px',
              color: '#52525b',
              textTransform: 'uppercase' as const,
              letterSpacing: '0.05em',
              margin: '0 0 8px 0',
            }}
          >
            Notes
          </Text>
          <Text
            style={{
              fontSize: '14px',
              color: '#a1a1aa',
              lineHeight: '1.5',
              margin: 0,
            }}
          >
            {notes}
          </Text>
        </Section>
      )}
    </Section>
  </BaseLayout>
);

export default InvoiceEmail;
