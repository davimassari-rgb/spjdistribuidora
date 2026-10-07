"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { requireUser } from "@/lib/auth/current-user";
import { parseMove, runMove } from "@/lib/kanban/actions-helpers";
import { moveProspect, prospectStageSchema } from "@/lib/kanban/boards";

export async function moveProspectAction(input: unknown): Promise<{ error?: string }> {
  await requireUser();
  const move = parseMove(input, prospectStageSchema);
  if (!move) return { error: "Movimento inválido." };
  const result = await runMove(() => moveProspect(getDb(), move));
  revalidatePath("/prospeccao");
  revalidatePath("/farmer");
  revalidatePath(`/clientes/${move.id}`);
  return result;
}
