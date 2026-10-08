import { ChevronRight, ShoppingCart } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { getDb } from "@/db/client";
import { requireCustomer } from "@/lib/auth/current-user";
import { formatCents, formatDateTime, formatRelative } from "@/lib/format";
import { listClientOrders } from "@/lib/orders";
import { OrderStatusBadge } from "../order-status";

export const metadata: Metadata = { title: "Meus pedidos" };

export default async function MyOrdersPage() {
  const user = await requireCustomer();
  const list = await listClientOrders(getDb(), user.clientId);
  return (
    <>
      <PageHeader
        title="Meus pedidos"
        description="Acompanhe o andamento dos pedidos enviados para a SPJ."
      />
      {list.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="Você ainda não fez pedidos"
          description="Escolha os produtos no catálogo e envie o primeiro pedido."
          action={
            <Link href="/portal" className="btn-primary">
              Ver produtos
            </Link>
          }
        />
      ) : (
        <ul className="card divide-y divide-line">
          {list.map((order) => (
            <li key={order.id}>
              <Link
                href={`/portal/pedidos/${order.id}`}
                className="flex items-center gap-4 p-4 transition hover:bg-surface-muted"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                  <ShoppingCart className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ink">Pedido {order.number}</span>
                    <OrderStatusBadge stage={order.stage} />
                  </span>
                  <span className="caption block" title={formatDateTime(order.createdAt)}>
                    {formatRelative(order.createdAt)}
                  </span>
                </span>
                <span className="num text-right font-semibold text-ink">
                  {formatCents(order.totalCents, "R$ 0,00")}
                  {order.hasUnpricedItems && (
                    <span className="caption block font-normal">+ a cotar</span>
                  )}
                </span>
                <ChevronRight className="size-4 text-ink-subtle" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
