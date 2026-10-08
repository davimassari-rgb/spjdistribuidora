import { UsersRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DaysSinceOrder, KindLabel, StatusBadge } from "@/components/client-badges";
import { ClientFilters } from "@/components/client-filters";
import { PageHeader } from "@/components/page-header";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
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
        description="Clientes ativos e potenciais clientes deste segmento."
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
        <EmptyState
          icon={UsersRound}
          title="Nenhum cliente encontrado"
          description="Ajuste os filtros ou cadastre um novo cliente neste segmento."
          action={
            <Link href="/clientes/novo" className="btn-primary">
              Novo cliente
            </Link>
          }
        />
      ) : (
        <div className="card max-h-[calc(100vh-14rem)] overflow-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Tipo</th>
                <th className="hidden md:table-cell">Contato</th>
                <th className="hidden md:table-cell">Região</th>
                <th className="hidden lg:table-cell">Responsável</th>
                <th>Situação</th>
                <th className="hidden sm:table-cell">Desde o último pedido</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((client) => (
                <tr key={client.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <Avatar name={client.tradeName} />
                      <div className="min-w-0">
                        <Link
                          href={`/clientes/${client.id}`}
                          className="font-medium text-ink hover:text-brand-700 hover:underline"
                        >
                          {client.tradeName}
                        </Link>
                        {client.cnpj && (
                          <div className="caption num whitespace-nowrap">
                            {formatCnpj(client.cnpj)}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <KindLabel kind={client.kind} />
                  </td>
                  <td className="hidden md:table-cell">
                    <div>{client.contactName ?? "—"}</div>
                    <div className="caption num">
                      {formatPhone(client.whatsapp ?? client.phone)}
                    </div>
                  </td>
                  <td className="hidden md:table-cell">
                    {[client.region, client.city].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="hidden lg:table-cell">
                    {client.ownerName ? (
                      <span className="flex items-center gap-2">
                        <Avatar name={client.ownerName} size="sm" />
                        {client.ownerName}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <StatusBadge status={client.status} />
                    <div className="caption mt-1">
                      {client.status === "active"
                        ? stageLabel(FARMER_STAGES, client.farmerStage)
                        : stageLabel(PROSPECT_STAGES, client.prospectStage)}
                    </div>
                  </td>
                  <td className="hidden sm:table-cell">
                    <DaysSinceOrder date={client.lastOrderAt} />
                    {client.lastOrderAt && (
                      <div className="caption num mt-1">{formatDate(client.lastOrderAt)}</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length >= 500 && (
            <p className="caption px-3 py-2">Mostrando os 500 primeiros. Use os filtros.</p>
          )}
        </div>
      )}
    </>
  );
}
