import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  ne,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import type { Db } from "@/db/client";
import { imports, partPriceTiers, parts, suppliers, users } from "@/db/schema";
import type { Segment } from "@/lib/segments";
import { escapeLike, normalizeCode, normalizeForSearch } from "@/lib/text";

export const PAGE_SIZE = 50;

export type CatalogFilters = {
  /** Segmento de distribuição: só peças de fornecedores deste segmento. */
  segment?: Segment;
  q?: string;
  supplierId?: string;
  brand?: string;
  /** "active" (padrão), "inactive" ou "all" */
  status?: string;
  page?: number;
};

export type Offer = {
  partId: string;
  supplierId: string;
  supplierName: string;
  code: string;
  priceCents: number | null;
};

export type CatalogRow = {
  id: string;
  supplierId: string;
  supplierName: string;
  code: string;
  codeKey: string;
  description: string;
  brand: string | null;
  application: string | null;
  priceCents: number | null;
  turnoverShare: number | null;
  active: boolean;
  tiers: { minQuantity: number; priceCents: number }[];
  /** A mesma peça (mesmo código normalizado) em outros fornecedores. */
  otherOffers: Offer[];
};

/** Cada termo digitado precisa aparecer na descrição/código/marca/aplicação. */
function searchConditions(q: string | undefined): SQL[] {
  const terms = normalizeForSearch(q ?? "")
    .split(" ")
    .filter(Boolean);
  return terms.map((term) => {
    const textMatch = ilike(parts.searchText, `%${escapeLike(term)}%`);
    const codeTerm = normalizeCode(term);
    // "wk-58" também encontra "WK58" (e vice-versa) pelo código normalizado.
    return codeTerm
      ? (or(textMatch, ilike(parts.codeKey, `%${escapeLike(codeTerm)}%`)) as SQL)
      : textMatch;
  });
}

/** Peça de um fornecedor do segmento. */
function inSegment(segment: Segment | undefined): SQL | undefined {
  if (!segment) return undefined;
  return sql`${parts.supplierId} in (select ${suppliers.id} from ${suppliers} where ${suppliers.segment} = ${segment})`;
}

function filterConditions(filters: CatalogFilters): SQL[] {
  const conditions = searchConditions(filters.q);
  const segment = inSegment(filters.segment);
  if (segment) conditions.push(segment);
  if (filters.supplierId) conditions.push(eq(parts.supplierId, filters.supplierId));
  if (filters.brand) conditions.push(eq(parts.brand, filters.brand));
  if (filters.status === "inactive") conditions.push(eq(parts.active, false));
  else if (filters.status !== "all") conditions.push(eq(parts.active, true));
  return conditions;
}

function pageOf(filters: { page?: number }) {
  return Math.max(1, Math.floor(filters.page ?? 1));
}

