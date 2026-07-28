import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import {
  KeyboardShortcutsProvider,
  useKeyboardShortcutsContext,
  useKeyboardShortcuts,
  useKeyboardShortcutStatus,
} from './keyboard-shortcuts-context';
import { KEYBOARD_SHORTCUTS, getCustomShortcuts, saveCustomShortcuts, type ShortcutCustomization } from '@/styles/keyboard-shortcuts';

// ─── Helper to create keyboard events ──────────────

function createKeyEvent(
  overrides: Partial<KeyboardEvent> = {}
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ...overrides,
  });
  Object.defineProperty(event, 'preventDefault', { value: vi.fn() });
  Object.defineProperty(event, 'stopPropagation', { value: vi.fn() });
  return event;
}

// ─── Test Consumer Component ───────────────────────

function TestConsumer({
  onRegister,
  onContext,
}: {
  onRegister?: (ctx: ReturnType<typeof useKeyboardShortcutsContext>) => void;
  onContext?: (ctx: ReturnType<typeof useKeyboardShortcutsContext>) => void;
}) {
  const ctx = useKeyboardShortcutsContext();

  React.useEffect(() => {
    onContext?.(ctx);
  }, [ctx]);

  React.useEffect(() => {
    onRegister?.(ctx);
  }, []);

  return (
    <div>
      <span data-testid="globally-enabled">{ctx.isGloballyEnabled ? 'true' : 'false'}</span>
      <button data-testid="toggle-global" onClick={ctx.toggleGlobal}>Toggle</button>
      <button data-testid="disable-all" onClick={ctx.disableAll}>Disable</button>
      <button data-testid="enable-all" onClick={ctx.enableAll}>Enable</button>
    </div>
  );
}

// ─── Test Component Using useKeyboardShortcuts ──────

function ShortcutConsumer({
  id,
  shortcut,
  handler,
  enabled,
  priority,
}: {
  id: string;
  shortcut: typeof KEYBOARD_SHORTCUTS[0];
  handler: (event: KeyboardEvent) => void;
  enabled?: boolean;
  priority?: number;
}) {
  useKeyboardShortcuts({ id, shortcut, handler, enabled, priority });
  return <div data-testid={`consumer-${id}`}>Consumer {id}</div>;
}

// ─── Tests ─────────────────────────────────────────

