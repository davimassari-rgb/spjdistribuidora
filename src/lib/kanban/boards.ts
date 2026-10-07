import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  max,
  notInArray,
  or,
  type SQL,
} from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/client";
import { appSettings, clients, opportunities, users } from "@/db/schema";
import { daysAgo, weekStart, weeksBetween } from "@/lib/week";
import {
  FARMER_RESET_STAGES,
  FARMER_STAGES,
  type FarmerStage,
  ids,
  OPPORTUNITY_STAGES,
  type OpportunityStage,
  PROSPECT_STAGES,
  type ProspectStage,
  TERMINAL_VISIBLE_DAYS,
} from "./stages";

export class BoardError extends Error {}

export const moveSchema = z.object({
  id: z.uuid(),
  index: z.number().int().min(0),
  reason: z.string().trim().max(500).optional(),
});

/** Insere `id` na posição `index` da coluna e devolve a nova ordem. */
export function reorder(columnIds: string[], id: string, index: number): string[] {
  const rest = columnIds.filter((other) => other !== id);
  const at = Math.min(Math.max(0, index), rest.length);
  return [...rest.slice(0, at), id, ...rest.slice(at)];
}

// ================================================================== Kanban de prospecção (hunter)

export const prospectStageSchema = z.enum(ids(PROSPECT_STAGES));

export async function moveProspect(
  db: Db,
  input: { id: string; stage: ProspectStage; index: number; reason?: string },
  now = new Date(),
): Promise<void> {
  if (input.stage === "lost" && !input.reason) {
    throw new BoardError("Informe o motivo da perda.");
  }
  await db.transaction(async (tx) => {
    const [client] = await tx.select().from(clients).where(eq(clients.id, input.id));
    if (!client?.prospectStage) throw new BoardError("Cliente não está no Kanban de prospecção.");

    const changes: Partial<typeof clients.$inferInsert> = {
      prospectStage: input.stage,
      lostReason: null,
    };
    if (input.stage === "first_order") {
      // Primeiro pedido: vira cliente ativo e entra na carteira (farmer) como "Pedido fechado".
      Object.assign(changes, {
        status: "active",
        becameActiveAt: client.becameActiveAt ?? now,
        lastOrderAt: now,
        farmerStage: client.farmerStage ?? "order_closed",
      });
    } else if (input.stage === "lost") {
      Object.assign(changes, { status: "lost", lostReason: input.reason, farmerStage: null });
    } else if (client.prospectStage === "first_order" || client.status !== "prospect") {
      // Voltou para uma etapa aberta: desfaz a conversão.
      Object.assign(changes, { status: "prospect", farmerStage: null });
    }
    await tx.update(clients).set(changes).where(eq(clients.id, client.id));

    const column = await tx
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.prospectStage, input.stage))
      .orderBy(asc(clients.prospectPosition));
    const order = reorder(
      column.map((c) => c.id),
      client.id,
      input.index,
    );
    for (const [position, id] of order.entries()) {
      await tx.update(clients).set({ prospectPosition: position }).where(eq(clients.id, id));
    }
  });
}

// ================================================================== Kanban farmer (carteira ativa)

export const farmerStageSchema = z.enum(ids(FARMER_STAGES));

export async function moveFarmer(
  db: Db,
  input: { id: string; stage: FarmerStage; index: number },
  now = new Date(),
): Promise<void> {
  await db.transaction(async (tx) => {
    const [client] = await tx.select().from(clients).where(eq(clients.id, input.id));
    if (client?.status !== "active") throw new BoardError("Cliente não está ativo.");

    const changes: Partial<typeof clients.$inferInsert> = { farmerStage: input.stage };
    if (input.stage === "order_closed" && client.farmerStage !== "order_closed") {
      changes.lastOrderAt = now;
    }
    await tx.update(clients).set(changes).where(eq(clients.id, client.id));

    const column = await tx
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.status, "active"), eq(clients.farmerStage, input.stage)))
      .orderBy(asc(clients.farmerPosition));
    const order = reorder(
      column.map((c) => c.id),
      client.id,
      input.index,
    );
    for (const [position, id] of order.entries()) {
      await tx.update(clients).set({ farmerPosition: position }).where(eq(clients.id, id));
    }
  });
}

const FARMER_WEEK_KEY = "farmer_week";
const FARMER_ALERT_KEY = "farmer_alert_weeks";
export const DEFAULT_ALERT_WEEKS = 3;

