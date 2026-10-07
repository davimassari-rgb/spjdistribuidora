"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/client";
import { requireUser } from "@/lib/auth/current-user";
import { parseMove, runMove } from "@/lib/kanban/actions-helpers";
import { farmerStageSchema, moveFarmer, setAlertWeeks } from "@/lib/kanban/boards";

export async function moveFarmerAction(input: unknown): Promise<{ error?: string }> {
  await requireUser();
  const move = parseMove(input, farmerStageSchema);
  if (!move) return { error: "Movimento inválido." };
  const result = await runMove(() => moveFarmer(getDb(), move));
  revalidatePath("/farmer");
  revalidatePath(`/clientes/${move.id}`);
  return result;
}

export async function setAlertWeeksAction(formData: FormData): Promise<void> {
  await requireUser();
  const weeks = z.coerce.number().int().min(1).max(52).safeParse(formData.get("weeks"));
  if (!weeks.success) return;
  await setAlertWeeks(getDb(), weeks.data);
  revalidatePath("/farmer");
}
