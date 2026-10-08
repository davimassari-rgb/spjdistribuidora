import { CLIENT_KINDS, CLIENT_STATUSES } from "@/lib/kanban/stages";

const STATUS_STYLE: Record<string, string> = {
  prospect: "badge-brand",
  active: "badge-success",
  lost: "badge-neutral",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={STATUS_STYLE[status] ?? "badge-neutral"}>
      {CLIENT_STATUSES[status as keyof typeof CLIENT_STATUSES] ?? status}
    </span>
  );
}

export function KindLabel({ kind }: { kind: string }) {
  return <>{CLIENT_KINDS[kind] ?? kind}</>;
}

const DAY = 24 * 60 * 60 * 1000;

/** Dias desde o último pedido, com cor: até 7 verde, até 21 âmbar, acima vermelho. */
export function DaysSinceOrder({ date, now = new Date() }: { date: Date | null; now?: Date }) {
  if (!date) return <span className="badge-neutral">sem pedido</span>;
  const days = Math.max(0, Math.floor((now.getTime() - date.getTime()) / DAY));
  const style = days <= 7 ? "badge-success" : days <= 21 ? "badge-warning" : "badge-danger";
  return (
    <span className={`${style} num`}>
      {days === 0 ? "hoje" : `${days} dia${days > 1 ? "s" : ""}`}
    </span>
  );
}