/**
 * Virada de semana do farmer, feita sob demanda ao abrir o quadro (não depende de cron):
 * se a semana atual (segunda-feira, horário de Brasília) é posterior à última registrada,
 * os cards "Contatado", "Pedido fechado" e "Entregue" voltam para "A contatar".
 * "Cotação em andamento" continua onde está (negociação aberta).
 */
export async function rolloverFarmerWeek(db: Db, now = new Date()): Promise<boolean> {
  const current = weekStart(now);
  return db.transaction(async (tx) => {
    const [setting] = await tx
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, FARMER_WEEK_KEY));
    const stored = typeof setting?.value === "string" ? setting.value : null;
    if (stored === current) return false;

    await tx
      .insert(appSettings)
      .values({ key: FARMER_WEEK_KEY, value: current })
      .onConflictDoUpdate({ target: appSettings.key, set: { value: current } });
    // Primeira execução: só registra a semana (não mexe nos cards).
    if (stored === null || stored > current) return false;

    await tx
      .update(clients)
      .set({ farmerStage: "to_contact" })
      .where(
        and(
          eq(clients.status, "active"),
          or(inArray(clients.farmerStage, FARMER_RESET_STAGES), isNull(clients.farmerStage)),
        ),
      );
    return true;
  });
}

export async function getAlertWeeks(db: Db): Promise<number> {
  const [setting] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, FARMER_ALERT_KEY));
  const value = Number(setting?.value);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_ALERT_WEEKS;
}

export async function setAlertWeeks(db: Db, weeks: number): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key: FARMER_ALERT_KEY, value: weeks })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: weeks } });
}

export type FarmerCard = {
  id: string;
  title: string;
  stage: string;
  kind: string;
  region: string | null;
  ownerName: string | null;
  whatsapp: string | null;
  phone: string | null;
  lastOrderAt: Date | null;
  /** Semanas desde o último pedido (ou desde que virou cliente, se nunca pediu). */
  weeksWithoutOrder: number;
  alert: boolean;
};

export async function farmerBoard(db: Db, filters: SQL[], now = new Date()) {
  const alertWeeks = await getAlertWeeks(db);
  const rows = await db
    .select({
      id: clients.id,
      title: clients.tradeName,
      stage: clients.farmerStage,
      kind: clients.kind,
      region: clients.region,
      ownerName: users.name,
      whatsapp: clients.whatsapp,
      phone: clients.phone,
      lastOrderAt: clients.lastOrderAt,
      becameActiveAt: clients.becameActiveAt,
      createdAt: clients.createdAt,
    })
    .from(clients)
    .leftJoin(users, eq(users.id, clients.ownerId))
    .where(and(eq(clients.status, "active"), ...filters))
    .orderBy(asc(clients.farmerPosition), asc(clients.tradeName));

  const cards: FarmerCard[] = rows.map((row) => {
    const since = row.lastOrderAt ?? row.becameActiveAt ?? row.createdAt;
    const weeks = weeksBetween(since, now);
    return {
      id: row.id,
      title: row.title,
      stage: row.stage ?? "to_contact",
      kind: row.kind,
      region: row.region,
      ownerName: row.ownerName,
      whatsapp: row.whatsapp,
      phone: row.phone,
      lastOrderAt: row.lastOrderAt,
      weeksWithoutOrder: weeks,
      alert: weeks >= alertWeeks,
    };
  });
  return { cards, alertWeeks };
}

export async function prospectBoard(db: Db, filters: SQL[], now = new Date()) {
  const since = daysAgo(now, TERMINAL_VISIBLE_DAYS);
  return db
    .select({
      id: clients.id,
      title: clients.tradeName,
      stage: clients.prospectStage,
      kind: clients.kind,
      region: clients.region,
      ownerName: users.name,
      whatsapp: clients.whatsapp,
      phone: clients.phone,
      lostReason: clients.lostReason,
    })
    .from(clients)
    .leftJoin(users, eq(users.id, clients.ownerId))
    .where(
      and(
        isNotNull(clients.prospectStage),
        or(
          notInArray(clients.prospectStage, ["first_order", "lost"]),
          gte(clients.updatedAt, since),
        ),
        ...filters,
      ),
    )
    .orderBy(asc(clients.prospectPosition), asc(clients.tradeName));
}

// ================================================================== Kanban comercial (demandas)

