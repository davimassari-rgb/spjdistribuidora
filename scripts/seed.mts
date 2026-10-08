// Dados FICTÍCIOS para desenvolvimento local. Nunca rode em produção.
// Uso: npm run db:seed  (com o `npm run dev` PARADO, se estiver usando PGlite)
// É idempotente: o usuário dev é criado se não existir; catálogo e clientes só se o banco estiver vazio.
import { count, eq } from "drizzle-orm";
import { createDb, resolveDatabaseUrl } from "../src/db/client";
import { clients, suppliers, users } from "../src/db/schema";
import { applyImport } from "../src/lib/catalog/import";
import type { ParsedPart } from "../src/lib/catalog/mapping";
import { addInteraction, type ClientInput, createClient } from "../src/lib/clients/clients";
import {
  createOpportunity,
  moveFarmer,
  moveOpportunity,
  moveProspect,
} from "../src/lib/kanban/boards";
import { normalizeCode } from "../src/lib/text";
import { createUser } from "../src/lib/users";

export const DEV_USER = { name: "Usuário Dev", email: "dev@spj.test", password: "spj-dev-123" };

if (process.env.NODE_ENV === "production") {
  console.error("Seed é só para desenvolvimento.");
  process.exit(1);
}

const PRODUCTS = [
  ["FILTRO DE OLEO", "MARCA ALFA"],
  ["FILTRO DE AR", "MARCA ALFA"],
  ["FILTRO DE COMBUSTIVEL", "MARCA BETA"],
  ["VELA DE IGNICAO", "MARCA GAMA"],
  ["PASTILHA DE FREIO DIANTEIRA", "MARCA DELTA"],
  ["DISCO DE FREIO", "MARCA DELTA"],
  ["AMORTECEDOR DIANTEIRO", "MARCA EPSILON"],
  ["CORREIA DENTADA", "MARCA BETA"],
  ["BOMBA D AGUA", "MARCA GAMA"],
  ["ADITIVO RADIADOR 1L", "MARCA ZETA"],
];
const CARS = ["CARRO A 1.0", "CARRO B 1.6", "PICAPE C 2.0", "SEDAN D 1.4", "HATCH E 1.0"];

function fakeParts(prefix: string, count: number, priceFactor: number): ParsedPart[] {
  return Array.from({ length: count }, (_, i) => {
    const [description, brand] = PRODUCTS[i % PRODUCTS.length];
    const code = `${prefix}${1000 + i}`;
    const base = 800 + ((i * 731) % 9000);
    return {
      rowNumber: i + 2,
      code,
      codeKey: normalizeCode(code),
      description,
      brand,
      application: `${CARS[i % CARS.length]}, ${CARS[(i + 2) % CARS.length]}`,
      priceCents: i % 17 === 0 ? null : Math.round(base * priceFactor),
      turnoverShare: 1 / (i + 5),
      tiers:
        i % 3 === 0 ? [{ minQuantity: 10, priceCents: Math.round(base * priceFactor * 0.92) }] : [],
    };
  });
}

const client = (tradeName: string, extra: Partial<ClientInput> = {}): ClientInput => ({
  tradeName,
  legalName: null,
  cnpj: null,
  kind: "workshop",
  contactName: null,
  phone: null,
  whatsapp: null,
  address: null,
  city: "São Paulo",
  region: null,
  ownerId: null,
  notes: null,
  ...extra,
});

const handle = createDb(resolveDatabaseUrl());
try {
  await handle.migrate();
  const db = handle.db;

  let [dev] = await db.select().from(users).where(eq(users.email, DEV_USER.email));
  if (!dev) {
    await createUser(db, DEV_USER);
    [dev] = await db.select().from(users).where(eq(users.email, DEV_USER.email));
  }

  const [{ value: supplierCount }] = await db.select({ value: count() }).from(suppliers);
  if (supplierCount === 0) {
    const [a, b] = await db
      .insert(suppliers)
      .values([{ name: "Fornecedor Exemplo A" }, { name: "Fornecedor Exemplo B" }])
      .returning({ id: suppliers.id });
    const partsA = fakeParts("EX", 120, 1);
    // B tem metade dos códigos em comum com A (escritos com hífen) e preços um pouco diferentes.
    const partsB = fakeParts("EX-", 60, 0.96).concat(fakeParts("BX", 40, 1.1));
    for (const [supplierId, items] of [
      [a.id, partsA],
      [b.id, partsB],
    ] as const) {
      await applyImport(db, {
        supplierId,
        userId: dev.id,
        fileName: "exemplo-ficticio.xlsx",
        result: { items, issues: [], totalRows: items.length },
      });
    }
    console.log("Catálogo fictício criado (2 fornecedores).");
  }

  const [{ value: clientCount }] = await db.select({ value: count() }).from(clients);
  if (clientCount === 0) {
    const owner = { ownerId: dev.id };
    const lead = await createClient(
      db,
      client("Oficina do Zé (exemplo)", { region: "Zona Norte", ...owner }),
      "prospect",
    );
    const contact = await createClient(
      db,
      client("Auto Center Exemplo", { region: "Zona Sul", whatsapp: "11912345678", ...owner }),
      "prospect",
    );
    await moveProspect(db, { id: contact.id, stage: "first_contact", index: 0 });
    const quote = await createClient(
      db,
      client("Loja Peças Fictícia", { kind: "parts_store", region: "Centro", ...owner }),
      "prospect",
    );
    await moveProspect(db, { id: quote.id, stage: "quote_sent", index: 0 });
    await addInteraction(db, lead.id, dev.id, {
      kind: "visit",
      occurredAt: new Date(),
      note: "Visita de apresentação (exemplo).",
    });

    const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
    const active1 = await createClient(
      db,
      client("Mecânica Modelo (exemplo)", { region: "Zona Leste", ...owner }),
      "active",
      fourWeeksAgo,
    );
    const active2 = await createClient(
      db,
      client("Distribuidora Teste Peças", { kind: "parts_store", region: "Zona Sul" }),
      "active",
    );
    await moveFarmer(db, { id: active2.id, stage: "contacted", index: 0 });

    const deal = await createOpportunity(db, {
      clientId: active1.id,
      title: "Jogo de pastilhas + discos (exemplo)",
      valueCents: 68_900,
      ownerId: dev.id,
      notes: null,
    });
    await moveOpportunity(db, { id: deal.id, stage: "quoting", index: 0 });
    await createOpportunity(db, {
      clientId: quote.id,
      title: "Filtros para revisão (exemplo)",
      valueCents: 23_450,
      ownerId: dev.id,
      notes: null,
    });
    console.log("Clientes, interações e demandas fictícias criados.");
  }

  console.log(`Seed concluído. Login: ${DEV_USER.email} / ${DEV_USER.password}`);
} finally {
  await handle.close();
}
