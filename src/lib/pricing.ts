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

export { bpToPercent, percentToBp, salePriceCents, unitPriceForQuantity } from "./price-math";
