import { describe, expect, it } from "vitest";
import { parseMoneyToCents } from "./money";

const cents = (value: unknown) => {
  const result = parseMoneyToCents(value);
  return result.ok ? result.cents : "invalid";
};

describe("parseMoneyToCents", () => {
  it.each([
    [10.23, 1023],
    [0.1 + 0.2, 30], // ruído de ponto flutuante não vaza
    [1.005, 101], // arredonda meio para cima
    [718.95, 71895],
    [12, 1200],
  ])("número %s → %s centavos", (input, expected) => {
    expect(cents(input)).toBe(expected);
  });

  it.each([
    ["10,23", 1023],
    ["R$ 1.234,56", 123456],
    ["R$1.234.567,8", 123456780],
    ["1,234.56", 123456],
    ["10.23", 1023],
    ["10,5", 1050],
    ["1.234", 123400],
    ["1234", 123400],
    [" 15,99 ", 1599],
    ["0,019", 2],
  ])("texto %j → %s centavos", (input, expected) => {
    expect(cents(input)).toBe(expected);
  });

  it.each([null, undefined, "", "  ", "-"])("vazio %j → null (sem preço)", (input) => {
    expect(cents(input)).toBeNull();
  });

  it.each(["abc", "10,00,00.5,1", "R$ dez", "1e5", Number.NaN, true])("rejeita %j", (input) => {
    expect(cents(input)).toBe("invalid");
  });
});
