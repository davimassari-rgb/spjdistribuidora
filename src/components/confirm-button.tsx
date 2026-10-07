"use client";

import type { ReactNode } from "react";

/** Botão de envio que pede confirmação antes (para ações destrutivas). */
export function ConfirmButton({
  message,
  children,
  className = "btn-danger",
}: {
  message: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
