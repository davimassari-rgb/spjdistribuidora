import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DbHandle } from "@/db/client";
import { clients, opportunities } from "@/db/schema";
import { type ClientInput, createClient } from "@/lib/clients/clients";
import { createTestDb } from "@/test/db";
import {
  BoardError,
  createOpportunity,
  farmerBoard,
  moveFarmer,
  moveOpportunity,
  moveProspect,
  prospectBoard,
  reorder,
  rolloverFarmerWeek,
  setAlertWeeks,
} from "./boards";

const base: ClientInput = {
  tradeName: "",
  legalName: null,
  cnpj: null,
  kind: "workshop",
  contactName: null,
  phone: null,
  whatsapp: null,
  address: null,
  city: null,
  region: null,
  ownerId: null,
  notes: null,
};

describe("reorder", () => {
  it("insere na posição, removendo da posição anterior", () => {
    expect(reorder(["a", "b", "c"], "x", 1)).toEqual(["a", "x", "b", "c"]);
    expect(reorder(["a", "b", "c"], "a", 2)).toEqual(["b", "c", "a"]);
    expect(reorder(["a", "b"], "x", 99)).toEqual(["a", "b", "x"]);
  });
});

describe("Kanbans", () => {
  let handle: DbHandle;
  const getClient = async (id: string) =>
    (await handle.db.select().from(clients).where(eq(clients.id, id)))[0];

  beforeAll(async () => {
    handle = await createTestDb();
  });
  afterAll(() => handle.close());

  it("novo prospect entra como Lead no fim da coluna", async () => {
    const a = await createClient(handle.db, { ...base, tradeName: "Oficina A" }, "prospect");
    const b = await createClient(handle.db, { ...base, tradeName: "Oficina B" }, "prospect");
    const board = await prospectBoard(handle.db, []);
    expect(board.map((c) => [c.title, c.stage])).toEqual([
      ["Oficina A", "lead"],
      ["Oficina B", "lead"],
    ]);
    // Reordena dentro da mesma coluna
    await moveProspect(handle.db, { id: b.id, stage: "lead", index: 0 });
    expect((await prospectBoard(handle.db, [])).map((c) => c.title)).toEqual([
      "Oficina B",
      "Oficina A",
    ]);
    expect((await getClient(a.id)).prospectPosition).toBe(1);
  });

  it("Perdido exige motivo; Primeiro pedido converte em cliente ativo no farmer", async () => {
    const c = await createClient(
      handle.db,
      { ...base, tradeName: "Loja C", kind: "parts_store" },
      "prospect",
    );
    await expect(
      moveProspect(handle.db, { id: c.id, stage: "lost", index: 0 }),
    ).rejects.toBeInstanceOf(BoardError);
    await moveProspect(handle.db, { id: c.id, stage: "lost", index: 0, reason: "Preço" });
    expect(await getClient(c.id)).toMatchObject({ status: "lost", lostReason: "Preço" });

    const now = new Date("2026-10-07T15:00:00Z");
    await moveProspect(handle.db, { id: c.id, stage: "first_order", index: 0 }, now);
    expect(await getClient(c.id)).toMatchObject({
      status: "active",
      lostReason: null,
      farmerStage: "order_closed",
      lastOrderAt: now,
      becameActiveAt: now,
    });
    const { cards } = await farmerBoard(handle.db, [], now);
    expect(cards.map((card) => [card.title, card.stage])).toEqual([["Loja C", "order_closed"]]);

    // Voltar para uma etapa aberta desfaz a conversão
    await moveProspect(handle.db, { id: c.id, stage: "quote_sent", index: 0 });
    expect(await getClient(c.id)).toMatchObject({ status: "prospect", farmerStage: null });
  });

  it("farmer: virada de semana devolve cards para 'A contatar' (exceto cotação em andamento)", async () => {
    const monday = new Date("2026-10-05T12:00:00-03:00");
    const ids: Record<string, string> = {};
    for (const name of ["F1", "F2", "F3", "F4"]) {
      ids[name] = (
        await createClient(handle.db, { ...base, tradeName: name }, "active", monday)
      ).id;
    }
    // Primeira execução só registra a semana
    expect(await rolloverFarmerWeek(handle.db, monday)).toBe(false);

    await moveFarmer(handle.db, { id: ids.F1, stage: "contacted", index: 0 }, monday);
    await moveFarmer(handle.db, { id: ids.F2, stage: "quoting", index: 0 }, monday);
    await moveFarmer(handle.db, { id: ids.F3, stage: "order_closed", index: 0 }, monday);
    await moveFarmer(handle.db, { id: ids.F4, stage: "delivered", index: 0 }, monday);
    expect((await getClient(ids.F3)).lastOrderAt).toEqual(monday);

    // Mesma semana: nada muda
    expect(await rolloverFarmerWeek(handle.db, new Date("2026-10-11T22:00:00-03:00"))).toBe(false);
    expect((await getClient(ids.F1)).farmerStage).toBe("contacted");

    // Segunda-feira seguinte
    expect(await rolloverFarmerWeek(handle.db, new Date("2026-10-12T08:00:00-03:00"))).toBe(true);
    expect((await getClient(ids.F1)).farmerStage).toBe("to_contact");
    expect((await getClient(ids.F2)).farmerStage).toBe("quoting");
    expect((await getClient(ids.F3)).farmerStage).toBe("to_contact");
    expect((await getClient(ids.F4)).farmerStage).toBe("to_contact");
  });

  it("farmer: destaca clientes há X semanas ou mais sem pedido", async () => {
    await setAlertWeeks(handle.db, 2);
    const later = new Date("2026-10-30T12:00:00-03:00");
    const { cards, alertWeeks } = await farmerBoard(handle.db, [], later);
    expect(alertWeeks).toBe(2);
    const byName = Object.fromEntries(cards.map((card) => [card.title, card]));
    expect(byName.F3).toMatchObject({ weeksWithoutOrder: 3, alert: true });
    expect(byName.F1).toMatchObject({ alert: true }); // nunca pediu: conta desde que virou cliente
  });

  it("comercial: pedido fechado de um prospect o converte e atualiza o farmer", async () => {
    const p = await createClient(handle.db, { ...base, tradeName: "Prospect P" }, "prospect");
    const opp = await createOpportunity(handle.db, {
      clientId: p.id,
      title: "Kit embreagem",
      valueCents: 45_000,
      ownerId: null,
      notes: null,
    });
    await expect(
      moveOpportunity(handle.db, { id: opp.id, stage: "lost", index: 0 }),
    ).rejects.toThrow(/motivo/);
    const now = new Date("2026-10-08T10:00:00Z");
    await moveOpportunity(handle.db, { id: opp.id, stage: "order_closed", index: 0 }, now);

    const [saved] = await handle.db
      .select()
      .from(opportunities)
      .where(eq(opportunities.id, opp.id));
    expect(saved).toMatchObject({ stage: "order_closed", closedAt: now });
    expect(await getClient(p.id)).toMatchObject({
      status: "active",
      prospectStage: "first_order",
      farmerStage: "order_closed",
      lastOrderAt: now,
    });

    // Reabrir a demanda limpa a data de fechamento
    await moveOpportunity(handle.db, { id: opp.id, stage: "quote_sent", index: 0 }, now);
    const [reopened] = await handle.db
      .select()
      .from(opportunities)
      .where(eq(opportunities.id, opp.id));
    expect(reopened.closedAt).toBeNull();
  });

  it("comercial: pedido de cliente ativo que estava 'A contatar' vai para 'Pedido fechado'", async () => {
    const c = await createClient(handle.db, { ...base, tradeName: "Ativo X" }, "active");
    const opp = await createOpportunity(handle.db, {
      clientId: c.id,
      title: "Pastilhas",
      valueCents: null,
      ownerId: null,
      notes: null,
    });
    await moveOpportunity(handle.db, { id: opp.id, stage: "delivered", index: 0 });
    expect((await getClient(c.id)).farmerStage).toBe("order_closed");
  });
});
