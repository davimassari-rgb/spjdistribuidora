"use client";

import { X } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";

/** Janela modal acessível (usa <dialog> nativo: foco preso e Esc para fechar). */
export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-ui border border-line bg-surface p-0 text-ink shadow-modal backdrop:bg-slate-900/40"
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <h2 className="section-title">{title}</h2>
        <button type="button" className="btn-icon" onClick={onClose} aria-label="Fechar">
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <div className="p-5">{open && children}</div>
    </dialog>
  );
}
