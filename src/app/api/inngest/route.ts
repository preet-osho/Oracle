// ═══════════════════════════════════════
// ORACLE — Inngest API Endpoint
// Exposes the Inngest SDK for event receiving, function calling, and step management
// ═══════════════════════════════════════

import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { inngestFunctions } from '@/lib/inngest/functions';

/**
 * Inngest serves three HTTP methods:
 * - GET:  Health check / info
 * - POST: Event receiving + function invocation + step execution
 * - PUT:  Register this app's functions with Inngest
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: inngestFunctions,
});
