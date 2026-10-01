"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "./Button";
import { Dialog } from "./Dialog";

type Toast = { id: number; message: string; kind: "success" | "error" };

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type Ui = {
  /** Show a short message at the bottom of the screen. */
  toast: (message: string, kind?: Toast["kind"]) => void;
  /** Ask a yes/no question. Resolves true when the user confirms. */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const UiContext = createContext<Ui | null>(null);

export function useUi(): Ui {
  const ui = useContext(UiContext);
  if (!ui) throw new Error("useUi must be used inside <UiProvider>");
  return ui;
}

export function UiProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const toast = useCallback<Ui["toast"]>(
    (message, kind = "success") => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-2), { id, message, kind }]);
      // Errors stay longer so they can be read.
      window.setTimeout(() => dismiss(id), kind === "error" ? 9000 : 5000);
    },
    [dismiss],
  );

  const confirm = useCallback<Ui["confirm"]>(
    (options) => new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
    [],
  );

  const answer = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  return (
    <UiContext.Provider value={value}>
      {children}

      {pending && (
        <Dialog
          title={pending.title}
          onClose={() => answer(false)}
          footer={
            <>
              <Button onClick={() => answer(false)}>{pending.cancelLabel ?? "Cancel"}</Button>
              <Button variant={pending.danger ? "danger" : "primary"} onClick={() => answer(true)} data-autofocus>
                {pending.confirmLabel ?? "OK"}
              </Button>
            </>
          }
        >
          <p>{pending.message}</p>
        </Dialog>
      )}

      <div className="screen-only pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className={`pointer-events-auto flex max-w-xl items-center gap-3 rounded-lg px-4 py-3 text-base text-white shadow-lg ${
              t.kind === "error" ? "bg-danger" : "bg-ink"
            }`}
          >
            <span>{t.message}</span>
            <button type="button" onClick={() => dismiss(t.id)} className="min-h-9 rounded px-2 font-semibold underline">
              Dismiss
            </button>
          </div>
        ))}
      </div>
    </UiContext.Provider>
  );
}
