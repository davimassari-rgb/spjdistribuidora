import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// Convenções: chaves em camelCase no TS viram snake_case no banco (casing: "snake_case").
// Dinheiro é SEMPRE inteiro em centavos (colunas *Cents). Etapas de Kanban e enums são
// `text` validados no código (src/lib/kanban/stages.ts), para ajustar etapas sem migration.

const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// ---------------------------------------------------------------- autenticação

export const users = pgTable("users", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  email: text().notNull().unique(),
  passwordHash: text().notNull(),
  createdAt: createdAt(),
});

export const sessions = pgTable("sessions", {
  // SHA-256 do token do cookie. O token em si nunca é gravado.
  id: text().primaryKey(),
  userId: uuid()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------- catálogo

export type ColumnMapping = {
  /** Linha (1 = primeira linha da planilha) onde estão os títulos das colunas. */
  headerRow: number;
  code: string;
  description: string;
  price: string;
  brand: string | null;
  application: string | null;
  turnover: string | null;
  /** Colunas de preço por volume: preço válido a partir de `minQuantity` unidades. */
  tiers: { column: string; minQuantity: number }[];
};

export type ImportIssue = {
  /** Número da linha na planilha (como o usuário vê no Excel). */
  row: number;
  level: "error" | "warning";
  message: string;
};

export const suppliers = pgTable("suppliers", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull().unique(),
  columnMapping: jsonb().$type<ColumnMapping>(),
  lastImportAt: timestamp({ withTimezone: true }),
  createdAt: createdAt(),
});

export const imports = pgTable("imports", {
  id: uuid().primaryKey().defaultRandom(),
  supplierId: uuid()
    .notNull()
    .references(() => suppliers.id, { onDelete: "cascade" }),
  userId: uuid().references(() => users.id, { onDelete: "set null" }),
  fileName: text().notNull(),
  totalRows: integer().notNull().default(0),
  createdCount: integer().notNull().default(0),
  updatedCount: integer().notNull().default(0),
  deactivatedCount: integer().notNull().default(0),
  errorCount: integer().notNull().default(0),
  warningCount: integer().notNull().default(0),
  issues: jsonb().$type<ImportIssue[]>().notNull().default([]),
  createdAt: createdAt(),
});

export const parts = pgTable(
  "parts",
  {
    id: uuid().primaryKey().defaultRandom(),
    supplierId: uuid()
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    /** Código como veio na planilha. */
    code: text().notNull(),
    /** Código normalizado (maiúsculo, só letras e números): chave de comparação entre fornecedores. */
    codeKey: text().notNull(),
    description: text().notNull(),
    brand: text(),
    application: text(),
    /** null = "sob consulta" (planilha sem preço). */
    priceCents: integer(),
    /** Participação no giro (coluna opcional da planilha). Não é dinheiro. */
    turnoverShare: doublePrecision(),
    /** Texto normalizado (minúsculo, sem acento) usado na busca. */
    searchText: text().notNull(),
    /** false = a peça sumiu da última planilha do fornecedor. */
    active: boolean().notNull().default(true),
    lastImportId: uuid().references(() => imports.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique().on(t.supplierId, t.codeKey), index().on(t.codeKey)],
);

export const partPriceTiers = pgTable(
  "part_price_tiers",
  {
    id: uuid().primaryKey().defaultRandom(),
    partId: uuid()
      .notNull()
      .references(() => parts.id, { onDelete: "cascade" }),
    minQuantity: integer().notNull(),
    priceCents: integer().notNull(),
  },
  (t) => [unique().on(t.partId, t.minQuantity)],
);

// ---------------------------------------------------------------- clientes

export const clients = pgTable(
  "clients",
  {
    id: uuid().primaryKey().defaultRandom(),
    tradeName: text().notNull(),
    legalName: text(),
    /** 14 caracteres sem pontuação (numérico ou alfanumérico, padrão 2026). */
    cnpj: text().unique(),
    /** "workshop" (oficina) | "parts_store" (loja de autopeças) */
    kind: text().notNull(),
    contactName: text(),
    /** Apenas dígitos. */
    phone: text(),
    /** Apenas dígitos. */
    whatsapp: text(),
    address: text(),
    city: text(),
    region: text(),
    ownerId: uuid().references(() => users.id, { onDelete: "set null" }),
    notes: text(),
    /** "prospect" | "active" | "lost" */
    status: text().notNull(),
    /** Etapa no Kanban de prospecção (null = cliente que não passou pela prospecção). */
    prospectStage: text(),
    prospectPosition: integer().notNull().default(0),
    lostReason: text(),
    /** Etapa no Kanban farmer (só para clientes ativos). */
    farmerStage: text(),
    farmerPosition: integer().notNull().default(0),
    becameActiveAt: timestamp({ withTimezone: true }),
    lastOrderAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.status)],
);

export const interactions = pgTable(
  "interactions",
  {
    id: uuid().primaryKey().defaultRandom(),
    clientId: uuid()
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    userId: uuid().references(() => users.id, { onDelete: "set null" }),
    occurredAt: timestamp({ withTimezone: true }).notNull(),
    /** "call" | "whatsapp" | "visit" | "email" | "other" */
    kind: text().notNull(),
    note: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.clientId)],
);

/** Kanban comercial: cada card é uma demanda/cotação de um cliente. */
export const opportunities = pgTable(
  "opportunities",
  {
    id: uuid().primaryKey().defaultRandom(),
    clientId: uuid()
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    title: text().notNull(),
    valueCents: integer(),
    stage: text().notNull(),
    position: integer().notNull().default(0),
    ownerId: uuid().references(() => users.id, { onDelete: "set null" }),
    notes: text(),
    lostReason: text(),
    closedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.stage)],
);

/** Configurações simples chave/valor (ex.: semana corrente do Kanban farmer). */
export const appSettings = pgTable("app_settings", {
  key: text().primaryKey(),
  value: jsonb().notNull(),
});
