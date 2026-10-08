import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  max,
  notInArray,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/client";
import { clients, orderItems, orders, partPriceTiers, parts, suppliers } from "@/db/schema";
import { BoardError, registerClientOrder, reorder } from "@/lib/kanban/boards";
import { ids, ORDER_STAGES, type OrderStage, TERMINAL_VISIBLE_DAYS } from "@/lib/kanban/stages";
import { salePriceCents, unitPriceForQuantity } from "@/lib/pricing";
import { isSegment, type Segment } from "@/lib/segments";
import { escapeLike, normalizeCode, normalizeForSearch } from "@/lib/text";
import { daysAgo } from "@/lib/week";

export class OrderError extends Error {}

export const PORTAL_PAGE_SIZE = 30;

// ================================================================== catálogo do portal

export type PortalProduct = {
  partId: string;
  code: string;
  description: string;
  brand: string | null;
  application: string | null;
  /** Preço de venda (com margem); null = sob consulta. */
  priceCents: number | null;
  /** Faixas de volume já com margem. */
  tiers: { minQuantity: number; priceCents: number }[];
};

/**
 * Produtos do segmento do cliente, uma linha por código (quando a mesma peça existe em mais de
 * um fornecedor, vale a oferta mais barata). O cliente nunca vê fornecedor nem custo.
 */
export async function portalCatalog(
  db: Db,
  input: { segment: Segment; markupBp: number; q?: string; brand?: string; page?: number },
) {
  const conditions: SQL[] = [
    eq(parts.active, true),
    sql`${parts.supplierId} in (select ${suppliers.id} from ${suppliers} where ${suppliers.segment} = ${input.segment})`,
  ];
  for (const term of normalizeForSearch(input.q ?? "")
    .split(" ")
    .filter(Boolean)) {
    const code = normalizeCode(term);
    const textMatch = sql`${parts.searchText} ilike ${`%${escapeLike(term)}%`}`;
    conditions.push(
      code ? sql`(${textMatch} or ${parts.codeKey} ilike ${`%${escapeLike(code)}%`})` : textMatch,
    );
  }
  if (input.brand) conditions.push(eq(parts.brand, input.brand));

  const best = db
    .selectDistinctOn([parts.codeKey], {
      partId: sql<string>`${parts.id}`.as("part_id"),
      codeKey: parts.codeKey,
      code: parts.code,
      description: parts.description,
      brand: parts.brand,
      application: parts.application,
      priceCents: parts.priceCents,
      turnoverShare: parts.turnoverShare,
    })
    .from(parts)
    .where(and(...conditions))
    .orderBy(parts.codeKey, sql`${parts.priceCents} asc nulls last`)
    .as("best");

  const page = Math.max(1, input.page ?? 1);
  const [{ total }] = await db.select({ total: count() }).from(best);
  const rows = await db
    .select()
    .from(best)
    .orderBy(sql`${best.turnoverShare} desc nulls last`, asc(best.description))
    .limit(PORTAL_PAGE_SIZE)
    .offset((page - 1) * PORTAL_PAGE_SIZE);

  const tierRows =
    rows.length === 0
      ? []
      : await db
          .select()
          .from(partPriceTiers)
          .where(
            inArray(
              partPriceTiers.partId,
              rows.map((r) => r.partId),
            ),
          )
          .orderBy(asc(partPriceTiers.minQuantity));

  const products: PortalProduct[] = rows.map((row) => ({
    partId: row.partId,
    code: row.code,
    description: row.description,
    brand: row.brand,
    application: row.application,
    priceCents: row.priceCents === null ? null : salePriceCents(row.priceCents, input.markupBp),
    tiers: tierRows
      .filter((t) => t.partId === row.partId)
      .map((t) => ({
        minQuantity: t.minQuantity,
        priceCents: salePriceCents(t.priceCents, input.markupBp),
      })),
  }));
  return { products, total, page, pageCount: Math.max(1, Math.ceil(total / PORTAL_PAGE_SIZE)) };
}

// ================================================================== envio do pedido

export const orderInputSchema = z.object({
  items: z
    .array(
      z.object({
        partId: z.uuid(),
        quantity: z.number().int().min(1, "Quantidade mínima: 1.").max(100_000),
      }),
    )
    .min(1, "O pedido está vazio.")
    .max(500),
  notes: z.string().trim().max(2000).optional(),
});
export type OrderInput = z.infer<typeof orderInputSchema>;

/**
 * Cria o pedido do cliente. Preços e disponibilidade são recalculados aqui (nunca confiamos no
 * valor vindo do navegador) e gravados como cópia, para o pedido não mudar com novas planilhas.
 */
