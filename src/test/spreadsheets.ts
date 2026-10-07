import { type BookType, utils, write } from "xlsx";
import type { CellValue } from "@/lib/catalog/spreadsheet";

// Geradores de planilhas FICTÍCIAS para os testes (nunca usar dados reais de fornecedor).

export function buildWorkbook(rows: CellValue[][], bookType: BookType = "xlsx"): Uint8Array {
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, utils.aoa_to_sheet(rows), "Planilha");
  return new Uint8Array(write(workbook, { type: "array", bookType }));
}

/** CSV codificado em Windows-1252 (como o Excel brasileiro salva). */
export function encodeWindows1252(text: string): Uint8Array {
  return Uint8Array.from(text, (char) => {
    const code = char.charCodeAt(0);
    if (code > 255) throw new Error(`caractere fora do Latin-1: ${char}`);
    return code;
  });
}

/**
 * Mesma estrutura da planilha real do fornecedor "giro ABC": coluna sem título com a
 * participação no giro, marca no formato "NN - MARCA", códigos repetidos e itens sem preço.
 */
export const GIRO_ABC_LIKE: CellValue[][] = [
  ["Codigo", "Descrição", "Linha", "Aplicação", null, "preço"],
  [
    "FX100",
    "FILTRO DE OLEO                    ",
    "10 - MARCA ALFA",
    "CARRO A 1.0, CARRO B 1.6",
    0.0132,
    10.23,
  ],
  ["FX200", "FILTRO DE AR", "10 - MARCA ALFA", "CARRO C 2.0", 0.0098, 21.79],
  ["VL-300", "VELA DE IGNICAO", "07 - MARCA BETA", "MOTOR X 8V", 0.0071, null],
  ["FX100", "FILTRO DE OLEO", "10 - MARCA ALFA", "CARRO A 1.0, CARRO B 1.6", 0.0009, 10.23],
  [null, null, null, null, null, null],
  ["AD400", "ADITIVO RADIADOR 1L", "51 - MARCA GAMA", "PRONTO P/USO (12X1L)", 0.0001, 15.99],
  ["", "SEM CODIGO", "51 - MARCA GAMA", "", 0.0001, 9.9],
  ["PS500", "PASTILHA DE FREIO", "26 - MARCA DELTA", "", 0.0001, "abc"],
];
