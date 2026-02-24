import { useEffect } from "react";

export interface ToastItem {
  id: string;
  level: "info" | "success" | "error";
  message: string;
}

interface ToastStackProps {
  toasts: ToastItem[];
  onRemove: (id: string) => void;
}

export default function ToastStack({ toasts, onRemove }: ToastStackProps) {
  useEffect(() => {
    const timers = toasts.map((toast) =>
      setTimeout(() => {
        onRemove(toast.id);
      }, 3200)
    );

    return () => {
      for (const timer of timers) {
        clearTimeout(timer);
      }
    };
  }, [toasts, onRemove]);

  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.level}`}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}
