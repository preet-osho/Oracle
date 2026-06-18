// ═══════════════════════════════════════
// ORACLE — Forgot Password Page (Server Component)
// Exports generateMetadata for SEO + renders ForgotPasswordForm client component
// ═══════════════════════════════════════

import type { Metadata } from 'next';
import { PAGE_METADATA } from '@/styles/design-tokens';
import { ForgotPasswordForm } from './ForgotPasswordForm';
import { JsonLd, ORACLE_APP_SCHEMA, authBreadcrumbSchema } from '@/components/ui/json-ld';

export const metadata: Metadata = (() => {
  const meta = PAGE_METADATA['forgot-password'];
  const imageUrl = `https://oracle.app${meta.image}`;

  return {
    title: meta.title,
    description: meta.description,
    openGraph: {
      title: `${meta.title} | ORACLE`,
      description: meta.description,
      type: 'website',
      locale: 'en_IN',
      url: 'https://oracle.app/auth/forgot-password',
      siteName: 'ORACLE',
      images: [{ url: imageUrl, width: 1200, height: 630, alt: `${meta.title} — ORACLE` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${meta.title} | ORACLE`,
      description: meta.description,
      images: [imageUrl],
    },
  };
})();

const FORGOT_PASSWORD_BREADCRUMBS = authBreadcrumbSchema([
  { name: 'ORACLE', url: '/' },
  { name: 'Sign In', url: '/login' },
  { name: 'Reset Password', url: '/auth/forgot-password' },
]);

export default function ForgotPasswordPage() {
  return (
    <>
      <JsonLd schema={[ORACLE_APP_SCHEMA, FORGOT_PASSWORD_BREADCRUMBS]} />
      <ForgotPasswordForm />
    </>
  );
}
