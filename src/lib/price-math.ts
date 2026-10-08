// Cálculos de preço puros (sem banco): usados no servidor e no carrinho do portal.

/** Centavos de custo → centavos de venda, arredondando para o centavo mais próximo. */
export function salePriceCents(costCents: number, markupBp: number): number {
  return Math.round((costCents * (10_000 + markupBp)) / 10_000);
}

/** Preço unitário de venda para uma quantidade, considerando faixas de volume do fornecedor. */
export function unitPriceForQuantity(
  part: { priceCents: number | null; tiers: { minQuantity: number; priceCents: number }[] },
  quantity: number,
  markupBp: number,
): number | null {
  const tier = [...part.tiers]
    .sort((a, b) => b.minQuantity - a.minQuantity)
    .find((t) => quantity >= t.minQuantity);
  const cost = tier?.priceCents ?? part.priceCents;
  return cost === null ? null : salePriceCents(cost, markupBp);
}

/** "30" / "12,5" → pontos-base. */
export function percentToBp(value: string): number | null {
  const n = Number(value.replace(",", ".").trim());
  if (!Number.isFinite(n) || n < 0 || n > 1000) return null;
  return Math.round(n * 100);
}

export function bpToPercent(bp: number): string {
  return (bp / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}
