"use client";

import { useEffect, useRef, useState } from "react";

/** Pede o motivo ao mover um card para "Perdido". */
export function ReasonDialog({
  title,
  onConfirm,
  onCancel,
}: {
  title: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-lg p-0 shadow-xl backdrop:bg-black/30"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <form
        className="space-y-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (reason.trim()) onConfirm(reason.trim());
        }}
      >
        <h2 className="font-semibold">{title}</h2>
        <label className="label" htmlFor="lost-reason">
          Motivo
        </label>
        <textarea
          id="lost-reason"
          className="input min-h-20"
          required
          placeholder="Ex.: preço acima do concorrente, já tem fornecedor, fechou a oficina…"
          value={reason}
          onChange={(e) => setReason(e.currentTarget.value)}
        />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" className="btn-danger" disabled={!reason.trim()}>
            Confirmar
          </button>
        </div>
      </form>
    </dialog>
  );
}
