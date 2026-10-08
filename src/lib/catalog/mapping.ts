import { z } from "zod";
import type { ColumnMapping, ImportIssue } from "@/db/schema";
import { parseMoneyToCents } from "@/lib/money";
import { cleanText, normalizeCode, normalizeForSearch } from "@/lib/text";
import { type CellValue, columnLabels, isEmptyCell, type SheetData } from "./spreadsheet";

// Mapeamento "coluna da planilha do fornecedor" → "campo do catálogo" e validação linha a linha.

export type ParsedPart = {
  rowNumber: number;
  code: string;
  codeKey: string;
  description: string;
  brand: string | null;
  application: string | null;
  priceCents: number | null;
  turnoverShare: number | null;
  tiers: { minQuantity: number; priceCents: number }[];
};

export type MappingResult = {
  items: ParsedPart[];
  issues: ImportIssue[];
  /** Linhas não vazias abaixo do cabeçalho. */
  totalRows: number;
};

export class MappingError extends Error {}

const optionalColumn = z
  .string()
  .nullish()
  .transform((v) => (v ? v : null));

export const columnMappingSchema = z.object({
  headerRow: z.coerce.number().int().min(1, "Linha de títulos inválida."),
  code: z.string().min(1, "Escolha a coluna do código."),
  description: z.string().min(1, "Escolha a coluna da descrição."),
  price: z.string().min(1, "Escolha a coluna do preço."),
  brand: optionalColumn,
  application: optionalColumn,
  turnover: optionalColumn,
  tiers: z
    .array(
      z.object({
        column: z.string().min(1),
        minQuantity: z.coerce.number().int().min(2, "A faixa deve começar em 2 unidades ou mais."),
      }),
    )
    .default([]),
}) satisfies z.ZodType<ColumnMapping, unknown>;

// Sinônimos (já normalizados: minúsculo, sem acento, sem espaços/pontuação) para sugerir o mapeamento.
const SYNONYMS: Record<
  "code" | "description" | "price" | "brand" | "application" | "turnover",
  string[]
> = {
  code: ["codigo", "cod", "codproduto", "codigoproduto", "referencia", "ref", "partnumber", "sku"],
  description: ["descricao", "descricaoproduto", "produto", "desc", "nome"],
  price: ["preco", "valor", "valordemercado", "precovenda", "precounitario", "precounit", "vlunit"],
  brand: ["marca", "linha", "fabricante"],
  application: ["aplicacao", "aplicacoes", "veiculo", "veiculos"],
  turnover: ["giro", "curva", "curvaabc", "participacao"],
};

const labelKey = (label: string) => normalizeForSearch(label).replace(/[^a-z0-9]/g, "");

/** Sugere um mapeamento a partir dos títulos das colunas (o usuário confirma na tela). */
export function guessMapping(labels: string[], headerRow: number): ColumnMapping {
  const used = new Set<string>();
  const find = (field: keyof typeof SYNONYMS): string | null => {
    const synonyms = SYNONYMS[field];
    const keys = labels.map(labelKey);
    let index = keys.findIndex((k, i) => !used.has(labels[i]) && synonyms.includes(k));
    if (index === -1) {
      index = keys.findIndex(
        (k, i) => !used.has(labels[i]) && synonyms.some((s) => k.startsWith(s)),
      );
    }
    if (index === -1) return null;
    used.add(labels[index]);
    return labels[index];
  };
  return {
    headerRow,
    code: find("code") ?? "",
    description: find("description") ?? "",
    price: find("price") ?? "",
    brand: find("brand"),
    application: find("application"),
    turnover: find("turnover"),
    tiers: [],
  };
}

/** "74 - WEGA" → "WEGA" (fornecedores prefixam a marca com o número da linha). */
export function cleanBrand(value: string): string {
  return value.replace(/^\d+\s*-\s*/, "").trim();
}

function parseShare(cell: CellValue): number | null | "invalid" {
  if (isEmptyCell(cell)) return null;
  if (typeof cell === "number") return Number.isFinite(cell) ? cell : "invalid";
  const text = cleanText(cell).replace(",", ".");
  const isPercent = text.endsWith("%");
  const value = Number(isPercent ? text.slice(0, -1) : text);
  if (!Number.isFinite(value)) return "invalid";
  return isPercent ? value / 100 : value;
}

/** Linha da planilha já com as colunas mapeadas, como texto (editável na revisão). */
export type ReviewRow = {
  row: number;
  code: string;
  description: string;
  price: string;
  brand: string;
  application: string;
  turnover: string;
  tiers: { minQuantity: number; price: string }[];
};

export const reviewRowsSchema = z
  .array(
    z.object({
      row: z.number().int().min(1),
      code: z.string().max(200),
      description: z.string().max(1000),
      price: z.string().max(100),
      brand: z.string().max(200),
      application: z.string().max(1000),
      turnover: z.string().max(100),
      tiers: z
        .array(z.object({ minQuantity: z.number().int().min(2), price: z.string().max(100) }))
        .max(20),
    }),
  )
  .max(100_000);