export const opportunityStageSchema = z.enum(ids(OPPORTUNITY_STAGES));

const CLOSED_STAGES: OpportunityStage[] = ["order_closed", "delivered"];

export async function createOpportunity(
  db: Db,
  input: {
    clientId: string;
    title: string;
    valueCents: number | null;
    ownerId: string | null;
    notes: string | null;
  },
): Promise<{ id: string }> {
  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.id, input.clientId));
  if (!client) throw new BoardError("Cliente não encontrado.");
  const [row] = await db
    .select({ value: max(opportunities.position) })
    .from(opportunities)
    .where(eq(opportunities.stage, "requested"));
  const [created] = await db
    .insert(opportunities)
    .values({ ...input, stage: "requested", position: (row?.value ?? -1) + 1 })
    .returning({ id: opportunities.id });
  return created;
}

/**
 * Move uma demanda. Ao chegar em "Pedido fechado" (ou "Entregue" sem ter passado por ele):
 * registra o último pedido do cliente; prospect vira cliente ativo; no farmer, o card do
 * cliente vai para "Pedido fechado" se ainda estava antes disso na semana.
 */
export async function moveOpportunity(
  db: Db,
  input: { id: string; stage: OpportunityStage; index: number; reason?: string },
  now = new Date(),
): Promise<void> {
  if (input.stage === "lost" && !input.reason) throw new BoardError("Informe o motivo da perda.");

  await db.transaction(async (tx) => {
    const [opportunity] = await tx
      .select()
      .from(opportunities)
      .where(eq(opportunities.id, input.id));
    if (!opportunity) throw new BoardError("Demanda não encontrada.");

    const wasClosed = CLOSED_STAGES.includes(opportunity.stage as OpportunityStage);
    const isClosed = CLOSED_STAGES.includes(input.stage);
    await tx
      .update(opportunities)
      .set({
        stage: input.stage,
        lostReason: input.stage === "lost" ? input.reason : null,
        closedAt: isClosed || input.stage === "lost" ? (opportunity.closedAt ?? now) : null,
      })
      .where(eq(opportunities.id, opportunity.id));

    if (isClosed && !wasClosed) {
      const [client] = await tx.select().from(clients).where(eq(clients.id, opportunity.clientId));
      const changes: Partial<typeof clients.$inferInsert> = { lastOrderAt: now };
      if (client.status !== "active") {
        Object.assign(changes, {
          status: "active",
          becameActiveAt: client.becameActiveAt ?? now,
          prospectStage: client.prospectStage ? "first_order" : null,
          lostReason: null,
          farmerStage: "order_closed",
        });
      } else if (["to_contact", "contacted", "quoting", null].includes(client.farmerStage)) {
        changes.farmerStage = "order_closed";
      }
      await tx.update(clients).set(changes).where(eq(clients.id, client.id));
    }

    const column = await tx
      .select({ id: opportunities.id })
      .from(opportunities)
      .where(eq(opportunities.stage, input.stage))
      .orderBy(asc(opportunities.position));
    const order = reorder(
      column.map((c) => c.id),
      opportunity.id,
      input.index,
    );
    for (const [position, id] of order.entries()) {
      await tx.update(opportunities).set({ position }).where(eq(opportunities.id, id));
    }
  });
}

export async function opportunityBoard(db: Db, filters: SQL[], now = new Date()) {
  const since = daysAgo(now, TERMINAL_VISIBLE_DAYS);
  return db
    .select({
      id: opportunities.id,
      title: opportunities.title,
      stage: opportunities.stage,
      valueCents: opportunities.valueCents,
      lostReason: opportunities.lostReason,
      clientId: clients.id,
      clientName: clients.tradeName,
      ownerName: users.name,
      createdAt: opportunities.createdAt,
    })
    .from(opportunities)
    .innerJoin(clients, eq(clients.id, opportunities.clientId))
    .leftJoin(users, eq(users.id, opportunities.ownerId))
    .where(
      and(
        or(
          notInArray(opportunities.stage, ["order_closed", "delivered", "lost"]),
          gte(opportunities.closedAt, since),
        ),
        ...filters,
      ),
    )
    .orderBy(asc(opportunities.position), asc(opportunities.createdAt));
}

export async function listClientOpportunities(db: Db, clientId: string) {
  return db
    .select()
    .from(opportunities)
    .where(eq(opportunities.clientId, clientId))
    .orderBy(desc(opportunities.createdAt));
}
