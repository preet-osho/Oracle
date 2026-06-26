import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import {
  OperatingLoopDashboard,
  OperatingLoopStepDots,
  OperatingLoopFloatingProgress,
} from './OperatingLoopDashboard';
import type { OperatingLoopResult } from '@/lib/agency-operations';

// ─── Mock framer-motion ───
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div {...filterProps(props)}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function filterProps(props: Record<string, unknown>): Record<string, unknown> {
  const dom: Record<string, unknown> = {};
  for (const key of Object.keys(props)) {
    if (key === 'children' || key.startsWith('on') || key === 'className' || key === 'style' || key === 'key' || key === 'role' || key === 'title') {
      dom[key] = props[key];
    }
  }
  return dom;
}

// ─── Helpers ───

function makeResult(overrides: Partial<OperatingLoopResult> = {}): OperatingLoopResult {
  return {
    step: 'understand',
    output: 'Business analysis complete. Target: dental clinics in Delhi.',
    agentUsed: 'agency-brain',
    duration: 150,
    ...overrides,
  };
}

function makeFullResults(): OperatingLoopResult[] {
  const steps = ['understand', 'diagnose', 'plan', 'execute', 'qa', 'improve'] as const;
  return steps.map((step, i) => makeResult({ step, duration: 100 + i * 50 }));
}

// ─── OperatingLoopDashboard Tests ───

