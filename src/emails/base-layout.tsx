import React from 'react';
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Link,
  Hr,
  Preview,
} from '@react-email/components';

interface BaseLayoutProps {
  previewText: string;
  children: React.ReactNode;
}

/**
 * Shared email layout for all Oracle transactional emails.
 * Provides consistent branding, header, footer, and responsive container.
 */
export const BaseLayout: React.FC<BaseLayoutProps> = ({
  previewText,
  children,
}) => (
  <Html lang="en">
    <Head />
    <Preview>{previewText}</Preview>
    <Body
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        backgroundColor: '#0a0a0f',
        color: '#e4e4e7',
        margin: 0,
        padding: 0,
      }}
    >
      <Container
        style={{
          maxWidth: '600px',
          margin: '0 auto',
          padding: '40px 20px',
        }}
      >
        {/* Header */}
        <Section style={{ marginBottom: '32px', textAlign: 'center' as const }}>
          <Text
            style={{
              fontSize: '28px',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            ⬡ Oracle
          </Text>
          <Text
            style={{
              fontSize: '12px',
              color: '#71717a',
              margin: '4px 0 0 0',
              textTransform: 'uppercase' as const,
              letterSpacing: '0.1em',
            }}
          >
            Digital Agency Platform
          </Text>
        </Section>

        {/* Divider */}
        <Hr
          style={{
            border: 'none',
            borderTop: '1px solid #27272a',
            margin: '0 0 32px 0',
          }}
        />

        {/* Content */}
        <Section style={{ marginBottom: '32px' }}>{children}</Section>

        {/* Divider */}
        <Hr
          style={{
            border: 'none',
            borderTop: '1px solid #27272a',
            margin: '0 0 24px 0',
          }}
        />

        {/* Footer */}
        <Section style={{ textAlign: 'center' as const }}>
          <Text
            style={{
              fontSize: '13px',
              color: '#52525b',
              lineHeight: '1.6',
              margin: 0,
            }}
          >
            © {new Date().getFullYear()} Oracle Digital. All rights reserved.
          </Text>
          <Text
            style={{
              fontSize: '12px',
              color: '#3f3f46',
              margin: '8px 0 0 0',
            }}
          >
            <Link
              href="https://oracledigital.in/privacy"
              style={{ color: '#71717a', textDecoration: 'underline' }}
            >
              Privacy Policy
            </Link>
            {' · '}
            <Link
              href="https://oracledigital.in/unsubscribe"
              style={{ color: '#71717a', textDecoration: 'underline' }}
            >
              Unsubscribe
            </Link>
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);
