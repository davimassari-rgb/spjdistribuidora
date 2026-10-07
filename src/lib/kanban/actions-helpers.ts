import type { z } from "zod";
import { BoardError, moveSchema } from "./boards";

/** Valida a entrada de uma movimentação de card (vinda do navegador). */
export function parseMove<S extends z.ZodType<string>>(input: unknown, stageSchema: S) {
  const base = moveSchema.safeParse(input);
  const stage = stageSchema.safeParse((input as { stage?: unknown } | null)?.stage);
  if (!base.success || !stage.success) return null;
  return { ...base.data, stage: stage.data as z.infer<S> };
}

/** Converte erros de regra de negócio em mensagem para o usuário; demais erros sobem. */
export async function runMove(fn: () => Promise<void>): Promise<{ error?: string }> {
  try {
    await fn();
    return {};
  } catch (error) {
    if (error instanceof BoardError) return { error: error.message };
    throw error;
  }
}