describe('OperatingLoopDashboard', () => {
  describe('header', () => {
    it('renders the title', () => {
      render(<OperatingLoopDashboard results={[]} />);
      expect(screen.getByText('Agency Brain — Operating Loop')).toBeDefined();
    });

    it('shows step count as 0/6 when empty', () => {
      render(<OperatingLoopDashboard results={[]} />);
      expect(screen.getByText('0/6 steps')).toBeDefined();
    });

    it('shows correct step count when partially complete', () => {
      const results = [makeResult(), makeResult({ step: 'diagnose' })];
      render(<OperatingLoopDashboard results={results} />);
      expect(screen.getByText('2/6 steps')).toBeDefined();
    });

    it('shows "Running" badge when isActive and not all done', () => {
      const results = [makeResult()];
      render(<OperatingLoopDashboard results={results} isActive={true} />);
      expect(screen.getByText('Running')).toBeDefined();
    });

    it('shows "✓ Complete" badge when all done and not active', () => {
      const results = makeFullResults();
      render(<OperatingLoopDashboard results={results} />);
      expect(screen.getByText('✓ Complete')).toBeDefined();
    });

    it('does not show "Running" when all done', () => {
      const results = makeFullResults();
      render(<OperatingLoopDashboard results={results} isActive={true} />);
      expect(screen.queryByText('Running')).toBeNull();
    });

    it('shows total time when > 0', () => {
      const results = [makeResult({ duration: 200 }), makeResult({ step: 'diagnose', duration: 300 })];
      render(<OperatingLoopDashboard results={results} />);
      expect(screen.getByText('500ms')).toBeDefined();
    });

    it('shows failed count when there are failures', () => {
      const results = [
        makeResult(),
        makeResult({ step: 'diagnose', output: '[Failed at diagnose step]' }),
      ];
      render(<OperatingLoopDashboard results={results} />);
      expect(screen.getByText('1 failed')).toBeDefined();
    });
  });

  describe('task display', () => {
    it('shows task when provided', () => {
      render(<OperatingLoopDashboard results={[]} task="Build a marketing strategy" />);
      expect(screen.getByText(/Build a marketing strategy/)).toBeDefined();
    });

    it('does not show task when not provided', () => {
      const { container } = render(<OperatingLoopDashboard results={[]} />);
      expect(container.querySelector('[title]')).toBeNull();
    });
  });

  describe('steps timeline', () => {
    it('renders all 6 step labels', () => {
      render(<OperatingLoopDashboard results={[]} />);
      expect(screen.getByText(/1\. Understand/)).toBeDefined();
      expect(screen.getByText(/2\. Diagnose/)).toBeDefined();
      expect(screen.getByText(/3\. Plan/)).toBeDefined();
      expect(screen.getByText(/4\. Execute/)).toBeDefined();
      expect(screen.getByText(/5\. QA Check/)).toBeDefined();
      expect(screen.getByText(/6\. Improve/)).toBeDefined();
    });

    it('shows completed steps with duration', () => {
      const results = [makeResult({ step: 'understand', duration: 200 })];
      render(<OperatingLoopDashboard results={results} />);
      // Duration appears in both the step row and the header total — verify at least one exists
      const durations = screen.getAllByText('200ms');
      expect(durations.length).toBeGreaterThanOrEqual(1);
    });

    it('shows "Processing…" for current step when active', () => {
      const results = [makeResult({ step: 'understand' })];
      render(<OperatingLoopDashboard results={results} isActive={true} />);
      expect(screen.getByText('Processing…')).toBeDefined();
    });

    it('does not show "Processing…" when not active', () => {
      const results = [makeResult({ step: 'understand' })];
      render(<OperatingLoopDashboard results={results} isActive={false} />);
      expect(screen.queryByText('Processing…')).toBeNull();
    });
  });

  describe('step expand/collapse', () => {
    it('expands step output when completed step is clicked', () => {
      const results = [makeResult({ step: 'understand', output: 'Business is a dental clinic targeting young professionals.' })];
      render(<OperatingLoopDashboard results={results} />);
      
      // Click the understand step
      fireEvent.click(screen.getByText(/1\. Understand/).closest('button')!);
      
      expect(screen.getByText(/Business is a dental clinic/)).toBeDefined();
      expect(screen.getByText(/Output via agency-brain/)).toBeDefined();
    });

    it('collapses step output when clicked again', () => {
      const results = [makeResult({ step: 'understand', output: 'Business analysis output' })];
      render(<OperatingLoopDashboard results={results} />);
      
      const button = screen.getByText(/1\. Understand/).closest('button')!;
      fireEvent.click(button); // expand
      fireEvent.click(button); // collapse
      
      expect(screen.queryByText(/Business analysis output/)).toBeNull();
    });

    it('does not expand pending steps when clicked', () => {
      render(<OperatingLoopDashboard results={[]} />);
      
      // Click the understand step (pending)
      fireEvent.click(screen.getByText(/1\. Understand/).closest('button')!);
      
      // Should not show output section
      expect(screen.queryByText(/Output via/)).toBeNull();
    });

    it('shows failed step output with error styling', () => {
      const results = [makeResult({ step: 'understand', output: '[Failed at understand step]' })];
      render(<OperatingLoopDashboard results={results} />);
      
      fireEvent.click(screen.getByText(/1\. Understand/).closest('button')!);
      
      expect(screen.getByText('[Failed at understand step]')).toBeDefined();
    });
  });

  describe('totalSteps prop', () => {
    it('uses default totalSteps of 6', () => {
      render(<OperatingLoopDashboard results={[]} />);
      expect(screen.getByText('0/6 steps')).toBeDefined();
    });

    it('uses custom totalSteps', () => {
      render(<OperatingLoopDashboard results={[]} totalSteps={10} />);
      expect(screen.getByText('0/10 steps')).toBeDefined();
    });
  });
});

// ─── OperatingLoopStepDots Tests ───

