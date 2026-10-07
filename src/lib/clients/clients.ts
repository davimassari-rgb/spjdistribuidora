import { and, asc, desc, eq, ilike, isNotNull, max, ne, or, type SQL, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/client";
import { clients, interactions, users } from "@/db/schema";
import { isValidCnpj, normalizeCnpj, normalizePhone } from "@/lib/br";
import {
  CLIENT_KINDS,
  CLIENT_STATUSES,
  type ClientKind,
  INTERACTION_KINDS,
  type InteractionKind,
} from "@/lib/kanban/stages";
import { escapeLike } from "@/lib/text";

// ------------------------------------------------------------------ validação (borda)

const optionalText = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .transform((v) => v || null);

const optionalPhone = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const phone = normalizePhone(v);
    if (!phone) {
      ctx.addIssue({ code: "custom", message: "Telefone inválido: informe com DDD." });
      return z.NEVER;
    }
    return phone;
  });

export const clientInputSchema = z.object({
  tradeName: z.string().trim().min(2, "Informe o nome fantasia (ou o nome do cliente).").max(200),
  legalName: optionalText,
  cnpj: z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      if (!isValidCnpj(v)) {
        ctx.addIssue({ code: "custom", message: "CNPJ inválido." });
        return z.NEVER;
      }
      return normalizeCnpj(v);
    }),
  kind: z.enum(Object.keys(CLIENT_KINDS) as [ClientKind, ...ClientKind[]], {
    error: "Escolha o tipo de cliente.",
  }),
  contactName: optionalText,
  phone: optionalPhone,
  whatsapp: optionalPhone,
  address: optionalText,
  city: optionalText,
  region: optionalText,
  ownerId: z
    .string()
    .optional()
    .transform((v) => v || null)
    .pipe(z.uuid().nullable()),
  notes: optionalText,
});
export type ClientInput = z.infer<typeof clientInputSchema>;

export const newClientStatusSchema = z.enum(["prospect", "active"]);

export const interactionInputSchema = z.object({
  kind: z.enum(Object.keys(INTERACTION_KINDS) as [InteractionKind, ...InteractionKind[]]),
  occurredAt: z.coerce.date({ error: "Data inválida." }),
  note: z.string().trim().min(1, "Escreva uma anotação.").max(5000),
});
export type InteractionInput = z.infer<typeof interactionInputSchema>;

export class DuplicateCnpjError extends Error {
  constructor() {
    super("Já existe um cliente com este CNPJ.");
  }
}

// ------------------------------------------------------------------ escrita

async function assertCnpjFree(db: Db, cnpj: string | null, exceptId?: string) {
  if (!cnpj) return;
  const rows = await db.select({ id: clients.id }).from(clients).where(eq(clients.cnpj, cnpj));
  if (rows.some((row) => row.id !== exceptId)) throw new DuplicateCnpjError();
}

async function nextPosition(db: Db, column: "prospect" | "farmer", stage: string) {
  const [row] =
    column === "prospect"
      ? await db
          .select({ value: max(clients.prospectPosition) })
          .from(clients)
          .where(eq(clients.prospectStage, stage))
      : await db
          .select({ value: max(clients.farmerPosition) })
          .from(clients)
          .where(eq(clients.farmerStage, stage));
  return (row?.value ?? -1) + 1;
}

/** Cliente novo: prospecção entra no Kanban hunter como Lead; ativo entra no farmer em "A contatar". */
export async function createClient(
  db: Db,
  input: ClientInput,
  status: "prospect" | "active",
  now = new Date(),
): Promise<{ id: string }> {
  await assertCnpjFree(db, input.cnpj);
  const stageFields =
    status === "prospect"
      ? { prospectStage: "lead", prospectPosition: await nextPosition(db, "prospect", "lead") }
      : {
          farmerStage: "to_contact",
          farmerPosition: await nextPosition(db, "farmer", "to_contact"),
          becameActiveAt: now,
        };
  const [row] = await db
    .insert(clients)
    .values({ ...input, status, ...stageFields })
    .returning({ id: clients.id });
  return row;
}

export async function updateClient(db: Db, id: string, input: ClientInput): Promise<void> {
  await assertCnpjFree(db, input.cnpj, id);
  await db.update(clients).set(input).where(eq(clients.id, id));
}

