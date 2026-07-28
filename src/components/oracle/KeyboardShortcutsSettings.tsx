'use client';

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { XIcon } from 'lucide-react';
import { KEYBOARD_SHORTCUTS, detectShortcutConflicts, findConflictForKeys, type KeyboardShortcut, type ShortcutConflict } from '@/styles/keyboard-shortcuts';
import { useKeyboardShortcutsContext } from '@/hooks/keyboard-shortcuts-context';

// ═══════════════════════════════════════
// ORACLE — Keyboard Shortcuts Settings
// Modal for customizing keyboard shortcuts
// ═══════════════════════════════════════

interface KeyboardShortcutsSettingsProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when the dialog is closed */
  onOpenChange: (open: boolean) => void;
}

/**
 * KeyboardShortcutsSettings provides a UI for customizing keyboard shortcuts.
 * Features: search, conflict detection, key recording, and reset-to-defaults.
 */
export function KeyboardShortcutsSettings({
  open,
  onOpenChange,
}: KeyboardShortcutsSettingsProps) {
  const {
    getEffectiveKeys,
    setCustomization,
    removeCustomization,
    getCustomizations,
    resetToDefaults,
    exportCustomizations,
    importCustomizations,
  } = useKeyboardShortcutsContext();

  const [searchQuery, setSearchQuery] = useState('');
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [recordedKeys, setRecordedKeys] = useState<string[]>([]);
  const [conflicts, setConflicts] = useState<ShortcutConflict[]>([]);
  const [recordingConflict, setRecordingConflict] = useState<string | null>(null);

  // Get all customizations
  const customizations = useMemo(() => getCustomizations(), [getCustomizations]);

  // Set of customized shortcut IDs for O(1) lookup
  const customizedIds = useMemo(
    () => new Set(customizations.map((c) => c.shortcutId)),
    [customizations]
  );

  // Filter shortcuts based on search query
  const filteredShortcuts = useMemo(() => {
    if (!searchQuery.trim()) return KEYBOARD_SHORTCUTS;
    const query = searchQuery.toLowerCase();
    return KEYBOARD_SHORTCUTS.filter(
      (s) =>
        s.description.toLowerCase().includes(query) ||
        s.id.toLowerCase().includes(query) ||
        s.keys.some((k) => k.toLowerCase().includes(query))
    );
  }, [searchQuery]);

  // Recalculate conflicts when customizations change
  useEffect(() => {
    setConflicts(detectShortcutConflicts(getEffectiveKeys));
  }, [customizations, getEffectiveKeys]);

  // Check for conflicts while recording keys
  useEffect(() => {
    if (recordingId && recordedKeys.length > 0) {
      const conflictId = findConflictForKeys(recordingId, recordedKeys, getEffectiveKeys);
      setRecordingConflict(conflictId);
    } else {
      setRecordingConflict(null);
    }
  }, [recordingId, recordedKeys, getEffectiveKeys]);

  // Start recording a new key combination
  const startRecording = useCallback((id: string) => {
    setRecordingId(id);
    setRecordedKeys([]);
  }, []);

  // Cancel recording
  const cancelRecording = useCallback(() => {
    setRecordingId(null);
    setRecordedKeys([]);
  }, []);

  // Check if saving a shortcut would create a conflict
  const wouldConflict = useCallback(
    (shortcutId: string, keys: string[]): boolean => {
      return findConflictForKeys(shortcutId, keys, getEffectiveKeys) !== null;
    },
    [getEffectiveKeys]
  );

  // Save the recorded key combination
  const saveRecording = useCallback(() => {
    if (!recordingId || recordedKeys.length === 0) return;

    // Check if this key combo conflicts with another shortcut
    if (wouldConflict(recordingId, recordedKeys)) {
      const conflictingShortcut = KEYBOARD_SHORTCUTS.find(
        (s) => s.id !== recordingId && getEffectiveKeys(s.id).keys.join('+') === recordedKeys.join('+')
      );
      if (
        !window.confirm(
          `This shortcut conflicts with "${conflictingShortcut?.description || recordingId}". Save anyway?`
        )
      ) {
        return;
      }
    }

    // Determine if modifier is required
    const requiresModifier = recordedKeys.includes('Ctrl');
    const requiresShift = recordedKeys.includes('Shift');

    setCustomization({
      shortcutId: recordingId,
      customKeys: recordedKeys,
      requiresModifier,
      requiresShift,
    });

    setRecordingId(null);
    setRecordedKeys([]);
  }, [recordingId, recordedKeys, setCustomization, getEffectiveKeys, wouldConflict]);

  // Remove customization for a shortcut
  const handleRemoveCustomization = useCallback(
    (shortcutId: string) => {
      removeCustomization(shortcutId);
    },
    [removeCustomization]
  );

  // Reset all shortcuts to defaults
  const handleResetAll = useCallback(() => {
    resetToDefaults();
    setImportErrors([]);
  }, [resetToDefaults]);

  // Handle keydown during recording
  useEffect(() => {
    if (!recordingId) return;

    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Escape cancels recording
      if (e.key === 'Escape') {
        cancelRecording();
        return;
      }

      // Build key list
      const keys: string[] = [];
      if (e.ctrlKey || e.metaKey) keys.push('Ctrl');
      if (e.shiftKey) keys.push('Shift');
      if (e.altKey) keys.push('Alt');

      // Add the main key (skip modifier-only presses)
      const key = e.key;
      if (!['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
        keys.push(key.length === 1 ? key.toUpperCase() : key);
      }

      if (keys.length > 0) {
        setRecordedKeys(keys);
      }
    };

    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [recordingId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup recording state on unmount
  useEffect(() => {
    return () => {
      setRecordingId(null);
      setRecordedKeys([]);
    };
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  // Export customizations as file download
  const handleExport = useCallback(() => {
    const json = exportCustomizations();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'oracle-shortcut-customizations.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [exportCustomizations]);

  // Import customizations from file
  const handleImportClick = useCallback(() => {
    setImportErrors([]);
    fileInputRef.current?.click();
  }, []);

  const handleFileImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        const errors = importCustomizations(text);
        setImportErrors(errors);
      }
    };
    reader.readAsText(file);
    // Reset input so the same file can be re-imported
    e.target.value = '';
  }, [importCustomizations]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>⌨️</span>
            <span>Keyboard Shortcuts</span>
          </DialogTitle>
          <DialogDescription>
            Customize keyboard shortcuts to match your workflow.
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Input
            type="search"
            placeholder="Search shortcuts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
            aria-label="Search keyboard shortcuts"
          />
        </div>

        {/* Shortcuts List */}
        <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
          {filteredShortcuts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No shortcuts found matching &quot;{searchQuery}&quot;
            </div>
          ) : (
            filteredShortcuts.map((shortcut) => (
              <ShortcutSettingRow
                key={shortcut.id}
                shortcut={shortcut}
                effectiveKeys={getEffectiveKeys(shortcut.id)}
                isCustomized={customizedIds.has(shortcut.id)}
                isRecording={recordingId === shortcut.id}
                recordedKeys={recordedKeys}
                recordingConflict={recordingId === shortcut.id ? recordingConflict : null}
                hasConflict={conflicts.some(c => c.shortcutId === shortcut.id)}
                conflictIds={conflicts.find(c => c.shortcutId === shortcut.id)?.conflictingIds || []}
                onStartRecording={() => startRecording(shortcut.id)}
                onCancelRecording={cancelRecording}
                onSaveRecording={saveRecording}
                onRemoveCustomization={() => handleRemoveCustomization(shortcut.id)}
                allShortcuts={KEYBOARD_SHORTCUTS}
              />
            ))
          )}
        </div>

        {/* Import Errors */}
        {importErrors.length > 0 && (
          <div className="text-xs text-destructive bg-destructive/5 rounded-lg p-2 space-y-0.5" role="alert">
            <div className="font-medium">Import warnings:</div>
            {importErrors.map((err, i) => (
              <div key={i}>• {err}</div>
            ))}
          </div>
        )}

        {/* Hidden file input for import */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleFileImport}
          aria-label="Import shortcut customizations file"
        />

        {/* Footer */}
        <DialogFooter className="flex-row justify-between sm:justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="text-muted-foreground"
            >
              📤 Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleImportClick}
              className="text-muted-foreground"
            >
              📥 Import
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetAll}
              className="text-muted-foreground hover:text-destructive"
            >
              ↺ Reset All
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Shortcut Setting Row ──────────────

interface ShortcutSettingRowProps {
  shortcut: KeyboardShortcut;
  effectiveKeys: { keys: string[]; alternateKeys?: string[]; requiresModifier?: boolean; requiresShift?: boolean };
  isCustomized: boolean;
  isRecording: boolean;
  recordedKeys: string[];
  recordingConflict: string | null;
  hasConflict: boolean;
  conflictIds: string[];
  onStartRecording: () => void;
  onCancelRecording: () => void;
  onSaveRecording: () => void;
  onRemoveCustomization: () => void;
  allShortcuts: KeyboardShortcut[];
}

function ShortcutSettingRow({
  shortcut,
  effectiveKeys,
  isCustomized,
  isRecording,
  recordedKeys,
  recordingConflict,
  hasConflict,
  conflictIds,
  onStartRecording,
  onCancelRecording,
  onSaveRecording,
  onRemoveCustomization,
  allShortcuts,
}: ShortcutSettingRowProps) {
  const conflictNames = conflictIds
    .map((id) => allShortcuts.find((s) => s.id === id)?.description || id)
    .join(', ');

  return (
    <div
      className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
        hasConflict
          ? 'border-destructive/50 bg-destructive/5'
          : isCustomized
          ? 'border-primary/30 bg-primary/5'
          : 'border-border hover:bg-muted/50'
      }`}
    >
      {/* Description */}
      <div className="flex-1 min-w-0 mr-4">
        <div className="text-sm font-medium text-foreground truncate">
          {shortcut.description}
        </div>
        {hasConflict && !isRecording && (
          <div className="text-xs text-destructive mt-0.5" aria-live="polite">
            ⚠ Conflict with: {conflictNames}
          </div>
        )}
        {isCustomized && !hasConflict && !isRecording && (
          <div className="text-xs text-primary mt-0.5">Customized</div>
        )}
      </div>

      {/* Key Display / Recording */}
      <div className="flex items-center gap-2">
        {isRecording ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              {recordedKeys.length > 0 ? (
                recordedKeys.map((key, i) => (
                  <React.Fragment key={`${key}-${i}`}>
                    {i > 0 && (
                      <span className="text-[10px] text-muted-foreground">+</span>
                    )}
                    <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 rounded border border-primary bg-primary/10 px-1.5 text-[10px] font-mono text-primary animate-pulse">
                      {key}
                    </kbd>
                  </React.Fragment>
                ))
              ) : (
                <span className="text-xs text-muted-foreground italic">
                  Press keys...
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onCancelRecording}
              className="h-6 w-6 text-muted-foreground"
              aria-label="Cancel recording"
            >
              <XIcon className="h-3 w-3" />
            </Button>
            {recordingConflict && (
              <span className="text-[10px] text-destructive" aria-live="polite">
                ⚠ conflicts with {allShortcuts.find(s => s.id === recordingConflict)?.description}
              </span>
            )}
            <Button
              variant={recordingConflict ? 'destructive' : 'default'}
              size="sm"
              onClick={onSaveRecording}
              disabled={recordedKeys.length === 0}
              className="h-6 text-[10px] px-2"
            >
              {recordingConflict ? 'Save Anyway' : 'Save'}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            {/* Current keys */}
            {effectiveKeys.keys.map((key, i) => (
              <React.Fragment key={`${key}-${i}`}>
                {i > 0 && (
                  <span className="text-[10px] text-muted-foreground">+</span>
                )}
                <kbd
                  className={`inline-flex items-center justify-center min-w-[24px] h-6 rounded border px-1.5 text-[10px] font-mono ${
                    isCustomized
                      ? 'border-primary/50 bg-primary/10 text-primary'
                      : 'border-border bg-muted text-foreground'
                  }`}
                >
                  {key}
                </kbd>
              </React.Fragment>
            ))}

            {/* Edit / Reset buttons */}
            <div className="flex items-center gap-1 ml-2">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onStartRecording}
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                aria-label="Change shortcut"
              >
                ✏️
              </Button>
              {isCustomized && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={onRemoveCustomization}
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  aria-label="Reset to default"
                >
                  ↺
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default KeyboardShortcutsSettings;
