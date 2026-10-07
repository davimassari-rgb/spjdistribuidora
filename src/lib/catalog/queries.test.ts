import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DbHandle } from "@/db/client";
import { suppliers } from "@/db/schema";
import { createTestDb } from "@/test/db";
import { applyImport } from "./import";
import type { ParsedPart } from "./mapping";
import { comparePrices, countSharedCodes, listBrands, listSuppliers, searchParts } from "./queries";

function part(
  code: string,
  description: string,
  priceCents: number | null,
  extra: Partial<ParsedPart> = {},
): ParsedPart {
  return {
    rowNumber: 2,
    code,
    codeKey: code.toUpperCase().replace(/[^A-Z0-9]/g, ""),
    description,
    brand: "MARCA ALFA",
    application: null,
    priceCents,
    turnoverShare: null,
    tiers: [],
    ...extra,
  };
}

describe("consultas do catálogo", () => {
  let handle: DbHandle;
  let supplierA: string;
  let supplierB: string;

  beforeAll(async () => {
    handle = await createTestDb();
    const rows = await handle.db
      .insert(suppliers)
      .values([{ name: "Fornecedor A" }, { name: "Fornecedor B" }])
      .returning({ id: suppliers.id });
    [supplierA, supplierB] = rows.map((r) => r.id);

    const importParts = (supplierId: string, items: ParsedPart[]) =>
      applyImport(handle.db, {
        supplierId,
        userId: null,
        fileName: "x.xlsx",
        result: { items, issues: [], totalRows: items.length },
      });
    await importParts(supplierA, [
      part("WK58", "Filtro de Combustível", 1028, {
        turnoverShare: 0.5,
        tiers: [{ minQuantity: 10, priceCents: 990 }],
      }),
      part("WO120", "Filtro de Óleo", 1042, { turnoverShare: 0.9 }),
      part("BKR7", "Vela de ignição", null, { brand: "MARCA BETA" }),
    ]);
    await importParts(supplierB, [
      part("WK-58", "FILTRO COMBUSTIVEL", 995),
      part("ZZ1", "Pastilha de freio", 4500),
    ]);
  });
  afterAll(() => handle.close());

  it("busca sem acento, por vários termos, e ordena pelo giro", async () => {
    const result = await searchParts(handle.db, { q: "filtro oleo" });
    expect(result.rows.map((r) => r.code)).toEqual(["WO120"]);

    const all = await searchParts(handle.db, { q: "filtro" });
    expect(all.rows.map((r) => r.code)).toEqual(["WO120", "WK58", "WK-58"]);
  });

  it("encontra pelo código com ou sem pontuação", async () => {
    const result = await searchParts(handle.db, { q: "wk-58" });
    expect(result.rows.map((r) => r.supplierName).sort()).toEqual(["Fornecedor A", "Fornecedor B"]);
    const result2 = await searchParts(handle.db, { q: "WK58" });
    expect(result2.total).toBe(2);
  });

  it("traz faixas de volume e o preço da mesma peça no outro fornecedor", async () => {
    const { rows } = await searchParts(handle.db, { q: "wk58", supplierId: supplierA });
    expect(rows).toHaveLength(1);
    expect(rows[0].tiers).toEqual([{ minQuantity: 10, priceCents: 990 }]);
    expect(rows[0].otherOffers).toMatchObject([{ supplierName: "Fornecedor B", priceCents: 995 }]);
  });

  it("filtra por marca e lista marcas", async () => {
    expect((await searchParts(handle.db, { brand: "MARCA BETA" })).rows.map((r) => r.code)).toEqual(
      ["BKR7"],
    );
    expect(await listBrands(handle.db)).toEqual(["MARCA ALFA", "MARCA BETA"]);
  });

  it("compara preços lado a lado só das peças presentes em 2+ fornecedores", async () => {
    const { rows, total } = await comparePrices(handle.db, {});
    expect(total).toBe(1);
    expect(rows[0]).toMatchObject({ codeKey: "WK58", spreadCents: 33 });
    expect(rows[0].offers.map((o) => [o.supplierName, o.priceCents])).toEqual([
      ["Fornecedor B", 995],
      ["Fornecedor A", 1028],
    ]);
    expect(await countSharedCodes(handle.db)).toBe(1);
  });

  it("lista fornecedores com contagem de peças", async () => {
    const list = await listSuppliers(handle.db);
    expect(list.map((s) => [s.name, s.activeCount, s.inactiveCount])).toEqual([
      ["Fornecedor A", 3, 0],
      ["Fornecedor B", 2, 0],
    ]);
  });
});
