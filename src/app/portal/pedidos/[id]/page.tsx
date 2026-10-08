import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { getDb } from "@/db/client";
import { requireCustomer } from "@/lib/auth/current-user";
import { formatCents, formatDateTime } from "@/lib/format";
import { ORDER_STAGES, stageLabel } from "@/lib/kanban/stages";
import { getOrder } from "@/lib/orders";
import { param, type SearchParams } from "@/lib/search-params";

export const metadata: Metadata = { title: "Pedido" };

/** Pedido visto pelo cliente: só preços de venda (nunca fornecedor ou custo). */
export default async function MyOrderPage(props: PageProps<"/portal/pedidos/[id]">) {
  const user = await requireCustomer();
  const { id } = await props.params;
  const params = (await props.searchParams) as SearchParams;
  const order = z.uuid().safeParse(id).success ? await getOrder(getDb(), id, user.clientId) : null;
  if (!order) notFound();

  return (
    <>
      <Link href="/portal/pedidos" className="text-sm text-blue-600 hover:underline">
        ← Meus pedidos
      </Link>
      {param(params, "enviado") && (
        <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Pedido enviado! A SPJ já recebeu e vai organizar a entrega.
        </p>
      )}
      <PageHeader
        title={`Pedido ${order.number}`}
        description={`${stageLabel(ORDER_STAGES, order.stage)} · ${formatDateTime(order.createdAt)}`}
      />
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Produto</th>
              <th className="px-3 py-2 text-right font-medium">Qtd.</th>
              <th className="px-3 py-2 text-right font-medium">Preço un.</th>
              <th className="px-3 py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-b border-slate-100 last:border-0">
                <td className="px-3 py-2">
                  {item.description}
                  <div className="text-xs text-slate-500">{item.code}</div>
                </td>
                <td className="px-3 py-2 text-right">{item.quantity}</td>
                <td className="px-3 py-2 text-right">{formatCents(item.unitPriceCents)}</td>
                <td className="px-3 py-2 text-right">
                  {item.unitPriceCents === null
                    ? "a cotar"
                    : formatCents(item.unitPriceCents * item.quantity)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-end gap-3 border-t border-slate-200 px-3 py-2 text-sm">
          <span className="text-slate-500">Total</span>
          <strong>{formatCents(order.totalCents, "R$ 0,00")}</strong>
        </div>
      </div>
      {order.notes && <p className="card mt-4 p-3 text-sm">Observações: {order.notes}</p>}
      {order.cancelReason && (
        <p className="card mt-4 p-3 text-sm text-red-700">Cancelado: {order.cancelReason}</p>
      )}
    </>
  );
}
