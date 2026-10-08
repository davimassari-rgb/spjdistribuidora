"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db/client";
import { type ColumnMapping, type ImportIssue, suppliers } from "@/db/schema";
import { requireUser } from "@/lib/auth/current-user";
import { applyImport, ImportError, type ImportSummary } from "@/lib/catalog/import";
import { columnMappingSchema, guessMapping, MappingError, mapRows } from "@/lib/catalog/mapping";
import { getSupplier } from "@/lib/catalog/queries";
import {
  type CellValue,
  columnLabels,
  detectHeaderIndex,
  readSpreadsheet,
  SpreadsheetError,
} from "@/lib/catalog/spreadsheet";
import { type FormState, invalidForm } from "@/lib/forms";

const MAX_FILE_BYTES = 15 * 1024 * 1024;

const supplierNameSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do fornecedor.").max(80),
});

async function nameTaken(name: string, exceptId?: string) {
  const rows = await getDb()
    .select({ id: suppliers.id })
    .from(suppliers)
    .where(eq(suppliers.name, name));
  return rows.some((row) => row.id !== exceptId);
}

export async function createSupplier(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = supplierNameSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalidForm(parsed.error, formData);
  if (await nameTaken(parsed.data.name)) {
    return {
      fieldErrors: { name: "Já existe um fornecedor com este nome." },
      values: { name: parsed.data.name },
    };
  }
  await getDb().insert(suppliers).values({ name: parsed.data.name });
  revalidatePath("/fornecedores");
  return { success: `Fornecedor ${parsed.data.name} cadastrado.` };
}

export async function renameSupplier(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const id = z.uuid().safeParse(formData.get("id"));
  const parsed = supplierNameSchema.safeParse(Object.fromEntries(formData));
  if (!id.success) return { error: "Fornecedor inválido." };
  if (!parsed.success) return invalidForm(parsed.error, formData);
  if (await nameTaken(parsed.data.name, id.data)) {
    return { fieldErrors: { name: "Já existe um fornecedor com este nome." } };
  }
  await getDb().update(suppliers).set({ name: parsed.data.name }).where(eq(suppliers.id, id.data));
  revalidatePath("/fornecedores", "layout");
  return { success: "Nome atualizado." };
}

/** Exclui o fornecedor com todas as peças, faixas de preço e histórico de importações. */
export async function deleteSupplier(formData: FormData): Promise<void> {
  await requireUser();
  const id = z.uuid().parse(formData.get("id"));
  await getDb().delete(suppliers).where(eq(suppliers.id, id));
  revalidatePath("/", "layout");
  redirect("/fornecedores");
}

// ------------------------------------------------------------------ importação

type FileCheck = { ok: true; data: Uint8Array; name: string } | { ok: false; error: string };

async function readUploadedFile(formData: FormData): Promise<FileCheck> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, error: "Escolha a planilha." };
  if (file.size > MAX_FILE_BYTES) return { ok: false, error: "Arquivo maior que 15 MB." };
  return { ok: true, data: new Uint8Array(await file.arrayBuffer()), name: file.name };
}

async function supplierFrom(formData: FormData) {
  const id = z.uuid().safeParse(formData.get("supplierId"));
  return id.success ? getSupplier(getDb(), id.data) : null;
}

export type PreviewResult =
  | { ok: false; error: string }
  | {
      ok: true;
      fileName: string;
      sheetName: string;
      headerRow: number;
      labels: string[];
      /** Primeiras linhas de dados, para conferência visual. */
      sample: string[][];
      dataRowCount: number;
      mapping: ColumnMapping;
      /** true quando o mapeamento veio da última importação deste fornecedor. */
      mappingFromLastImport: boolean;
    };

/** Passo 1: lê a planilha e sugere o mapeamento de colunas (nada é gravado). */
export async function previewSpreadsheet(formData: FormData): Promise<PreviewResult> {
  await requireUser();
  const supplier = await supplierFrom(formData);
  if (!supplier) return { ok: false, error: "Fornecedor não encontrado." };
  const file = await readUploadedFile(formData);
  if (!file.ok) return file;

  try {
    const sheet = readSpreadsheet(file.data, file.name);
    const requested = Number(formData.get("headerRow"));
    const headerIndex =
      Number.isInteger(requested) && requested >= sheet.firstRowNumber
        ? requested - sheet.firstRowNumber
        : detectHeaderIndex(sheet.rows);
    const labels = columnLabels(sheet.rows, headerIndex);
    const headerRow = sheet.firstRowNumber + headerIndex;

    // Reaproveita o mapeamento salvo se todas as colunas dele ainda existirem.
    const saved = supplier.columnMapping;
    const savedStillFits =
      saved !== null &&
      [
        saved.code,
        saved.description,
        saved.price,
        saved.brand,
        saved.application,
        saved.turnover,
        ...saved.tiers.map((t) => t.column),
      ]
        .filter((c): c is string => Boolean(c))
        .every((column) => labels.includes(column));
    const mapping =
      savedStillFits && saved ? { ...saved, headerRow } : guessMapping(labels, headerRow);

    const dataRows = sheet.rows.slice(headerIndex + 1);
    return {
      ok: true,
      fileName: file.name,
      sheetName: sheet.sheetName,
      headerRow,
      labels,
      sample: dataRows.slice(0, 5).map((row) => labels.map((_, i) => cellPreview(row[i]))),
      dataRowCount: dataRows.filter((row) => row.some((c) => c !== null && String(c).trim() !== ""))
        .length,
      mapping,
      mappingFromLastImport: savedStillFits,
    };
  } catch (error) {
    if (error instanceof SpreadsheetError) return { ok: false, error: error.message };
    throw error;
  }
}

function cellPreview(cell: CellValue | undefined): string {
  if (cell === null || cell === undefined) return "";
  return String(cell).trim().slice(0, 60);
}

export type ImportResult =
  | { ok: false; error: string }
  | { ok: true; summary: ImportSummary; issues: ImportIssue[]; supplierId: string };

/** Passo 2: aplica o mapeamento e grava o catálogo do fornecedor. */
export async function importSpreadsheet(formData: FormData): Promise<ImportResult> {
  const user = await requireUser();
  const supplier = await supplierFrom(formData);
  if (!supplier) return { ok: false, error: "Fornecedor não encontrado." };
  const file = await readUploadedFile(formData);
  if (!file.ok) return file;

  let rawMapping: unknown;
  try {
    rawMapping = JSON.parse(String(formData.get("mapping") ?? ""));
  } catch {
    return { ok: false, error: "Mapeamento de colunas inválido." };
  }
  const mapping = columnMappingSchema.safeParse(rawMapping);
  if (!mapping.success) {
    return { ok: false, error: mapping.error.issues.map((i) => i.message).join(" ") };
  }

  try {
    const sheet = readSpreadsheet(file.data, file.name);
    const result = mapRows(sheet, mapping.data);
    const db = getDb();
    const summary = await applyImport(db, {
      supplierId: supplier.id,
      userId: user.id,
      fileName: file.name,
      result,
    });
    await db
      .update(suppliers)
      .set({ columnMapping: mapping.data })
      .where(eq(suppliers.id, supplier.id));
    revalidatePath("/", "layout");
    return { ok: true, summary, issues: result.issues.slice(0, 300), supplierId: supplier.id };
  } catch (error) {
    if (
      error instanceof SpreadsheetError ||
      error instanceof MappingError ||
      error instanceof ImportError
    ) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}
