import { Check, CircleX } from "lucide-react";
import { ORDER_STAGES, type Stage } from "@/lib/kanban/stages";

const BADGE: Record<NonNullable<Stage["tone"]>, string> = {
  neutral: "badge-neutral",
  brand: "badge-brand",
  warning: "badge-warning",
  success: "badge-success",
  danger: "badge-danger",
};

/** Etapa do pedido em linguagem do cliente. */
const CUSTOMER_LABEL: Record<string, string> = {
  received: "Recebido",
  purchased: "Em separação",
  out_for_delivery: "Saiu para entrega",
  delivered: "Entregue",
  canceled: "Cancelado",
};

export function OrderStatusBadge({ stage }: { stage: string }) {
  const tone = ORDER_STAGES.find((s) => s.id === stage)?.tone ?? "neutral";
  return <span className={BADGE[tone]}>{CUSTOMER_LABEL[stage] ?? stage}</span>;
}

const FLOW = ["received", "purchased", "out_for_delivery", "delivered"];

/** Linha do tempo do pedido (Recebido → Em separação → Saiu para entrega → Entregue). */
export function OrderTracker({ stage }: { stage: string }) {
  if (stage === "canceled") {
    return (
      <div className="flex items-center gap-3 rounded-ui border border-danger-border bg-danger-bg p-4 text-danger">
        <CircleX className="size-5 shrink-0" aria-hidden />
        <p className="text-sm font-medium">Este pedido foi cancelado.</p>
      </div>
    );
  }
  const current = Math.max(0, FLOW.indexOf(stage));
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="Andamento do pedido">
      {FLOW.map((id, index) => {
        const done = index < current || stage === "delivered";
        const active = index === current && stage !== "delivered";
        return (
          <li key={id} className="flex flex-col items-center text-center">
            <div className="flex w-full items-center">
              <span
                className={`h-0.5 flex-1 ${index === 0 ? "invisible" : index <= current ? "bg-brand-600" : "bg-line-strong"}`}
              />
              <span
                aria-current={active ? "step" : undefined}
                className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  done
                    ? "bg-brand-600 text-white"
                    : active
                      ? "bg-brand-100 text-brand-700 ring-2 ring-brand-600"
                      : "bg-surface-sunken text-ink-subtle"
                }`}
              >
                {done ? <Check className="size-4" aria-hidden /> : index + 1}
              </span>
              <span
                className={`h-0.5 flex-1 ${index === FLOW.length - 1 ? "invisible" : index < current ? "bg-brand-600" : "bg-line-strong"}`}
              />
            </div>
            <span
              className={`mt-2 text-xs ${active || done ? "font-medium text-ink" : "text-ink-subtle"}`}
            >
              {CUSTOMER_LABEL[id]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
