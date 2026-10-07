import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DbHandle } from "@/db/client";
import { createTestDb } from "@/test/db";
import {
  addInteraction,
  clientInputSchema,
  createClient,
  DuplicateCnpjError,
  listClients,
  listInteractions,
  listRegions,
  updateClient,
} from "./clients";

const parse = (data: Record<string, string>) => clientInputSchema.safeParse(data);

describe("validação do cadastro de cliente", () => {
  it("normaliza CNPJ e telefones e transforma vazios em null", () => {
    const result = parse({
      tradeName: " Auto Center Fictício ",
      cnpj: "11.222.333/0001-81",
      kind: "workshop",
      phone: "(11) 3456-7890",
      whatsapp: "+55 11 91234-5678",
      region: "",
      ownerId: "",
    });
    expect(result.success && result.data).toMatchObject({
      tradeName: "Auto Center Fictício",
      cnpj: "11222333000181",
      phone: "1134567890",
      whatsapp: "11912345678",
      region: null,
      ownerId: null,
    });
  });

  it("rejeita CNPJ, telefone e tipo inválidos com mensagens em português", () => {
    const result = parse({
      tradeName: "X",
      cnpj: "11.222.333/0001-00",
      kind: "outro",
      phone: "123",
    });
    expect(result.success).toBe(false);
    const messages = result.error?.issues.map((i) => `${String(i.path[0])}: ${i.message}`);
    expect(messages).toEqual([
      "tradeName: Informe o nome fantasia (ou o nome do cliente).",
      "cnpj: CNPJ inválido.",
      "kind: Escolha o tipo de cliente.",
      "phone: Telefone inválido: informe com DDD.",
    ]);
  });
});

describe("clientes", () => {
  let handle: DbHandle;
  beforeAll(async () => {
    handle = await createTestDb();
  });
  afterAll(() => handle.close());

  const input = (extra: Record<string, string>) => {
    const result = parse({ kind: "workshop", ...extra });
    if (!result.success) throw result.error;
    return result.data;
  };

  it("cadastra, filtra por tipo/região/situação e busca por nome ou CNPJ", async () => {
    await createClient(
      handle.db,
      input({ tradeName: "Oficina Alfa", region: "Zona Norte", cnpj: "11222333000181" }),
      "prospect",
    );
    await createClient(
      handle.db,
      input({ tradeName: "Loja Beta", kind: "parts_store", region: "Centro" }),
      "active",
    );

    expect((await listClients(handle.db, { kind: "parts_store" })).map((c) => c.tradeName)).toEqual(
      ["Loja Beta"],
    );
    expect(
      (await listClients(handle.db, { region: "Zona Norte" })).map((c) => c.tradeName),
    ).toEqual(["Oficina Alfa"]);
    expect((await listClients(handle.db, { status: "active" })).map((c) => c.tradeName)).toEqual([
      "Loja Beta",
    ]);
    expect((await listClients(handle.db, { q: "alfa" })).map((c) => c.tradeName)).toEqual([
      "Oficina Alfa",
    ]);
    expect((await listClients(handle.db, { q: "11.222.333" })).map((c) => c.tradeName)).toEqual([
      "Oficina Alfa",
    ]);
    expect(await listRegions(handle.db)).toEqual(["Centro", "Zona Norte"]);
  });

  it("não permite CNPJ duplicado", async () => {
    await expect(
      createClient(
        handle.db,
        input({ tradeName: "Outra", cnpj: "11.222.333/0001-81" }),
        "prospect",
      ),
    ).rejects.toBeInstanceOf(DuplicateCnpjError);
    const [beta] = await listClients(handle.db, { q: "Beta" });
    await expect(
      updateClient(handle.db, beta.id, input({ tradeName: "Loja Beta", cnpj: "11222333000181" })),
    ).rejects.toBeInstanceOf(DuplicateCnpjError);
  });

  it("registra interações no histórico, da mais recente para a mais antiga", async () => {
    const [alfa] = await listClients(handle.db, { q: "Alfa" });
    await addInteraction(handle.db, alfa.id, null, {
      kind: "call",
      occurredAt: new Date("2026-10-01T10:00:00Z"),
      note: "Primeira ligação",
    });
    await addInteraction(handle.db, alfa.id, null, {
      kind: "visit",
      occurredAt: new Date("2026-10-05T10:00:00Z"),
      note: "Visita na oficina",
    });
    const history = await listInteractions(handle.db, alfa.id);
    expect(history.map((h) => h.note)).toEqual(["Visita na oficina", "Primeira ligação"]);
  });
});
