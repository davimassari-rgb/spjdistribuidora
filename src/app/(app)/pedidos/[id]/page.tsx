import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { getDb } from "@/db/client";
import { whatsappLink } from "@/lib/br";
import { formatCents, formatDateTime, formatPhone } from "@/lib/format";
import { ORDER_STAGES, stageLabel } from "@/lib/kanban/stages";
import { getOrder } from "@/lib/orders";

export const metadata: Metadata = { title: "Pedido" };

/** Detalhe do pedido para a equipe: itens por fornecedor (compra), custo, venda e entrega. */
export default async function OrderPage(props: PageProps<"/pedidos/[id]">) {
  const { id } = await props.params;
  const order = z.uuid().safeParse(id).success ? await getOrder(getDb(), id) : null;
  if (!order) notFound();

  const bySupplier = new Map<string, typeof order.items>();
  for (const item of order.items) {
    bySupplier.set(item.supplierName, [...(bySupplier.get(item.supplierName) ?? []), item]);
  }
  const costTotal = order.items.reduce((sum, i) => sum + (i.unitCostCents ?? 0) * i.quantity, 0);

  return (
    <>
      <Link href="/pedidos" className="text-sm text-blue-600 hover:underline">
        ← Pedidos
      </Link>
      <PageHeader
        title={`Pedido ${order.number} · ${order.clientName}`}
        description={`${stageLabel(ORDER_STAGES, order.stage)} · recebido em ${formatDateTime(order.createdAt)}`}
        actions={
          order.clientWhatsapp && (
            <a
              className="btn-secondary"
              href={whatsappLink(order.clientWhatsapp)}
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp {formatPhone(order.clientWhatsapp)}
            </a>
          )
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="card p-3 text-sm">
          <div className="text-slate-500">Venda</div>
          <div className="text-xl font-semibold">{formatCents(order.totalCents, "R$ 0,00")}</div>
          {order.hasUnpricedItems && (
            <div className="text-xs text-amber-700">+ itens sob consulta</div>
          )}
        </div>
        <div className="card p-3 text-sm">
          <div className="text-slate-500">Custo nos fornecedores</div>
          <div className="text-xl font-semibold">{formatCents(costTotal, "R$ 0,00")}</div>
        </div>
        <div className="card p-3 text-sm">
          <div className="text-slate-500">Entrega</div>
          <div>
            {[order.clientAddress, order.clientCity].filter(Boolean).join(" · ") ||
              "Endereço não cadastrado"}
          </div>
        </div>
      </div>
      {order.notes && <p className="card mb-4 p-3 text-sm">Observação do cliente: {order.notes}</p>}
      {order.cancelReason && (
        <p className="card mb-4 p-3 text-sm text-red-700">Cancelado: {order.cancelReason}</p>
      )}

      <div className="space-y-4">
        {[...bySupplier.entries()].map(([supplierName, items]) => (
          <section key={supplierName} className="card overflow-x-auto">
            <h2 className="border-b border-slate-100 px-3 py-2 font-semibold">
              Comprar em: {supplierName}
            </h2>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-1.5 font-medium">Código</th>
                  <th className="px-3 py-1.5 font-medium">Produto</th>
                  <th className="px-3 py-1.5 text-right font-medium">Qtd.</th>
                  <th className="px-3 py-1.5 text-right font-medium">Custo un.</th>
                  <th className="px-3 py-1.5 text-right font-medium">Venda un.</th>
                  <th className="px-3 py-1.5 text-right font-medium">Total venda</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-3 py-1.5 font-mono">{item.code}</td>
                    <td className="px-3 py-1.5">
                      {item.description}
                      {item.brand && (
                        <span className="text-xs text-slate-500"> · {item.brand}</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-right">{item.quantity}</td>
                    <td className="px-3 py-1.5 text-right">{formatCents(item.unitCostCents)}</td>
                    <td className="px-3 py-1.5 text-right">{formatCents(item.unitPriceCents)}</td>
                    <td className="px-3 py-1.5 text-right">
                      {item.unitPriceCents === null
                        ? "—"
                        : formatCents(item.unitPriceCents * item.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </>
  );
}
