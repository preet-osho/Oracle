import type { Metadata } from 'next';
import { AppShell } from '@/components/oracle/AppShell';
import { TAB_METADATA, VALID_TAB_IDS, type OracleTab } from '@/styles/design-tokens';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}): Promise<Metadata> {
  const params = await searchParams;
  const rawTab = params.tab ?? 'agent';
  const tab = VALID_TAB_IDS.has(rawTab) ? (rawTab as OracleTab) : 'agent';
  const meta = TAB_METADATA[tab];

  const title = `${meta.title} | ORACLE`;
  const description = meta.description;

  const imageUrl = `https://oracle.app${meta.image}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      locale: 'en_IN',
      url: `https://oracle.app/app/?tab=${tab}`,
      siteName: 'ORACLE',
      images: [{ url: imageUrl, width: 1200, height: 630, alt: `${meta.title} — ORACLE` }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default function AppPage() {
  return <AppShell />;
}