export async function placeOrder(
  db: Db,
  input: OrderInput & { clientId: string; userId: string | null; markupBp: number },
  now = new Date(),
): Promise<{ id: string; number: number }> {
  return db.transaction(async (tx) => {
    const [client] = await tx.select().from(clients).where(eq(clients.id, input.clientId));
    if (!client || !isSegment(client.segment)) throw new OrderError("Cliente não encontrado.");

    // Soma quantidades se o mesmo produto vier repetido.
    const quantities = new Map<string, number>();
    for (const item of input.items) {
      quantities.set(item.partId, (quantities.get(item.partId) ?? 0) + item.quantity);
    }
    const found = await tx
      .select({ part: parts, supplierName: suppliers.name })
      .from(parts)
      .innerJoin(suppliers, eq(suppliers.id, parts.supplierId))
      .where(
        and(
          inArray(parts.id, [...quantities.keys()]),
          eq(parts.active, true),
          eq(suppliers.segment, client.segment),
        ),
      );
    if (found.length !== quantities.size) {
      throw new OrderError(
        "Alguns produtos do carrinho não estão mais disponíveis. Atualize a página e revise o pedido.",
      );
    }
    const tiers = await tx
      .select()
      .from(partPriceTiers)
      .where(inArray(partPriceTiers.partId, [...quantities.keys()]));

    const items = found.map(({ part, supplierName }) => {
      const quantity = quantities.get(part.id) as number;
      const partTiers = tiers.filter((t) => t.partId === part.id);
      const unitPriceCents = unitPriceForQuantity(
        { priceCents: part.priceCents, tiers: partTiers },
        quantity,
        input.markupBp,
      );
      const unitCostCents = unitPriceForQuantity(
        { priceCents: part.priceCents, tiers: partTiers },
        quantity,
        0,
      );
      return {
        partId: part.id,
        supplierId: part.supplierId,
        supplierName,
        code: part.code,
        description: part.description,
        brand: part.brand,
        quantity,
        unitPriceCents,
        unitCostCents,
      };
    });

    const [position] = await tx
      .select({ value: max(orders.position) })
      .from(orders)
      .where(eq(orders.stage, "received"));
    const [order] = await tx
      .insert(orders)
      .values({
        clientId: client.id,
        createdByUserId: input.userId,
        segment: client.segment,
        stage: "received",
        position: (position?.value ?? -1) + 1,
        notes: input.notes || null,
        totalCents: items.reduce((sum, i) => sum + (i.unitPriceCents ?? 0) * i.quantity, 0),
        hasUnpricedItems: items.some((i) => i.unitPriceCents === null),
      })
      .returning({ id: orders.id, number: orders.number });
    await tx.insert(orderItems).values(items.map((item) => ({ ...item, orderId: order.id })));
    await registerClientOrder(tx, client.id, now);
    return order;
  });
}

// ================================================================== quadro de Pedidos (equipe)

export const orderStageSchema = z.enum(ids(ORDER_STAGES));
const CLOSED: OrderStage[] = ["delivered", "canceled"];

export async function moveOrder(
  db: Db,
  input: { id: string; stage: OrderStage; index: number; reason?: string },
  now = new Date(),
): Promise<void> {
  if (input.stage === "canceled" && !input.reason)
    throw new BoardError("Informe o motivo do cancelamento.");
  await db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, input.id));
    if (!order) throw new BoardError("Pedido não encontrado.");
    const closing = CLOSED.includes(input.stage);
    await tx
      .update(orders)
      .set({
        stage: input.stage,
        cancelReason: input.stage === "canceled" ? input.reason : null,
        closedAt: closing ? (order.closedAt ?? now) : null,
      })
      .where(eq(orders.id, order.id));

    if (input.stage === "delivered" && order.stage !== "delivered") {
      // Entregue: no farmer, o cliente avança de "Pedido fechado" para "Entregue".
      await tx
        .update(clients)
        .set({ farmerStage: "delivered" })
        .where(and(eq(clients.id, order.clientId), eq(clients.farmerStage, "order_closed")));
    }

    const column = await tx
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.stage, input.stage))
      .orderBy(asc(orders.position));
    const order_ = reorder(
      column.map((c) => c.id),
      order.id,
      input.index,
    );
    for (const [position, id] of order_.entries()) {
      await tx.update(orders).set({ position }).where(eq(orders.id, id));
    }
  });
}

export async function orderBoard(db: Db, segment: Segment, now = new Date()) {
  const since = daysAgo(now, TERMINAL_VISIBLE_DAYS);
  return db
    .select({
      id: orders.id,
      number: orders.number,
      stage: orders.stage,
      totalCents: orders.totalCents,
      hasUnpricedItems: orders.hasUnpricedItems,
      cancelReason: orders.cancelReason,
      createdAt: orders.createdAt,
      clientId: clients.id,
      clientName: clients.tradeName,
      itemCount:
        sql<number>`(select count(*) from ${orderItems} where ${orderItems.orderId} = ${orders.id})`.mapWith(
          Number,
        ),
    })
    .from(orders)
    .innerJoin(clients, eq(clients.id, orders.clientId))
    .where(
      and(
        eq(orders.segment, segment),
        or(notInArray(orders.stage, CLOSED), gte(orders.closedAt, since)),
      ),
    )
    .orderBy(asc(orders.position), asc(orders.createdAt));
}

/** Pedido com itens. Com `clientId`, só devolve se o pedido for desse cliente (portal). */
export async function getOrder(db: Db, id: string, clientId?: string) {
  const [order] = await db
    .select({
      order: orders,
      clientName: clients.tradeName,
      clientWhatsapp: clients.whatsapp,
      clientAddress: clients.address,
      clientCity: clients.city,
    })
    .from(orders)
    .innerJoin(clients, eq(clients.id, orders.clientId))
    .where(and(eq(orders.id, id), clientId ? eq(orders.clientId, clientId) : undefined));
  if (!order) return null;
  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, id))
    .orderBy(asc(orderItems.supplierName), asc(orderItems.description));
  return {
    ...order.order,
    clientName: order.clientName,
    clientWhatsapp: order.clientWhatsapp,
    clientAddress: order.clientAddress,
    clientCity: order.clientCity,
    items,
  };
}

export async function listClientOrders(db: Db, clientId: string) {
  return db
    .select()
    .from(orders)
    .where(eq(orders.clientId, clientId))
    .orderBy(desc(orders.createdAt))
    .limit(100);
}

export async function countOpenOrders(db: Db, segment: Segment): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(orders)
    .where(and(eq(orders.segment, segment), eq(orders.stage, "received")));
  return row.value;
}
