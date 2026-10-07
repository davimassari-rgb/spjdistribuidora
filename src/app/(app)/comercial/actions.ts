"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/client";
import { opportunities } from "@/db/schema";
import { requireUser } from "@/lib/auth/current-user";
import { type FormState, formValues, invalidForm } from "@/lib/forms";
import { parseMove, runMove } from "@/lib/kanban/actions-helpers";
import {
  BoardError,
  createOpportunity,
  moveOpportunity,
  opportunityStageSchema,
} from "@/lib/kanban/boards";
import { parseMoneyInput } from "@/lib/money";

function revalidateBoards() {
  for (const path of ["/comercial", "/prospeccao", "/farmer", "/clientes"]) revalidatePath(path);
}

const opportunitySchema = z.object({
  clientId: z.uuid({ error: "Escolha o cliente." }),
  title: z.string().trim().min(2, "Descreva a demanda (ex.: peça, aplicação).").max(300),
  value: z
    .string()
    .optional()
    .transform((v, ctx) => {
      const cents = parseMoneyInput(v ?? "");
      if (cents === "invalid" || (cents !== null && cents < 0)) {
        ctx.addIssue({ code: "custom", message: "Valor inválido. Ex.: 1.234,56" });
        return z.NEVER;
      }
      return cents;
    }),
  ownerId: z
    .string()
    .optional()
    .transform((v) => v || null)
    .pipe(z.uuid().nullable()),
  notes: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => v || null),
});

export async function createOpportunityAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  const parsed = opportunitySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalidForm(parsed.error, formData);
  const { value, ...rest } = parsed.data;
  try {
    await createOpportunity(getDb(), { ...rest, valueCents: value });
  } catch (error) {
    if (error instanceof BoardError) return { error: error.message, values: formValues(formData) };
    throw error;
  }
  revalidateBoards();
  return { success: "Demanda criada em “Solicitação”." };
}

export async function moveOpportunityAction(input: unknown): Promise<{ error?: string }> {
  await requireUser();
  const move = parseMove(input, opportunityStageSchema);
  if (!move) return { error: "Movimento inválido." };
  const result = await runMove(() => moveOpportunity(getDb(), move));
  revalidateBoards();
  return result;
}

export async function deleteOpportunityAction(formData: FormData): Promise<void> {
  await requireUser();
  const id = z.uuid().parse(formData.get("id"));
  await getDb().delete(opportunities).where(eq(opportunities.id, id));
  revalidateBoards();
}
