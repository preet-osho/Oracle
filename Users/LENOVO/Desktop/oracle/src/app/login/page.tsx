// ═══════════════════════════════════════
// ORACLE — Login / Signup Page (Server Component)
// Exports generateMetadata for SEO + renders LoginForm client component
// ═══════════════════════════════════════

import type { Metadata } from 'next';
import { PAGE_METADATA } from '@/styles/design-tokens';
import { LoginForm } from './LoginForm';
import { JsonLd, ORACLE_APP_SCHEMA, authBreadcrumbSchema } from '@/components/ui/json-ld';

export const metadata: Metadata = (() => {
  const meta = PAGE_METADATA['login'];
  const imageUrl = `https://oracle.app${meta.image}`;

  return {
    title: meta.title,
    description: meta.description,
    openGraph: {
      title: `${meta.title} | ORACLE`,
      description: meta.description,
      type: 'website',
      locale: 'en_IN',
      url: 'https://oracle.app/login',
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

const LOGIN_BREADCRUMBS = authBreadcrumbSchema([
  { name: 'ORACLE', url: '/' },
  { name: 'Sign In', url: '/login' },
]);

export default function LoginPage() {
  return (
    <>
      <JsonLd schema={[ORACLE_APP_SCHEMA, LOGIN_BREADCRUMBS]} />
      <LoginForm />
    </>
  );
}
