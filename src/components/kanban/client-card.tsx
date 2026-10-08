import { MapPin, MessageCircle } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
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
    <div className="space-y-2">
      <Link
        href={`/clientes/${id}`}
        className="block leading-snug font-semibold text-ink hover:text-brand-700 hover:underline"
      >
        {title}
      </Link>
      <div className="flex flex-wrap gap-1">
        <span className="badge-neutral">{CLIENT_KINDS[kind] ?? kind}</span>
        {region && (
          <span className="badge-neutral">
            <MapPin className="size-3" aria-hidden />
            {region}
          </span>
        )}
        {whatsapp && (
          <a
            href={whatsappLink(whatsapp)}
            target="_blank"
            rel="noreferrer"
            className="badge-success hover:bg-green-100"
            aria-label={`WhatsApp de ${title}`}
          >
            <MessageCircle className="size-3" aria-hidden />
            WhatsApp
          </a>
        )}
      </div>
      {children}
      <div className="flex items-center gap-1.5 text-xs text-ink-subtle">
        {ownerName ? (
          <>
            <Avatar name={ownerName} size="sm" />
            {ownerName}
          </>
        ) : (
          "Sem responsável"
        )}
      </div>
    </div>
  );
}