/** Extrai, de cada linha não vazia, os valores das colunas mapeadas (sem validar). */
export function extractRows(sheet: SheetData, mapping: ColumnMapping): ReviewRow[] {
  const headerIndex = mapping.headerRow - sheet.firstRowNumber;
  if (headerIndex < 0 || headerIndex >= sheet.rows.length) {
    throw new MappingError(`A linha de títulos ${mapping.headerRow} não existe na planilha.`);
  }
  const labels = columnLabels(sheet.rows, headerIndex);
  const indexOf = (label: string | null): number | null => {
    if (!label) return null;
    const index = labels.indexOf(label);
    if (index === -1) {
      throw new MappingError(
        `A coluna "${label}" não foi encontrada na linha ${mapping.headerRow}. Revise o mapeamento.`,
      );
    }
    return index;
  };

  const col = {
    code: indexOf(mapping.code) as number,
    description: indexOf(mapping.description) as number,
    price: indexOf(mapping.price) as number,
    brand: indexOf(mapping.brand),
    application: indexOf(mapping.application),
    turnover: indexOf(mapping.turnover),
  };
  const tierCols = mapping.tiers.map((tier) => ({
    ...tier,
    index: indexOf(tier.column) as number,
  }));
  const text = (cell: CellValue | undefined) => cleanText(cell);
  // Números viram texto no formato brasileiro ("10,23") para a revisão e o parser de preço.
  const money = (cell: CellValue | undefined) =>
    typeof cell === "number" ? String(cell).replace(".", ",") : text(cell);

  const rows: ReviewRow[] = [];
  for (let i = headerIndex + 1; i < sheet.rows.length; i++) {
    const row = sheet.rows[i];
    if (row.every((cell) => isEmptyCell(cell))) continue;
    rows.push({
      row: sheet.firstRowNumber + i,
      code: text(row[col.code]),
      description: text(row[col.description]),
      price: money(row[col.price]),
      brand: col.brand === null ? "" : cleanBrand(text(row[col.brand])),
      application: col.application === null ? "" : text(row[col.application]),
      turnover: col.turnover === null ? "" : text(row[col.turnover]),
      tiers: tierCols.map((tier) => ({
        minQuantity: tier.minQuantity,
        price: money(row[tier.index]),
      })),
    });
  }
  return rows;
}

/** Lê a planilha e valida as linhas (atalho para extractRows + validateRows). */
export function mapRows(sheet: SheetData, mapping: ColumnMapping): MappingResult {
  return validateRows(extractRows(sheet, mapping));
}

/**
 * Valida as linhas (vindas da planilha ou editadas na revisão) e produz as peças a importar.
 * Erros tiram a linha da importação; avisos importam com ressalva. Roda sempre no servidor.
 */
export function validateRows(rows: ReviewRow[]): MappingResult {
  const items: ParsedPart[] = [];
  const issues: ImportIssue[] = [];
  const firstRowByKey = new Map<string, number>();

  for (const raw of rows) {
    const rowNumber = raw.row;
    const errors: string[] = [];
    const warnings: string[] = [];

    const code = cleanText(raw.code);
    const codeKey = normalizeCode(code);
    if (!code) errors.push("código vazio");
    else if (!codeKey) errors.push(`código inválido "${code.slice(0, 40)}"`);

    const description = cleanText(raw.description);
    if (!description) errors.push("descrição vazia");

    const price = parseMoneyToCents(raw.price);
    let priceCents: number | null = null;
    if (!price.ok) errors.push(`preço inválido "${raw.price.slice(0, 40)}"`);
    else if (price.cents !== null && price.cents <= 0) errors.push("preço deve ser maior que zero");
    else if (price.cents === null) warnings.push("sem preço: importada como “Sob consulta”");
    else priceCents = price.cents;

    let turnoverShare: number | null = null;
    const share = parseShare(raw.turnover || null);
    if (share === "invalid") warnings.push(`giro inválido "${raw.turnover.slice(0, 40)}" ignorado`);
    else turnoverShare = share;

    const tiers: ParsedPart["tiers"] = [];
    for (const tier of raw.tiers) {
      const tierPrice = parseMoneyToCents(tier.price);
      if (!tierPrice.ok || (tierPrice.cents !== null && tierPrice.cents <= 0)) {
        warnings.push(
          `preço da faixa ${tier.minQuantity}+ inválido "${tier.price.slice(0, 40)}" ignorado`,
        );
      } else if (tierPrice.cents !== null) {
        tiers.push({ minQuantity: tier.minQuantity, priceCents: tierPrice.cents });
      }
    }

    if (errors.length === 0 && codeKey) {
      const firstRow = firstRowByKey.get(codeKey);
      if (firstRow !== undefined) {
        issues.push({
          row: rowNumber,
          level: "warning",
          message: `Código ${code} repetido (já aparece na linha ${firstRow}): linha ignorada.`,
        });
        continue;
      }
      firstRowByKey.set(codeKey, rowNumber);
    }

    if (errors.length > 0) {
      issues.push({
        row: rowNumber,
        level: "error",
        message: `Linha não importada: ${errors.join("; ")}.`,
      });
      continue;
    }
    for (const message of warnings) {
      issues.push({ row: rowNumber, level: "warning", message: capitalize(message) });
    }

    items.push({
      rowNumber,
      code,
      codeKey,
      description,
      brand: cleanText(raw.brand) || null,
      application: cleanText(raw.application) || null,
      priceCents,
      turnoverShare,
      tiers,
    });
  }

  return { items, issues, totalRows: rows.length };
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Texto indexado na busca do catálogo. */
export function buildSearchText(
  part: Pick<ParsedPart, "code" | "codeKey" | "description" | "brand" | "application">,
): string {
  return normalizeForSearch(
    [part.code, part.codeKey, part.description, part.brand ?? "", part.application ?? ""].join(" "),
  );
}
