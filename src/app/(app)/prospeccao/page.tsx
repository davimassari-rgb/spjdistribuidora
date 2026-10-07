import type { Metadata } from "next";
import Link from "next/link";
import { ClientFilters } from "@/components/client-filters";
import { ClientCardContent } from "@/components/kanban/client-card";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { PageHeader } from "@/components/page-header";
import { getDb } from "@/db/client";
import { clientFilterConditions, listRegions } from "@/lib/clients/clients";
import { clientFiltersFrom } from "@/lib/clients/filters";
import { prospectBoard } from "@/lib/kanban/boards";
import { PROSPECT_STAGES, TERMINAL_VISIBLE_DAYS } from "@/lib/kanban/stages";
import type { SearchParams } from "@/lib/search-params";
import { listUsers } from "@/lib/users";
import { moveProspectAction } from "./actions";

export const metadata: Metadata = { title: "Prospecção" };

/** Kanban hunter: abertura de novos clientes. */
export default async function ProspectingPage(props: PageProps<"/prospeccao">) {
  const params = (await props.searchParams) as SearchParams;
  const filters = { ...clientFiltersFrom(params), q: undefined, status: undefined };
  const db = getDb();
  const [cards, regions, users] = await Promise.all([
    prospectBoard(db, clientFilterConditions(filters)),
    listRegions(db),
    listUsers(db),
  ]);

  return (
    <>
      <PageHeader
        title="Prospecção"
        description="Abertura de novos clientes. Ao chegar em “Primeiro pedido”, o cliente entra na carteira (Farmer)."
        actions={
          <Link href="/clientes/novo" className="btn-primary">
            Novo lead
          </Link>
        }
      />
      <ClientFilters
        action="/prospeccao"
        values={filters}
        regions={regions}
        users={users}
        showSearch={false}
      />
      <KanbanBoard
        stages={PROSPECT_STAGES}
        move={moveProspectAction}
        columnNotes={{
          first_order: `Últimos ${TERMINAL_VISIBLE_DAYS} dias`,
          lost: `Últimos ${TERMINAL_VISIBLE_DAYS} dias`,
        }}
        cards={cards.map((card) => ({
          id: card.id,
          stage: card.stage ?? "lead",
          content: (
            <ClientCardContent {...card}>
              {card.stage === "lost" && card.lostReason && (
                <p className="text-xs text-red-700">Motivo: {card.lostReason}</p>
              )}
            </ClientCardContent>
          ),
        }))}
      />
    </>
  );
}
