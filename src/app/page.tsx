import type { Metadata } from 'next';
import { LandingContent } from '@/components/landing/LandingContent';
import { JsonLd, ORACLE_ORG_SCHEMA, ORACLE_FAQ_SCHEMA, ORACLE_PRODUCT_SCHEMA } from '@/components/ui/json-ld';

export const metadata: Metadata = {
  title: 'ORACLE — AI Operating System for Digital Agencies',
  description:
    'The ultimate AI-powered agency assistant with 40+ service domains, 55+ expert prompts, 10 AI providers, and smart routing. Built for digital agencies in India.',
  openGraph: {
    title: 'ORACLE — AI Operating System for Digital Agencies',
    description:
      '40+ domains. 55+ prompts. 10 providers. One platform to deliver exceptional agency work.',
    type: 'website',
    locale: 'en_IN',
    url: 'https://oracle.app',
    siteName: 'ORACLE',
    images: [{ url: 'https://oracle.app/api/og?tab=agent', width: 1200, height: 630, alt: 'ORACLE — AI Operating System for Digital Agencies' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ORACLE — AI Operating System for Digital Agencies',
    description:
      '40+ domains. 55+ prompts. 10 providers. One platform to deliver exceptional agency work.',
    images: ['https://oracle.app/api/og?tab=agent'],
  },
};

export default function Home() {
  return (
    <>
      <JsonLd schema={[ORACLE_ORG_SCHEMA, ORACLE_FAQ_SCHEMA, ORACLE_PRODUCT_SCHEMA]} />
      <LandingContent />
    </>
  );
}
