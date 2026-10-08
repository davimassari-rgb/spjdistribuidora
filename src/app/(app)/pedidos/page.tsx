import type { Metadata } from "next";
import Link from "next/link";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { PageHeader } from "@/components/page-header";
import { getDb } from "@/db/client";
import { formatCents, formatDateTime } from "@/lib/format";
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
        cards={cards.map((card) => ({
          id: card.id,
          stage: card.stage,
          highlight: card.stage === "received",
          content: (
            <div className="space-y-1">
              <Link href={`/pedidos/${card.id}`} className="block font-medium hover:underline">
                Pedido {card.number}
              </Link>
              <Link
                href={`/clientes/${card.clientId}`}
                className="block text-xs text-blue-700 hover:underline"
              >
                {card.clientName}
              </Link>
              <p className="text-sm">
                {card.itemCount} item(ns) ·{" "}
                <strong>{formatCents(card.totalCents, "R$ 0,00")}</strong>
                {card.hasUnpricedItems && (
                  <span className="text-xs text-amber-700"> + sob consulta</span>
                )}
              </p>
              {card.stage === "canceled" && card.cancelReason && (
                <p className="text-xs text-red-700">Motivo: {card.cancelReason}</p>
              )}
              <p className="text-xs text-slate-500">{formatDateTime(card.createdAt)}</p>
            </div>
          ),
        }))}
      />
    </>
  );
}
