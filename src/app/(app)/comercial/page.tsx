import type { SQL } from "drizzle-orm";
import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { ConfirmButton } from "@/components/confirm-button";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { PageHeader } from "@/components/page-header";
import { getDb } from "@/db/client";
import { clients, opportunities } from "@/db/schema";
import { requireUser } from "@/lib/auth/current-user";
import { listClientOptions } from "@/lib/clients/clients";
import { formatCents, formatDate } from "@/lib/format";
import { opportunityBoard } from "@/lib/kanban/boards";
import { OPPORTUNITY_STAGES, TERMINAL_VISIBLE_DAYS } from "@/lib/kanban/stages";
import { param, type SearchParams } from "@/lib/search-params";
import { getCurrentSegment } from "@/lib/segment-server";
import { listUsers } from "@/lib/users";
import { deleteOpportunityAction, moveOpportunityAction } from "./actions";
import { OpportunityForm } from "./opportunity-form";

export const metadata: Metadata = { title: "Comercial" };

/** Kanban comercial: cada card é uma demanda (pedido de peça/cotação) de um cliente. */
export default async function CommercialPage(props: PageProps<"/comercial">) {
  const me = await requireUser();
  const params = (await props.searchParams) as SearchParams;
  const db = getDb();
  const preselected = param(params, "novo");
  const ownerFilter = param(params, "responsavel");
  const segment = await getCurrentSegment();
  const filters: SQL[] = [eq(clients.segment, segment)];
  if (ownerFilter && z.uuid().safeParse(ownerFilter).success) {
    filters.push(eq(opportunities.ownerId, ownerFilter));
  }

  const [cards, clientOptions, users] = await Promise.all([
    opportunityBoard(db, filters),
    listClientOptions(db, segment),
    listUsers(db),
  ]);
  const openTotal = cards
    .filter((card) => !["order_closed", "delivered", "lost"].includes(card.stage))
    .reduce((sum, card) => sum + (card.valueCents ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Comercial"
        description={
          <>
            Demandas dos clientes, da solicitação à entrega. Em aberto:{" "}
            <strong>{formatCents(openTotal, "R$ 0,00")}</strong>. Ao fechar o pedido, o cliente é
            marcado no Farmer (e um prospect vira cliente ativo).
          </>
        }
        actions={
          <form action="/comercial" className="flex gap-2">
            <select
              name="responsavel"
              defaultValue={ownerFilter ?? ""}
              className="input w-auto"
              aria-label="Responsável"
            >
              <option value="">Todos os responsáveis</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
            <button type="submit" className="btn-secondary">
              Filtrar
            </button>
          </form>
        }
      />

      <details className="card mb-4 p-3" open={Boolean(preselected)}>
        <summary className="cursor-pointer font-medium text-blue-700">+ Nova demanda</summary>
        <div className="mt-3">
          {clientOptions.length === 0 ? (
            <p className="text-sm text-slate-500">
              Cadastre um cliente antes.{" "}
              <Link href="/clientes/novo" className="text-blue-600 underline">
                Novo cliente
              </Link>
            </p>
          ) : (
            <OpportunityForm
              clients={clientOptions}
              users={users}
              defaultClientId={preselected}
              defaultOwnerId={me.id}
            />
          )}
        </div>
      </details>

      <KanbanBoard
        stages={OPPORTUNITY_STAGES}
        move={moveOpportunityAction}
        columnNotes={{
          order_closed: `Últimos ${TERMINAL_VISIBLE_DAYS} dias`,
          delivered: `Últimos ${TERMINAL_VISIBLE_DAYS} dias`,
          lost: `Últimos ${TERMINAL_VISIBLE_DAYS} dias`,
        }}
        cards={cards.map((card) => ({
          id: card.id,
          stage: card.stage,
          content: (
            <div className="space-y-1">
              <p className="font-medium">{card.title}</p>
              <Link
                href={`/clientes/${card.clientId}`}
                className="block text-xs text-blue-700 hover:underline"
              >
                {card.clientName}
              </Link>
              {card.valueCents !== null && (
                <p className="text-sm font-semibold">{formatCents(card.valueCents)}</p>
              )}
              {card.stage === "lost" && card.lostReason && (
                <p className="text-xs text-red-700">Motivo: {card.lostReason}</p>
              )}
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  {card.ownerName ?? "Sem responsável"} · {formatDate(card.createdAt)}
                </span>
                <form action={deleteOpportunityAction}>
                  <input type="hidden" name="id" value={card.id} />
                  <ConfirmButton
                    message="Excluir esta demanda?"
                    className="text-red-600 hover:underline"
                  >
                    excluir
                  </ConfirmButton>
                </form>
              </div>
            </div>
          ),
        }))}
      />
    </>
  );
}
