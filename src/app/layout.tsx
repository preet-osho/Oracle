import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { KeyboardShortcutsProvider } from '@/hooks/keyboard-shortcuts-context';

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  preload: true,
});const jetbrainsMono = JetBrains_Mono({ 
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: {
    default: "ORACLE — Universal Agency Intelligence",
    template: "%s | ORACLE",
  },
  description: "The ultimate AI-powered agency assistant with 40+ service domains, 55+ prompts, 10 AI providers, and smart routing. Built for digital agencies in India.",
  keywords: ["AI", "agency", "marketing", "SEO", "development", "India", "digital agency"],
  authors: [{ name: "ORACLE Team" }],
  creator: "ORACLE",
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://oracle.app",
    siteName: "ORACLE",
    title: "ORACLE — Universal Agency Intelligence",
    description: "The ultimate AI-powered agency assistant for digital agencies",
  },
  twitter: {
    card: "summary_large_image",
    title: "ORACLE — Universal Agency Intelligence",
    description: "The ultimate AI-powered agency assistant for digital agencies",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#020711" },
    { media: "(prefers-color-scheme: light)", color: "#f8faff" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html 
      lang="en" 
      className={`${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#6366f1" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="ORACLE" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <Script src="/sw.js" strategy="afterInteractive" />
      <Script
        id="sw-register"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: `
          if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
            window.addEventListener('load', () => {
              navigator.serviceWorker.register('/sw.js').catch(() => {});
            });
          }
        ` }}
      />
      <body className="font-sans antialiased">
        <KeyboardShortcutsProvider>
          {children}
        </KeyboardShortcutsProvider>
      </body>
    </html>
  );
}
