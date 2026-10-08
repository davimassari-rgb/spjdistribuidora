import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { getDb } from "@/db/client";
import { requireCustomer } from "@/lib/auth/current-user";
import { formatCents, formatDateTime } from "@/lib/format";
import { ORDER_STAGES, stageLabel } from "@/lib/kanban/stages";
import { listClientOrders } from "@/lib/orders";

export const metadata: Metadata = { title: "Meus pedidos" };

export default async function MyOrdersPage() {
  const user = await requireCustomer();
  const list = await listClientOrders(getDb(), user.clientId);
  return (
    <>
      <PageHeader title="Meus pedidos" />
      {list.length === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-500">
          Você ainda não fez pedidos.{" "}
          <Link href="/portal" className="text-blue-600 underline">
            Ver produtos
          </Link>
        </div>
      ) : (
        <ul className="card divide-y divide-slate-100">
          {list.map((order) => (
            <li key={order.id}>
              <Link
                href={`/portal/pedidos/${order.id}`}
                className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm hover:bg-slate-50"
              >
                <span>
                  <strong>Pedido {order.number}</strong>{" "}
                  <span className="text-slate-500">· {formatDateTime(order.createdAt)}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span>{formatCents(order.totalCents, "R$ 0,00")}</span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                    {stageLabel(ORDER_STAGES, order.stage)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
