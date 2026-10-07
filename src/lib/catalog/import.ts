import { and, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { imports, partPriceTiers, parts, suppliers } from "@/db/schema";
import { buildSearchText, type MappingResult } from "./mapping";

export class ImportError extends Error {}

export type ImportSummary = {
  importId: string;
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  deactivatedCount: number;
  errorCount: number;
  warningCount: number;
};

const CHUNK_SIZE = 500;
const MAX_STORED_ISSUES = 2000;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/** Referência à coluna do registro rejeitado no ON CONFLICT (nome real, em snake_case). */
const excluded = (column: string) => sql.raw(`excluded.${column}`);

/**
 * Grava o resultado do mapeamento como o catálogo atual do fornecedor, numa única transação:
 * - peças novas são criadas e as existentes (mesmo código normalizado) são atualizadas;
 * - peças que não vieram na planilha são marcadas como inativas (não são apagadas);
 * - as faixas de preço por volume do fornecedor são substituídas pelas da planilha;
 * - a data de última atualização do fornecedor é registrada.
 * Se nenhuma linha for válida, nada é alterado (evita "zerar" o catálogo por engano).
 */
export async function applyImport(
  db: Db,
  input: { supplierId: string; userId: string | null; fileName: string; result: MappingResult },
): Promise<ImportSummary> {
  const { supplierId, userId, fileName, result } = input;
  if (result.items.length === 0) {
    throw new ImportError(
      "Nenhuma linha válida encontrada na planilha. Nada foi alterado no catálogo; revise o mapeamento das colunas.",
    );
  }

  const errorCount = result.issues.filter((issue) => issue.level === "error").length;
  const warningCount = result.issues.length - errorCount;

  return db.transaction(async (tx) => {
    const now = new Date();
    const [importRow] = await tx
      .insert(imports)
      .values({
        supplierId,
        userId,
        fileName,
        totalRows: result.totalRows,
        errorCount,
        warningCount,
        issues: result.issues.slice(0, MAX_STORED_ISSUES),
      })
      .returning({ id: imports.id });

    const existing = await tx
      .select({ codeKey: parts.codeKey })
      .from(parts)
      .where(eq(parts.supplierId, supplierId));
    const existingKeys = new Set(existing.map((row) => row.codeKey));

    const idByKey = new Map<string, string>();
    for (const batch of chunk(result.items, CHUNK_SIZE)) {
      const saved = await tx
        .insert(parts)
        .values(
          batch.map((item) => ({
            supplierId,
            code: item.code,
            codeKey: item.codeKey,
            description: item.description,
            brand: item.brand,
            application: item.application,
            priceCents: item.priceCents,
            turnoverShare: item.turnoverShare,
            searchText: buildSearchText(item),
            active: true,
            lastImportId: importRow.id,
          })),
        )
        .onConflictDoUpdate({
          target: [parts.supplierId, parts.codeKey],
          set: {
            code: excluded("code"),
            description: excluded("description"),
            brand: excluded("brand"),
            application: excluded("application"),
            priceCents: excluded("price_cents"),
            turnoverShare: excluded("turnover_share"),
            searchText: excluded("search_text"),
            active: true,
            lastImportId: importRow.id,
            updatedAt: now,
          },
        })
        .returning({ id: parts.id, codeKey: parts.codeKey });
      for (const row of saved) idByKey.set(row.codeKey, row.id);
    }

    const deactivated = await tx
      .update(parts)
      .set({ active: false, updatedAt: now })
      .where(
        and(
          eq(parts.supplierId, supplierId),
          eq(parts.active, true),
          or(isNull(parts.lastImportId), ne(parts.lastImportId, importRow.id)),
        ),
      )
      .returning({ id: parts.id });

    await tx
      .delete(partPriceTiers)
      .where(
        inArray(
          partPriceTiers.partId,
          tx.select({ id: parts.id }).from(parts).where(eq(parts.supplierId, supplierId)),
        ),
      );
    const tierRows = result.items.flatMap((item) =>
      item.tiers.map((tier) => ({
        partId: idByKey.get(item.codeKey) as string,
        minQuantity: tier.minQuantity,
        priceCents: tier.priceCents,
      })),
    );
    for (const batch of chunk(tierRows, CHUNK_SIZE)) {
      await tx.insert(partPriceTiers).values(batch);
    }

    const createdCount = result.items.filter((item) => !existingKeys.has(item.codeKey)).length;
    const summary = {
      createdCount,
      updatedCount: result.items.length - createdCount,
      deactivatedCount: deactivated.length,
    };
    await tx.update(imports).set(summary).where(eq(imports.id, importRow.id));
    await tx.update(suppliers).set({ lastImportAt: now }).where(eq(suppliers.id, supplierId));

    return {
      importId: importRow.id,
      totalRows: result.totalRows,
      errorCount,
      warningCount,
      ...summary,
    };
  });
}
