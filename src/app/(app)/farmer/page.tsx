import type { Metadata } from "next";
import { ClientFilters } from "@/components/client-filters";
import { ClientCardContent } from "@/components/kanban/client-card";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { PageHeader } from "@/components/page-header";
import { getDb } from "@/db/client";
import { clientFilterConditions, listRegions } from "@/lib/clients/clients";
import { clientFiltersFrom } from "@/lib/clients/filters";
import { formatDate } from "@/lib/format";
import { farmerBoard, rolloverFarmerWeek } from "@/lib/kanban/boards";
import { FARMER_STAGES } from "@/lib/kanban/stages";
import type { SearchParams } from "@/lib/search-params";
import { getCurrentSegment } from "@/lib/segment-server";
import { clientKindsOf } from "@/lib/segments";
import { listUsers } from "@/lib/users";
import { weekStart } from "@/lib/week";
import { moveFarmerAction, setAlertWeeksAction } from "./actions";

export const metadata: Metadata = { title: "Farmer" };

/** Kanban farmer: relacionamento semanal com a carteira de clientes ativos. */
export default async function FarmerPage(props: PageProps<"/farmer">) {
  const params = (await props.searchParams) as SearchParams;
  const segment = await getCurrentSegment();
  const filters = { ...clientFiltersFrom(params, segment), q: undefined, status: undefined };
  const db = getDb();
  const now = new Date();
  // A virada da semana acontece aqui, na primeira abertura do quadro na semana.
  await rolloverFarmerWeek(db, now);
  const [{ cards, alertWeeks }, regions, users] = await Promise.all([
    farmerBoard(db, clientFilterConditions(filters), now),
    listRegions(db, segment),
    listUsers(db),
  ]);
  const alerts = cards.filter((card) => card.alert).length;
  const monday = new Date(`${weekStart(now)}T12:00:00-03:00`);

  return (
    <>
      <PageHeader
        title="Farmer · carteira ativa"
        description={
          <>
            Semana de {formatDate(monday)}. Toda segunda-feira os cards em “Contatado”, “Pedido
            fechado” e “Entregue” voltam para “A contatar”; “Cotação em andamento” continua.
            {alerts > 0 && (
              <span className="badge-danger ml-1">
                {alerts} cliente(s) há {alertWeeks}+ semanas sem pedido.
              </span>
            )}
          </>
        }
        actions={
          <form action={setAlertWeeksAction} className="flex items-center gap-2 text-sm">
            <label htmlFor="weeks" className="text-slate-600">
              Alertar após
            </label>
            <input
              id="weeks"
              name="weeks"
              type="number"
              min={1}
              max={52}
              defaultValue={alertWeeks}
              className="input w-16"
            />
            <span className="text-slate-600">semanas</span>
            <button type="submit" className="btn-secondary">
              Salvar
            </button>
          </form>
        }
      />
      <ClientFilters
        kinds={clientKindsOf(segment)}
        action="/farmer"
        values={filters}
        regions={regions}
        users={users}
        showSearch={false}
      />
      <KanbanBoard
        stages={FARMER_STAGES}
        move={moveFarmerAction}
        cards={cards.map((card) => ({
          id: card.id,
          stage: card.stage,
          highlight: card.alert,
          content: (
            <ClientCardContent {...card}>
              {card.alert ? (
                <p className="badge-danger">{card.weeksWithoutOrder} sem. sem pedido</p>
              ) : (
                <p className="caption">
                  {card.lastOrderAt
                    ? `Último pedido: ${formatDate(card.lastOrderAt)} (${card.weeksWithoutOrder} sem.)`
                    : `Sem pedido registrado (${card.weeksWithoutOrder} sem. como cliente)`}
                </p>
              )}
            </ClientCardContent>
          ),
        }))}
      />
    </>
  );
}
