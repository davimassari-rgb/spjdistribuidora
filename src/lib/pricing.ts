import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { appSettings } from "@/db/schema";
import type { Segment } from "./segments";

// Preço de venda para o cliente final = preço do fornecedor + margem % do segmento.
// A margem é guardada em pontos-base (30% = 3000) para evitar ponto flutuante.

export const DEFAULT_MARKUP_BP = 3000;
const key = (segment: Segment) => `markup_bp_${segment}`;

export async function getMarkupBp(db: Db, segment: Segment): Promise<number> {
  const [row] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, key(segment)));
  const value = Number(row?.value);
  return Number.isInteger(value) && value >= 0 ? value : DEFAULT_MARKUP_BP;
}

export async function setMarkupBp(db: Db, segment: Segment, bp: number): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key: key(segment), value: bp })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: bp } });
}

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
