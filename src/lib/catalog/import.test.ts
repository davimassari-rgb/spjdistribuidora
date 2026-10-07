import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DbHandle } from "@/db/client";
import { imports, partPriceTiers, parts, suppliers } from "@/db/schema";
import { createTestDb } from "@/test/db";
import { buildWorkbook, GIRO_ABC_LIKE } from "@/test/spreadsheets";
import { applyImport, ImportError } from "./import";
import { guessMapping, mapRows } from "./mapping";
import { columnLabels, readSpreadsheet } from "./spreadsheet";

function parse(rows: unknown[][]) {
  const sheet = readSpreadsheet(buildWorkbook(rows as never), "f.xlsx");
  return mapRows(sheet, guessMapping(columnLabels(sheet.rows, 0), 1));
}

describe("applyImport", () => {
  let handle: DbHandle;
  let supplierId: string;

  beforeAll(async () => {
    handle = await createTestDb();
    const [row] = await handle.db
      .insert(suppliers)
      .values({ name: "Fornecedor Fictício" })
      .returning({ id: suppliers.id });
    supplierId = row.id;
  });
  afterAll(() => handle.close());

  const supplierParts = () =>
    handle.db.select().from(parts).where(eq(parts.supplierId, supplierId)).orderBy(parts.code);

  it("primeira importação cria as peças válidas e registra o histórico", async () => {
    const summary = await applyImport(handle.db, {
      supplierId,
      userId: null,
      fileName: "giro.xls",
      result: parse(GIRO_ABC_LIKE),
    });

    expect(summary).toMatchObject({
      totalRows: 7,
      createdCount: 4,
      updatedCount: 0,
      deactivatedCount: 0,
      errorCount: 2,
      warningCount: 2,
    });
    const rows = await supplierParts();
    expect(rows.map((p) => [p.code, p.priceCents, p.active])).toEqual([
      ["AD400", 1599, true],
      ["FX100", 1023, true],
      ["FX200", 2179, true],
      ["VL-300", null, true],
    ]);

    const [history] = await handle.db
      .select()
      .from(imports)
      .where(eq(imports.id, summary.importId));
    expect(history.issues).toHaveLength(4);
    const [supplier] = await handle.db.select().from(suppliers).where(eq(suppliers.id, supplierId));
    expect(supplier.lastImportAt).toBeInstanceOf(Date);
  });

  it("reimportação atualiza preços, cria novas e inativa as que sumiram", async () => {
    const summary = await applyImport(handle.db, {
      supplierId,
      userId: null,
      fileName: "giro-v2.xlsx",
      result: parse([
        ["Código", "Descrição", "Marca", "Preço", "Preço 10+"],
        ["FX100", "FILTRO DE OLEO", "MARCA ALFA", "11,50", "10,90"],
        ["fx-200", "FILTRO DE AR", "MARCA ALFA", "21,79", ""],
        ["NEW1", "PECA NOVA", "MARCA ALFA", "5,00", ""],
      ]),
    });
    expect(summary).toMatchObject({ createdCount: 1, updatedCount: 2, deactivatedCount: 2 });

    const rows = await supplierParts();
    const byKey = Object.fromEntries(rows.map((p) => [p.codeKey, p]));
    expect(byKey.FX100).toMatchObject({ priceCents: 1150, active: true });
    expect(byKey.FX200).toMatchObject({ code: "fx-200", active: true }); // mesma peça, código normalizado
    expect(byKey.NEW1).toMatchObject({ active: true });
    expect(byKey.AD400.active).toBe(false);
    expect(byKey["VL300"].active).toBe(false);
  });

  it("substitui as faixas de preço por volume", async () => {
    const tiers = await handle.db.select().from(partPriceTiers);
    expect(tiers.map((t) => [t.minQuantity, t.priceCents])).toEqual([]);

    // Sem "Preço 10+" mapeado automaticamente (é uma faixa), a importação acima não gravou faixas.
    const sheet = readSpreadsheet(
      buildWorkbook([
        ["Código", "Descrição", "Preço", "Preço 10+"],
        ["FX100", "FILTRO DE OLEO", "11,50", "10,90"],
      ]),
      "f.xlsx",
    );
    const mapping = {
      ...guessMapping(columnLabels(sheet.rows, 0), 1),
      tiers: [{ column: "Preço 10+", minQuantity: 10 }],
    };
    await applyImport(handle.db, {
      supplierId,
      userId: null,
      fileName: "f.xlsx",
      result: mapRows(sheet, mapping),
    });

    const saved = await handle.db.select().from(partPriceTiers);
    expect(saved.map((t) => [t.minQuantity, t.priceCents])).toEqual([[10, 1090]]);
  });

  it("não altera nada quando nenhuma linha é válida", async () => {
    const before = await supplierParts();
    await expect(
      applyImport(handle.db, {
        supplierId,
        userId: null,
        fileName: "ruim.xlsx",
        result: parse([
          ["Código", "Descrição", "Preço"],
          ["", "sem código", "1,00"],
        ]),
      }),
    ).rejects.toBeInstanceOf(ImportError);
    expect(await supplierParts()).toEqual(before);
  });
});
