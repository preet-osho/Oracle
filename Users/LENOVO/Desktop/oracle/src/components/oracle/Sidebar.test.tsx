import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// ─── Mocks ───

vi.mock('framer-motion', () => ({
  motion: {
    div: (p: Record<string, unknown>) => <div {...p}>{p.children as React.ReactNode}</div>,
    button: (p: Record<string, unknown>) => <button {...p}>{p.children as React.ReactNode}</button>,
    aside: (p: Record<string, unknown>) => <aside {...p}>{p.children as React.ReactNode}</aside>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/stores/router.store', () => ({
  useRouterStore: () => ({
    selectedModel: { providerId: 'openai', modelId: 'gpt-4o' },
    setSelectedModel: vi.fn(),
    autoRoute: true,
    toggleAutoRoute: vi.fn(),
    byokKeys: { openai: 'sk-123' },
  }),
}));

vi.mock('@/data/providers', () => ({
  PROVIDERS: [
    {
      id: 'openai',
      name: 'OpenAI',
      models: [
        { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000, bestFor: ['general'], isFree: false },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini', contextWindow: 128000, bestFor: ['general'], isFree: true },
      ],
      baseUrl: 'https://api.openai.com',
      keyFormat: 'sk-...',
      keyLabel: 'API Key',
      docsUrl: '',
      signupUrl: '',
      color: '#10a37f',
      supportsStreaming: true,
      supportsMCP: false,
    },
    {
      id: 'anthropic',
      name: 'Anthropic',
      models: [
        { id: 'claude-sonnet', name: 'Claude Sonnet', contextWindow: 200000, bestFor: ['general'], isFree: false },
      ],
      baseUrl: 'https://api.anthropic.com',
      keyFormat: 'sk-ant-...',
      keyLabel: 'API Key',
      docsUrl: '',
      signupUrl: '',
      color: '#d97706',
      supportsStreaming: true,
      supportsMCP: false,
    },
  ],
}));

vi.mock('@/styles/design-tokens', () => ({
  QUICK_ACTIONS: [
    { id: 'qa1', label: 'New Chat', emoji: '💬', action: 'chat' },
    { id: 'qa2', label: 'Upload Doc', emoji: '📄', action: 'upload' },
  ],
  transitions: { smooth: {}, snappy: {} },
  motionVariants: { fadeUp: {} },
  buttonTapProps: {},
  cardHoverProps: {},
}));

vi.mock('@/lib/rag', () => ({
  processDocument: vi.fn().mockResolvedValue({}),
}));

// ─── Import after mocks ───
import { Sidebar } from './Sidebar';

// ─── Tests ───

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders when isOpen is true', () => {
    render(<Sidebar isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('⚡ Quick Actions')).toBeDefined();
    expect(screen.getByText('📁 Active Project')).toBeDefined();
    expect(screen.getByText('📄 Documents')).toBeDefined();
    expect(screen.getByText('🌐 Web Search')).toBeDefined();
    expect(screen.getByText('🤖 Model')).toBeDefined();
    expect(screen.getByText('📊 Quality Average')).toBeDefined();
  });

  it('does not render when isOpen is false', () => {
    render(<Sidebar isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByText('⚡ Quick Actions')).toBeNull();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<Sidebar isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close sidebar'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders quick action buttons', () => {
    render(<Sidebar isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('New Chat')).toBeDefined();
    expect(screen.getByText('Upload Doc')).toBeDefined();
  });

  it('displays model selector with auto-route toggle', () => {
    render(<Sidebar isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('Auto-route')).toBeDefined();
    // Provider dropdowns are hidden when autoRoute is true (the mock default)
  });

  it('displays No active project message', () => {
    render(<Sidebar isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('No active project')).toBeDefined();
  });

  it('displays No scores yet for quality bar', () => {
    render(<Sidebar isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('No scores yet')).toBeDefined();
  });

  it('renders upload document button', () => {
    render(<Sidebar isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByLabelText('Upload document for RAG')).toBeDefined();
  });

  it('renders web search toggle', () => {
    render(<Sidebar isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('Enable web search')).toBeDefined();
  });
});
