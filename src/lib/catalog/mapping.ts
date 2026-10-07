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

function display(cell: CellValue): string {
  return cleanText(cell).slice(0, 40);
}

export function mapRows(sheet: SheetData, mapping: ColumnMapping): MappingResult {
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

  const items: ParsedPart[] = [];
  const issues: ImportIssue[] = [];
  const firstRowByKey = new Map<string, number>();
  let totalRows = 0;

  for (let i = headerIndex + 1; i < sheet.rows.length; i++) {
    const row = sheet.rows[i];
    if (row.every((cell) => isEmptyCell(cell))) continue;
    totalRows++;
    const rowNumber = sheet.firstRowNumber + i;
    const errors: string[] = [];
    const warnings: string[] = [];

    const code = cleanText(row[col.code]);
    const codeKey = normalizeCode(code);
    if (!code) errors.push("código vazio");
    else if (!codeKey) errors.push(`código inválido "${display(row[col.code])}"`);

    const description = cleanText(row[col.description]);
    if (!description) errors.push("descrição vazia");

    const price = parseMoneyToCents(row[col.price]);
    let priceCents: number | null = null;
    if (!price.ok) errors.push(`preço inválido "${display(row[col.price])}"`);
    else if (price.cents !== null && price.cents <= 0) errors.push("preço deve ser maior que zero");
    else if (price.cents === null) warnings.push("sem preço: importada como “Sob consulta”");
    else priceCents = price.cents;

    let turnoverShare: number | null = null;
    if (col.turnover !== null) {
      const share = parseShare(row[col.turnover]);
      if (share === "invalid")
        warnings.push(`giro inválido "${display(row[col.turnover])}" ignorado`);
      else turnoverShare = share;
    }

    const tiers: ParsedPart["tiers"] = [];
    for (const tier of tierCols) {
      const tierPrice = parseMoneyToCents(row[tier.index]);
      if (!tierPrice.ok || (tierPrice.cents !== null && tierPrice.cents <= 0)) {
        warnings.push(
          `preço da faixa ${tier.minQuantity}+ inválido "${display(row[tier.index])}" ignorado`,
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

    const brandText = col.brand === null ? "" : cleanBrand(cleanText(row[col.brand]));
    const applicationText = col.application === null ? "" : cleanText(row[col.application]);
    items.push({
      rowNumber,
      code,
      codeKey,
      description,
      brand: brandText || null,
      application: applicationText || null,
      priceCents,
      turnoverShare,
      tiers,
    });
  }

  return { items, issues, totalRows };
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