export async function searchParts(db: Db, filters: CatalogFilters) {
  const where = and(...filterConditions(filters));
  const page = pageOf(filters);

  const [{ total }] = await db.select({ total: count() }).from(parts).where(where);
  const rows = await db
    .select({
      id: parts.id,
      supplierId: parts.supplierId,
      supplierName: suppliers.name,
      code: parts.code,
      codeKey: parts.codeKey,
      description: parts.description,
      brand: parts.brand,
      application: parts.application,
      priceCents: parts.priceCents,
      turnoverShare: parts.turnoverShare,
      active: parts.active,
    })
    .from(parts)
    .innerJoin(suppliers, eq(suppliers.id, parts.supplierId))
    .where(where)
    // Mais vendidos (giro) primeiro, depois ordem alfabética.
    .orderBy(sql`${parts.turnoverShare} desc nulls last`, asc(parts.description), asc(parts.code))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const [tiers, offers] = await Promise.all([
    loadTiers(
      db,
      rows.map((r) => r.id),
    ),
    loadOffers(
      db,
      rows.map((r) => r.codeKey),
      filters.segment,
    ),
  ]);

  const result: CatalogRow[] = rows.map((row) => ({
    ...row,
    tiers: tiers.get(row.id) ?? [],
    otherOffers: (offers.get(row.codeKey) ?? []).filter((o) => o.supplierId !== row.supplierId),
  }));
  return { rows: result, total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

async function loadTiers(db: Db, partIds: string[]) {
  const map = new Map<string, { minQuantity: number; priceCents: number }[]>();
  if (partIds.length === 0) return map;
  const rows = await db
    .select()
    .from(partPriceTiers)
    .where(inArray(partPriceTiers.partId, partIds))
    .orderBy(asc(partPriceTiers.minQuantity));
  for (const row of rows) {
    const list = map.get(row.partId) ?? [];
    list.push({ minQuantity: row.minQuantity, priceCents: row.priceCents });
    map.set(row.partId, list);
  }
  return map;
}

async function loadOffers(db: Db, codeKeys: string[], segment?: Segment) {
  const map = new Map<string, Offer[]>();
  if (codeKeys.length === 0) return map;
  const rows = await db
    .select({
      partId: parts.id,
      codeKey: parts.codeKey,
      supplierId: parts.supplierId,
      supplierName: suppliers.name,
      code: parts.code,
      priceCents: parts.priceCents,
    })
    .from(parts)
    .innerJoin(suppliers, eq(suppliers.id, parts.supplierId))
    .where(
      and(
        inArray(parts.codeKey, [...new Set(codeKeys)]),
        eq(parts.active, true),
        inSegment(segment),
      ),
    )
    .orderBy(sql`${parts.priceCents} asc nulls last`);
  for (const { codeKey, ...offer } of rows) {
    const list = map.get(codeKey) ?? [];
    list.push(offer);
    map.set(codeKey, list);
  }
  return map;
}

export type ComparisonRow = {
  codeKey: string;
  description: string;
  brand: string | null;
  offers: Offer[];
  /** Diferença entre o maior e o menor preço (centavos), quando há 2+ preços. */
  spreadCents: number | null;
};

/** Peças ativas que existem em 2 ou mais fornecedores (mesmo código normalizado), lado a lado. */
export async function comparePrices(db: Db, filters: CatalogFilters) {
  const conditions = [eq(parts.active, true), ...searchConditions(filters.q)];
  const segment = inSegment(filters.segment);
  if (segment) conditions.push(segment);
  if (filters.brand) conditions.push(eq(parts.brand, filters.brand));
  const page = pageOf(filters);

  const shared = db
    .select({ codeKey: parts.codeKey })
    .from(parts)
    .where(and(...conditions))
    .groupBy(parts.codeKey)
    .having(sql`count(distinct ${parts.supplierId}) > 1`)
    .as("shared");

  const [{ total }] = await db.select({ total: count() }).from(shared);
  const keys = await db
    .select({ codeKey: shared.codeKey })
    .from(shared)
    .orderBy(asc(shared.codeKey))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const codeKeys = keys.map((k) => k.codeKey);
  const offers = await loadOffers(db, codeKeys, filters.segment);
  const details =
    codeKeys.length === 0
      ? []
      : await db
          .selectDistinctOn([parts.codeKey], {
            codeKey: parts.codeKey,
            description: parts.description,
            brand: parts.brand,
          })
          .from(parts)
          .where(and(inArray(parts.codeKey, codeKeys), eq(parts.active, true)))
          .orderBy(parts.codeKey, desc(parts.updatedAt));
  const detailByKey = new Map(details.map((d) => [d.codeKey, d]));

  const rows: ComparisonRow[] = codeKeys.map((codeKey) => {
    const list = offers.get(codeKey) ?? [];
    const prices = list.map((o) => o.priceCents).filter((p): p is number => p !== null);
    return {
      codeKey,
      description: detailByKey.get(codeKey)?.description ?? "",
      brand: detailByKey.get(codeKey)?.brand ?? null,
      offers: list,
      spreadCents: prices.length >= 2 ? Math.max(...prices) - Math.min(...prices) : null,
    };
  });
  return { rows, total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function listBrands(
  db: Db,
  supplierId?: string,
  segment?: Segment,
): Promise<string[]> {
  const conditions = [eq(parts.active, true), isNotNull(parts.brand), ne(parts.brand, "")];
  const bySegment = inSegment(segment);
  if (bySegment) conditions.push(bySegment);
  if (supplierId) conditions.push(eq(parts.supplierId, supplierId));
  const rows = await db
    .selectDistinct({ brand: parts.brand })
    .from(parts)
    .where(and(...conditions))
    .orderBy(asc(parts.brand));
  return rows.map((r) => r.brand as string);
}

export async function listSuppliers(db: Db, segment?: Segment) {
  return db
    .select({
      id: suppliers.id,
      name: suppliers.name,
      segment: suppliers.segment,
      lastImportAt: suppliers.lastImportAt,
      activeCount: sql<number>`count(${parts.id}) filter (where ${parts.active})`.mapWith(Number),
      inactiveCount: sql<number>`count(${parts.id}) filter (where not ${parts.active})`.mapWith(
        Number,
      ),
    })
    .from(suppliers)
    .leftJoin(parts, eq(parts.supplierId, suppliers.id))
    .where(segment ? eq(suppliers.segment, segment) : undefined)
    .groupBy(suppliers.id)
    .orderBy(asc(suppliers.name));
}

export async function getSupplier(db: Db, id: string) {
  const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, id));
  return supplier ?? null;
}

/** Quantos códigos ativos existem em 2+ fornecedores. */
export async function countSharedCodes(db: Db, segment?: Segment): Promise<number> {
  const shared = db
    .select({ codeKey: parts.codeKey })
    .from(parts)
    .where(and(eq(parts.active, true), inSegment(segment)))
    .groupBy(parts.codeKey)
    .having(sql`count(distinct ${parts.supplierId}) > 1`)
    .as("shared");
  const [row] = await db.select({ total: count() }).from(shared);
  return row.total;
}

export async function listImports(db: Db, supplierId: string, limit = 10) {
  return db
    .select({
      id: imports.id,
      fileName: imports.fileName,
      createdAt: imports.createdAt,
      userName: users.name,
      totalRows: imports.totalRows,
      createdCount: imports.createdCount,
      updatedCount: imports.updatedCount,
      deactivatedCount: imports.deactivatedCount,
      errorCount: imports.errorCount,
      warningCount: imports.warningCount,
    })
    .from(imports)
    .leftJoin(users, eq(users.id, imports.userId))
    .where(eq(imports.supplierId, supplierId))
    .orderBy(desc(imports.createdAt))
    .limit(limit);
}

export async function getImport(db: Db, supplierId: string, importId: string) {
  const [row] = await db
    .select({
      id: imports.id,
      fileName: imports.fileName,
      createdAt: imports.createdAt,
      userName: users.name,
      totalRows: imports.totalRows,
      createdCount: imports.createdCount,
      updatedCount: imports.updatedCount,
      deactivatedCount: imports.deactivatedCount,
      errorCount: imports.errorCount,
      warningCount: imports.warningCount,
      issues: imports.issues,
    })
    .from(imports)
    .leftJoin(users, eq(users.id, imports.userId))
    .where(and(eq(imports.id, importId), eq(imports.supplierId, supplierId)));
  return row ?? null;
}
