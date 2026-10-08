import { ArrowLeft, CircleCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db/client";
import { requireCustomer } from "@/lib/auth/current-user";
import { formatCents, formatDateTime } from "@/lib/format";
import { getOrder } from "@/lib/orders";
import { param, type SearchParams } from "@/lib/search-params";
import { OrderStatusBadge, OrderTracker } from "../../order-status";

export const metadata: Metadata = { title: "Pedido" };

/** Pedido visto pelo cliente: só preços de venda (nunca fornecedor ou custo). */
export default async function MyOrderPage(props: PageProps<"/portal/pedidos/[id]">) {
  const user = await requireCustomer();
  const { id } = await props.params;
  const params = (await props.searchParams) as SearchParams;
  const order = z.uuid().safeParse(id).success ? await getOrder(getDb(), id, user.clientId) : null;
  if (!order) notFound();
  const units = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <>
      <Link
        href="/portal/pedidos"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Meus pedidos
      </Link>

      {param(params, "enviado") && (
        <div className="mb-6 flex items-start gap-3 rounded-ui border border-success-border bg-success-bg p-4 text-success">
          <CircleCheck className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">Pedido enviado com sucesso!</p>
            <p className="text-sm">
              A SPJ já recebeu e vai organizar a compra e a entrega. Acompanhe por aqui.
            </p>
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="page-title">Pedido {order.number}</h1>
        <OrderStatusBadge stage={order.stage} />
        <span className="caption num">feito em {formatDateTime(order.createdAt)}</span>
      </div>

      <section className="card mb-6 p-5">
        <OrderTracker stage={order.stage} />
        {order.cancelReason && (
          <p className="mt-3 text-sm text-danger">Motivo: {order.cancelReason}</p>
        )}
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="card overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Produto</th>
                <th className="text-right!">Qtd.</th>
                <th className="text-right!">Preço un.</th>
                <th className="text-right!">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="font-medium text-ink">{item.description}</div>
                    <div className="caption">
                      <span className="font-mono">{item.code}</span>
                      {item.brand && ` · ${item.brand}`}
                    </div>
                  </td>
                  <td className="num text-right">{item.quantity}</td>
                  <td className="num text-right">{formatCents(item.unitPriceCents)}</td>
                  <td className="num text-right font-medium">
                    {item.unitPriceCents === null
                      ? "a cotar"
                      : formatCents(item.unitPriceCents * item.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className="card space-y-3 p-5">
          <h2 className="section-title">Resumo</h2>
          <dl className="num space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-subtle">Produtos</dt>
              <dd>{order.items.length}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-subtle">Unidades</dt>
              <dd>{units}</dd>
            </div>
            <div className="flex items-baseline justify-between border-t border-line pt-3">
              <dt className="font-medium text-ink">Total</dt>
              <dd className="text-xl font-semibold text-ink">
                {formatCents(order.totalCents, "R$ 0,00")}
              </dd>
            </div>
          </dl>
          {order.hasUnpricedItems && (
            <p className="rounded-ui border border-warning-border bg-warning-bg px-3 py-2 text-xs text-warning">
              Há itens sob consulta: a SPJ confirma o valor com você.
            </p>
          )}
          {order.notes && (
            <div className="border-t border-line pt-3">
              <p className="caption">Suas observações</p>
              <p className="text-sm">{order.notes}</p>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
