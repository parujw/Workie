'use client';

import { useEffect } from 'react';
import { useStore } from '@/lib/store';
import { Spinner } from './ui';

/**
 * Always-visible save status. Conflicts and errors stay on screen until the
 * user dismisses them; a plain success fades on its own.
 */
export function SaveIndicator() {
  const { saveState, dismissSaveState, storageMode } = useStore();

  useEffect(() => {
    if (saveState.kind !== 'saved') return;
    const t = setTimeout(dismissSaveState, 2200);
    return () => clearTimeout(t);
  }, [saveState, dismissSaveState]);

  if (saveState.kind === 'saving') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-ink-muted">
        <Spinner className="h-3 w-3" />
        กำลังบันทึก…
      </span>
    );
  }

  if (saveState.kind === 'saved') {
    return (
      <span className="text-xs font-medium text-emerald-600">
        บันทึกแล้ว ✓
        {storageMode === 'local' && <span className="ml-1 text-ink-faint">(ในเครื่อง)</span>}
      </span>
    );
  }

  if (saveState.kind === 'error' || saveState.kind === 'conflict') {
    const isConflict = saveState.kind === 'conflict';
    return (
      <span
        className={`rounded-lg px-2 py-1 text-xs font-medium ${
          isConflict ? 'bg-amber-100 text-amber-900' : 'bg-red-100 text-red-800'
        }`}
      >
        {isConflict ? '⚠ แก้ไขชนกัน' : '⚠ บันทึกไม่สำเร็จ'}
      </span>
    );
  }

  return null;
}

/**
 * Full-width explanation for a failed or conflicting save. Stays until
 * dismissed so a lost write is never silent.
 */
export function SaveAlertBanner() {
  const { saveState, dismissSaveState } = useStore();
  if (saveState.kind !== 'error' && saveState.kind !== 'conflict') return null;
  const isConflict = saveState.kind === 'conflict';
  return (
    <div className="px-4 pt-3">
      <div
        role="alert"
        className={`flex flex-wrap items-start justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${
          isConflict
            ? 'border-amber-300 bg-amber-50 text-amber-900'
            : 'border-red-300 bg-red-50 text-red-800'
        }`}
      >
        <span className="flex-1">{saveState.message}</span>
        <button onClick={dismissSaveState} className="font-medium underline underline-offset-2">
          ปิด
        </button>
      </div>
    </div>
  );
}
