"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { requireUser } from "@/lib/auth/current-user";
import { parseMove, runMove } from "@/lib/kanban/actions-helpers";
import { moveOrder, orderStageSchema } from "@/lib/orders";

export async function moveOrderAction(input: unknown): Promise<{ error?: string }> {
  await requireUser();
  const move = parseMove(input, orderStageSchema);
  if (!move) return { error: "Movimento inválido." };
  const result = await runMove(() => moveOrder(getDb(), move));
  revalidatePath("/pedidos", "layout");
  revalidatePath("/farmer");
  revalidatePath("/portal", "layout");
  return result;
}
