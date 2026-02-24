import { useCallback, useEffect, useState } from "react";
import type { RewriteRunContext } from "../../../shared/types";
import ToastStack, { type ToastItem } from "./ToastStack";

function createToast(level: ToastItem["level"], message: string): ToastItem {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    level,
    message
  };
}

export default function PreviewPage() {
  const [context, setContext] = useState<RewriteRunContext | null>(null);
  const [activeTab, setActiveTab] = useState<"original" | "improved">("improved");
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((level: ToastItem["level"], message: string) => {
    setToasts((prev) => [...prev, createToast(level, message)]);
  }, []);

  useEffect(() => {
    const unsubscribe = window.desktopApi.onStatus((payload) => {
      addToast(payload.level, payload.message);
    });

    void (async () => {
      const data = await window.desktopApi.getPreviewData();
      setContext(data);
    })();

    return () => {
      unsubscribe();
    };
  }, [addToast]);

  if (!context) {
    return (
      <main className="preview-page">
        <section className="card">
          <h2>Rewrite preview</h2>
          <p>Geen preview data beschikbaar.</p>
          <button className="btn secondary" type="button" onClick={() => void window.desktopApi.previewCancel()}>
            Close
          </button>
        </section>
      </main>
    );
  }

  const text = activeTab === "original" ? context.sourceText : context.improvedText;

  return (
    <main className="preview-page">
      <section className="card preview-card">
        <h2>Rewrite preview</h2>

        <div className="segmented">
          <button
            type="button"
            className={activeTab === "original" ? "segmented-active" : ""}
            onClick={() => setActiveTab("original")}
          >
            Original
          </button>
          <button
            type="button"
            className={activeTab === "improved" ? "segmented-active" : ""}
            onClick={() => setActiveTab("improved")}
          >
            Improved
          </button>
        </div>

        <textarea readOnly value={text} className="preview-text" />

        <div className="actions actions-split">
          <button className="btn primary" type="button" onClick={() => void window.desktopApi.previewCopy()}>
            Copy improved
          </button>
          <button className="btn secondary" type="button" onClick={() => void window.desktopApi.previewPaste()}>
            Paste
          </button>
          <button className="btn ghost" type="button" onClick={() => void window.desktopApi.previewCancel()}>
            Cancel
          </button>
        </div>
      </section>

      <ToastStack toasts={toasts} onRemove={(id) => setToasts((prev) => prev.filter((toast) => toast.id !== id))} />
    </main>
  );
}
