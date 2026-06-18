// ═══════════════════════════════════════
// ORACLE — 404 Not Found Page
// ═══════════════════════════════════════

import type { Metadata } from 'next';
import Link from 'next/link';
import { PAGE_METADATA } from '@/styles/design-tokens';

export const metadata: Metadata = (() => {
  const meta = PAGE_METADATA['not-found'];
  const imageUrl = `https://oracle.app${meta.image}`;

  return {
    title: meta.title,
    description: meta.description,
    openGraph: {
      title: `${meta.title} | ORACLE`,
      description: meta.description,
      type: 'website',
      locale: 'en_IN',
      url: 'https://oracle.app/not-found',
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

export default function NotFound() {
  return (
    <div className="flex h-screen items-center justify-center bg-[var(--oracle-bg)]">
      <div className="text-center">
        <div className="mb-6 flex h-20 w-20 mx-auto items-center justify-center rounded-2xl oracle-gradient-bg oracle-glow">
          <span className="text-4xl">⚡</span>
        </div>
        <h1 className="mb-2 text-[48px] font-black oracle-gradient-text">404</h1>
        <p className="mb-6 text-[16px] text-[var(--oracle-text-3)]">
          This page does not exist in the ORACLE universe.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl oracle-gradient-bg px-6 py-3 text-[14px] font-semibold text-white transition-all hover:scale-105"
        >
          ← Return to ORACLE
        </Link>
      </div>
    </div>
  );
}
