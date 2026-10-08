import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { KindLabel, StatusBadge } from "@/components/client-badges";
import { ConfirmButton } from "@/components/confirm-button";
import { PageHeader } from "@/components/page-header";
import { getDb } from "@/db/client";
import { whatsappLink } from "@/lib/br";
import { getClient, listInteractions, listRegions } from "@/lib/clients/clients";
import { formatCents, formatCnpj, formatDate, formatPhone } from "@/lib/format";
import { listClientOpportunities } from "@/lib/kanban/boards";
import {
  FARMER_STAGES,
  INTERACTION_KINDS,
  OPPORTUNITY_STAGES,
  PROSPECT_STAGES,
  stageLabel,
} from "@/lib/kanban/stages";
import { clientKindsOf, DEFAULT_SEGMENT, isSegment, segmentLabel } from "@/lib/segments";
import { listClientLogins, listUsers } from "@/lib/users";
import { localDate } from "@/lib/week";
import {
  deleteClientAction,
  deleteInteractionAction,
  removePortalLoginAction,
  updateClientAction,
} from "../actions";
import { ClientForm } from "../client-form";
import { InteractionForm } from "./interaction-form";
import { PortalLoginForm } from "./portal-access";

export const metadata: Metadata = { title: "Cliente" };

export default async function ClientPage(props: PageProps<"/clientes/[id]">) {
  const { id } = await props.params;
  const db = getDb();
  const client = z.uuid().safeParse(id).success ? await getClient(db, id) : null;
  if (!client) notFound();
  const [history, deals, users, regions, logins] = await Promise.all([
    listInteractions(db, client.id),
    listClientOpportunities(db, client.id),
    listUsers(db),
    listRegions(db, isSegment(client.segment) ? client.segment : undefined),
    listClientLogins(db, client.id),
  ]);

  return (
    <>
      <Link href="/clientes" className="text-sm text-blue-600 hover:underline">
        ← Clientes
      </Link>
      <PageHeader
        title={client.tradeName}
        description={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={client.status} />
            <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-800">
              {segmentLabel(client.segment)}
            </span>
            <span>
              <KindLabel kind={client.kind} />
            </span>
            {client.cnpj && <span>· CNPJ {formatCnpj(client.cnpj)}</span>}
            {client.prospectStage && (
              <span>· Prospecção: {stageLabel(PROSPECT_STAGES, client.prospectStage)}</span>
            )}
            {client.status === "active" && (
              <span>· Farmer: {stageLabel(FARMER_STAGES, client.farmerStage ?? "to_contact")}</span>
            )}
            {client.lostReason && <span>· Motivo da perda: {client.lostReason}</span>}
            <span>· Último pedido: {formatDate(client.lastOrderAt)}</span>
          </div>
        }
        actions={
          <>
            {client.whatsapp && (
              <a
                className="btn-secondary"
                href={whatsappLink(client.whatsapp)}
                target="_blank"
                rel="noreferrer"
              >
                WhatsApp {formatPhone(client.whatsapp)}
              </a>
            )}
            {client.phone && (
              <a className="btn-secondary" href={`tel:${client.phone}`}>
                Ligar {formatPhone(client.phone)}
              </a>
            )}
            <Link className="btn-primary" href={`/comercial?novo=${client.id}`}>
              Nova demanda
            </Link>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          <section className="card p-4">
            <h2 className="mb-4 font-semibold">Dados do cliente</h2>
            <ClientForm
              kinds={clientKindsOf(isSegment(client.segment) ? client.segment : DEFAULT_SEGMENT)}
              action={updateClientAction}
              users={users}
              regions={regions}
              isNew={false}
              initial={{
                id: client.id,
                tradeName: client.tradeName,
                legalName: client.legalName ?? "",
                cnpj: client.cnpj ? formatCnpj(client.cnpj) : "",
                kind: client.kind,
                contactName: client.contactName ?? "",
                phone: client.phone ? formatPhone(client.phone) : "",
                whatsapp: client.whatsapp ? formatPhone(client.whatsapp) : "",
                address: client.address ?? "",
                city: client.city ?? "",
                region: client.region ?? "",
                ownerId: client.ownerId ?? "",
                notes: client.notes ?? "",
              }}
            />
          </section>

          <section>
            <h2 className="mb-2 font-semibold">Demandas (Kanban comercial)</h2>
            {deals.length === 0 ? (
              <div className="card p-4 text-sm text-slate-500">Nenhuma demanda registrada.</div>
            ) : (
              <ul className="card divide-y divide-slate-100">
                {deals.map((deal) => (
                  <li
                    key={deal.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm"
                  >
                    <span>
                      <strong>{deal.title}</strong>{" "}
                      <span className="text-slate-500">· {formatDate(deal.createdAt)}</span>
                    </span>
                    <span className="flex items-center gap-3">
                      {deal.valueCents !== null && <span>{formatCents(deal.valueCents)}</span>}
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                        {stageLabel(OPPORTUNITY_STAGES, deal.stage)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <form action={deleteClientAction}>
            <input type="hidden" name="id" value={client.id} />
            <ConfirmButton
              message={`Excluir ${client.tradeName}, com histórico e demandas? Não dá para desfazer.`}
            >
              Excluir cliente
            </ConfirmButton>
          </form>
        </div>

        <section className="space-y-4">
          <div className="card p-4">
            <h2 className="mb-1 font-semibold">Acesso ao portal de pedidos</h2>
            <p className="mb-3 text-xs text-slate-500">
              Com um login, o cliente escolhe os produtos de {segmentLabel(client.segment)} e envia
              o pedido, que cai no quadro de Pedidos.
            </p>
            {logins.length > 0 && (
              <ul className="mb-3 divide-y divide-slate-100 text-sm">
                {logins.map((login) => (
                  <li key={login.id} className="flex items-center justify-between gap-2 py-1.5">
                    <span>
                      {login.name} · <span className="text-slate-500">{login.email}</span>
                    </span>
                    <form action={removePortalLoginAction}>
                      <input type="hidden" name="clientId" value={client.id} />
                      <input type="hidden" name="userId" value={login.id} />
                      <ConfirmButton
                        message={`Remover o acesso de ${login.email}?`}
                        className="text-xs text-red-600 hover:underline"
                      >
                        remover
                      </ConfirmButton>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <details>
              <summary className="cursor-pointer text-sm font-medium text-blue-700">
                + Novo acesso
              </summary>
              <div className="mt-3">
                <PortalLoginForm clientId={client.id} />
              </div>
            </details>
          </div>
          <div className="card p-4">
            <h2 className="mb-3 font-semibold">Registrar interação</h2>
            <InteractionForm clientId={client.id} today={localDate(new Date())} />
          </div>
          <div>
            <h2 className="mb-2 font-semibold">Histórico</h2>
            {history.length === 0 ? (
              <div className="card p-4 text-sm text-slate-500">Nenhuma interação registrada.</div>
            ) : (
              <ol className="space-y-2">
                {history.map((item) => (
                  <li key={item.id} className="card p-3 text-sm">
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs text-slate-500">
                      <span>
                        <strong className="text-slate-700">
                          {INTERACTION_KINDS[item.kind as keyof typeof INTERACTION_KINDS] ??
                            item.kind}
                        </strong>{" "}
                        · {formatDate(item.occurredAt)}
                        {item.userName && ` · ${item.userName}`}
                      </span>
                      <form action={deleteInteractionAction}>
                        <input type="hidden" name="clientId" value={client.id} />
                        <input type="hidden" name="interactionId" value={item.id} />
                        <ConfirmButton
                          message="Excluir esta interação?"
                          className="text-red-600 hover:underline"
                        >
                          excluir
                        </ConfirmButton>
                      </form>
                    </div>
                    <p className="whitespace-pre-wrap">{item.note}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
