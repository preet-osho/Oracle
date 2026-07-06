import React from 'react';
import { Text, Button, Section } from '@react-email/components';
import { BaseLayout } from './base-layout';

interface InvitationEmailProps {
  inviteUrl: string;
  inviterName: string;
  inviterEmail?: string;
  orgName: string;
  role?: string;
  expiryDays?: number;
}

/**
 * Invitation email template.
 * Sent when a user is invited to join an organization on Oracle.
 */
export const InvitationEmail: React.FC<InvitationEmailProps> = ({
  inviteUrl,
  inviterName,
  inviterEmail,
  orgName,
  role = 'member',
  expiryDays = 7,
}) => (
  <BaseLayout previewText={`${inviterName} invited you to ${orgName}`}>
    <Section>
      <Text
        style={{
          fontSize: '22px',
          fontWeight: 600,
          color: '#fafafa',
          margin: '0 0 16px 0',
        }}
      >
        👋 You&apos;re Invited!
      </Text>

      <Text
        style={{
          fontSize: '15px',
          color: '#a1a1aa',
          lineHeight: '1.6',
          margin: '0 0 8px 0',
        }}
      >
        <strong style={{ color: '#e4e4e7' }}>{inviterName}</strong>
        {inviterEmail ? ` (${inviterEmail})` : ''} has invited you to join{' '}
        <strong style={{ color: '#e4e4e7' }}>{orgName}</strong> on Oracle Digital.
      </Text>

      <Text
        style={{
          fontSize: '15px',
          color: '#a1a1aa',
          lineHeight: '1.6',
          margin: '0 0 24px 0',
        }}
      >
        You&apos;ll be joining as a <strong style={{ color: '#a855f7' }}>{role}</strong> with access to
        the agency&apos;s AI-powered tools, client management, and analytics.
      </Text>

      {/* Accept Button */}
      <Section style={{ textAlign: 'center' as const, marginBottom: '24px' }}>
        <Button
          href={inviteUrl}
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
          Accept Invitation
        </Button>
      </Section>

      {/* Features Preview */}
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
            fontSize: '13px',
            color: '#71717a',
            lineHeight: '1.6',
            margin: '0 0 8px 0',
          }}
        >
          🚀 What you&apos;ll get access to:
        </Text>
        <Text
          style={{
            fontSize: '13px',
            color: '#52525b',
            lineHeight: '1.6',
            margin: 0,
          }}
        >
          • AI-powered client task management
          <br />
          • Automated proposal & invoice generation
          <br />
          • Real-time analytics & profitability tracking
          <br />
          • WhatsApp & email campaign tools
        </Text>
      </Section>

      {/* Expiry Warning */}
      <Text
        style={{
          fontSize: '13px',
          color: '#52525b',
          lineHeight: '1.5',
          margin: 0,
        }}
      >
        ⏱ This invitation expires in <strong style={{ color: '#a1a1aa' }}>{expiryDays} days</strong>.
        {' '}If you don&apos;t have an Oracle account, one will be created for you.
      </Text>
    </Section>
  </BaseLayout>
);

export default InvitationEmail;
