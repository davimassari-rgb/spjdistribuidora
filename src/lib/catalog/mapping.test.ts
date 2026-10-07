import { describe, expect, it } from "vitest";
import type { ColumnMapping } from "@/db/schema";
import { buildWorkbook, encodeWindows1252, GIRO_ABC_LIKE } from "@/test/spreadsheets";
import { buildSearchText, cleanBrand, guessMapping, MappingError, mapRows } from "./mapping";
import { columnLabels, detectHeaderIndex, readSpreadsheet, SpreadsheetError } from "./spreadsheet";

describe("leitura de planilhas", () => {
  it("lê .xls (Excel 97-2003), detecta o cabeçalho e nomeia a coluna sem título", () => {
    const sheet = readSpreadsheet(buildWorkbook(GIRO_ABC_LIKE, "biff8"), "giro.xls");
    const header = detectHeaderIndex(sheet.rows);
    expect(header).toBe(0);
    expect(columnLabels(sheet.rows, header)).toEqual([
      "Codigo",
      "Descrição",
      "Linha",
      "Aplicação",
      "Coluna E",
      "preço",
    ]);
  });

  it("ignora linhas de título acima da tabela", () => {
    const rows = [["CATÁLOGO FORNECEDOR XYZ - OUTUBRO"], [], ...GIRO_ABC_LIKE];
    const sheet = readSpreadsheet(buildWorkbook(rows), "catalogo.xlsx");
    expect(detectHeaderIndex(sheet.rows)).toBe(2);
  });

  it("lê CSV brasileiro (ponto e vírgula, vírgula decimal, Windows-1252) sem estragar preços", () => {
    const csv =
      "Código;Descrição;Marca;Preço\r\nAB-1;Junta do cabeçote;MARCA Ç;1.234,56\r\nAB-2;Óleo;MARCA Ç;10,23\r\n";
    const sheet = readSpreadsheet(encodeWindows1252(csv), "lista.csv");
    expect(sheet.rows[0]).toEqual(["Código", "Descrição", "Marca", "Preço"]);
    const result = mapRows(sheet, {
      headerRow: 1,
      code: "Código",
      description: "Descrição",
      price: "Preço",
      brand: "Marca",
      application: null,
      turnover: null,
      tiers: [],
    });
    expect(result.items.map((i) => [i.code, i.description, i.priceCents])).toEqual([
      ["AB-1", "Junta do cabeçote", 123456],
      ["AB-2", "Óleo", 1023],
    ]);
  });

  it("detecta o separador mesmo com uma linha de título antes do cabeçalho", () => {
    const csv = [
      "Tabela de preços - Fornecedor Fictício",
      "",
      "Cód. Fabricante;Produto;Valor;Valor 10+",
      "FX-1;FILTRO;6,05;5,45",
      "FX-2;VELA;8,36;7,52",
    ].join("\r\n");
    const sheet = readSpreadsheet(encodeWindows1252(csv), "b.csv");
    expect(detectHeaderIndex(sheet.rows)).toBe(2);
    expect(sheet.rows[3]).toEqual(["FX-1", "FILTRO", "6,05", "5,45"]);
  });

  it("lê CSV UTF-8 com vírgula como separador", () => {
    const csv = '\uFEFFcodigo,descricao,preco\nX1,"Peça, com vírgula",12.5\n';
    const sheet = readSpreadsheet(new TextEncoder().encode(csv), "lista.csv");
    expect(sheet.rows[1]).toEqual(["X1", "Peça, com vírgula", "12.5"]);
  });

  it("recusa formatos não suportados e arquivos corrompidos", () => {
    expect(() => readSpreadsheet(new Uint8Array([1, 2]), "foto.png")).toThrow(SpreadsheetError);
    expect(() =>
      readSpreadsheet(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 1, 2, 3]), "x.xls"),
    ).toThrow(SpreadsheetError);
  });
});

describe("mapeamento de colunas", () => {
  const sheet = readSpreadsheet(buildWorkbook(GIRO_ABC_LIKE, "biff8"), "giro.xls");
  const labels = columnLabels(sheet.rows, 0);

  it("sugere o mapeamento a partir dos títulos", () => {
    expect(guessMapping(labels, 1)).toEqual({
      headerRow: 1,
      code: "Codigo",
      description: "Descrição",
      price: "preço",
      brand: "Linha",
      application: "Aplicação",
      turnover: null,
      tiers: [],
    });
  });

  const mapping: ColumnMapping = { ...guessMapping(labels, 1), turnover: "Coluna E" };

  it("importa linhas válidas e reporta linha a linha o que foi ignorado", () => {
    const result = mapRows(sheet, mapping);

    expect(result.totalRows).toBe(7); // a linha totalmente vazia não conta
    expect(result.items.map((i) => i.code)).toEqual(["FX100", "FX200", "VL-300", "AD400"]);

    const first = result.items[0];
    expect(first).toMatchObject({
      rowNumber: 2,
      codeKey: "FX100",
      description: "FILTRO DE OLEO", // espaços extras removidos
      brand: "MARCA ALFA", // prefixo "10 - " removido
      priceCents: 1023,
      turnoverShare: 0.0132,
    });
    expect(result.items[2]).toMatchObject({ codeKey: "VL300", priceCents: null });

    expect(result.issues).toEqual([
      { row: 4, level: "warning", message: "Sem preço: importada como “Sob consulta”" },
      {
        row: 5,
        level: "warning",
        message: "Código FX100 repetido (já aparece na linha 2): linha ignorada.",
      },
      { row: 8, level: "error", message: "Linha não importada: código vazio." },
      { row: 9, level: "error", message: 'Linha não importada: preço inválido "abc".' },
    ]);
  });

  it("lê faixas de preço por volume", () => {
    const rows = [
      ["Código", "Descrição", "Preço", "Preço 10+", "Preço 50+"],
      ["A1", "Peça A", "10,00", "9,50", "9,00"],
      ["A2", "Peça B", "20,00", "", "xx"],
    ];
    const result = mapRows(readSpreadsheet(buildWorkbook(rows), "v.xlsx"), {
      headerRow: 1,
      code: "Código",
      description: "Descrição",
      price: "Preço",
      brand: null,
      application: null,
      turnover: null,
      tiers: [
        { column: "Preço 10+", minQuantity: 10 },
        { column: "Preço 50+", minQuantity: 50 },
      ],
    });
    expect(result.items[0].tiers).toEqual([
      { minQuantity: 10, priceCents: 950 },
      { minQuantity: 50, priceCents: 900 },
    ]);
    expect(result.items[1].tiers).toEqual([]);
    expect(result.issues).toEqual([
      { row: 3, level: "warning", message: 'Preço da faixa 50+ inválido "xx" ignorado' },
    ]);
  });

  it("falha com mensagem clara se a coluna mapeada não existe mais", () => {
    expect(() => mapRows(sheet, { ...mapping, price: "Valor" })).toThrow(MappingError);
    expect(() => mapRows(sheet, { ...mapping, headerRow: 99 })).toThrow(/não existe/);
  });
});

describe("normalizações", () => {
  it("limpa a marca e monta o texto de busca sem acentos", () => {
    expect(cleanBrand("74 - WEGA")).toBe("WEGA");
    expect(cleanBrand("3M")).toBe("3M");
    expect(
      buildSearchText({
        code: "WK-58",
        codeKey: "WK58",
        description: "Filtro de Combustível",
        brand: "MANN",
        application: null,
      }),
    ).toBe("wk-58 wk58 filtro de combustivel mann");
  });
});
