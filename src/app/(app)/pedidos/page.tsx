import type { Metadata } from "next";
import Link from "next/link";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { PageHeader } from "@/components/page-header";
import { getDb } from "@/db/client";
import { formatCents, formatDateTime, formatRelative } from "@/lib/format";
import { ORDER_STAGES, TERMINAL_VISIBLE_DAYS } from "@/lib/kanban/stages";
import { orderBoard } from "@/lib/orders";
import { getCurrentSegment } from "@/lib/segment-server";
import { segmentLabel } from "@/lib/segments";
import { moveOrderAction } from "./actions";

export const metadata: Metadata = { title: "Pedidos" };

/** Pedidos enviados pelos clientes no portal, da chegada até a entrega. */
export default async function OrdersPage() {
  const segment = await getCurrentSegment();
  const cards = await orderBoard(getDb(), segment);
  return (
    <>
      <PageHeader
        title={`Pedidos · ${segmentLabel(segment)}`}
        description="Pedidos feitos pelos clientes no portal. Abra o pedido para ver os itens agrupados por fornecedor (para a compra) e o endereço de entrega."
      />
      <KanbanBoard
        stages={ORDER_STAGES}
        move={moveOrderAction}
        columnNotes={{
          delivered: `Últimos ${TERMINAL_VISIBLE_DAYS} dias`,
          canceled: `Últimos ${TERMINAL_VISIBLE_DAYS} dias`,
        }}
        showTotals
        cards={cards.map((card) => ({
          id: card.id,
          stage: card.stage,
          valueCents: card.totalCents,
          content: (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Link
                  href={`/pedidos/${card.id}`}
                  className="font-semibold text-ink hover:text-brand-700 hover:underline"
                >
                  Pedido {card.number}
                </Link>
                {card.stage === "received" && <span className="badge-brand">novo</span>}
              </div>
              <Link
                href={`/clientes/${card.clientId}`}
                className="block text-xs font-medium text-brand-700 hover:underline"
              >
                {card.clientName}
              </Link>
              <p className="num text-lg font-semibold text-ink">
                {formatCents(card.totalCents, "R$ 0,00")}
              </p>
              <div className="flex flex-wrap gap-1">
                <span className="badge-neutral">{card.itemCount} item(ns)</span>
                {card.hasUnpricedItems && <span className="badge-warning">sob consulta</span>}
              </div>
              {card.stage === "canceled" && card.cancelReason && (
                <p className="badge-danger whitespace-normal">Motivo: {card.cancelReason}</p>
              )}
              <time
                className="caption block"
                dateTime={card.createdAt.toISOString()}
                title={formatDateTime(card.createdAt)}
              >
                {formatRelative(card.createdAt)}
              </time>
            </div>
          ),
        }))}
      />
    </>
  );
}
