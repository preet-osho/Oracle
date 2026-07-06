// ═══════════════════════════════════════
// ORACLE — MCP Module
// Model Context Protocol server infrastructure
// ═══════════════════════════════════════

// Protocol types
export * from './protocol';

// Base server
export { McpServer } from './server';

// Client manager
export { McpClientManager, getMcpManager, MCP_SERVER_REGISTRY } from './client';

// Specialized servers
export { createBrowserMcpServer } from './servers/browser';
export { createSearchMcpServer } from './servers/search';
export { createSeoMcpServer } from './servers/seo';
export { createCrmMcpServer } from './servers/crm';