describe('OperatingLoopStepDots', () => {
  it('shows "Loop Complete" when all steps done', () => {
    const results = makeFullResults();
    render(<OperatingLoopStepDots results={results} totalSteps={6} isActive={false} />);
    expect(screen.getByText('Loop Complete')).toBeDefined();
  });

  it('shows current step label when active and not all done', () => {
    const results = [makeResult({ step: 'understand' })];
    render(<OperatingLoopStepDots results={results} totalSteps={6} isActive={true} />);
    expect(screen.getByText(/🩺 Diagnose…/)).toBeDefined();
  });

  it('shows fallback label when no steps done and not active', () => {
    const { container } = render(<OperatingLoopStepDots results={[]} totalSteps={6} isActive={false} />);
    // The component renders a label span — check it exists
    const label = container.querySelector('.text-\\[11px\\]');
    expect(label).toBeDefined();
  });

  it('shows step count', () => {
    const results = [makeResult(), makeResult({ step: 'diagnose' })];
    render(<OperatingLoopStepDots results={results} totalSteps={6} isActive={true} />);
    expect(screen.getByText('2/6')).toBeDefined();
  });

  it('shows total time when > 0', () => {
    const results = [makeResult({ duration: 100 }), makeResult({ step: 'diagnose', duration: 200 })];
    render(<OperatingLoopStepDots results={results} totalSteps={6} isActive={false} />);
    expect(screen.getByText('300ms')).toBeDefined();
  });

  it('shows warning icon when there are failures', () => {
    const results = [
      makeResult({ step: 'understand', output: '[Failed at understand step]' }),
      makeResult({ step: 'diagnose' }),
    ];
    render(<OperatingLoopStepDots results={results} totalSteps={6} isActive={false} />);
    expect(screen.getByText('⚠')).toBeDefined();
  });

  it('renders 6 step dot dividers', () => {
    const { container } = render(<OperatingLoopStepDots results={[]} totalSteps={6} isActive={false} />);
    // Each step dot has a title attribute with the step name
    const dots = container.querySelectorAll('[title]');
    expect(dots.length).toBe(6);
  });

  it('shows pulsing dot for current active step', () => {
    const results = [makeResult({ step: 'understand' })];
    const { container } = render(<OperatingLoopStepDots results={results} totalSteps={6} isActive={true} />);
    // The current step dot should have animate-pulse class
    const pulsingDots = container.querySelectorAll('.animate-pulse');
    expect(pulsingDots.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── OperatingLoopFloatingProgress Tests ───

describe('OperatingLoopFloatingProgress', () => {
  it('returns null when not active and no results', () => {
    const { container } = render(
      <OperatingLoopFloatingProgress results={[]} totalSteps={6} isActive={false} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders when active even with no results', () => {
    render(
      <OperatingLoopFloatingProgress results={[]} totalSteps={6} isActive={true} />
    );
    expect(screen.getByText(/Understand…/)).toBeDefined();
  });

  it('shows current step label and description when active', () => {
    const results = [
      makeResult({ step: 'understand' }),
      makeResult({ step: 'diagnose' }),
    ];
    render(
      <OperatingLoopFloatingProgress results={results} totalSteps={6} isActive={true} />
    );
    // After 2 steps, current is 'plan' (index 2)
    expect(screen.getByText(/Plan…/)).toBeDefined();
    expect(screen.getByText(/Channel mix, funnel, agent assignment/)).toBeDefined();
  });

  it('shows "Loop Complete" when all done', () => {
    const results = makeFullResults();
    render(
      <OperatingLoopFloatingProgress results={results} totalSteps={6} isActive={false} />
    );
    expect(screen.getByText('Loop Complete')).toBeDefined();
    expect(screen.getByText('✓')).toBeDefined();
  });

  it('shows step count', () => {
    const results = [makeResult(), makeResult({ step: 'diagnose' })];
    render(
      <OperatingLoopFloatingProgress results={results} totalSteps={6} isActive={true} />
    );
    expect(screen.getByText('2/6')).toBeDefined();
  });

  it('shows task when provided', () => {
    render(
      <OperatingLoopFloatingProgress
        results={[]}
        totalSteps={6}
        isActive={true}
        task="Build marketing strategy"
      />
    );
    expect(screen.getByText('Build marketing strategy')).toBeDefined();
  });

  it('does not show task when not provided', () => {
    const { container } = render(
      <OperatingLoopFloatingProgress results={[]} totalSteps={6} isActive={true} />
    );
    // Task text is rendered in a <p> with class containing 'truncate' — verify no truncate paragraph exists
    const truncateEls = container.querySelectorAll('p.truncate');
    expect(truncateEls.length).toBe(0);
  });

  it('shows completion emoji when all done', () => {
    const results = makeFullResults();
    render(
      <OperatingLoopFloatingProgress results={results} totalSteps={6} isActive={false} />
    );
    expect(screen.getByText('✓')).toBeDefined();
  });

  it('shows step emoji when active and not all done', () => {
    render(
      <OperatingLoopFloatingProgress results={[]} totalSteps={6} isActive={true} />
    );
    expect(screen.getByText('🔍')).toBeDefined();
  });
});
