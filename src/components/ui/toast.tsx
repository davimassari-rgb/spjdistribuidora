"use client";

import { CircleCheck, CircleX, Info, X } from "lucide-react";
import { createContext, type ReactNode, useCallback, useContext, useState } from "react";

type ToastKind = "success" | "error" | "info";
type Toast = { id: number; kind: ToastKind; message: string };

const ToastContext = createContext<((kind: ToastKind, message: string) => void) | null>(null);

const STYLE: Record<ToastKind, { box: string; Icon: typeof Info }> = {
  success: { box: "border-success-border bg-success-bg text-success", Icon: CircleCheck },
  error: { box: "border-danger-border bg-danger-bg text-danger", Icon: CircleX },
  info: { box: "border-info-border bg-info-bg text-info", Icon: Info },
};

/** Avisos flutuantes (canto inferior direito) para o resultado das ações. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback(
    (id: number) => setToasts((all) => all.filter((t) => t.id !== id)),
    [],
  );
  const show = useCallback(
    (kind: ToastKind, message: string) => {
      const id = Date.now() + Math.random();
      setToasts((all) => [...all.slice(-3), { id, kind, message }]);
      setTimeout(() => dismiss(id), kind === "error" ? 7000 : 4000);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
      >
        {toasts.map((toast) => {
          const { box, Icon } = STYLE[toast.kind];
          return (
            <div
              key={toast.id}
              role={toast.kind === "error" ? "alert" : "status"}
              className={`pointer-events-auto flex items-start gap-2 rounded-ui border px-3 py-2.5 text-sm shadow-pop ${box}`}
            >
              <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p className="flex-1">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="opacity-70 hover:opacity-100"
                aria-label="Fechar aviso"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const show = useContext(ToastContext);
  // Fora do provider (ex.: testes), não quebra: só não mostra o aviso.
  return show ?? (() => {});
}
