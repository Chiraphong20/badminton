import { useEffect } from 'react';

interface UseModalHotkeysOptions {
  /** Called when Escape is pressed while the modal is open. Omit to disable. */
  onClose?: () => void;
  /** Called when Enter is pressed (the modal's primary/save action). Omit to disable. */
  onSubmit?: () => void;
  /** Set false while the modal isn't actually open (or a nested picker/confirm should keep focus). */
  enabled?: boolean;
}

/**
 * Standard modal keyboard shortcuts: Esc closes, Enter runs the primary action.
 *
 * Enter is ignored while focus is inside a <textarea> (so multi-line text/paste keeps
 * working normally) unless Ctrl/Cmd is held at the same time.
 *
 * Fields that already have their own Enter behavior (e.g. an "add row" input that should
 * only add a row, not submit the whole modal) should call `e.stopPropagation()` in their
 * own onKeyDown to opt out of this global handler.
 */
export function useModalHotkeys({ onClose, onSubmit, enabled = true }: UseModalHotkeysOptions) {
  useEffect(() => {
    if (!enabled) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (onClose) { e.preventDefault(); onClose(); }
        return;
      }
      if (e.key === 'Enter' && onSubmit) {
        // e.repeat กัน auto-repeat จากการกด Enter ค้าง — ป้องกัน onSubmit (มักมีผลกับเงิน/ข้อมูล
        // จริง) ถูกยิงซ้ำโดยไม่ตั้งใจ เช่น ค้าง Enter ตอนเปิด modal พอดี แล้ว action ก็ทำงานทันที
        if (e.repeat) return;
        const active = document.activeElement as HTMLElement | null;
        if (active?.tagName === 'TEXTAREA' && !(e.ctrlKey || e.metaKey)) return;
        e.preventDefault();
        onSubmit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onSubmit, enabled]);
}
