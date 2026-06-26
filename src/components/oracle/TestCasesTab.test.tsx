import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// ─── Mocks ───

vi.mock('@/styles/design-tokens', () => ({
  motionVariants: { fadeUp: {} },
  transitions: { smooth: {}, snappy: {} },
  buttonTapProps: {},
  cardHoverProps: {},
}));

vi.mock('@/data/test-cases', () => ({
  TEST_CASES: [
    {
      id: 'tc-1',
      clientName: 'GlowUp Beauty',
      industry: 'D2C / Beauty',
      city: 'Mumbai',
      contact: { name: 'Priya', phone: '+919876543210', email: 'priya@glowup.com', designation: 'Founder' },
      brief: 'We need help with our D2C beauty brand launch.',
      requirements: ['Meta Ads strategy', 'Instagram content plan'],
      suggestedPrompts: [],
      testQuestions: ['What is our target audience?', 'How should we price our products?'],
    },
    {
      id: 'tc-2',
      clientName: 'TechFlow SaaS',
      industry: 'SaaS / Productivity',
      city: 'Bangalore',
      contact: { name: 'Rahul', phone: '+919876543211', email: 'rahul@techflow.io', designation: 'CTO' },
      brief: 'We need SEO for our SaaS landing pages.',
      requirements: ['Technical SEO audit', 'Keyword research'],
      suggestedPrompts: [],
      testQuestions: ['What keywords should we target?', 'How to improve page speed?'],
    },
  ],
}));

// ─── Import after mocks ───

import { TestCasesTab } from './TestCasesTab';

// ─── Tests ─────────────────────────────

describe('TestCasesTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the heading', () => {
    render(<TestCasesTab />);
    expect(screen.getByText('🧪 Test Cases')).toBeDefined();
    expect(screen.getByText(/8 real client scenarios/)).toBeDefined();
  });

  it('displays all test case cards', () => {
    render(<TestCasesTab />);
    // Client names appear in both cards and comparison table
    expect(screen.getAllByText('GlowUp Beauty').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('TechFlow SaaS').length).toBeGreaterThanOrEqual(1);
  });

  it('displays client cities', () => {
    render(<TestCasesTab />);
    // Cities appear in both cards and comparison table
    expect(screen.getAllByText('Mumbai').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Bangalore').length).toBeGreaterThanOrEqual(1);
  });

  it('displays industry badges', () => {
    render(<TestCasesTab />);
    // Industry text appears in both card badges and comparison table
    expect(screen.getAllByText('D2C / Beauty').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('SaaS / Productivity').length).toBeGreaterThanOrEqual(1);
  });

  it('renders comparison table', () => {
    render(<TestCasesTab />);
    expect(screen.getByText('📊 Quick Comparison')).toBeDefined();
    expect(screen.getByText('Client')).toBeDefined();
    expect(screen.getByText('Industry')).toBeDefined();
    expect(screen.getByText('City')).toBeDefined();
    expect(screen.getByText('Primary Need')).toBeDefined();
    expect(screen.getByText('Requirements')).toBeDefined();
  });

  it('expands card when clicked to show brief', () => {
    render(<TestCasesTab />);
    // Client name appears in card AND comparison table, use getAllByText
    const glowUpElements = screen.getAllByText('GlowUp Beauty');
    fireEvent.click(glowUpElements[0]);
    expect(screen.getByText('Client Brief')).toBeDefined();
    expect(screen.getByText(/We need help with our D2C beauty brand launch/)).toBeDefined();
  });

  it('shows requirements when expanded', () => {
    render(<TestCasesTab />);
    fireEvent.click(screen.getAllByText('GlowUp Beauty')[0]);
    // 'Requirements' appears in both expanded card and comparison table header
    expect(screen.getAllByText('Requirements').length).toBeGreaterThanOrEqual(2);
    // Requirement names appear in both expanded card and comparison table primary need
    expect(screen.getAllByText('Meta Ads strategy').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Instagram content plan').length).toBeGreaterThanOrEqual(1);
  });

  it('shows contact info when expanded', () => {
    render(<TestCasesTab />);
    fireEvent.click(screen.getAllByText('GlowUp Beauty')[0]);
    expect(screen.getByText('Contact')).toBeDefined();
    expect(screen.getByText(/Priya.*Founder.*priya@glowup.com/)).toBeDefined();
  });

  it('shows test questions when expanded', () => {
    render(<TestCasesTab />);
    fireEvent.click(screen.getAllByText('GlowUp Beauty')[0]);
    expect(screen.getByText('Test Questions')).toBeDefined();
    expect(screen.getByText('What is our target audience?')).toBeDefined();
    expect(screen.getByText('How should we price our products?')).toBeDefined();
  });

  it('collapses card when clicked again', () => {
    render(<TestCasesTab />);
    fireEvent.click(screen.getAllByText('GlowUp Beauty')[0]);
    expect(screen.getByText('Client Brief')).toBeDefined();
    fireEvent.click(screen.getAllByText('GlowUp Beauty')[0]);
    expect(screen.queryByText('Client Brief')).toBeNull();
  });

  it('calls onAskQuestion when test question button is clicked', () => {
    const onAskQuestion = vi.fn();
    render(<TestCasesTab onAskQuestion={onAskQuestion} />);
    fireEvent.click(screen.getAllByText('GlowUp Beauty')[0]);
    fireEvent.click(screen.getByText('What is our target audience?'));
    expect(onAskQuestion).toHaveBeenCalledWith('What is our target audience?');
  });

  it('expands different card independently', () => {
    render(<TestCasesTab />);
    fireEvent.click(screen.getAllByText('GlowUp Beauty')[0]);
    expect(screen.getByText('Client Brief')).toBeDefined();
    fireEvent.click(screen.getAllByText('TechFlow SaaS')[0]);
    // GlowUp should collapse, TechFlow should expand
    expect(screen.getByText(/We need SEO for our SaaS landing pages/)).toBeDefined();
  });

  it('shows requirements count in comparison table', () => {
    render(<TestCasesTab />);
    expect(screen.getAllByText('2 items').length).toBeGreaterThanOrEqual(1);
  });
});