describe('KeyboardShortcutsContext', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('useKeyboardShortcutsContext', () => {
    it('throws when used outside provider', () => {
      function BadConsumer() {
        useKeyboardShortcutsContext();
        return <div />;
      }

      expect(() => {
        render(<BadConsumer />);
      }).toThrow('useKeyboardShortcutsContext must be used within a KeyboardShortcutsProvider');
    });

    it('provides context when used inside provider', () => {
      let contextValue: ReturnType<typeof useKeyboardShortcutsContext> | null = null;

      render(
        <KeyboardShortcutsProvider>
          <TestConsumer onContext={(ctx) => { contextValue = ctx; }} />
        </KeyboardShortcutsProvider>
      );

      expect(contextValue).not.toBeNull();
      expect(contextValue!.isGloballyEnabled).toBe(true);
    });
  });

  describe('KeyboardShortcutsProvider', () => {
    it('renders children', () => {
      render(
        <KeyboardShortcutsProvider>
          <div data-testid="child">Hello</div>
        </KeyboardShortcutsProvider>
      );
      expect(screen.getByTestId('child')).toBeTruthy();
    });

    it('starts enabled by default', () => {
      render(
        <KeyboardShortcutsProvider>
          <TestConsumer />
        </KeyboardShortcutsProvider>
      );
      expect(screen.getByTestId('globally-enabled').textContent).toBe('true');
    });

    it('can start disabled', () => {
      render(
        <KeyboardShortcutsProvider enabled={false}>
          <TestConsumer />
        </KeyboardShortcutsProvider>
      );
      expect(screen.getByTestId('globally-enabled').textContent).toBe('false');
    });

    it('toggleGlobal toggles enabled state', () => {
      render(
        <KeyboardShortcutsProvider>
          <TestConsumer />
        </KeyboardShortcutsProvider>
      );

      expect(screen.getByTestId('globally-enabled').textContent).toBe('true');
      fireEvent.click(screen.getByTestId('toggle-global'));
      expect(screen.getByTestId('globally-enabled').textContent).toBe('false');
      fireEvent.click(screen.getByTestId('toggle-global'));
      expect(screen.getByTestId('globally-enabled').textContent).toBe('true');
    });

    it('disableAll disables all shortcuts', () => {
      render(
        <KeyboardShortcutsProvider>
          <TestConsumer />
        </KeyboardShortcutsProvider>
      );

      expect(screen.getByTestId('globally-enabled').textContent).toBe('true');
      fireEvent.click(screen.getByTestId('disable-all'));
      expect(screen.getByTestId('globally-enabled').textContent).toBe('false');
    });

    it('enableAll enables all shortcuts', () => {
      render(
        <KeyboardShortcutsProvider enabled={false}>
          <TestConsumer />
        </KeyboardShortcutsProvider>
      );

      expect(screen.getByTestId('globally-enabled').textContent).toBe('false');
      fireEvent.click(screen.getByTestId('enable-all'));
      expect(screen.getByTestId('globally-enabled').textContent).toBe('true');
    });
  });

  describe('register / unregister', () => {
    it('registers and calls handler on matching shortcut', () => {
      const handler = vi.fn();

      render(
        <KeyboardShortcutsProvider>
          <TestConsumer
            onRegister={(ctx) => {
              ctx.register({
                id: 'test-shortcut',
                shortcut: KEYBOARD_SHORTCUTS[4], // Escape
                handler,
              });
            }}
          />
        </KeyboardShortcutsProvider>
      );

      act(() => {
        fireEvent.keyDown(document, { key: 'Escape' });
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('returns cleanup function that unregisters', () => {
      const handler = vi.fn();
      let cleanup: () => void;

      render(
        <KeyboardShortcutsProvider>
          <TestConsumer
            onRegister={(ctx) => {
              cleanup = ctx.register({
                id: 'test-cleanup',
                shortcut: KEYBOARD_SHORTCUTS[4], // Escape
                handler,
              });
            }}
          />
        </KeyboardShortcutsProvider>
      );

      // Should work before cleanup
      act(() => {
        fireEvent.keyDown(document, { key: 'Escape' });
      });
      expect(handler).toHaveBeenCalledTimes(1);

      // Cleanup
      act(() => {
        cleanup!();
      });

      // Should not fire after cleanup
      act(() => {
        fireEvent.keyDown(document, { key: 'Escape' });
      });
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('unregister removes registration', () => {
      const handler = vi.fn();

      render(
        <KeyboardShortcutsProvider>
          <TestConsumer
            onRegister={(ctx) => {
              ctx.register({
                id: 'test-unregister',
                shortcut: KEYBOARD_SHORTCUTS[4], // Escape
                handler,
              });
              // Immediately unregister
              ctx.unregister('test-unregister');
            }}
          />
        </KeyboardShortcutsProvider>
      );

      act(() => {
        fireEvent.keyDown(document, { key: 'Escape' });
      });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('can enable/disable individual registrations', () => {
      const handler = vi.fn();

      render(
        <KeyboardShortcutsProvider>
          <TestConsumer
            onRegister={(ctx) => {
              ctx.register({
                id: 'test-update',
                shortcut: KEYBOARD_SHORTCUTS[4], // Escape
                handler,
                enabled: true,
              });

              // Disable it
              ctx.update('test-update', { enabled: false });
            }}
          />
        </KeyboardShortcutsProvider>
      );

      act(() => {
        fireEvent.keyDown(document, { key: 'Escape' });
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it('can update handler', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      render(
        <KeyboardShortcutsProvider>
          <TestConsumer
            onRegister={(ctx) => {
              ctx.register({
                id: 'test-update-handler',
                shortcut: KEYBOARD_SHORTCUTS[4], // Escape
                handler: handler1,
              });

              ctx.update('test-update-handler', { handler: handler2 });
            }}
          />
        </KeyboardShortcutsProvider>
      );

      act(() => {
        fireEvent.keyDown(document, { key: 'Escape' });
      });

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });

  describe('getRegistrations', () => {
    it('returns all current registrations', () => {
      let registrations: ReturnType<typeof useKeyboardShortcutsContext>['getRegistrations'];

      render(
        <KeyboardShortcutsProvider>
          <TestConsumer
            onRegister={(ctx) => {
              registrations = ctx.getRegistrations;
              ctx.register({
                id: 'test-get-1',
                shortcut: KEYBOARD_SHORTCUTS[4],
                handler: vi.fn(),
              });
              ctx.register({
                id: 'test-get-2',
                shortcut: KEYBOARD_SHORTCUTS[0],
                handler: vi.fn(),
              });
            }}
          />
        </KeyboardShortcutsProvider>
      );

      const regs = registrations!();
      expect(regs.length).toBe(2);
      expect(regs.map((r) => r.id)).toContain('test-get-1');
      expect(regs.map((r) => r.id)).toContain('test-get-2');
    });
  });

  describe('priority', () => {
    it('higher priority handlers are checked first', () => {
      const callOrder: string[] = [];

      render(
        <KeyboardShortcutsProvider>
          <TestConsumer
            onRegister={(ctx) => {
              ctx.register({
                id: 'low-priority',
                shortcut: KEYBOARD_SHORTCUTS[4], // Escape
                handler: () => callOrder.push('low'),
                priority: 0,
              });
              ctx.register({
                id: 'high-priority',
                shortcut: KEYBOARD_SHORTCUTS[4], // Escape
                handler: () => callOrder.push('high'),
                priority: 10,
              });
            }}
          />
        </KeyboardShortcutsProvider>
      );

      act(() => {
        fireEvent.keyDown(document, { key: 'Escape' });
      });

      expect(callOrder).toEqual(['high', 'low']);
    });
  });

  describe('condition', () => {
    it('skips handler when condition returns false', () => {
      const handler = vi.fn();

      render(
        <KeyboardShortcutsProvider>
          <TestConsumer
            onRegister={(ctx) => {
              ctx.register({
                id: 'conditional',
                shortcut: KEYBOARD_SHORTCUTS[4], // Escape
                handler,
                condition: () => false,
              });
            }}
          />
        </KeyboardShortcutsProvider>
      );

      act(() => {
        fireEvent.keyDown(document, { key: 'Escape' });
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it('calls handler when condition returns true', () => {
      const handler = vi.fn();

      render(
        <KeyboardShortcutsProvider>
          <TestConsumer
            onRegister={(ctx) => {
              ctx.register({
                id: 'conditional-true',
                shortcut: KEYBOARD_SHORTCUTS[4], // Escape
                handler,
                condition: () => true,
              });
            }}
          />
        </KeyboardShortcutsProvider>
      );

      act(() => {
        fireEvent.keyDown(document, { key: 'Escape' });
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('input suppression', () => {
    it('does not trigger shortcuts when typing in input', () => {
      const handler = vi.fn();

      render(
        <KeyboardShortcutsProvider>
          <TestConsumer
            onRegister={(ctx) => {
              ctx.register({
                id: 'input-test',
                shortcut: KEYBOARD_SHORTCUTS[4], // Escape
                handler,
              });
            }}
          />
          <input data-testid="test-input" />
        </KeyboardShortcutsProvider>
      );

      const input = screen.getByTestId('test-input');
      input.focus();

      act(() => {
        fireEvent.keyDown(input, { key: 'Escape' });
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it('does not trigger shortcuts when typing in textarea', () => {
      const handler = vi.fn();

      render(
        <KeyboardShortcutsProvider>
          <TestConsumer
            onRegister={(ctx) => {
              ctx.register({
                id: 'textarea-test',
                shortcut: KEYBOARD_SHORTCUTS[4], // Escape
                handler,
              });
            }}
          />
          <textarea data-testid="test-textarea" />
        </KeyboardShortcutsProvider>
      );

      const textarea = screen.getByTestId('test-textarea');
      textarea.focus();

      act(() => {
        fireEvent.keyDown(textarea, { key: 'Escape' });
      });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('disabled shortcuts not triggered', () => {
    it('does not call handler when globally disabled', () => {
      const handler = vi.fn();

      render(
        <KeyboardShortcutsProvider enabled={false}>
          <TestConsumer
            onRegister={(ctx) => {
              ctx.register({
                id: 'disabled-test',
                shortcut: KEYBOARD_SHORTCUTS[4], // Escape
                handler,
              });
            }}
          />
        </KeyboardShortcutsProvider>
      );

      act(() => {
        fireEvent.keyDown(document, { key: 'Escape' });
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it('does not call handler when individually disabled', () => {
      const handler = vi.fn();

      render(
        <KeyboardShortcutsProvider>
          <TestConsumer
            onRegister={(ctx) => {
              ctx.register({
                id: 'indiv-disabled',
                shortcut: KEYBOARD_SHORTCUTS[4], // Escape
                handler,
                enabled: false,
              });
            }}
          />
        </KeyboardShortcutsProvider>
      );

      act(() => {
        fireEvent.keyDown(document, { key: 'Escape' });
      });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('useKeyboardShortcuts hook', () => {
    it('registers shortcut on mount', () => {
      const handler = vi.fn();

      render(
        <KeyboardShortcutsProvider>
          <ShortcutConsumer
            id="hook-test"
            shortcut={KEYBOARD_SHORTCUTS[4]} // Escape
            handler={handler}
          />
        </KeyboardShortcutsProvider>
      );

      act(() => {
        fireEvent.keyDown(document, { key: 'Escape' });
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('unregisters on unmount', () => {
      const handler = vi.fn();

      const { unmount } = render(
        <KeyboardShortcutsProvider>
          <ShortcutConsumer
            id="hook-unmount"
            shortcut={KEYBOARD_SHORTCUTS[4]} // Escape
            handler={handler}
          />
        </KeyboardShortcutsProvider>
      );

      act(() => {
        fireEvent.keyDown(document, { key: 'Escape' });
      });
      expect(handler).toHaveBeenCalledTimes(1);

      unmount();

      act(() => {
        fireEvent.keyDown(document, { key: 'Escape' });
      });
      expect(handler).toHaveBeenCalledTimes(1); // Not called again
    });

    it('supports enabled prop', () => {
      const handler = vi.fn();

      const { rerender } = render(
        <KeyboardShortcutsProvider>
          <ShortcutConsumer
            id="hook-enabled"
            shortcut={KEYBOARD_SHORTCUTS[4]} // Escape
            handler={handler}
            enabled={false}
          />
        </KeyboardShortcutsProvider>
      );

      act(() => {
        fireEvent.keyDown(document, { key: 'Escape' });
      });
      expect(handler).not.toHaveBeenCalled();

      rerender(
        <KeyboardShortcutsProvider>
          <ShortcutConsumer
            id="hook-enabled"
            shortcut={KEYBOARD_SHORTCUTS[4]} // Escape
            handler={handler}
            enabled={true}
          />
        </KeyboardShortcutsProvider>
      );

      act(() => {
        fireEvent.keyDown(document, { key: 'Escape' });
      });
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('supports priority prop', () => {
      const callOrder: string[] = [];

      render(
        <KeyboardShortcutsProvider>
          <ShortcutConsumer
            id="hook-priority-low"
            shortcut={KEYBOARD_SHORTCUTS[4]}
            handler={() => callOrder.push('low')}
            priority={0}
          />
          <ShortcutConsumer
            id="hook-priority-high"
            shortcut={KEYBOARD_SHORTCUTS[4]}
            handler={() => callOrder.push('high')}
            priority={10}
          />
        </KeyboardShortcutsProvider>
      );

      act(() => {
        fireEvent.keyDown(document, { key: 'Escape' });
      });

      expect(callOrder).toEqual(['high', 'low']);
    });
  });

  describe('multiple shortcuts in sequence', () => {
    it('handles multiple shortcut presses', () => {
      const pdfHandler = vi.fn();
      const csvHandler = vi.fn();

      render(
        <KeyboardShortcutsProvider>
          <TestConsumer
            onRegister={(ctx) => {
              ctx.register({
                id: 'pdf',
                shortcut: KEYBOARD_SHORTCUTS[0], // Ctrl+P
                handler: pdfHandler,
              });
              ctx.register({
                id: 'csv',
                shortcut: KEYBOARD_SHORTCUTS[2], // Ctrl+S
                handler: csvHandler,
              });
            }}
          />
        </KeyboardShortcutsProvider>
      );

      act(() => {
        fireEvent.keyDown(document, { key: 'p', ctrlKey: true });
      });
      expect(pdfHandler).toHaveBeenCalledTimes(1);

      act(() => {
        fireEvent.keyDown(document, { key: 's', ctrlKey: true });
      });
      expect(csvHandler).toHaveBeenCalledTimes(1);
    });
  });
});
describe('analytics', () => {
  it('tracks usage count when shortcuts are triggered', () => {
    const handler = vi.fn();
    let getShortcutAnalytics: ReturnType<typeof useKeyboardShortcutsContext>['getShortcutAnalytics'];
    render(
      <KeyboardShortcutsProvider>
        <TestConsumer
          onRegister={(ctx) => {
            getShortcutAnalytics = ctx.getShortcutAnalytics;
            ctx.register({
              id: 'analytics-test',
              shortcut: KEYBOARD_SHORTCUTS[4], // Escape
              handler,
            });
          }}
        />
      </KeyboardShortcutsProvider>
    );

    // Initially no analytics
    expect(getShortcutAnalytics!('analytics-test')).toBeNull();

    // Trigger the shortcut
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });
    expect(handler).toHaveBeenCalledTimes(1);

    // Verify analytics were tracked
    const analytics = getShortcutAnalytics!('analytics-test');
    expect(analytics).not.toBeNull();
    expect(analytics!.usageCount).toBe(1);
    expect(analytics!.firstTriggeredAt).toBeGreaterThan(0);
    expect(analytics!.lastTriggeredAt).toBe(analytics!.firstTriggeredAt);
  });

  it('getShortcutAnalytics returns null for unregistered shortcuts', () => {
    let getShortcutAnalytics: ReturnType<typeof useKeyboardShortcutsContext>['getShortcutAnalytics'];
    render(
      <KeyboardShortcutsProvider>
        <TestConsumer
          onContext={(ctx) => { getShortcutAnalytics = ctx.getShortcutAnalytics; }}
        />
      </KeyboardShortcutsProvider>
    );
    expect(getShortcutAnalytics!('nonexistent')).toBeNull();
  });

  it('resetAnalytics clears all analytics', () => {
    let resetAnalytics: ReturnType<typeof useKeyboardShortcutsContext>['resetAnalytics'];
    let getAnalytics: ReturnType<typeof useKeyboardShortcutsContext>['getAnalytics'];
    render(
      <KeyboardShortcutsProvider>
        <TestConsumer
          onContext={(ctx) => { 
            resetAnalytics = ctx.resetAnalytics;
            getAnalytics = ctx.getAnalytics;
          }}
        />
      </KeyboardShortcutsProvider>
    );
    resetAnalytics!();
    expect(getAnalytics!()).toEqual([]);
  });
});

describe('getRegistration', () => {
  it('returns registration by id', () => {
    let getRegistration: ReturnType<typeof useKeyboardShortcutsContext>['getRegistration'];
    render(
      <KeyboardShortcutsProvider>
        <TestConsumer
          onRegister={(ctx) => {
            getRegistration = ctx.getRegistration;
            ctx.register({
              id: 'test-get',
              shortcut: KEYBOARD_SHORTCUTS[4],
              handler: vi.fn(),
            });
          }}
        />
      </KeyboardShortcutsProvider>
    );
    expect(getRegistration!('test-get')).toBeTruthy();
    expect(getRegistration!('test-get')!.id).toBe('test-get');
  });

  it('returns null for nonexistent id', () => {
    let getRegistration: ReturnType<typeof useKeyboardShortcutsContext>['getRegistration'];
    render(
      <KeyboardShortcutsProvider>
        <TestConsumer
          onContext={(ctx) => { getRegistration = ctx.getRegistration; }}
        />
      </KeyboardShortcutsProvider>
    );
    expect(getRegistration!('nonexistent')).toBeNull();
  });
});


describe('useKeyboardShortcutStatus', () => {
  function StatusConsumer({ shortcutId }: { shortcutId: string }) {
    const status = useKeyboardShortcutStatus(shortcutId);
    return (
      <div>
        <span data-testid="isRegistered">{String(status.isRegistered)}</span>
        <span data-testid="isEnabled">{String(status.isEnabled)}</span>
        <span data-testid="hasRegistration">{String(status.registration !== null)}</span>
        <span data-testid="hasAnalytics">{String(status.analytics !== null)}</span>
      </div>
    );
  }

  it('returns correct state for unregistered shortcut', () => {
    render(
      <KeyboardShortcutsProvider>
        <StatusConsumer shortcutId="nonexistent" />
      </KeyboardShortcutsProvider>
    );

    expect(screen.getByTestId('isRegistered').textContent).toBe('false');
    expect(screen.getByTestId('isEnabled').textContent).toBe('false');
    expect(screen.getByTestId('hasRegistration').textContent).toBe('false');
    expect(screen.getByTestId('hasAnalytics').textContent).toBe('false');
  });

  it('returns correct state for registered and enabled shortcut', () => {
    render(
      <KeyboardShortcutsProvider>
        <TestConsumer
          onRegister={(ctx) => {
            ctx.register({
              id: 'status-test-enabled',
              shortcut: KEYBOARD_SHORTCUTS[4],
              handler: vi.fn(),
              enabled: true,
            });
          }}
        />
        <StatusConsumer shortcutId="status-test-enabled" />
      </KeyboardShortcutsProvider>
    );

    // Wait for onRegister useEffect to fire
    act(() => {});

    expect(screen.getByTestId('isRegistered').textContent).toBe('true');
    expect(screen.getByTestId('isEnabled').textContent).toBe('true');
    expect(screen.getByTestId('hasRegistration').textContent).toBe('true');
  });

  it('returns correct state for registered but disabled shortcut', () => {
    render(
      <KeyboardShortcutsProvider>
        <TestConsumer
          onRegister={(ctx) => {
            ctx.register({
              id: 'status-test-disabled',
              shortcut: KEYBOARD_SHORTCUTS[4],
              handler: vi.fn(),
              enabled: false,
            });
          }}
        />
        <StatusConsumer shortcutId="status-test-disabled" />
      </KeyboardShortcutsProvider>
    );

    // Wait for onRegister useEffect to fire
    act(() => {});

    expect(screen.getByTestId('isRegistered').textContent).toBe('true');
    expect(screen.getByTestId('isEnabled').textContent).toBe('false');
    expect(screen.getByTestId('hasRegistration').textContent).toBe('true');
  });

  it('returns analytics after shortcut is triggered', () => {
    render(
      <KeyboardShortcutsProvider>
        <TestConsumer
          onRegister={(ctx) => {
            ctx.register({
              id: 'status-test-analytics',
              shortcut: KEYBOARD_SHORTCUTS[4],
              handler: vi.fn(),
            });
          }}
        />
        <StatusConsumer shortcutId="status-test-analytics" />
      </KeyboardShortcutsProvider>
    );

    // Wait for onRegister useEffect to fire and registration to complete
    act(() => {});

    // Initially no analytics
    expect(screen.getByTestId('hasAnalytics').textContent).toBe('false');

    // Trigger the shortcut
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });

    // Now should have analytics
    expect(screen.getByTestId('hasAnalytics').textContent).toBe('true');
  });

  it('updates status when shortcut is unregistered', () => {
    let cleanup: () => void;
    render(
      <KeyboardShortcutsProvider>
        <TestConsumer
          onRegister={(ctx) => {
            cleanup = ctx.register({
              id: 'status-test-unregister',
              shortcut: KEYBOARD_SHORTCUTS[4],
              handler: vi.fn(),
            });
          }}
        />
        <StatusConsumer shortcutId="status-test-unregister" />
      </KeyboardShortcutsProvider>
    );

    // Wait for onRegister useEffect to fire
    act(() => {});

    expect(screen.getByTestId('isRegistered').textContent).toBe('true');

    // Unregister the shortcut
    act(() => {
      cleanup!();
    });

    expect(screen.getByTestId('isRegistered').textContent).toBe('false');
  });
});

describe('analytics multi-trigger', () => {
  it('increments usageCount across multiple triggers', () => {
    const handler = vi.fn();
    let getShortcutAnalytics: ReturnType<typeof useKeyboardShortcutsContext>['getShortcutAnalytics'];
    render(
      <KeyboardShortcutsProvider>
        <TestConsumer
          onRegister={(ctx) => {
            getShortcutAnalytics = ctx.getShortcutAnalytics;
            ctx.register({
              id: 'multi-trigger-test',
              shortcut: KEYBOARD_SHORTCUTS[4], // Escape
              handler,
            });
          }}
        />
      </KeyboardShortcutsProvider>
    );

    // Trigger 3 times
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });

    expect(handler).toHaveBeenCalledTimes(3);

    const analytics = getShortcutAnalytics!('multi-trigger-test');
    expect(analytics).not.toBeNull();
    expect(analytics!.usageCount).toBe(3);
    expect(analytics!.firstTriggeredAt).toBeGreaterThan(0);
    expect(analytics!.lastTriggeredAt).toBeGreaterThanOrEqual(analytics!.firstTriggeredAt!);
  });

  it('getAnalytics returns data for multiple shortcuts', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    let getAnalytics: ReturnType<typeof useKeyboardShortcutsContext>['getAnalytics'];
    render(
      <KeyboardShortcutsProvider>
        <TestConsumer
          onRegister={(ctx) => {
            getAnalytics = ctx.getAnalytics;
            ctx.register({
              id: 'multi-shortcut-1',
              shortcut: KEYBOARD_SHORTCUTS[4], // Escape
              handler: handler1,
            });
            ctx.register({
              id: 'multi-shortcut-2',
              shortcut: KEYBOARD_SHORTCUTS[0], // Ctrl+P
              handler: handler2,
            });
          }}
        />
      </KeyboardShortcutsProvider>
    );

    // Trigger Escape
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });

    // Trigger Ctrl+P
    act(() => {
      fireEvent.keyDown(document, { key: 'p', ctrlKey: true });
    });

    const allAnalytics = getAnalytics!();
    expect(allAnalytics.length).toBe(2);
    expect(allAnalytics.find(a => a.id === 'multi-shortcut-1')?.usageCount).toBe(1);
    expect(allAnalytics.find(a => a.id === 'multi-shortcut-2')?.usageCount).toBe(1);
  });
});

describe('customization', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.removeItem('oracle-custom-shortcuts');
  });

  it('starts with empty customizations', () => {
    let getCustomizations: ReturnType<typeof useKeyboardShortcutsContext>['getCustomizations'];
    render(
      <KeyboardShortcutsProvider>
        <TestConsumer
          onContext={(ctx) => { getCustomizations = ctx.getCustomizations; }}
        />
      </KeyboardShortcutsProvider>
    );
    expect(getCustomizations!()).toEqual([]);
  });

  it('setCustomization adds a new customization', () => {
    let getCustomizations: ReturnType<typeof useKeyboardShortcutsContext>['getCustomizations'];
    let setCustomization: ReturnType<typeof useKeyboardShortcutsContext>['setCustomization'];
    render(
      <KeyboardShortcutsProvider>
        <TestConsumer
          onContext={(ctx) => {
            getCustomizations = ctx.getCustomizations;
            setCustomization = ctx.setCustomization;
          }}
        />
      </KeyboardShortcutsProvider>
    );

    const custom: ShortcutCustomization = {
      shortcutId: 'escape-close',
      customKeys: ['F1'],
    };

    act(() => {
      setCustomization!(custom);
    });

    expect(getCustomizations!()).toEqual([custom]);
  });

  it('setCustomization updates existing customization', () => {
    let getCustomizations: ReturnType<typeof useKeyboardShortcutsContext>['getCustomizations'];
    let setCustomization: ReturnType<typeof useKeyboardShortcutsContext>['setCustomization'];
    render(
      <KeyboardShortcutsProvider>
        <TestConsumer
          onContext={(ctx) => {
            getCustomizations = ctx.getCustomizations;
            setCustomization = ctx.setCustomization;
          }}
        />
      </KeyboardShortcutsProvider>
    );

    // First customization
    act(() => {
      setCustomization!({ shortcutId: 'escape-close', customKeys: ['F1'] });
    });

    // Update it
    act(() => {
      setCustomization!({ shortcutId: 'escape-close', customKeys: ['F2'] });
    });

    const customizations = getCustomizations!();
    expect(customizations.length).toBe(1);
    expect(customizations[0].customKeys).toEqual(['F2']);
  });

  it('removeCustomization removes a customization', () => {
    let getCustomizations: ReturnType<typeof useKeyboardShortcutsContext>['getCustomizations'];
    let setCustomization: ReturnType<typeof useKeyboardShortcutsContext>['setCustomization'];
    let removeCustomization: ReturnType<typeof useKeyboardShortcutsContext>['removeCustomization'];
    render(
      <KeyboardShortcutsProvider>
        <TestConsumer
          onContext={(ctx) => {
            getCustomizations = ctx.getCustomizations;
            setCustomization = ctx.setCustomization;
            removeCustomization = ctx.removeCustomization;
          }}
        />
      </KeyboardShortcutsProvider>
    );

    // Add customization
    act(() => {
      setCustomization!({ shortcutId: 'escape-close', customKeys: ['F1'] });
    });

    expect(getCustomizations!().length).toBe(1);

    // Remove it
    act(() => {
      removeCustomization!('escape-close');
    });

    expect(getCustomizations!()).toEqual([]);
  });

  it('resetToDefaults clears all customizations', () => {
    let getCustomizations: ReturnType<typeof useKeyboardShortcutsContext>['getCustomizations'];
    let setCustomization: ReturnType<typeof useKeyboardShortcutsContext>['setCustomization'];
    let resetToDefaults: ReturnType<typeof useKeyboardShortcutsContext>['resetToDefaults'];
    render(
      <KeyboardShortcutsProvider>
        <TestConsumer
          onContext={(ctx) => {
            getCustomizations = ctx.getCustomizations;
            setCustomization = ctx.setCustomization;
            resetToDefaults = ctx.resetToDefaults;
          }}
        />
      </KeyboardShortcutsProvider>
    );

    // Add multiple customizations
    act(() => {
      setCustomization!({ shortcutId: 'escape-close', customKeys: ['F1'] });
    });
    act(() => {
      setCustomization!({ shortcutId: 'pdf-preview', customKeys: ['Ctrl+Shift+P'] });
    });

    expect(getCustomizations!().length).toBe(2);

    // Reset to defaults
    act(() => {
      resetToDefaults!();
    });

    expect(getCustomizations!()).toEqual([]);
  });

  it('getEffectiveKeys returns default keys when no customization', () => {
    let getEffectiveKeys: ReturnType<typeof useKeyboardShortcutsContext>['getEffectiveKeys'];
    render(
      <KeyboardShortcutsProvider>
        <TestConsumer
          onContext={(ctx) => { getEffectiveKeys = ctx.getEffectiveKeys; }}
        />
      </KeyboardShortcutsProvider>
    );

    const keys = getEffectiveKeys!('escape-close');
    expect(keys.keys).toEqual(['Escape']);
    expect(keys.requiresModifier).toBeUndefined();
    expect(keys.requiresShift).toBeUndefined();
  });

  it('getEffectiveKeys returns custom keys when customization exists', () => {
    let getEffectiveKeys: ReturnType<typeof useKeyboardShortcutsContext>['getEffectiveKeys'];
    let setCustomization: ReturnType<typeof useKeyboardShortcutsContext>['setCustomization'];
    render(
      <KeyboardShortcutsProvider>
        <TestConsumer
          onContext={(ctx) => {
            getEffectiveKeys = ctx.getEffectiveKeys;
            setCustomization = ctx.setCustomization;
          }}
        />
      </KeyboardShortcutsProvider>
    );

    act(() => {
      setCustomization!({ shortcutId: 'escape-close', customKeys: ['F1'] });
    });

    const keys = getEffectiveKeys!('escape-close');
    expect(keys.keys).toEqual(['F1']);
  });

  it('getEffectiveKeys returns empty keys for nonexistent shortcut', () => {
    let getEffectiveKeys: ReturnType<typeof useKeyboardShortcutsContext>['getEffectiveKeys'];
    render(
      <KeyboardShortcutsProvider>
        <TestConsumer
          onContext={(ctx) => { getEffectiveKeys = ctx.getEffectiveKeys; }}
        />
      </KeyboardShortcutsProvider>
    );

    const keys = getEffectiveKeys!('nonexistent');
    expect(keys.keys).toEqual([]);
  });

  it('persists customizations to localStorage', () => {
    let setCustomization: ReturnType<typeof useKeyboardShortcutsContext>['setCustomization'];
    render(
      <KeyboardShortcutsProvider>
        <TestConsumer
          onContext={(ctx) => {
            setCustomization = ctx.setCustomization;
          }}
        />
      </KeyboardShortcutsProvider>
    );

    act(() => {
      setCustomization!({ shortcutId: 'escape-close', customKeys: ['F1'] });
    });

    // Check localStorage directly
    const stored = JSON.parse(localStorage.getItem('oracle-custom-shortcuts') || '[]');
    expect(stored.length).toBe(1);
    expect(stored[0].shortcutId).toBe('escape-close');
    expect(stored[0].customKeys).toEqual(['F1']);
  });

  it('loads customizations from localStorage on mount', () => {
    // Pre-populate localStorage
    const existing: ShortcutCustomization[] = [
      { shortcutId: 'escape-close', customKeys: ['F2'] },
    ];
    localStorage.setItem('oracle-custom-shortcuts', JSON.stringify(existing));

    let getCustomizations: ReturnType<typeof useKeyboardShortcutsContext>['getCustomizations'];
    render(
      <KeyboardShortcutsProvider>
        <TestConsumer
          onContext={(ctx) => { getCustomizations = ctx.getCustomizations; }}
        />
      </KeyboardShortcutsProvider>
    );

    const customizations = getCustomizations!();
    expect(customizations.length).toBe(1);
    expect(customizations[0].customKeys).toEqual(['F2']);
  });

  it('removes localStorage when resetToDefaults is called', () => {
    let setCustomization: ReturnType<typeof useKeyboardShortcutsContext>['setCustomization'];
    let resetToDefaults: ReturnType<typeof useKeyboardShortcutsContext>['resetToDefaults'];
    render(
      <KeyboardShortcutsProvider>
        <TestConsumer
          onContext={(ctx) => {
            setCustomization = ctx.setCustomization;
            resetToDefaults = ctx.resetToDefaults;
          }}
        />
      </KeyboardShortcutsProvider>
    );

    // Add customization
    act(() => {
      setCustomization!({ shortcutId: 'escape-close', customKeys: ['F1'] });
    });

    expect(localStorage.getItem('oracle-custom-shortcuts')).toBeTruthy();

    // Reset
    act(() => {
      resetToDefaults!();
    });

    const stored = JSON.parse(localStorage.getItem('oracle-custom-shortcuts') || '[]');
    expect(stored).toEqual([]);
  });
});
