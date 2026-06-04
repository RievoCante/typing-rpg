import { useEffect, useRef } from 'react';
import { useThemeContext } from '../hooks/useThemeContext';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// Generic, theme-aware blocking confirm dialog. Reuses the WeaponDropModal
// overlay/card pattern (fixed full-screen backdrop + centered blurred card).
// Esc and backdrop click both cancel; Cancel is focused by default so a stray
// Enter can't trigger a destructive confirm.
export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { theme } = useThemeContext();
  const isDark = theme === 'dark';
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 pointer-events-auto"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={e => e.stopPropagation()}
        className={`mx-4 flex max-w-sm flex-col gap-4 rounded-xl border p-6 shadow-lg backdrop-blur-sm transition-colors duration-300 ${
          isDark
            ? 'border-gray-700 bg-[#2A2C3C] text-gray-100'
            : 'border-gray-200 bg-white text-gray-800'
        }`}
      >
        <h2 className="text-lg font-bold">{title}</h2>
        <p
          className={`text-sm leading-relaxed ${
            isDark ? 'text-gray-300' : 'text-gray-600'
          }`}
        >
          {message}
        </p>
        <div className="mt-1 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              isDark
                ? 'bg-[#33364a] text-gray-200 hover:bg-[#3d4060]'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-red-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-red-400"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
