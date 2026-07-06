import { useEffect, useRef } from 'react';
import clsx from 'clsx';
import { useStore } from '../../store';

const TOAST_LIFETIME_MS = 3000;

/** Renders uiSlice toasts bottom-right; each auto-dismisses after ~3s. */
export function Toaster() {
  const toasts = useStore((s) => s.toasts);
  const dismissToast = useStore((s) => s.dismissToast);
  const timers = useRef(new Set<number>());

  useEffect(() => {
    for (const toast of toasts) {
      if (timers.current.has(toast.id)) continue;
      timers.current.add(toast.id);
      window.setTimeout(() => {
        timers.current.delete(toast.id);
        dismissToast(toast.id);
      }, TOAST_LIFETIME_MS);
    }
  }, [toasts, dismissToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="toaster">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={clsx('toast', toast.kind)}
          onClick={() => dismissToast(toast.id)}
          role="status"
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
