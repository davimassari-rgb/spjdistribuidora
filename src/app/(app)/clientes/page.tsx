import type { Metadata } from "next";
import Link from "next/link";
import { KindLabel, StatusBadge } from "@/components/client-badges";
import { ClientFilters } from "@/components/client-filters";
import { PageHeader } from "@/components/page-header";
import { getDb } from "@/db/client";
import { listClients, listRegions } from "@/lib/clients/clients";
import { clientFiltersFrom } from "@/lib/clients/filters";
import { formatCnpj, formatDate, formatPhone } from "@/lib/format";
import { FARMER_STAGES, PROSPECT_STAGES, stageLabel } from "@/lib/kanban/stages";
import type { SearchParams } from "@/lib/search-params";
import { getCurrentSegment } from "@/lib/segment-server";
import { clientKindsOf } from "@/lib/segments";
import { listUsers } from "@/lib/users";

export const metadata: Metadata = { title: "Clientes" };

export default async function ClientsPage(props: PageProps<"/clientes">) {
  const params = (await props.searchParams) as SearchParams;
  const segment = await getCurrentSegment();
  const filters = clientFiltersFrom(params, segment);
  const db = getDb();
  const [rows, regions, users] = await Promise.all([
    listClients(db, filters),
    listRegions(db, segment),
    listUsers(db),
  ]);

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Clientes ativos e potenciais clientes (oficinas e lojas de autopeças)."
        actions={
          <Link href="/clientes/novo" className="btn-primary">
            Novo cliente
          </Link>
        }
      />
      <ClientFilters
        kinds={clientKindsOf(segment)}
        action="/clientes"
        values={filters}
        regions={regions}
        users={users}
        showStatus
      />

      {rows.length === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-500">
          Nenhum cliente encontrado.
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Cliente</th>
                <th className="px-3 py-2 font-medium">Tipo</th>
                <th className="hidden px-3 py-2 font-medium md:table-cell">Contato</th>
                <th className="hidden px-3 py-2 font-medium md:table-cell">Região</th>
                <th className="hidden px-3 py-2 font-medium lg:table-cell">Responsável</th>
                <th className="px-3 py-2 font-medium">Situação</th>
                <th className="hidden px-3 py-2 font-medium lg:table-cell">Último pedido</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((client) => (
                <tr key={client.id} className="border-b border-slate-100 align-top last:border-0">
                  <td className="px-3 py-2">
                    <Link
                      href={`/clientes/${client.id}`}
                      className="font-medium text-blue-700 hover:underline"
                    >
                      {client.tradeName}
                    </Link>
                    {client.cnpj && (
                      <div className="text-xs text-slate-500">{formatCnpj(client.cnpj)}</div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <KindLabel kind={client.kind} />
                  </td>
                  <td className="hidden px-3 py-2 md:table-cell">
                    <div>{client.contactName ?? "—"}</div>
                    <div className="text-xs text-slate-500">
                      {formatPhone(client.whatsapp ?? client.phone)}
                    </div>
                  </td>
                  <td className="hidden px-3 py-2 md:table-cell">
                    {[client.region, client.city].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="hidden px-3 py-2 lg:table-cell">{client.ownerName ?? "—"}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={client.status} />
                    <div className="mt-0.5 text-xs text-slate-500">
                      {client.status === "active"
                        ? stageLabel(FARMER_STAGES, client.farmerStage)
                        : stageLabel(PROSPECT_STAGES, client.prospectStage)}
                    </div>
                  </td>
                  <td className="hidden px-3 py-2 lg:table-cell">
                    {formatDate(client.lastOrderAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length >= 500 && (
            <p className="px-3 py-2 text-xs text-slate-500">
              Mostrando os 500 primeiros. Use os filtros.
            </p>
          )}
        </div>
      )}
    </>
  );
}
