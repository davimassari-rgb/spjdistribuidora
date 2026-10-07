import { describe, expect, it } from "vitest";
import { isValidCnpj, normalizeCnpj, normalizePhone } from "./br";
import { formatCnpj, formatPhone } from "./format";

describe("CNPJ", () => {
  it.each(["11.222.333/0001-81", "11222333000181", "45.997.418/0001-53"])(
    "aceita numérico válido %s",
    (cnpj) => {
      expect(isValidCnpj(cnpj)).toBe(true);
    },
  );

  it("aceita o novo CNPJ alfanumérico (exemplo oficial da Receita)", () => {
    expect(isValidCnpj("12.ABC.345/01DE-35")).toBe(true);
    expect(normalizeCnpj("12.abc.345/01de-35")).toBe("12ABC34501DE35");
  });

  it.each([
    "11.222.333/0001-82",
    "00.000.000/0000-00",
    "123",
    "12.ABC.345/01DE-36",
    "AB.CDE.FGH/IJKL-MN",
  ])("rejeita %s", (cnpj) => {
    expect(isValidCnpj(cnpj)).toBe(false);
  });

  it("formata para exibição", () => {
    expect(formatCnpj("11222333000181")).toBe("11.222.333/0001-81");
    expect(formatCnpj("12ABC34501DE35")).toBe("12.ABC.345/01DE-35");
  });
});

describe("telefone", () => {
  it.each([
    ["(11) 91234-5678", "11912345678"],
    ["11 3456-7890", "1134567890"],
    ["+55 (21) 99876-5432", "21998765432"],
  ])("normaliza %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(["1234-5678", "(01) 91234-5678", "abc"])("rejeita %s", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });

  it("formata para exibição", () => {
    expect(formatPhone("11912345678")).toBe("(11) 91234-5678");
    expect(formatPhone("1134567890")).toBe("(11) 3456-7890");
  });
});
