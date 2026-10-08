"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { ColumnMapping } from "@/db/schema";
import {
  type ImportResult,
  type PreviewResult,
  previewSpreadsheet,
  type ReviewResult,
  reviewSpreadsheet,
} from "../../actions";
import { IssuesTable } from "../issues-table";
import { ReviewStep } from "./review-step";

type Preview = Extract<PreviewResult, { ok: true }>;
type Imported = Extract<ImportResult, { ok: true }>;
type Review = Extract<ReviewResult, { ok: true }>;

const FIELDS: {
  key: "code" | "description" | "price" | "brand" | "application" | "turnover";
  label: string;
  required: boolean;
  hint?: string;
}[] = [
  { key: "code", label: "Código da peça", required: true },
  { key: "description", label: "Descrição", required: true },
  {
    key: "price",
    label: "Preço",
    required: true,
    hint: "Linhas sem preço entram como “Sob consulta”.",
  },
  { key: "brand", label: "Marca", required: false, hint: "“74 - WEGA” vira “WEGA”." },
  { key: "application", label: "Aplicação", required: false },
  {
    key: "turnover",
    label: "Giro / curva ABC",
    required: false,
    hint: "Usado para ordenar os mais vendidos primeiro.",
  },
];

export function ImportWizard({
  supplierId,
  supplierName,
}: {
  supplierId: string;
  supplierName: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [headerRow, setHeaderRow] = useState<string>("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [result, setResult] = useState<Imported | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function baseForm() {
    const data = new FormData();
    data.set("supplierId", supplierId);
    if (file) data.set("file", file);
    return data;
  }

  function readFile(overrideHeaderRow?: string) {
    if (!file) return setError("Escolha a planilha.");
    setError(null);
    setResult(null);
    const data = baseForm();
    if (overrideHeaderRow) data.set("headerRow", overrideHeaderRow);
    startTransition(async () => {
      const response = await previewSpreadsheet(data);
      if (!response.ok) {
        setError(response.error);
        setPreview(null);
        return;
      }
      setPreview(response);
      setMapping(response.mapping);
      setHeaderRow(String(response.headerRow));
    });
  }

  function startReview() {
    if (!mapping) return;
    setError(null);
    const data = baseForm();
    data.set("mapping", JSON.stringify(mapping));
    startTransition(async () => {
      const response = await reviewSpreadsheet(data);
      if (!response.ok) return setError(response.error);
      setReview(response);
    });
  }

  const update = (changes: Partial<ColumnMapping>) =>
    setMapping((m) => (m ? { ...m, ...changes } : m));
  const missingRequired = mapping ? FIELDS.filter((f) => f.required && !mapping[f.key]) : [];

  if (review && !result) {
    return (
      <ReviewStep
        supplierId={supplierId}
        supplierName={supplierName}
        fileName={review.fileName}
        initialRows={review.rows}
        initialIssues={review.issues}
        onBack={() => setReview(null)}
        onImported={(imported) => {
          setResult(imported);
          setReview(null);
          setPreview(null);
        }}
      />
    );
  }

  if (result) {
    const s = result.summary;
    return (
      <div className="space-y-4">
        <div className="card p-4">
          <h2 className="mb-3 font-semibold text-green-700">Importação concluída</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Linhas lidas" value={s.totalRows} />
            <Stat label="Peças novas" value={s.createdCount} />
            <Stat label="Atualizadas" value={s.updatedCount} />
            <Stat label="Indisponíveis" value={s.deactivatedCount} hint="Sumiram da planilha" />
            <Stat label="Erros" value={s.errorCount} tone={s.errorCount ? "red" : undefined} />
            <Stat
              label="Avisos"
              value={s.warningCount}
              tone={s.warningCount ? "amber" : undefined}
            />
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link className="btn-primary" href={`/fornecedores/${supplierId}`}>
              Ver peças de {supplierName}
            </Link>
            <Link
              className="btn-secondary"
              href={`/fornecedores/${supplierId}/importacoes/${s.importId}`}
            >
              Relatório completo
            </Link>
          </div>
        </div>
        {result.issues.length > 0 && <IssuesTable issues={result.issues} />}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-3 p-4">
        <label className="label" htmlFor="file">
          Planilha do fornecedor (.xlsx, .xls, .csv, .ods)
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="file"
            type="file"
            accept=".xlsx,.xls,.xlsm,.csv,.ods"
            className="input"
            onChange={(e) => {
              setFile(e.currentTarget.files?.[0] ?? null);
              setPreview(null);
              setError(null);
            }}
          />
          <button
            type="button"
            className="btn-primary"
            disabled={!file || pending}
            onClick={() => readFile()}
          >
            {pending && !preview ? "Lendo…" : "Ler planilha"}
          </button>
        </div>
        {error && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>

      {preview && mapping && (
        <>
          <div className="card p-4">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-semibold">Conferência</h2>
                <p className="text-sm text-slate-500">
                  {preview.fileName} · aba “{preview.sheetName}” ·{" "}
                  {preview.dataRowCount.toLocaleString("pt-BR")} linhas de dados
                </p>
              </div>
              <div className="flex items-end gap-2">
                <div>
                  <label className="label" htmlFor="headerRow">
                    Linha dos títulos
                  </label>
                  <input
                    id="headerRow"
                    className="input w-24"
                    type="number"
                    min={1}
                    value={headerRow}
                    onChange={(e) => setHeaderRow(e.currentTarget.value)}
                  />
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={pending}
                  onClick={() => readFile(headerRow)}
                >
                  Reler
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    {preview.labels.map((label) => (
                      <th key={label} className="px-2 py-1 font-semibold whitespace-nowrap">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.sample.map((row, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: amostra estática
                    <tr key={i} className="border-b border-slate-100">
                      {row.map((cell, j) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: amostra estática
                        <td key={j} className="px-2 py-1 whitespace-nowrap text-slate-600">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card p-4">
            <h2 className="font-semibold">Mapeamento das colunas</h2>
            <p className="mb-4 text-sm text-slate-500">
              {preview.mappingFromLastImport
                ? "Mapeamento da última importação deste fornecedor. Confira e importe."
                : "Sugestão automática a partir dos títulos. Confira antes de importar; ele fica salvo para as próximas vezes."}
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FIELDS.map((field) => (
                <div key={field.key}>
                  <label className="label" htmlFor={`map-${field.key}`}>
                    {field.label}
                    {field.required && <span className="text-red-600"> *</span>}
                  </label>
                  <select
                    id={`map-${field.key}`}
                    className="input"
                    value={mapping[field.key] ?? ""}
                    onChange={(e) =>
                      update({ [field.key]: e.currentTarget.value || (field.required ? "" : null) })
                    }
                  >
                    <option value="">{field.required ? "Escolha…" : "(não usar)"}</option>
                    {preview.labels.map((label) => (
                      <option key={label} value={label}>
                        {label}
                      </option>
                    ))}
                  </select>
                  {field.hint && <p className="mt-1 text-xs text-slate-500">{field.hint}</p>}
                </div>
              ))}
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-semibold">Preço por volume (opcional)</h3>
              <p className="mb-2 text-xs text-slate-500">
                Para planilhas com colunas de preço por quantidade (ex.: “Preço 10+”). Cada coluna
                vale a partir da quantidade informada.
              </p>
              {mapping.tiers.map((tier, index) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: faixas são posicionais e sem id próprio
                  key={index}
                  className="mb-2 flex flex-wrap items-center gap-2"
                >
                  <select
                    className="input w-auto"
                    aria-label="Coluna da faixa"
                    value={tier.column}
                    onChange={(e) => {
                      const tiers = [...mapping.tiers];
                      tiers[index] = { ...tier, column: e.currentTarget.value };
                      update({ tiers });
                    }}
                  >
                    {preview.labels.map((label) => (
                      <option key={label} value={label}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <span className="text-sm">a partir de</span>
                  <input
                    className="input w-24"
                    type="number"
                    min={2}
                    aria-label="Quantidade mínima"
                    value={tier.minQuantity}
                    onChange={(e) => {
                      const tiers = [...mapping.tiers];
                      tiers[index] = { ...tier, minQuantity: Number(e.currentTarget.value) };
                      update({ tiers });
                    }}
                  />
                  <span className="text-sm">unidades</span>
                  <button
                    type="button"
                    className="text-sm text-red-600 hover:underline"
                    onClick={() => update({ tiers: mapping.tiers.filter((_, i) => i !== index) })}
                  >
                    remover
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn-secondary"
                onClick={() =>
                  update({
                    tiers: [
                      ...mapping.tiers,
                      { column: firstUnusedLabel(preview.labels, mapping), minQuantity: 10 },
                    ],
                  })
                }
              >
                Adicionar faixa
              </button>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                className="btn-primary"
                disabled={pending || missingRequired.length > 0}
                onClick={startReview}
              >
                {pending ? "Lendo linhas…" : "Revisar produtos antes de importar"}
              </button>
              {missingRequired.length > 0 && (
                <span className="text-sm text-red-600">
                  Escolha: {missingRequired.map((f) => f.label).join(", ")}.
                </span>
              )}
              <span className="text-xs text-slate-500">
                Peças que não estiverem nesta planilha ficam como “Indisponível”.
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Primeira coluna ainda não mapeada (a faixa nova costuma ser a próxima coluna de preço). */
function firstUnusedLabel(labels: string[], mapping: ColumnMapping): string {
  const used = new Set<string | null>([
    mapping.code,
    mapping.description,
    mapping.price,
    mapping.brand,
    mapping.application,
    mapping.turnover,
    ...mapping.tiers.map((t) => t.column),
  ]);
  return labels.find((label) => !used.has(label)) ?? labels[0] ?? "";
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: "red" | "amber";
}) {
  const color =
    tone === "red" ? "text-red-600" : tone === "amber" ? "text-amber-600" : "text-slate-900";
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className={`text-xl font-semibold ${color}`}>{value.toLocaleString("pt-BR")}</dd>
      {hint && <dd className="text-xs text-slate-400">{hint}</dd>}
    </div>
  );
}
