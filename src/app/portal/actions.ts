"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { clients } from "@/db/schema";
import { requireCustomer } from "@/lib/auth/current-user";
import { OrderError, orderInputSchema, placeOrder } from "@/lib/orders";
import { getMarkupBp } from "@/lib/pricing";
import { isSegment } from "@/lib/segments";

export async function placeOrderAction(
  input: unknown,
): Promise<{ ok: true; id: string; number: number } | { ok: false; error: string }> {
  const user = await requireCustomer();
  const parsed = orderInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Pedido inválido." };
  }
  const db = getDb();
  const [client] = await db.select().from(clients).where(eq(clients.id, user.clientId));
  if (!client || !isSegment(client.segment)) return { ok: false, error: "Cliente não encontrado." };

  try {
    const order = await placeOrder(db, {
      ...parsed.data,
      clientId: client.id,
      userId: user.id,
      markupBp: await getMarkupBp(db, client.segment),
    });
    revalidatePath("/portal", "layout");
    revalidatePath("/pedidos");
    return { ok: true, ...order };
  } catch (error) {
    if (error instanceof OrderError) return { ok: false, error: error.message };
    throw error;
  }
}
