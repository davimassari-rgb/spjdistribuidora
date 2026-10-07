import Link from "next/link";
import type { ReactNode } from "react";
import { whatsappLink } from "@/lib/br";
import { CLIENT_KINDS } from "@/lib/kanban/stages";

/** Conteúdo do card de cliente (prospecção e farmer). Renderizado no servidor. */
export function ClientCardContent({
  id,
  title,
  kind,
  region,
  ownerName,
  whatsapp,
  children,
}: {
  id: string;
  title: string;
  kind: string;
  region: string | null;
  ownerName: string | null;
  whatsapp: string | null;
  children?: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Link
        href={`/clientes/${id}`}
        className="block font-medium text-slate-900 hover:text-blue-700 hover:underline"
      >
        {title}
      </Link>
      <div className="text-xs text-slate-500">
        {[CLIENT_KINDS[kind as keyof typeof CLIENT_KINDS], region].filter(Boolean).join(" · ")}
      </div>
      {children}
      <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
        <span>{ownerName ?? "Sem responsável"}</span>
        {whatsapp && (
          <a
            href={whatsappLink(whatsapp)}
            target="_blank"
            rel="noreferrer"
            className="rounded bg-green-50 px-1.5 py-0.5 text-green-700 hover:bg-green-100"
          >
            WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}
