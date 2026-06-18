/** @type {import('next').NextConfig} */
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig = {
  // Enable React Strict Mode for better error detection
  reactStrictMode: true,

  // Optimize imports for heavy packages (tree-shaking)
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@tanstack/react-query',
      'recharts',
      'framer-motion',
    ],
  },

  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.qrserver.com',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },

  // Security headers (complement middleware CSP)
  headers: async () => [
    {
      source: '/api/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-XSS-Protection', value: '1; mode=block' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      ],
    },
  ],
};

export default withSentryConfig(nextConfig, {
  // Sentry options
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Only print logs in CI
  silent: !process.env.CI,

  // Upload source maps in production builds
  widenClientFileUpload: true,
  hideSourceMaps: true,

  // Webpack-specific options (replaces deprecated top-level options)
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
    automaticVercelMonitors: true,
  },
});
