import { read, utils, type WorkBook } from "xlsx";
import { cleanText } from "@/lib/text";

// Leitura de planilhas (.xlsx, .xls, .ods e .csv) em uma matriz de células.
// Usa SheetJS do CDN oficial (a versão do registro npm está desatualizada e vulnerável).

export type CellValue = string | number | boolean | null;

export type SheetData = {
  sheetName: string;
  rows: CellValue[][];
  /** Número (1-based, como no Excel) da primeira linha de `rows`. */
  firstRowNumber: number;
};

export class SpreadsheetError extends Error {}

export const ACCEPTED_EXTENSIONS = ["xlsx", "xls", "xlsm", "ods", "csv"] as const;

export function readSpreadsheet(data: Uint8Array, fileName: string): SheetData {
  const extension = fileName.toLowerCase().split(".").pop() ?? "";
  if (!(ACCEPTED_EXTENSIONS as readonly string[]).includes(extension)) {
    throw new SpreadsheetError(
      `Formato não suportado (.${extension}). Envie ${ACCEPTED_EXTENSIONS.map((e) => `.${e}`).join(", ")}.`,
    );
  }

  let workbook: WorkBook;
  try {
    if (extension === "csv") {
      const text = decodeText(data);
      // raw: true mantém os valores como texto; "10,23" não pode virar 1023.
      workbook = read(text, { type: "string", raw: true, FS: detectDelimiter(text) });
    } else {
      workbook = read(data, { type: "array" });
    }
  } catch {
    throw new SpreadsheetError(
      "Não foi possível ler o arquivo. Verifique se é uma planilha válida.",
    );
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
  if (!sheetName || !sheet?.["!ref"]) {
    throw new SpreadsheetError("A planilha está vazia.");
  }

  const range = utils.decode_range(sheet["!ref"]);
  const rows = utils.sheet_to_json<CellValue[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: true,
  });
  if (looksLikeBinaryGarbage(rows)) {
    // SheetJS "lê" qualquer arquivo como texto; caracteres de controle indicam arquivo corrompido.
    throw new SpreadsheetError("O arquivo parece corrompido ou não é uma planilha.");
  }
  return { sheetName, rows, firstRowNumber: range.s.r + 1 };
}

function looksLikeBinaryGarbage(rows: CellValue[][]): boolean {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: é justamente o que queremos detectar
  const control = /[\u0000-\u0008\u000E-\u001F]/;
  return rows
    .slice(0, 20)
    .some((row) => row.some((cell) => typeof cell === "string" && control.test(cell)));
}

/** UTF-8 (com ou sem BOM); se não for UTF-8 válido, Windows-1252 (padrão do Excel no Brasil). */
function decodeText(data: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(data).replace(/^\uFEFF/, "");
  } catch {
    return new TextDecoder("windows-1252").decode(data);
  }
}

/**
 * Separador mais frequente nas primeiras linhas. Olhar só a primeira linha falha quando a
 * planilha começa com um título ("Tabela de preços…") acima do cabeçalho.
 */
function detectDelimiter(text: string): string {
  const lines = text
    .split(/\r?\n/, 20)
    .filter((line) => line.trim() !== "")
    .slice(0, 10);
  const candidates = [";", ",", "\t", "|"];
  let best = ",";
  let bestCount = 0;
  for (const candidate of candidates) {
    const count = lines.reduce((sum, line) => sum + line.split(candidate).length - 1, 0);
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

export function isEmptyCell(cell: CellValue | undefined): boolean {
  return cell === null || cell === undefined || cleanText(cell) === "";
}

/**
 * Índice (em `rows`) da linha de títulos: a primeira, entre as 30 iniciais, que tem pelo menos
 * metade das colunas preenchidas e só texto. Ignora linhas de título/logo acima da tabela.
 */
export function detectHeaderIndex(rows: CellValue[][]): number {
  const sample = rows.slice(0, 30);
  const filled = sample.map((row) => row.filter((cell) => !isEmptyCell(cell)));
  const max = Math.max(0, ...filled.map((cells) => cells.length));
  const minimum = Math.max(2, Math.ceil(max / 2));
  const index = filled.findIndex(
    (cells) => cells.length >= minimum && cells.every((cell) => typeof cell === "string"),
  );
  return index === -1 ? 0 : index;
}

/**
 * Rótulo de cada coluna a partir da linha de títulos. Colunas sem título viram "Coluna E";
 * títulos repetidos ganham sufixo " (2)".
 */
export function columnLabels(rows: CellValue[][], headerIndex: number): string[] {
  const width = Math.max(0, ...rows.slice(headerIndex, headerIndex + 50).map((row) => row.length));
  const header = rows[headerIndex] ?? [];
  const seen = new Map<string, number>();
  const labels: string[] = [];
  for (let col = 0; col < width; col++) {
    let label = cleanText(header[col]) || `Coluna ${utils.encode_col(col)}`;
    const count = (seen.get(label) ?? 0) + 1;
    seen.set(label, count);
    if (count > 1) label = `${label} (${count})`;
    labels.push(label);
  }
  return labels;
}
