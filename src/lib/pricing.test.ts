import { describe, expect, it } from "vitest";
import { percentToBp, salePriceCents, unitPriceForQuantity } from "./pricing";

describe("preço de venda", () => {
  it("aplica a margem em pontos-base sem ponto flutuante", () => {
    expect(salePriceCents(1023, 3000)).toBe(1330); // 10,23 + 30% = 13,299 → 13,30
    expect(salePriceCents(1000, 0)).toBe(1000);
    expect(salePriceCents(999, 1250)).toBe(1124); // 12,5%
  });

  it("usa a faixa de volume quando a quantidade alcança o mínimo", () => {
    const part = {
      priceCents: 1000,
      tiers: [
        { minQuantity: 10, priceCents: 900 },
        { minQuantity: 50, priceCents: 800 },
      ],
    };
    expect(unitPriceForQuantity(part, 1, 1000)).toBe(1100);
    expect(unitPriceForQuantity(part, 10, 1000)).toBe(990);
    expect(unitPriceForQuantity(part, 60, 1000)).toBe(880);
    expect(unitPriceForQuantity({ priceCents: null, tiers: [] }, 1, 1000)).toBeNull();
  });

  it("converte percentual digitado", () => {
    expect(percentToBp("30")).toBe(3000);
    expect(percentToBp("12,5")).toBe(1250);
    expect(percentToBp("-1")).toBeNull();
    expect(percentToBp("abc")).toBeNull();
  });
});
