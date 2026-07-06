import React from 'react';
import { Text, Button, Section } from '@react-email/components';
import { BaseLayout } from './base-layout';

interface PasswordResetEmailProps {
  resetUrl: string;
  expiryMinutes?: number;
  requestedBy?: string;
}

/**
 * Password Reset email template.
 * Sent when a user requests a password reset via the auth flow.
 */
export const PasswordResetEmail: React.FC<PasswordResetEmailProps> = ({
  resetUrl,
  expiryMinutes = 60,
  requestedBy,
}) => (
  <BaseLayout previewText="Reset your Oracle password">
    <Section>
      <Text
        style={{
          fontSize: '22px',
          fontWeight: 600,
          color: '#fafafa',
          margin: '0 0 16px 0',
        }}
      >
        🔐 Reset Your Password
      </Text>

      <Text
        style={{
          fontSize: '15px',
          color: '#a1a1aa',
          lineHeight: '1.6',
          margin: '0 0 8px 0',
        }}
      >
        {requestedBy
          ? `We received a password reset request for the account associated with ${requestedBy}.`
          : 'We received a request to reset your password.'}
      </Text>

      <Text
        style={{
          fontSize: '15px',
          color: '#a1a1aa',
          lineHeight: '1.6',
          margin: '0 0 24px 0',
        }}
      >
        Click the button below to choose a new password:
      </Text>

      {/* Reset Button */}
      <Section style={{ textAlign: 'center' as const, marginBottom: '24px' }}>
        <Button
          href={resetUrl}
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
          Reset Password
        </Button>
      </Section>

      {/* Security Note */}
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
            lineHeight: '1.5',
            margin: 0,
          }}
        >
          ⏱ This link expires in <strong style={{ color: '#a1a1aa' }}>{expiryMinutes} minutes</strong>.
          {' '}If you didn&apos;t request this, you can safely ignore this email — your
          password will remain unchanged.
        </Text>
      </Section>

      {/* Troubleshooting */}
      <Text
        style={{
          fontSize: '13px',
          color: '#52525b',
          lineHeight: '1.5',
          margin: '0 0 8px 0',
        }}
      >
        Having trouble? Copy and paste this URL into your browser:
      </Text>
      <Text
        style={{
          fontSize: '12px',
          color: '#7c3aed',
          wordBreak: 'break-all' as const,
          margin: 0,
        }}
      >
        {resetUrl}
      </Text>
    </Section>
  </BaseLayout>
);

export default PasswordResetEmail;
