import { CLIENT_KINDS, CLIENT_STATUSES } from "@/lib/kanban/stages";

const STATUS_STYLE: Record<string, string> = {
  prospect: "bg-blue-100 text-blue-800",
  active: "bg-green-100 text-green-800",
  lost: "bg-slate-200 text-slate-600",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status] ?? ""}`}>
      {CLIENT_STATUSES[status as keyof typeof CLIENT_STATUSES] ?? status}
    </span>
  );
}

export function KindLabel({ kind }: { kind: string }) {
  return <>{CLIENT_KINDS[kind as keyof typeof CLIENT_KINDS] ?? kind}</>;
}
