import { describe, it, expect } from 'vitest';
import { matchesShortcut, KEYBOARD_SHORTCUTS } from './keyboard-shortcuts';
import type { KeyboardShortcut } from './keyboard-shortcuts';

// Helper to create a mock KeyboardEvent
function createKeyEvent(overrides: Partial<KeyboardEvent>): KeyboardEvent {
  return {
    key: '',
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    preventDefault: () => {},
    stopPropagation: () => {},
    ...overrides,
  } as KeyboardEvent;
}

describe('matchesShortcut', () => {
  describe('Ctrl+P (PDF preview)', () => {
    const shortcut = KEYBOARD_SHORTCUTS[0]; // Ctrl+P

    it('matches Ctrl+P', () => {
      expect(matchesShortcut(createKeyEvent({ key: 'p', ctrlKey: true }), shortcut)).toBe(true);
    });

    it('matches Cmd+P on macOS', () => {
      expect(matchesShortcut(createKeyEvent({ key: 'p', metaKey: true }), shortcut)).toBe(true);
    });

    it('does not match P without modifier', () => {
      expect(matchesShortcut(createKeyEvent({ key: 'p' }), shortcut)).toBe(false);
    });

    it('does not match Ctrl+Shift+P', () => {
      expect(matchesShortcut(createKeyEvent({ key: 'p', ctrlKey: true, shiftKey: true }), shortcut)).toBe(false);
    });

    it('does not match Ctrl+S', () => {
      expect(matchesShortcut(createKeyEvent({ key: 's', ctrlKey: true }), shortcut)).toBe(false);
    });
  });

  describe('Ctrl+Shift+W (Word export)', () => {
    const shortcut = KEYBOARD_SHORTCUTS[1]; // Ctrl+Shift+W

    it('matches Ctrl+Shift+W', () => {
      expect(matchesShortcut(createKeyEvent({ key: 'w', ctrlKey: true, shiftKey: true }), shortcut)).toBe(true);
    });

    it('matches Ctrl+Shift+w (lowercase)', () => {
      expect(matchesShortcut(createKeyEvent({ key: 'w', ctrlKey: true, shiftKey: true }), shortcut)).toBe(true);
    });

    it('matches Cmd+Shift+W on macOS', () => {
      expect(matchesShortcut(createKeyEvent({ key: 'w', metaKey: true, shiftKey: true }), shortcut)).toBe(true);
    });

    it('does not match Ctrl+W without shift', () => {
      expect(matchesShortcut(createKeyEvent({ key: 'w', ctrlKey: true }), shortcut)).toBe(false);
    });

    it('does not match Shift+W without Ctrl', () => {
      expect(matchesShortcut(createKeyEvent({ key: 'w', shiftKey: true }), shortcut)).toBe(false);
    });
  });

  describe('Ctrl+S (CSV export)', () => {
    const shortcut = KEYBOARD_SHORTCUTS[2]; // Ctrl+S

    it('matches Ctrl+S', () => {
      expect(matchesShortcut(createKeyEvent({ key: 's', ctrlKey: true }), shortcut)).toBe(true);
    });

    it('matches Cmd+S on macOS', () => {
      expect(matchesShortcut(createKeyEvent({ key: 's', metaKey: true }), shortcut)).toBe(true);
    });

    it('does not match S without modifier', () => {
      expect(matchesShortcut(createKeyEvent({ key: 's' }), shortcut)).toBe(false);
    });

    it('does not match Ctrl+Shift+S', () => {
      expect(matchesShortcut(createKeyEvent({ key: 's', ctrlKey: true, shiftKey: true }), shortcut)).toBe(false);
    });
  });

  describe('? (shortcuts help)', () => {
    const shortcut = KEYBOARD_SHORTCUTS[3]; // ? with alternate /

    it('matches ? key with shift', () => {
      expect(matchesShortcut(createKeyEvent({ key: '?', shiftKey: true }), shortcut)).toBe(true);
    });

    it('matches / key with shift', () => {
      expect(matchesShortcut(createKeyEvent({ key: '/', shiftKey: true }), shortcut)).toBe(true);
    });

    it('does not match ? without shift', () => {
      expect(matchesShortcut(createKeyEvent({ key: '?' }), shortcut)).toBe(false);
    });

    it('does not match / without shift', () => {
      expect(matchesShortcut(createKeyEvent({ key: '/' }), shortcut)).toBe(false);
    });

    it('does not match Ctrl+?', () => {
      expect(matchesShortcut(createKeyEvent({ key: '?', ctrlKey: true, shiftKey: true }), shortcut)).toBe(false);
    });
  });

  describe('Esc (close)', () => {
    const shortcut = KEYBOARD_SHORTCUTS[4]; // Esc

    it('matches Escape key', () => {
      expect(matchesShortcut(createKeyEvent({ key: 'Escape' }), shortcut)).toBe(true);
    });

    it('does not match Escape with Ctrl', () => {
      expect(matchesShortcut(createKeyEvent({ key: 'Escape', ctrlKey: true }), shortcut)).toBe(false);
    });

    it('does not match Enter', () => {
      expect(matchesShortcut(createKeyEvent({ key: 'Enter' }), shortcut)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('handles undefined requiresModifier', () => {
      const shortcut: KeyboardShortcut = {
        id: 'test-enter',
        keys: ['Enter'],
        description: 'Submit',
      };
      expect(matchesShortcut(createKeyEvent({ key: 'Enter' }), shortcut)).toBe(true);
    });

    it('handles undefined requiresShift', () => {
      const shortcut: KeyboardShortcut = {
        id: 'test-a',
        keys: ['a'],
        description: 'Action A',
        requiresModifier: true,
      };
      expect(matchesShortcut(createKeyEvent({ key: 'a', ctrlKey: true }), shortcut)).toBe(true);
    });

    it('is case-insensitive for single letter keys', () => {
      const shortcut: KeyboardShortcut = {
        id: 'test-ctrl-a',
        keys: ['Ctrl', 'A'],
        description: 'Select all',
        requiresModifier: true,
      };
      expect(matchesShortcut(createKeyEvent({ key: 'a', ctrlKey: true }), shortcut)).toBe(true);
      expect(matchesShortcut(createKeyEvent({ key: 'A', ctrlKey: true }), shortcut)).toBe(true);
    });
  });
});

describe('KEYBOARD_SHORTCUTS', () => {
  it('contains all expected shortcuts', () => {
    expect(KEYBOARD_SHORTCUTS).toHaveLength(5);
  });

  it('has descriptions for all shortcuts', () => {
    for (const shortcut of KEYBOARD_SHORTCUTS) {
      expect(shortcut.description).toBeTruthy();
      expect(typeof shortcut.description).toBe('string');
    }
  });

  it('has keys array for all shortcuts', () => {
    for (const shortcut of KEYBOARD_SHORTCUTS) {
      expect(shortcut.keys).toBeDefined();
      expect(Array.isArray(shortcut.keys)).toBe(true);
      expect(shortcut.keys.length).toBeGreaterThan(0);
    }
  });
});
