import { localDate } from "@/lib/week";

const DAY = 24 * 60 * 60 * 1000;

export type Freshness = "today" | "recent" | "stale" | "old" | "never";

/** Verde = atualizado hoje; azul = até 3 dias; âmbar = mais de 3 dias; vermelho = mais de 7. */
export function freshnessOf(lastImportAt: Date | null, now = new Date()): Freshness {
  if (!lastImportAt) return "never";
  if (localDate(lastImportAt) === localDate(now)) return "today";
  const days = (now.getTime() - lastImportAt.getTime()) / DAY;
  if (days > 7) return "old";
  if (days > 3) return "stale";
  return "recent";
}

export const FRESHNESS_STYLE: Record<Freshness, { dot: string; label: string; badge: string }> = {
  today: { dot: "bg-green-500", label: "Atualizado hoje", badge: "badge-success" },
  recent: { dot: "bg-brand-500", label: "Atualizado nos últimos 3 dias", badge: "badge-brand" },
  stale: { dot: "bg-amber-500", label: "Mais de 3 dias sem atualizar", badge: "badge-warning" },
  old: { dot: "bg-red-500", label: "Mais de 7 dias sem atualizar", badge: "badge-danger" },
  never: { dot: "bg-red-500", label: "Nenhuma planilha importada", badge: "badge-danger" },
};

export function daysAgoLabel(date: Date | null, now = new Date()): string {
  if (!date) return "nunca";
  if (localDate(date) === localDate(now)) return "hoje";
  const days = Math.max(1, Math.round((now.getTime() - date.getTime()) / DAY));
  return days === 1 ? "ontem" : `há ${days} dias`;
}

/** Bolinha colorida + texto acessível com o estado de atualização. */
export function FreshnessDot({ lastImportAt }: { lastImportAt: Date | null }) {
  const style = FRESHNESS_STYLE[freshnessOf(lastImportAt)];
  return (
    <span className={`inline-block size-2 shrink-0 rounded-full ${style.dot}`} title={style.label}>
      <span className="sr-only">{style.label}</span>
    </span>
  );
}
