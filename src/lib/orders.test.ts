import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DbHandle } from "@/db/client";
import { clients, orderItems, parts, suppliers } from "@/db/schema";
import { applyImport } from "@/lib/catalog/import";
import type { ParsedPart } from "@/lib/catalog/mapping";
import { type ClientInput, createClient } from "@/lib/clients/clients";
import { createTestDb } from "@/test/db";
import {
  getOrder,
  listClientOrders,
  moveOrder,
  OrderError,
  orderBoard,
  placeOrder,
  portalCatalog,
} from "./orders";

const part = (
  code: string,
  priceCents: number | null,
  extra: Partial<ParsedPart> = {},
): ParsedPart => ({
  rowNumber: 2,
  code,
  codeKey: code,
  description: `Produto ${code}`,
  brand: "MARCA",
  application: null,
  priceCents,
  turnoverShare: null,
  tiers: [],
  ...extra,
});

const clientInput = (tradeName: string, kind: string): ClientInput => ({
  tradeName,
  kind,
  legalName: null,
  cnpj: null,
  contactName: null,
  phone: null,
  whatsapp: null,
  address: null,
  city: null,
  region: null,
  ownerId: null,
  notes: null,
});

describe("portal do cliente e pedidos", () => {
  let handle: DbHandle;
  let salonId: string;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    handle = await createTestDb();
    const db = handle.db;
    const [a, b, food] = await db
      .insert(suppliers)
      .values([
        { name: "Cosméticos A", segment: "cosmetics" },
        { name: "Cosméticos B", segment: "cosmetics" },
        { name: "Alimentos", segment: "food" },
      ])
      .returning({ id: suppliers.id });
    const load = (supplierId: string, items: ParsedPart[]) =>
      applyImport(db, {
        supplierId,
        userId: null,
        fileName: "x",
        result: { items, issues: [], totalRows: items.length },
      });
    await load(a.id, [
      part("BATOM1", 2000, { tiers: [{ minQuantity: 10, priceCents: 1800 }] }),
      part("BASE1", null),
    ]);
    await load(b.id, [part("BATOM1", 1900)]); // mesma referência, mais barata em B
    await load(food.id, [part("ARROZ5", 2500)]);
    for (const row of await db.select().from(parts)) ids[`${row.code}:${row.supplierId}`] = row.id;
    ids.batomA = ids[`BATOM1:${a.id}`];
    ids.batomB = ids[`BATOM1:${b.id}`];
    ids.base = ids[`BASE1:${a.id}`];
    ids.arroz = ids[`ARROZ5:${food.id}`];

    salonId = (
      await createClient(
        db,
        clientInput("Salão Teste", "beauty_salon"),
        "prospect",
        new Date(),
        "cosmetics",
      )
    ).id;
  });
  afterAll(() => handle.close());

  it("catálogo do portal: só o segmento do cliente, uma linha por código, preço com margem", async () => {
    const { products } = await portalCatalog(handle.db, { segment: "cosmetics", markupBp: 5000 });
    expect(products.map((p) => [p.code, p.priceCents])).toEqual([
      ["BASE1", null],
      ["BATOM1", 2850], // oferta mais barata (19,00) + 50%
    ]);
    expect(products.find((p) => p.code === "BATOM1")?.partId).toBe(ids.batomB);
    expect(JSON.stringify(products)).not.toContain("Cosméticos"); // fornecedor não aparece
  });

  it("recusa produto de outro segmento ou inativo", async () => {
    await expect(
      placeOrder(handle.db, {
        clientId: salonId,
        userId: null,
        markupBp: 0,
        items: [{ partId: ids.arroz, quantity: 1 }],
      }),
    ).rejects.toBeInstanceOf(OrderError);
  });

  it("cria o pedido recalculando preços (com faixa de volume) e ativa o cliente", async () => {
    const now = new Date("2026-10-08T12:00:00Z");
    const order = await placeOrder(
      handle.db,
      {
        clientId: salonId,
        userId: null,
        markupBp: 1000,
        notes: "Entregar pela manhã",
        items: [
          { partId: ids.batomA, quantity: 6 },
          { partId: ids.batomA, quantity: 6 }, // repetido: soma 12, entra na faixa 10+
          { partId: ids.base, quantity: 2 },
        ],
      },
      now,
    );
    const saved = await getOrder(handle.db, order.id);
    expect(saved).toMatchObject({
      stage: "received",
      hasUnpricedItems: true,
      totalCents: 12 * 1980,
    });
    expect(
      saved?.items.map((i) => [i.code, i.quantity, i.unitPriceCents, i.unitCostCents]),
    ).toEqual([
      ["BASE1", 2, null, null],
      ["BATOM1", 12, 1980, 1800],
    ]);
    const [client] = await handle.db.select().from(clients).where(eq(clients.id, salonId));
    expect(client).toMatchObject({
      status: "active",
      farmerStage: "order_closed",
      lastOrderAt: now,
    });
    expect((await listClientOrders(handle.db, salonId)).map((o) => o.number)).toEqual([
      order.number,
    ]);
    // Outro cliente não enxerga o pedido
    expect(await getOrder(handle.db, order.id, "00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  it("quadro de pedidos: move até entregue e exige motivo para cancelar", async () => {
    const [order] = await orderBoard(handle.db, "cosmetics");
    await moveOrder(handle.db, { id: order.id, stage: "purchased", index: 0 });
    await expect(
      moveOrder(handle.db, { id: order.id, stage: "canceled", index: 0 }),
    ).rejects.toThrow(/motivo/);
    await moveOrder(handle.db, { id: order.id, stage: "delivered", index: 0 });
    const [client] = await handle.db.select().from(clients).where(eq(clients.id, salonId));
    expect(client.farmerStage).toBe("delivered");
    expect(await orderBoard(handle.db, "food")).toEqual([]);
    expect(await handle.db.select().from(orderItems)).toHaveLength(2);
  });
});
