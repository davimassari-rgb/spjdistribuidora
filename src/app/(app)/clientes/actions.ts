"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db/client";
import { requireUser } from "@/lib/auth/current-user";
import {
  addInteraction,
  clientInputSchema,
  createClient,
  DuplicateCnpjError,
  deleteClient,
  deleteInteraction,
  interactionInputSchema,
  newClientStatusSchema,
  updateClient,
} from "@/lib/clients/clients";
import { type FormState, formValues, invalidForm } from "@/lib/forms";
import { localDateToTimestamp } from "@/lib/week";

function revalidateClientViews() {
  for (const path of ["/clientes", "/prospeccao", "/farmer", "/comercial"]) revalidatePath(path);
}

export async function createClientAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = clientInputSchema.safeParse(Object.fromEntries(formData));
  const status = newClientStatusSchema.safeParse(formData.get("status"));
  if (!parsed.success) return invalidForm(parsed.error, formData);
  if (!status.success)
    return { error: "Escolha a situação do cliente.", values: formValues(formData) };

  let id: string;
  try {
    ({ id } = await createClient(getDb(), parsed.data, status.data));
  } catch (error) {
    if (error instanceof DuplicateCnpjError) {
      return { fieldErrors: { cnpj: error.message }, values: formValues(formData) };
    }
    throw error;
  }
  revalidateClientViews();
  redirect(`/clientes/${id}`);
}

export async function updateClientAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Cliente inválido." };
  const parsed = clientInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalidForm(parsed.error, formData);
  try {
    await updateClient(getDb(), id.data, parsed.data);
  } catch (error) {
    if (error instanceof DuplicateCnpjError) {
      return { fieldErrors: { cnpj: error.message }, values: formValues(formData) };
    }
    throw error;
  }
  revalidateClientViews();
  revalidatePath(`/clientes/${id.data}`);
  return { success: "Dados salvos." };
}

export async function deleteClientAction(formData: FormData): Promise<void> {
  await requireUser();
  const id = z.uuid().parse(formData.get("id"));
  await deleteClient(getDb(), id);
  revalidateClientViews();
  redirect("/clientes");
}

export async function addInteractionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const clientId = z.uuid().safeParse(formData.get("clientId"));
  if (!clientId.success) return { error: "Cliente inválido." };
  const parsed = interactionInputSchema.safeParse({
    kind: formData.get("kind"),
    note: formData.get("note"),
    occurredAt: localDateToTimestamp(String(formData.get("date") ?? "")) ?? undefined,
  });
  if (!parsed.success) return invalidForm(parsed.error, formData);
  await addInteraction(getDb(), clientId.data, user.id, parsed.data);
  revalidatePath(`/clientes/${clientId.data}`);
  return { success: "Interação registrada." };
}

export async function deleteInteractionAction(formData: FormData): Promise<void> {
  await requireUser();
  const clientId = z.uuid().parse(formData.get("clientId"));
  const interactionId = z.uuid().parse(formData.get("interactionId"));
  await deleteInteraction(getDb(), clientId, interactionId);
  revalidatePath(`/clientes/${clientId}`);
}