export async function deleteClient(db: Db, id: string): Promise<void> {
  await db.delete(clients).where(eq(clients.id, id));
}

export async function addInteraction(
  db: Db,
  clientId: string,
  userId: string | null,
  input: InteractionInput,
): Promise<void> {
  await db.insert(interactions).values({ clientId, userId, ...input });
}

export async function deleteInteraction(db: Db, clientId: string, interactionId: string) {
  await db
    .delete(interactions)
    .where(and(eq(interactions.id, interactionId), eq(interactions.clientId, clientId)));
}

// ------------------------------------------------------------------ leitura

export type ClientFilters = {
  q?: string;
  kind?: string;
  region?: string;
  ownerId?: string;
  status?: string;
};

export function clientFilterConditions(filters: ClientFilters): SQL[] {
  const conditions: SQL[] = [];
  if (filters.q) {
    const term = `%${escapeLike(filters.q.trim())}%`;
    const cnpjTerm = filters.q.toUpperCase().replace(/[^0-9A-Z]/g, "");
    const options = [
      ilike(clients.tradeName, term),
      ilike(clients.legalName, term),
      ilike(clients.contactName, term),
      ilike(clients.city, term),
    ];
    if (cnpjTerm.length >= 3) options.push(ilike(clients.cnpj, `%${cnpjTerm}%`));
    conditions.push(or(...options) as SQL);
  }
  if (filters.kind && filters.kind in CLIENT_KINDS) conditions.push(eq(clients.kind, filters.kind));
  if (filters.region) conditions.push(eq(clients.region, filters.region));
  if (filters.ownerId === "none") conditions.push(sql`${clients.ownerId} is null`);
  else if (filters.ownerId && z.uuid().safeParse(filters.ownerId).success) {
    conditions.push(eq(clients.ownerId, filters.ownerId));
  }
  if (filters.status && filters.status in CLIENT_STATUSES) {
    conditions.push(eq(clients.status, filters.status));
  }
  return conditions;
}

export async function listClients(db: Db, filters: ClientFilters) {
  return db
    .select({
      id: clients.id,
      tradeName: clients.tradeName,
      legalName: clients.legalName,
      cnpj: clients.cnpj,
      kind: clients.kind,
      contactName: clients.contactName,
      phone: clients.phone,
      whatsapp: clients.whatsapp,
      city: clients.city,
      region: clients.region,
      status: clients.status,
      prospectStage: clients.prospectStage,
      farmerStage: clients.farmerStage,
      lastOrderAt: clients.lastOrderAt,
      ownerName: users.name,
    })
    .from(clients)
    .leftJoin(users, eq(users.id, clients.ownerId))
    .where(and(...clientFilterConditions(filters)))
    .orderBy(asc(clients.tradeName))
    .limit(500);
}

export async function getClient(db: Db, id: string) {
  const [row] = await db
    .select({ client: clients, ownerName: users.name })
    .from(clients)
    .leftJoin(users, eq(users.id, clients.ownerId))
    .where(eq(clients.id, id));
  return row ? { ...row.client, ownerName: row.ownerName } : null;
}

export async function listInteractions(db: Db, clientId: string) {
  return db
    .select({
      id: interactions.id,
      kind: interactions.kind,
      occurredAt: interactions.occurredAt,
      note: interactions.note,
      userName: users.name,
    })
    .from(interactions)
    .leftJoin(users, eq(users.id, interactions.userId))
    .where(eq(interactions.clientId, clientId))
    .orderBy(desc(interactions.occurredAt), desc(interactions.createdAt));
}

export async function listRegions(db: Db): Promise<string[]> {
  const rows = await db
    .selectDistinct({ region: clients.region })
    .from(clients)
    .where(and(isNotNull(clients.region), ne(clients.region, "")))
    .orderBy(asc(clients.region));
  return rows.map((r) => r.region as string);
}

export async function listClientOptions(db: Db) {
  return db
    .select({ id: clients.id, tradeName: clients.tradeName, status: clients.status })
    .from(clients)
    .where(ne(clients.status, "lost"))
    .orderBy(asc(clients.tradeName));
}
