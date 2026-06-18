import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// ─── Mocks ───

vi.mock('@/data/providers', () => ({
  PROVIDERS: [
    { id: 'openai', name: 'OpenAI', color: '#10a37f' },
    { id: 'anthropic', name: 'Anthropic', color: '#d97706' },
  ],
}));

vi.mock('@/data/domains', () => ({
  AGENCY_DOMAINS: [
    { id: 'seo', name: 'SEO', emoji: '🔍', category: 'Digital Marketing' },
    { id: 'web', name: 'Web Development', emoji: '🌐', category: 'Development' },
  ],
}));

vi.mock('@/lib/router', () => ({
  NeverStopRouter: {
    getAllKeys: vi.fn().mockReturnValue({ openai: 'sk-123' }),
  },
}));

vi.mock('@/styles/design-tokens', () => ({
  QUICK_ACTIONS: [
    { id: 'qa1', label: 'New Chat', emoji: '💬', action: 'chat' },
  ],
  ORACLE_TABS: [
    { id: 'agent', label: 'Agent', emoji: '🤖' },
    { id: 'prompts', label: 'Prompts', emoji: '📝' },
  ],
}));

// Mock cmdk
vi.mock('cmdk', () => ({
  Command: Object.assign(
    ({ children, ...props }: React.ComponentPropsWithoutRef<'div'> & { shouldFilter?: boolean }) => (
      <div {...props}>{children}</div>
    ),
    {
      Input: React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
        (props, ref) => <input ref={ref} {...props} />
      ),
      Group: ({ children, heading }: { children: React.ReactNode; heading?: string }) => (
        <div>
          {heading && <div role="heading">{heading}</div>}
          {children}
        </div>
      ),
      Item: ({ children, onSelect, value }: { children: React.ReactNode; onSelect?: () => void; value?: string }) => (
        <button onClick={onSelect} data-value={value}>{children}</button>
      ),
      Empty: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    }
  ),
}));

// ─── Import after mocks ───
import { CommandPalette } from './CommandPalette';

// ─── Tests ───

describe('CommandPalette', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when open is false', () => {
    render(<CommandPalette open={false} onClose={vi.fn()} />);
    expect(screen.queryByText('Search commands, prompts, domains...')).toBeNull();
  });

  it('renders when open is true', () => {
    render(<CommandPalette open={true} onClose={vi.fn()} />);
    expect(screen.getByPlaceholderText('Search commands, prompts, domains...')).toBeDefined();
  });

  it('displays quick actions section', () => {
    render(<CommandPalette open={true} onClose={vi.fn()} />);
    expect(screen.getByText('New Chat')).toBeDefined();
  });

  it('displays navigation tabs', () => {
    render(<CommandPalette open={true} onClose={vi.fn()} />);
    expect(screen.getByText('Agent')).toBeDefined();
    expect(screen.getByText('Prompts')).toBeDefined();
  });

  it('displays domains section', () => {
    render(<CommandPalette open={true} onClose={vi.fn()} />);
    expect(screen.getByText('SEO')).toBeDefined();
    expect(screen.getByText('Web Development')).toBeDefined();
  });

  it('displays provider keys section', () => {
    render(<CommandPalette open={true} onClose={vi.fn()} />);
    expect(screen.getByText('OpenAI')).toBeDefined();
    expect(screen.getByText('Anthropic')).toBeDefined();
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(<CommandPalette open={true} onClose={onClose} />);
    // Click the backdrop (first div with fixed inset-0)
    const backdrop = document.querySelector('.fixed.inset-0');
    if (backdrop) fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(<CommandPalette open={true} onClose={onClose} />);
    fireEvent.keyDown(screen.getByPlaceholderText('Search commands, prompts, domains...'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onNavigate with agent when quick action is selected', () => {
    const onNavigate = vi.fn();
    render(<CommandPalette open={true} onClose={vi.fn()} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByText('New Chat'));
    expect(onNavigate).toHaveBeenCalledWith('agent');
  });

  it('calls onNavigate when navigation tab is selected', () => {
    const onNavigate = vi.fn();
    render(<CommandPalette open={true} onClose={vi.fn()} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByText('Prompts'));
    expect(onNavigate).toHaveBeenCalledWith('prompts');
  });

  it('calls onClose when an item is selected', () => {
    const onClose = vi.fn();
    render(<CommandPalette open={true} onClose={onClose} />);
    fireEvent.click(screen.getByText('New Chat'));
    expect(onClose).toHaveBeenCalled();
  });
});
